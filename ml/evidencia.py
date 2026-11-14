"""Evidencia adicional de la regresión relativa robusta frente al promedio de 4 semanas, sin datos nuevos.

1. Prueba de Wilcoxon pareada sobre los errores absolutos por producto y origen.
2. Proporción de productos en los que mejora el error.
3. Intervalo de confianza bootstrap (por productos) de la reducción del MAE.
4. Validación cruzada por productos: el modelo se entrena sin los productos que pronostica.
5. Sensibilidad a la ventana: orígenes de prueba anteriores (35 y 36).
Uso: python evidencia.py <carpeta con lotes.csv y movimientos.csv>
"""
import csv, json, os, sys
from datetime import date
import numpy as np
from pronostico import cargar_salidas, serie_diaria, errores, wilcoxon_unilateral, HIST, H

RAW = sys.argv[1]; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
INICIO, FIN = date(2026, 8, 26), date(2026, 10, 14)
sal = cargar_salidas(os.path.join(RAW, 'movimientos.csv'))
with open(os.path.join(RAW, 'lotes.csv'), encoding='utf-8') as f:
    tipo = {r['producto_id']: r['tipo'] for r in csv.DictReader(f) if r['eliminado'] == 'false'}
P = sorted({p for p, fe, q in sal if INICIO <= fe <= FIN and p in tipo})
es_med = np.array([1.0 if tipo[p] == 'MEDICAMENTO' else 0.0 for p in P])
D = serie_diaria(sal, P, INICIO, FIN); n = D.shape[1]
omin, omax = HIST, n - H; prueba = list(range(omax - 6, omax + 1))
REL, MA = 'regresion_relativa_robusta', 'promedio_4_semanas'

E, Y = errores(D, es_med, prueba, omin)
a_ma, a_rel = np.abs(E[MA]).ravel(), np.abs(E[REL]).ravel()
n_w, w, z, p_w = wilcoxon_unilateral(a_ma, a_rel)          # H1: el error del promedio es mayor
mae_p_ma, mae_p_rel = np.abs(E[MA]).mean(0), np.abs(E[REL]).mean(0)   # MAE por producto
mejor, peor = int((mae_p_rel < mae_p_ma).sum()), int((mae_p_rel > mae_p_ma).sum())

rng = np.random.default_rng(20261114); B = 2000; difs = []
for _ in range(B):
    idx = rng.integers(0, len(P), len(P))
    difs.append(1 - np.abs(E[REL][:, idx]).mean() / np.abs(E[MA][:, idx]).mean())
ic = np.percentile(difs, [2.5, 97.5])

orden = rng.permutation(len(P)); pliegues = np.array_split(orden, 5); ae_rel, ae_ma = [], []
for pl in pliegues:
    entren = np.ones(len(P), bool); entren[pl] = False
    Ec, _ = errores(D, es_med, prueba, omin, entrenar_con=entren)
    ae_rel.append(np.abs(Ec[REL][:, pl]).ravel()); ae_ma.append(np.abs(Ec[MA][:, pl]).ravel())
cv_rel, cv_ma = float(np.concatenate(ae_rel).mean()), float(np.concatenate(ae_ma).mean())

Ea, Ya = errores(D, es_med, [35, 36], omin)
sens = {k: float(np.abs(v).mean()) for k, v in Ea.items()}

r = {'pares': int(a_ma.size), 'wilcoxon': {'n_sin_empates': n_w, 'W_mas': w, 'z': z, 'p_unilateral': p_w},
     'mae': {'promedio_4_semanas': float(a_ma.mean()), 'regresion_relativa_robusta': float(a_rel.mean())},
     'reduccion_mae': float(1 - a_rel.mean() / a_ma.mean()), 'ic95_reduccion_bootstrap': [float(ic[0]), float(ic[1])],
     'productos': {'total': len(P), 'mejora': mejor, 'empeora': peor, 'igual': len(P) - mejor - peor},
     'validacion_cruzada_por_productos': {'pliegues': 5, 'mae_regresion_relativa_robusta': cv_rel, 'mae_promedio_4_semanas': cv_ma},
     'sensibilidad_origenes_35_36': sens}
json.dump(r, open(os.path.join(OUT, 'evidencia.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(r, ensure_ascii=False, indent=1))
