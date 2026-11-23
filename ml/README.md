# Pronóstico de demanda y sugerencias (módulo de investigación)

Módulo de la tesis que pronostica la demanda de los próximos 7 días por producto y, a partir de ese pronóstico, genera dos sugerencias:

- **Reposición:** unidades a pedir = demanda pronosticada en el tiempo de entrega más la revisión (3 + 7 días) + stock de seguridad (z = 1.65) − stock disponible.
- **Riesgo de vencimiento:** unidades de cada lote que no alcanzarían a consumirse antes de vencer, recorriendo los lotes en orden FEFO. Solo se reportan los lotes que vencen en 90 días o menos, el mismo umbral de la alerta del dashboard.

## Método
- Pronóstico con regresión lineal (mínimos cuadrados) entrenada con todos los productos a la vez. Variables: constante, salidas de los últimos 7 días, promedio semanal de los últimos 28 días, fracción de días con salida en 28 días y si el producto es medicamento.
- Validación con origen móvil en los 7 últimos orígenes, sin usar información futura, contra dos métodos simples: última semana y promedio de 4 semanas.
- El pronóstico con menor error absoluto medio en esa validación es el que alimenta las sugerencias.
- Evaluación en dos fases. **Desarrollo:** datos del 26-08 al 14-10-2026, con los que se diseñó el modelo (incluida la regresión relativa robusta). **Confirmación:** `confirmacion.py` evalúa el diseño congelado el 14-10 solo en orígenes cuyo objetivo cae completo después de esa fecha, con bootstrap por productos, Wilcoxon y la regla de selección completa. Una variante nueva del modelo debe congelarse antes y confirmarse con datos posteriores a la última exportación usada.

## Reproducir
Requiere Python 3.12, numpy y matplotlib.

    python -m unittest test_pronostico.py -v
    python ejecutar.py <carpeta con lotes.csv y movimientos.csv> [csv con producto_id y nombre]
    FIN=2026-11-19 python ejecutar.py <carpeta> [nombres.csv]     # ventana hasta el último día completo de otra exportación
    FIN=2026-11-19 python confirmacion.py <carpeta>                # fase de confirmación (orígenes posteriores al 14-10)
    FIN=2026-11-19 python evidencia.py <carpeta>

Sin `FIN` se usa la exportación del 14-10-2026 y los resultados se escriben en `ml/out/`; con `FIN`, en `ml/out_<FIN>/` (ninguno se versiona): `resultados.json`, `sugerencias_reposicion.csv`, `riesgo_vencimiento.csv` y `fig_errores.png`. Los datos de la clínica no se incluyen en el repositorio.
