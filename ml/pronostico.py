"""Pronóstico de demanda de 7 días por producto con regresión lineal y sugerencias de reposición y de riesgo de vencimiento.

Modelo único para todos los productos (la historia de cada uno es corta e intermitente). Variables de cada origen t:
constante, suma de los últimos 7 días, promedio semanal de los últimos 28 días, fracción de días con salida en los
últimos 28 y si el producto es medicamento. Objetivo: unidades que salen en los 7 días siguientes (t … t+6).
"""
import csv
import math
from datetime import date, timedelta
import numpy as np

H = 7      # horizonte del pronóstico (días)
HIST = 28  # historia que usan las variables (días)


def cargar_salidas(ruta):
    """Salidas de movimientos.csv: (producto_id, fecha, cantidad)."""
    with open(ruta, encoding='utf-8') as f:
        return [(r['producto_id'], date.fromisoformat(r['fecha']), int(float(r['cantidad'])))
                for r in csv.DictReader(f) if r['tipo'] == 'Salida']


def serie_diaria(salidas, productos, inicio, fin):
    """Matriz productos × días (inicio … fin inclusive); los días sin salidas valen 0."""
    idx = {p: i for i, p in enumerate(productos)}
    D = np.zeros((len(productos), (fin - inicio).days + 1))
    for p, f, q in salidas:
        if p in idx and inicio <= f <= fin:
            D[idx[p], (f - inicio).days] += q
    return D


def ventanas(D, origenes, es_med):
    """Filas (X, y, índice de producto) para cada origen t: variables con días < t, objetivo con t … t+6."""
    X, y, p = [], [], []
    for t in origenes:
        h = D[:, t - HIST:t]
        X.append(np.c_[np.ones(len(D)), h[:, -7:].sum(1), h.sum(1) / 4, (h > 0).mean(1), es_med])
        y.append(D[:, t:t + H].sum(1)); p.append(np.arange(len(D)))
    return np.vstack(X), np.concatenate(y), np.concatenate(p)


def ajustar(X, y):
    """Mínimos cuadrados ordinarios."""
    return np.linalg.lstsq(X, y, rcond=None)[0]


def predecir(beta, X):
    """Demanda de 7 días pronosticada; una demanda negativa no tiene sentido y se recorta a 0."""
    return np.clip(X @ beta, 0, None)


def ajustar_lad(X, y, iteraciones=100):
    """Regresión de mínimas desviaciones absolutas (mediana condicional) por mínimos cuadrados reponderados.
    Minimiza el mismo error que se evalúa (MAE) y no se deja arrastrar por picos de demanda."""
    b = ajustar(X, y)
    for _ in range(iteraciones):
        w = np.sqrt(1 / np.maximum(np.abs(y - X @ b), 1e-3))
        b = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)[0]
    return b


def _escala(X):
    """Escala de cada fila: promedio semanal de 28 días + 1 (los productos difieren hasta 1000 veces en volumen)."""
    return X[:, 2] + 1


def ajustar_relativo(X, y):
    """Regresión robusta sobre la demanda relativa: y/s ~ X/s, para que cada producto pese por su patrón y no por su volumen."""
    s = _escala(X)
    return ajustar_lad(X / s[:, None], y / s)


def predecir_relativo(beta, X):
    s = _escala(X)
    return np.clip((X / s[:, None]) @ beta * s, 0, None)


def _metricas(e, y):
    return {'MAE': float(np.abs(e).mean()), 'WAPE': float(np.abs(e).sum() / y.sum()) if y.sum() else None,
            'RMSE': float(np.sqrt((e ** 2).mean()))}


def errores(D, es_med, origenes_prueba, origen_min, entrenar_con=None):
    """Errores (predicción − real) por producto y origen de prueba para los cuatro métodos, y la demanda real.
    entrenar_con: máscara opcional de productos usados para entrenar (validación cruzada por productos)."""
    E = {'regresion': [], 'regresion_relativa_robusta': [], 'ultima_semana': [], 'promedio_4_semanas': []}; Y = []
    for t in origenes_prueba:
        entren = list(range(origen_min, t - H + 1))
        X, y, p = ventanas(D, entren, es_med)
        if entrenar_con is not None: X, y = X[entrenar_con[p]], y[entrenar_con[p]]
        Xt, yt, _ = ventanas(D, [t], es_med)
        E['regresion'].append(predecir(ajustar(X, y), Xt) - yt)
        E['regresion_relativa_robusta'].append(predecir_relativo(ajustar_relativo(X, y), Xt) - yt)
        E['ultima_semana'].append(Xt[:, 1] - yt)
        E['promedio_4_semanas'].append(Xt[:, 2] - yt)
        Y.append(yt)
    return {k: np.vstack(v) for k, v in E.items()}, np.vstack(Y)  # matrices orígenes × productos


def evaluar(D, es_med, origenes_prueba, origen_min):
    """Validación con origen móvil: para cada origen de prueba se entrena solo con ventanas cuyo objetivo ya terminó."""
    E, Y = errores(D, es_med, origenes_prueba, origen_min)
    return {k: _metricas(v.ravel(), Y.ravel()) for k, v in E.items()}


def reposicion(pred7, sigma7, stock, L=3, R=7, z=1.65):
    """Unidades a pedir: demanda pronosticada en L + R días + stock de seguridad − stock disponible (≥ 0)."""
    objetivo = pred7 / H * (L + R) + z * sigma7 * math.sqrt((L + R) / H)
    return max(0, math.ceil(objetivo - stock))


def riesgo_vencimiento(lotes, demanda_diaria, hoy):
    """Por lote, en orden FEFO (vencimiento y luego identificador): (lote, unidades consumibles antes de vencer, unidades en riesgo)."""
    out, consumido = [], 0.0
    for lote, vence, stock in sorted(lotes, key=lambda l: (l[1], l[0])):
        capacidad = demanda_diaria * max(0, (vence - hoy).days)
        consumible = int(min(stock, max(0.0, capacidad - consumido)))
        consumido += consumible
        out.append((lote, consumible, stock - consumible))
    return out


def wilcoxon_unilateral(a, b):
    """Prueba de rangos con signo de Wilcoxon (aproximación normal con corrección por empates) de H1: a > b.
    Devuelve (n sin empates en cero, W+, z, p unilateral)."""
    d = np.asarray(a, float) - np.asarray(b, float); d = d[d != 0]; n = len(d)
    if n == 0: return 0, 0.0, 0.0, 1.0
    ab = np.abs(d); orden = ab.argsort(); r = np.empty(n); r[orden] = np.arange(1, n + 1)
    _, inv, cnt = np.unique(ab, return_inverse=True, return_counts=True)
    r = np.array([r[inv == g].mean() for g in range(len(cnt))])[inv]  # rangos promedio en empates
    w = r[d > 0].sum(); mu = n * (n + 1) / 4
    var = n * (n + 1) * (2 * n + 1) / 24 - (cnt ** 3 - cnt).sum() / 48
    z = (w - mu) / math.sqrt(var)
    return n, float(w), float(z), 0.5 * math.erfc(z / math.sqrt(2))
