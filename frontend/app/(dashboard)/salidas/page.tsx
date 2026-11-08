"use client"

import { useState, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MagnifyingGlass as Search, ArrowLineUp as ArrowUpFromLine, CalendarBlank as Calendar, DownloadSimple as Download } from "@phosphor-icons/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { InventoryMovement } from "@/lib/types"
import * as XLSX from "xlsx"
import { formatLocalDate, formatLocalDateTime, getLocalDateString } from "@/lib/date-utils"
import { formatCurrency, formatQuantity } from "@/lib/number-utils"
import { useMovements, useMonthlyMovementStats } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function SalidasPage() {
  const { data: rawMovements = [], isLoading } = useMovements('Salida', false, { limit: 150 })
  const { data: monthlyStats, isLoading: isLoadingStats } = useMonthlyMovementStats('Salida')
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
      departamento: m.departamento,
      solicitante: m.solicitante,
      precioVentaPresentacion: m.product?.precioVentaPresentacion || 0,
      precioVentaUnidad: m.product?.precioVentaUnidad || 0,
    }))
  }, [rawMovements])


  const filteredMovements = movements.filter(
    (movement) =>
      movement.productoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.motivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.lote && movement.lote.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.departamento && movement.departamento.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.solicitante && movement.solicitante.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const totalUnidadesSalidas = monthlyStats?.totalUnidadesMes ?? movements.reduce((sum, m) => sum + (m.cantidadUnidad || 0), 0)
  const movimientosEsteMes = monthlyStats?.movimientosEsteMes ?? movements.filter((m) => {
    const fechaMov = new Date(m.fecha)
    const hoy = new Date()
    return fechaMov.getMonth() === hoy.getMonth() && fechaMov.getFullYear() === hoy.getFullYear()
  }).length

  // Calculate total sales
  const totalVentas = movements
    .filter((m) => m.motivo === "Venta")
    .reduce((sum, m) => {
      const precioUnitario =
        m.tipoUnidad === "presentacion"
          ? (m.precioVentaPresentacion || 0)
          : (m.precioVentaUnidad || 0)

      // Since backend stores total units in `cantidadUnidad` (and `cantidad` column), 
      // we use that directly. If type is presentation, we might need conversion, 
      // but for now let's assume `cantidadUnidad` is the total base units.
      // If price is per UNIT, we multiply by `cantidadUnidad`.
      // If price is per PRESENTATION, we need `cantidadPresentacion`.
      // Backend doesn't return `cantidadPresentacion`. 
      // Safe bet: always use Unit Price * Unit Quantity for calculation if available.

      // However, usually Venta implies selling by Unit or Presentation.
      // If `precioVentaUnidad` exists, use it.

      return sum + (m.precioVentaUnidad || 0) * m.cantidadUnidad
    }, 0)

  const exportToExcel = () => {
    const headers = [
      "Fecha",
      "Producto",
      "Tipo",
      "Motivo",
      "Cantidad",
      "Unidad",
      "Lote",
      "Departamento",
      "Usuario",
    ]

    const data = filteredMovements.map((m) => {
      return [
        formatLocalDateTime(m.fecha),
        m.productoNombre,
        m.tipo,
        m.motivo,
        m.cantidadUnidad,
        "Unidad",
        m.lote || "-",
        m.departamento || "-",
        m.usuario,
      ]
    })

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Salidas")
    XLSX.writeFile(workbook, `Salidas_${getLocalDateString()}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Salidas de Inventario</h1>
          <p className="text-muted-foreground mt-1">Registra las salidas de medicamentos e insumos del almacén</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Link href="/salidas/nuevo">
            <Button>
              Registrar Salida
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Salidas</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? <Skeleton className="h-8 w-20 bg-muted/70" /> : formatQuantity(movements.length)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <ArrowUpFromLine className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Unidades Salidas</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoadingStats ? <Skeleton className="h-8 w-24 bg-muted/70" /> : formatQuantity(totalUnidadesSalidas)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <Calendar className="h-6 w-6 text-destructive" />
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
              <div className="p-3 rounded-lg bg-destructive/10">
                <ArrowUpFromLine className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Ventas</p>
                <p className="text-3xl font-bold text-foreground">
                  {isLoading ? "..." : formatCurrency(totalVentas)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <Calendar className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historial de Salidas</CardTitle>
              <CardDescription>Total: {filteredMovements.length} registros</CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, motivo, lote, departamento..."
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
                  <TableHead>Destino / Solicitante</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={8} rows={6} columnWidths={["w-28", "w-48", "w-20", "w-24", "w-24", "w-32", "w-20 text-right", "w-24"]} />
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No se encontraron salidas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const cantidadTexto = `${formatQuantity(movement.cantidadUnidad)} unidades`

                    // Calcular total si es venta
                    let total = 0
                    if (movement.motivo === "Venta") {
                      // Simple calculation: Unit Price * Units
                      total = (movement.precioVentaUnidad || 0) * movement.cantidadUnidad
                    }

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
                          <Badge variant="secondary">{movement.motivo}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-destructive">-{cantidadTexto}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{movement.lote || "-"}</TableCell>
                        <TableCell className="text-sm">
                          <div>{movement.departamento || "-"}</div>
                          {movement.solicitante && (
                            <div className="text-[11px] text-muted-foreground">Sol: {movement.solicitante}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {total > 0 ? formatCurrency(total) : "-"}
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
