"""Confirmación con datos no vistos: el diseño del modelo se fijó con la exportación del 14-10-2026; aquí se evalúa
solo en orígenes cuyo objetivo (7 días) cae completo después de esa fecha. En cada origen se entrena solo con ventanas
cuyo objetivo ya terminó (origen móvil, sin fuga).
Uso: FIN=AAAA-MM-DD python confirmacion.py <carpeta con lotes.csv y movimientos.csv>"""
import csv, json, os, sys
from datetime import date
import numpy as np
from pronostico import cargar_salidas, serie_diaria, errores, _metricas, wilcoxon_unilateral, HIST, H

RAW = sys.argv[1]; INICIO, CORTE = date(2026, 8, 26), date(2026, 10, 14)
FIN = date.fromisoformat(os.environ['FIN'])
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out_' + FIN.isoformat()); os.makedirs(OUT, exist_ok=True)
sal = cargar_salidas(os.path.join(RAW, 'movimientos.csv'))
with open(os.path.join(RAW, 'lotes.csv'), encoding='utf-8') as f:
    tipo = {r['producto_id']: r['tipo'] for r in csv.DictReader(f) if r['eliminado'] == 'false'}
P = sorted({p for p, fe, q in sal if INICIO <= fe <= FIN and p in tipo})
es_med = np.array([1.0 if tipo[p] == 'MEDICAMENTO' else 0.0 for p in P])
D = serie_diaria(sal, P, INICIO, FIN); n = D.shape[1]
primero = (CORTE - INICIO).days + 1                     # primer origen cuyo objetivo empieza después del corte
prueba = list(range(primero, n - H + 1))
# Se calculan también los 13 orígenes previos para aplicar la regla de selección del sistema desde el primer origen de prueba
previos = list(range(primero - 2 * H + 1, primero))
Etodo, Ytodo = errores(D, es_med, previos + prueba, HIST)
E, Y = {k: v[len(previos):] for k, v in Etodo.items()}, Ytodo[len(previos):]
m = {k: _metricas(v.ravel(), Y.ravel()) for k, v in E.items()}
REL = 'regresion_relativa_robusta'; a = {k: np.abs(v) for k, v in E.items()}
rng = np.random.default_rng(20261123); boot = {}
for base in ('promedio_4_semanas', 'ultima_semana', 'regresion'):
    difs = [1 - a[REL][:, i].mean() / a[base][:, i].mean() for i in (rng.integers(0, len(P), len(P)) for _ in range(2000))]
    nw, w, z, p = wilcoxon_unilateral(a[base].ravel(), a[REL].ravel())
    boot[base] = {'reduccion_mae': float(1 - a[REL].mean() / a[base].mean()), 'ic95': [float(x) for x in np.percentile(difs, [2.5, 97.5])],
                  'wilcoxon_z': z, 'p_unilateral': p, 'productos_mejora': int((a[REL].mean(0) < a[base].mean(0)).sum()),
                  'productos_empeora': int((a[REL].mean(0) > a[base].mean(0)).sum())}
# Regla de selección (CU-17, paso 3): en el origen t usar el método de menor MAE en los 7 orígenes cuyo objetivo terminó antes de t
At = {k: np.abs(v) for k, v in Etodo.items()}; elegidos, err_regla = [], []
for j, t in enumerate(prueba):
    i = len(previos) + j; val = list(range(i - 2 * H + 1, i - H + 1))
    k = min(At, key=lambda k: At[k][val].mean()); elegidos.append(k); err_regla.append(At[k][i])
regla = {'MAE': float(np.mean(err_regla)), 'elegidos': {k: elegidos.count(k) for k in set(elegidos)}}
r = {'corte_diseno': CORTE.isoformat(), 'fin': FIN.isoformat(), 'productos': len(P), 'salidas': int(D.sum()),
     'origenes_prueba': [str(INICIO.fromordinal(INICIO.toordinal() + t)) for t in (prueba[0], prueba[-1])], 'n_origenes': len(prueba),
     'pares': int(Y.size), 'metricas': m, 'regla_seleccion': regla, 'relativa_robusta_frente_a': boot}
json.dump(r, open(os.path.join(OUT, 'confirmacion.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(r, ensure_ascii=False, indent=1))
