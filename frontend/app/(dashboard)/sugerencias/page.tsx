"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatQuantity } from "@/lib/number-utils"

type Metodo = "regresion" | "regresion_relativa_robusta" | "ultima_semana" | "promedio_4_semanas"
interface Sugerencias {
  inicio: string
  fin: string
  modeloElegido: Metodo
  metricas: Record<Metodo, { MAE: number; WAPE: number | null; RMSE: number }>
  reposicion: { productId: string; nombre: string; pronostico7d: number; sigma7d: number; stock: number; sugerido: number }[]
  riesgo: { productId: string; nombre: string; loteId: string; codigo: string; vence: string; stock: number; consumible: number; enRiesgo: number }[]
}

const NOMBRE_METODO: Record<Metodo, string> = {
  regresion: "Regresión lineal (mínimos cuadrados)",
  regresion_relativa_robusta: "Regresión lineal robusta ponderada",
  ultima_semana: "Última semana",
  promedio_4_semanas: "Promedio de 4 semanas",
}
const fecha = (s: string) => s.split("-").reverse().join("/")
const decimal = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 1 })

export default function SugerenciasPage() {
  const [datos, setDatos] = useState<Sugerencias | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get("/sugerencias").then(setDatos).catch((e: any) => setError(e?.message || "No se pudieron calcular las sugerencias"))
  }, [])

  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!datos) return <div className="p-6 text-muted-foreground">Calculando el pronóstico…</div>

  const reponer = datos.reposicion.filter(r => r.sugerido > 0)
  const enRiesgo = datos.riesgo.filter(r => r.enRiesgo > 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sugerencias de reposición y riesgo de vencimiento</h1>
        <p className="text-sm text-muted-foreground">
          Pronóstico de demanda de los próximos 7 días con las salidas del {fecha(datos.inicio)} al {fecha(datos.fin)}.
          Son un apoyo a la decisión del farmacéutico, no órdenes automáticas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Método de pronóstico usado</CardTitle>
          <CardDescription>Se usa el método con menor error absoluto medio (MAE) en los 7 orígenes más recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">MAE (unidades en 7 días)</TableHead>
                <TableHead className="text-right">WAPE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(Object.keys(NOMBRE_METODO) as Metodo[]).map(m => (
                <TableRow key={m}>
                  <TableCell>
                    {NOMBRE_METODO[m]} {m === datos.modeloElegido && <Badge className="ml-2">En uso</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{decimal(datos.metricas[m].MAE)}</TableCell>
                  <TableCell className="text-right">
                    {datos.metricas[m].WAPE == null ? "—" : `${decimal(datos.metricas[m].WAPE! * 100)} %`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reposición sugerida ({reponer.length} productos)</CardTitle>
          <CardDescription>
            Demanda pronosticada para 10 días (3 de entrega y 7 de revisión) más stock de seguridad al 95 %, menos el stock disponible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Pronóstico 7 días</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Pedir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reponer.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No hay productos por reponer.</TableCell></TableRow>
              )}
              {reponer.map(r => (
                <TableRow key={r.productId}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell className="text-right">{decimal(r.pronostico7d)}</TableCell>
                  <TableCell className="text-right">{formatQuantity(r.stock)}</TableCell>
                  <TableCell className="text-right font-medium">{formatQuantity(r.sugerido)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lotes en riesgo de vencimiento ({enRiesgo.length})</CardTitle>
          <CardDescription>Lotes que vencen en 90 días o menos, recorridos en orden FEFO con la demanda pronosticada.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Consumible antes de vencer</TableHead>
                <TableHead className="text-right">En riesgo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.riesgo.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Ningún lote vence en los próximos 90 días.</TableCell></TableRow>
              )}
              {datos.riesgo.map(r => (
                <TableRow key={r.loteId}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.codigo}</TableCell>
                  <TableCell>{fecha(r.vence)}</TableCell>
                  <TableCell className="text-right">{formatQuantity(r.stock)}</TableCell>
                  <TableCell className="text-right">{formatQuantity(r.consumible)}</TableCell>
                  <TableCell className="text-right">
                    {r.enRiesgo > 0 ? <Badge variant="destructive">{formatQuantity(r.enRiesgo)}</Badge> : "0"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
