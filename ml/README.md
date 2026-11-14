# Pronóstico de demanda y sugerencias (módulo de investigación)

Módulo de la tesis que pronostica la demanda de los próximos 7 días por producto y, a partir de ese pronóstico, genera dos sugerencias:

- **Reposición:** unidades a pedir = demanda pronosticada en el tiempo de entrega más la revisión (3 + 7 días) + stock de seguridad (z = 1.65) − stock disponible.
- **Riesgo de vencimiento:** unidades de cada lote que no alcanzarían a consumirse antes de vencer, recorriendo los lotes en orden FEFO. Solo se reportan los lotes que vencen en 90 días o menos, el mismo umbral de la alerta del dashboard.

## Método
- Pronóstico con regresión lineal (mínimos cuadrados) entrenada con todos los productos a la vez. Variables: constante, salidas de los últimos 7 días, promedio semanal de los últimos 28 días, fracción de días con salida en 28 días y si el producto es medicamento.
- Validación con origen móvil en los 7 últimos orígenes, sin usar información futura, contra dos métodos simples: última semana y promedio de 4 semanas.
- El pronóstico con menor error absoluto medio en esa validación es el que alimenta las sugerencias.

## Reproducir
Requiere Python 3.12, numpy y matplotlib.

    python -m unittest test_pronostico.py -v
    python ejecutar.py <carpeta con lotes.csv y movimientos.csv> [csv con producto_id y nombre]

Los resultados se escriben en `ml/out/` (no versionado): `resultados.json`, `sugerencias_reposicion.csv`, `riesgo_vencimiento.csv` y `fig_errores.png`. Los datos de la clínica no se incluyen en el repositorio.
