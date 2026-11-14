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


def _metricas(e, y):
    return {'MAE': float(np.abs(e).mean()), 'WAPE': float(np.abs(e).sum() / y.sum()) if y.sum() else None}


def evaluar(D, es_med, origenes_prueba, origen_min):
    """Validación con origen móvil: para cada origen de prueba se entrena solo con ventanas cuyo objetivo ya terminó."""
    E = {'regresion': [], 'ultima_semana': [], 'promedio_4_semanas': []}; Y = []
    for t in origenes_prueba:
        entren = list(range(origen_min, t - H + 1))
        beta = ajustar(*ventanas(D, entren, es_med)[:2])
        Xt, yt, _ = ventanas(D, [t], es_med)
        E['regresion'].append(predecir(beta, Xt) - yt)
        E['ultima_semana'].append(Xt[:, 1] - yt)
        E['promedio_4_semanas'].append(Xt[:, 2] - yt)
        Y.append(yt)
    Y = np.concatenate(Y)
    return {k: _metricas(np.concatenate(v), Y) for k, v in E.items()}


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
