"use client"

import { useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MagnifyingGlass as Search, ArrowLineDown as ArrowDownToLine, CalendarBlank as Calendar, DownloadSimple as Download } from "@phosphor-icons/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { InventoryMovement } from "@/lib/types"
import * as XLSX from "xlsx"
import { formatLocalDate, formatLocalDateTime, getLocalDateString } from "@/lib/date-utils"
import { formatQuantity } from "@/lib/number-utils"
import { useMovements, useMonthlyMovementStats } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function IngresosPage() {
  const { data: rawMovements = [], isLoading: isLoadingMovements } = useMovements('Ingreso', false, { limit: 150 })
  const { data: monthlyStats, isLoading: isLoadingStats } = useMonthlyMovementStats('Ingreso')
  const isLoading = isLoadingMovements
  const [searchTerm, setSearchTerm] = useState("")

  const movements: InventoryMovement[] = useMemo(() => {
    return rawMovements.map((m: any) => ({
      id: m.id,
      productoId: m.productId,
      productoNombre: m.product?.nombre || "Producto Desconocido",
      tipo: m.tipo,
      cantidadUnidad: m.cantidad || 0,
      tipoUnidad: "unidad",
      factorConversion: 1,
      motivo: m.motivo,
      lote: m.batch?.codigo || m.lote,
      fechaExpiracion: m.batch?.fechaExpiracion || m.fechaExpiracion,
      usuario: m.usuario || "Sistema",
      fecha: m.fecha,
      proveedorNombre: m.proveedor,
    }))
  }, [rawMovements])


  const filteredMovements = movements.filter(
    (movement) =>
      movement.productoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.motivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.lote && movement.lote.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const totalUnidadesIngresadas = monthlyStats?.totalUnidadesMes ?? movements.reduce((sum, m) => sum + (m.cantidadUnidad || 0), 0)
  const movimientosEsteMes = monthlyStats?.movimientosEsteMes ?? movements.filter((m) => {
    const fechaMov = new Date(m.fecha)
    const hoy = new Date()
    return fechaMov.getMonth() === hoy.getMonth() && fechaMov.getFullYear() === hoy.getFullYear()
  }).length

  const exportToExcel = () => {
    const headers = [
      "Fecha",
      "Producto",
      "Tipo",
      "Motivo",
      "Cantidad",
      "Unidad",
      "Lote",
      "Expiración",
      "Proveedor",
      "Usuario",
    ]

    const data = filteredMovements.map((m) => {
      return [
        formatLocalDateTime(m.fecha),
        m.productoNombre,
        m.tipo,
        m.motivo,
        m.cantidadUnidad,
        "Unidad", // Backend returns total units for now
        m.lote || "-",
        m.fechaExpiracion ? formatLocalDate(m.fechaExpiracion) : "-",
        m.proveedorNombre || "-",
        m.usuario,
      ]
    })

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ingresos")
    XLSX.writeFile(workbook, `Ingresos_${getLocalDateString()}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ingresos de Inventario</h1>
          <p className="text-muted-foreground mt-1">Registra las entradas de medicamentos e insumos al almacén</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Link href="/ingresos/nuevo">
            <Button>
              Registrar Ingreso
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Ingresos</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-20 bg-muted/70" /> : formatQuantity(movements.length)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <ArrowDownToLine className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Unidades Ingresadas</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoadingStats ? <Skeleton className="h-8 w-24 bg-muted/70" /> : formatQuantity(totalUnidadesIngresadas)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Este Mes</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoadingStats ? <Skeleton className="h-8 w-20 bg-muted/70" /> : formatQuantity(movimientosEsteMes)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <ArrowDownToLine className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historial de Ingresos</CardTitle>
              <CardDescription>Total: {filteredMovements.length} registros</CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, motivo, lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Expiración</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={8} rows={6} columnWidths={["w-28", "w-48", "w-20", "w-24", "w-24", "w-28", "w-28", "w-24"]} />
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No se encontraron ingresos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const cantidadTexto = `${formatQuantity(movement.cantidadUnidad)} unidades`

                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="font-medium text-xs">
                          {formatLocalDateTime(movement.fecha)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="truncate block max-w-[260px] cursor-default font-medium" title={movement.productoNombre}>
                              {movement.productoNombre}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{movement.motivo}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-accent">+{cantidadTexto}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{movement.lote || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {movement.fechaExpiracion ? formatLocalDate(movement.fechaExpiracion) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {movement.proveedorNombre || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{movement.usuario}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
