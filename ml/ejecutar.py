"""Ejecución con la exportación real de la farmacia (14-10-2026).

Uso: python ejecutar.py <carpeta con lotes.csv y movimientos.csv> [nombres.csv]
Escribe en ml/out/: resultados.json, sugerencias_reposicion.csv, riesgo_vencimiento.csv y fig_errores.png.
"""
import csv, json, sys, os
from datetime import date, timedelta
import numpy as np
from pronostico import cargar_salidas, serie_diaria, ventanas, ajustar, predecir, evaluar, reposicion, riesgo_vencimiento, ajustar_relativo, predecir_relativo, HIST, H

RAW = sys.argv[1]
NOMBRES = sys.argv[2] if len(sys.argv) > 2 else None
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
INICIO, FIN = date(2026, 8, 26), date(2026, 10, 14)  # ventana de operación continua hasta la exportación
HOY = FIN
VENTANA_ALERTA = 90  # días; mismo umbral de la alerta de vencimiento del dashboard de SysFarm

salidas = cargar_salidas(os.path.join(RAW, 'movimientos.csv'))
with open(os.path.join(RAW, 'lotes.csv'), encoding='utf-8') as f:
    lotes = [r for r in csv.DictReader(f) if r['eliminado'] == 'false']
tipo = {r['producto_id']: r['tipo'] for r in lotes}
productos = sorted({p for p, f, q in salidas if INICIO <= f <= FIN and p in tipo})
es_med = np.array([1.0 if tipo[p] == 'MEDICAMENTO' else 0.0 for p in productos])
nombre = {}
if NOMBRES:
    with open(NOMBRES, encoding='utf-8-sig') as f:
        nombre = {r['producto_id']: r['nombre'] for r in csv.DictReader(f)}

D = serie_diaria(salidas, productos, INICIO, FIN)
dias = D.shape[1]
orig_min, orig_max = HIST, dias - H                      # origen con 28 días de historia y 7 de futuro observado
prueba = list(range(orig_max - 6, orig_max + 1))          # últimos 7 orígenes
metricas = evaluar(D, es_med, prueba, orig_min)

# Modelo final con todos los orígenes y pronóstico al día siguiente de la exportación
X, y, pidx = ventanas(D, list(range(orig_min, orig_max + 1)), es_med)
beta = ajustar(X, y)
res_reg = y - predecir(beta, X)
r2 = float(1 - (res_reg ** 2).sum() / ((y - y.mean()) ** 2).sum())
h = D[:, dias - HIST:dias]
Xf = np.c_[np.ones(len(D)), h[:, -7:].sum(1), h.sum(1) / 4, (h > 0).mean(1), es_med]
# Selección del pronóstico: el de menor MAE en la validación con origen móvil alimenta las sugerencias
elegido = min(metricas, key=lambda k: metricas[k]['MAE'])
col = {'ultima_semana': 1, 'promedio_4_semanas': 2}
beta_rel = ajustar_relativo(X, y)
if elegido == 'regresion': pred, res = predecir(beta, Xf), res_reg
elif elegido == 'regresion_relativa_robusta': pred, res = predecir_relativo(beta_rel, Xf), y - predecir_relativo(beta_rel, X)
else: pred, res = Xf[:, col[elegido]], y - X[:, col[elegido]]
sig_global = float(np.sqrt((res ** 2).mean()))
sigma = np.array([float(np.sqrt((res[pidx == i] ** 2).mean())) for i in range(len(productos))])
pred_reg = predecir(beta, Xf)
pred_rel = predecir_relativo(beta_rel, Xf)

# Las sugerencias cubren todos los productos con stock; los que no tuvieron salidas en la ventana tienen pronóstico 0
con_stock = sorted({r['producto_id'] for r in lotes if float(r['stock_actual']) > 0} - set(productos))
productos = productos + con_stock
pred = np.r_[pred, np.zeros(len(con_stock))]; sigma = np.r_[sigma, np.zeros(len(con_stock))]; pred_reg = np.r_[pred_reg, np.zeros(len(con_stock))]; pred_rel = np.r_[pred_rel, np.zeros(len(con_stock))]
stock = {p: 0 for p in productos}; lotes_p = {p: [] for p in productos}
for r in lotes:
    if r['producto_id'] in stock and float(r['stock_actual']) > 0:
        s = int(float(r['stock_actual'])); stock[r['producto_id']] += s
        lotes_p[r['producto_id']].append((r['lote_id'], date.fromisoformat(r['fecha_expiracion']), s))

filas_rep, filas_riesgo = [], []
for i, p in enumerate(productos):
    q = reposicion(float(pred[i]), float(sigma[i]), stock[p])
    filas_rep.append({'producto_id': p, 'nombre': nombre.get(p, ''), 'tipo': tipo[p], 'pronostico_7d': round(float(pred[i]), 2),
                      'sigma_7d': round(float(sigma[i]), 2), 'stock': stock[p], 'sugerido': q})
    for lote, cons, riesgo in riesgo_vencimiento(lotes_p[p], float(pred[i]) / H, HOY):
        venc = next(v for l, v, s in lotes_p[p] if l == lote)
        if (venc - HOY).days > VENTANA_ALERTA: continue  # solo lotes dentro del umbral de alerta de vencimiento del sistema
        filas_riesgo.append({'producto_id': p, 'nombre': nombre.get(p, ''), 'lote_id': lote, 'vence': venc.isoformat(),
                             'stock': cons + riesgo, 'consumible': cons, 'en_riesgo': riesgo})
for nombre_csv, filas in (('sugerencias_reposicion.csv', sorted(filas_rep, key=lambda r: -r['sugerido'])),
                          ('riesgo_vencimiento.csv', sorted(filas_riesgo, key=lambda r: -r['en_riesgo']))):
    with open(os.path.join(OUT, nombre_csv), 'w', newline='', encoding='utf-8') as f:
        campos = list(filas[0]) if filas else ['producto_id']
        w = csv.DictWriter(f, fieldnames=campos); w.writeheader(); w.writerows(filas)

# Caso para la tesis: el producto con más unidades en la ventana
i = int(np.argmax(D.sum(1))); p = productos[i]
caso = {'producto_id': p, 'nombre': nombre.get(p, ''), 'tipo': tipo[p],
        'variables': {'ultimos_7': float(Xf[i, 1]), 'prom_semanal_28': float(Xf[i, 2]), 'frac_dias_28': float(Xf[i, 3]), 'es_medicamento': float(Xf[i, 4])},
        'pronostico_7d': float(pred[i]), 'pronostico_regresion_7d': float(pred_reg[i]), 'pronostico_relativa_robusta_7d': float(pred_rel[i]), 'sigma_7d': float(sigma[i]), 'stock': stock[p], 'sugerido': reposicion(float(pred[i]), float(sigma[i]), stock[p]),
        'lotes': [{'lote': l, 'vence': v.isoformat(), 'stock': s} for l, v, s in sorted(lotes_p[p], key=lambda t: (t[1], t[0]))],
        'riesgo': [{'lote': l, 'consumible': c, 'en_riesgo': k} for l, c, k in riesgo_vencimiento(lotes_p[p], float(pred[i]) / H, HOY)]}
riesgo_rows = [r for r in filas_riesgo if r['en_riesgo'] > 0]
caso['riesgo_detalle'] = riesgo_rows
salida = {
    'ventana': [INICIO.isoformat(), FIN.isoformat()], 'productos': len(productos) - len(con_stock), 'productos_sin_salidas_con_stock': len(con_stock), 'salidas_ventana': int(D.sum()),
    'origenes_entrenamiento_final': [(INICIO + timedelta(orig_min)).isoformat(), (INICIO + timedelta(orig_max)).isoformat()],
    'origenes_prueba': [(INICIO + timedelta(t)).isoformat() for t in prueba], 'filas_entrenamiento_final': int(len(y)),
    'coeficientes': dict(zip(['constante', 'ultimos_7', 'prom_semanal_28', 'frac_dias_28', 'es_medicamento'], map(float, beta))),
    'coeficientes_relativa_robusta': dict(zip(['constante/s', 'ultimos_7/s', 'prom_semanal_28/s', 'frac_dias_28/s', 'es_medicamento/s'], map(float, beta_rel))),
    'r2_entrenamiento': r2, 'sigma_global_7d': sig_global, 'metricas_prueba': metricas, 'modelo_elegido': elegido,
    'reposicion': {'productos_con_sugerencia': sum(1 for r in filas_rep if r['sugerido'] > 0), 'unidades_sugeridas': sum(r['sugerido'] for r in filas_rep)},
    'riesgo': {'lotes_con_riesgo': sum(1 for r in filas_riesgo if r['en_riesgo'] > 0), 'unidades_en_riesgo': sum(r['en_riesgo'] for r in filas_riesgo),
               'lotes_evaluados': len(filas_riesgo), 'ventana_alerta_dias': VENTANA_ALERTA,
               'productos_sin_demanda_reciente_con_stock': sum(1 for i2, p2 in enumerate(productos) if pred[i2] == 0 and stock[p2] > 0)},
    'caso': caso, 'supuestos': {'tiempo_entrega_dias': 3, 'revision_dias': 7, 'z': 1.65}}
with open(os.path.join(OUT, 'resultados.json'), 'w', encoding='utf-8') as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)

import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(6.4, 3.2))
k = ['regresion', 'regresion_relativa_robusta', 'ultima_semana', 'promedio_4_semanas']; etiquetas = ['Regresión\nlineal', 'Regresión relativa\nrobusta', 'Última\nsemana', 'Promedio\n4 semanas']
ax.bar(etiquetas, [metricas[x]['MAE'] for x in k], color=['#9db7d5', '#1f4e79', '#c9c9c9', '#c9c9c9'])
for j, x in enumerate(k): ax.text(j, metricas[x]['MAE'], f"{metricas[x]['MAE']:.2f}".replace('.', ','), ha='center', va='bottom')
ax.set_ylabel('Error absoluto medio (unidades en 7 días)'); ax.spines[['top', 'right']].set_visible(False); fig.tight_layout()
fig.savefig(os.path.join(OUT, 'fig_errores.png'), dpi=200)
print(json.dumps({k: salida[k] for k in ('productos', 'salidas_ventana', 'coeficientes', 'r2_entrenamiento', 'metricas_prueba', 'modelo_elegido', 'reposicion', 'riesgo')}, ensure_ascii=False, indent=1))
print(json.dumps(caso, ensure_ascii=False)[:1500])
