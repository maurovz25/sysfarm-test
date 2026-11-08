"use client"

import { useState, useMemo, useEffect } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    MagnifyingGlass as Search,
    FileText,
    TrendUp as TrendingUp,
    TrendDown as TrendingDown,
    DownloadSimple as Download,
    CurrencyDollar as DollarSign,
    Check,
    CaretUpDown as ChevronsUpDown,
    Coins,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import type { Product, InventoryMovement } from "@/lib/types"
import * as XLSX from "xlsx"
import { useUserRole } from "@/hooks/use-user-role"
import { UserRole } from "@/lib/roles"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { obtenerStockDesglosado } from "@/lib/inventory"
import { formatLocalDate, formatLocalDateTime, formatLocalTime, getLocalDateString } from "@/lib/date-utils"
import { formatCurrency, formatQuantity } from "@/lib/number-utils"
import { GuiaSalidaControladoDialog } from "@/components/movements/guia-salida-controlado-dialog"
import type { GuiaSalida } from "@/lib/types"

interface KardexEntry {
  id: string
  fecha: string
  tipo: "Ingreso" | "Salida" | "Ajuste"
  motivo: string
  cantidadUnidad: number
  entrada: number
  salida: number
  stockAnterior: number
  saldo: number
  usuario: string
  observaciones?: string
  productoNombre?: string
  productoCodigo?: string
  tipoUnidad?: "presentacion" | "unidad"
  cantidadPresentacion?: number
  lote?: string
  fechaExpiracion?: string
  precioCostoUnidad?: number
  precioVentaUnidad?: number
  guiaSalida?: GuiaSalida
  guiasSalida?: GuiaSalida[]
}

import { useProducts, useMovements } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"

export default function KardexPage() {
  const [selectedProductName, setSelectedProductName] = useState<string>("all")
  const { data: rawProductsData = [], isLoading: isLoadingProducts } = useProducts()

  // Obtener el ID del producto si hay uno seleccionado
  const selectedProductId = useMemo(() => {
    if (selectedProductName === "all") return undefined
    const match = rawProductsData.find((p: any) => p.nombre === selectedProductName)
    return match?.id
  }, [rawProductsData, selectedProductName])

  const { data: rawMovementsData = [], isLoading: isLoadingMovements } = useMovements(undefined, true, {
    productId: selectedProductId,
    limit: selectedProductName === "all" ? 150 : undefined
  })

  const [open, setOpen] = useState(false)
  const { user, role } = useUserRole()

  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const [selectedMovementForGuia, setSelectedMovementForGuia] = useState<InventoryMovement | null>(null)
  const [isGuiaModalOpen, setIsGuiaModalOpen] = useState(false)

  const isLoading = isLoadingProducts || isLoadingMovements

  const products: Product[] = useMemo(() => {
    return rawProductsData.map((p: any) => {
      const activeBatches = p.batches || []
      let valorTotalProducto = 0
      let precioCostoUnidad = 0
      let precioVentaUnidad = 0
      let cantidadPorPresentacion = 1

      if (activeBatches.length > 0) {
        const batchWithPres = activeBatches.find((b: any) => b.cantidadPorPresentacion && b.cantidadPorPresentacion > 1) || activeBatches[0]
        if (batchWithPres?.cantidadPorPresentacion) {
          cantidadPorPresentacion = batchWithPres.cantidadPorPresentacion
        }

        valorTotalProducto = activeBatches.reduce((sum: number, b: any) => {
          const cant = b.cantidadPorPresentacion || 1
          const bCost = cant > 0 ? (b.precioCostoPresentacion / cant) : 0
          return sum + (b.stockActual || 0) * bCost
        }, 0)

        const firstBatchWithCost = activeBatches.find((b: any) => b.precioCostoPresentacion > 0) || activeBatches[0]
        if (firstBatchWithCost) {
          const cant = firstBatchWithCost.cantidadPorPresentacion || 1
          precioCostoUnidad = cant > 0 ? (firstBatchWithCost.precioCostoPresentacion / cant) : 0
          precioVentaUnidad = cant > 0 ? (firstBatchWithCost.precioVentaPresentacion / cant) : 0
        }
      } else {
        cantidadPorPresentacion = p.cantidadPorPresentacion || 1
        precioCostoUnidad = cantidadPorPresentacion > 0 ? ((p.precioCostoPresentacion || 0) / cantidadPorPresentacion) : 0
        precioVentaUnidad = cantidadPorPresentacion > 0 ? ((p.precioVentaPresentacion || 0) / cantidadPorPresentacion) : 0
        valorTotalProducto = (p.stockUnidad || 0) * precioCostoUnidad
      }

      return {
        id: p.id,
        nombre: p.nombre,
        codigoBarras: p.codigoBarras || "",
        stockUnidad: p.stockUnidad || 0,
        unidadBase: p.unidadBase || "Unidad",
        presentacion: p.presentacion || "Caja",
        cantidadPorPresentacion,
        precioCostoUnidad,
        precioVentaUnidad,
        valorTotalProducto,
      } as any
    })
  }, [rawProductsData])

  const movements: InventoryMovement[] = useMemo(() => {
    return rawMovementsData.map((m: any) => ({
      id: m.id,
      productoId: m.productId,
      productoNombre: m.product?.nombre || "Producto Desconocido",
      productoCodigo: m.product?.codigoBarras || "",
      tipo: m.tipo,
      cantidadUnidad: m.tipo === "Ajuste" ? Math.abs(m.cantidad || 0) : (m.cantidad || 0),
      cantidadOriginal: m.cantidad || 0,
      tipoUnidad: "unidad",
      motivo: m.motivo,
      lote: m.batch?.codigo || m.lote,
      fechaExpiracion: m.batch?.fechaExpiracion || m.fechaExpiracion,
      usuario: m.usuario || "Sistema",
      fecha: m.fecha,
      observaciones: "",
      cantidadPresentacion: 0,
      precioCostoUnidad: m.batch?.precioCostoUnidad || m.product?.precioCostoUnidad || 0,
      precioVentaUnidad: m.batch?.precioVentaUnidad || m.product?.precioVentaUnidad || 0,
      guiaSalida: (m.guiasSalida && m.guiasSalida.length > 0) ? m.guiasSalida[0] : (m.guiaSalida || undefined),
      guiasSalida: m.guiasSalida || (m.guiaSalida ? [m.guiaSalida] : []),
    }))
  }, [rawMovementsData])

  const handleGuiaSaved = (savedGuia: GuiaSalida) => {
    // TanStack Query handles revalidation automatically
  }


  // Get unique products by name for the dropdown
  const uniqueProducts = useMemo(() => {
    const names = new Set()
    return products.filter((p) => {
      if (names.has(p.nombre)) return false
      names.add(p.nombre)
      return true
    })
  }, [products])

  // Get representative product details (for name, units, presentation metadata)
  const selectedProductMetadata = useMemo(() => {
    return products.find((p) => p.nombre === selectedProductName)
  }, [products, selectedProductName])

  const kardexEntries = useMemo(() => {
    if (products.length === 0) return []

    if (selectedProductName === "all") {
      // Mostrar todos los movimientos de todos los productos
      const allEntries: KardexEntry[] = []

      // Pre-agrupar movimientos y lotes por producto para optimización O(N+M)
      const movementsByProduct = new Map<string, typeof movements>()
      for (const m of movements) {
        const list = movementsByProduct.get(m.productoNombre)
        if (list) {
          list.push(m)
        } else {
          movementsByProduct.set(m.productoNombre, [m])
        }
      }

      const lotsByProduct = new Map<string, typeof products>()
      for (const p of products) {
        const list = lotsByProduct.get(p.nombre)
        if (list) {
          list.push(p)
        } else {
          lotsByProduct.set(p.nombre, [p])
        }
      }

      // Iterar sobre nombres únicos de productos
      for (const uniqueProd of uniqueProducts) {
        const relatedLots = lotsByProduct.get(uniqueProd.nombre) || []
        const currentTotalStock = relatedLots.reduce((sum, p) => sum + (p.stockUnidad || 0), 0)

        const productMovements = (movementsByProduct.get(uniqueProd.nombre) || [])
          .slice()
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

        let saldo = 0

        // Preprocesar movimientos para calcular entradas y salidas
        let totalEntradas = 0
        let totalSalidas = 0
        const processedMovements = productMovements.map((m) => {
          let entrada = 0
          let salida = 0
          if (m.tipo === "Ingreso") {
            entrada = m.cantidadUnidad || 0
          } else if (m.tipo === "Salida") {
            salida = m.cantidadUnidad || 0
          } else if (m.tipo === "Ajuste") {
            const originalVal = m.cantidadOriginal !== undefined ? m.cantidadOriginal : m.cantidadUnidad
            if (originalVal > 0) {
              entrada = Math.abs(originalVal)
            } else {
              salida = Math.abs(originalVal)
            }
          }
          totalEntradas += entrada
          totalSalidas += salida
          return {
            ...m,
            entrada,
            salida
          }
        })

        // Calcular stock inicial global para este producto
        saldo = currentTotalStock - totalEntradas + totalSalidas

        // Agregar entrada inicial ONLY if there is a balance (to avoid cluttering with 0 balance items)
        if (saldo !== 0 || productMovements.length > 0) {
          allEntries.push({
            id: `inicial-${uniqueProd.nombre}`,
            fecha: "2024-01-01", // Should ideally be dynamic or "Inicios"
            tipo: "Ingreso",
            motivo: "Stock Inicial / Legado",
            cantidadUnidad: saldo,
            entrada: saldo,
            salida: 0,
            stockAnterior: 0,
            saldo: saldo,
            usuario: "Sistema",
            productoNombre: uniqueProd.nombre,
            productoCodigo: uniqueProd.codigoBarras,
            precioCostoUnidad: 0,
            precioVentaUnidad: 0,
          })
        }

        // Procesar movimientos
        for (const movement of processedMovements) {
          const stockAnterior = saldo
          saldo += movement.entrada - movement.salida

          allEntries.push({
            id: movement.id,
            fecha: movement.fecha,
            tipo: movement.tipo as any,
            motivo: movement.motivo,
            cantidadUnidad: movement.cantidadUnidad || 0,
            entrada: movement.entrada,
            salida: movement.salida,
            stockAnterior,
            saldo,
            usuario: movement.usuario,
            observaciones: movement.observaciones,
            productoNombre: uniqueProd.nombre,
            productoCodigo: uniqueProd.codigoBarras,
            tipoUnidad: movement.tipoUnidad,
            cantidadPresentacion: movement.cantidadPresentacion,
            lote: movement.lote,
            fechaExpiracion: movement.fechaExpiracion,
            precioCostoUnidad: movement.precioCostoUnidad,
            precioVentaUnidad: movement.precioVentaUnidad,
            guiaSalida: movement.guiaSalida,
            guiasSalida: movement.guiasSalida,
          })
        }
      }

      // Ordenar por fecha descendente
      return allEntries.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    }

    // Lógica para un solo producto (agrupado por nombre)
    if (!selectedProductName) return []

    // 1. Get all lots for this product name to calculate 'Current Global Stock'
    const relatedLots = products.filter((p: Product) => p.nombre === selectedProductName)
    const currentTotalStock = relatedLots.reduce((sum: number, p: Product) => sum + (p.stockUnidad || 0), 0)

    const productMovements = movements
      .filter((m: InventoryMovement) => m.productoNombre === selectedProductName)
      .sort((a: InventoryMovement, b: InventoryMovement) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    let saldo = 0
    const entries: KardexEntry[] = []

    // Preprocesar movimientos
    let totalEntradas = 0
    let totalSalidas = 0
    const processedMovements = productMovements.map((m: any) => {
      let entrada = 0
      let salida = 0
      if (m.tipo === "Ingreso") {
        entrada = m.cantidadUnidad || 0
      } else if (m.tipo === "Salida") {
        salida = m.cantidadUnidad || 0
      } else if (m.tipo === "Ajuste") {
        const originalVal = m.cantidadOriginal !== undefined ? m.cantidadOriginal : m.cantidadUnidad
        if (originalVal > 0) {
          entrada = Math.abs(originalVal)
        } else {
          salida = Math.abs(originalVal)
        }
      }
      totalEntradas += entrada
      totalSalidas += salida
      return {
        ...m,
        entrada,
        salida
      }
    })

    // Calcular stock inicial (Reverse engineering from current stock)
    saldo = currentTotalStock - totalEntradas + totalSalidas

    entries.push({
      id: "inicial",
      fecha: "2024-01-01",
      tipo: "Ingreso",
      motivo: "Stock Inicial / Legado",
      cantidadUnidad: saldo,
      entrada: saldo,
      salida: 0,
      stockAnterior: 0,
      saldo: saldo,
      usuario: "Sistema",
      precioCostoUnidad: 0,
      precioVentaUnidad: 0,
    })

    // Procesar movimientos
    for (const movement of processedMovements) {
      const stockAnterior = saldo
      saldo += movement.entrada - movement.salida

      entries.push({
        id: movement.id,
        fecha: movement.fecha,
        tipo: movement.tipo as any,
        motivo: movement.motivo,
        cantidadUnidad: movement.cantidadUnidad || 0,
        entrada: movement.entrada,
        salida: movement.salida,
        stockAnterior,
        saldo,
        usuario: movement.usuario,
        observaciones: movement.observaciones,
        tipoUnidad: movement.tipoUnidad,
        cantidadPresentacion: movement.cantidadPresentacion,
        lote: movement.lote,
        fechaExpiracion: movement.fechaExpiracion,
        precioCostoUnidad: movement.precioCostoUnidad,
        precioVentaUnidad: movement.precioVentaUnidad,
        guiaSalida: movement.guiaSalida,
        guiasSalida: movement.guiasSalida,
      })
    }

    return entries.reverse() // Mostrar más recientes primero
  }, [selectedProductName, movements, products, uniqueProducts])

  const filteredEntries = kardexEntries.filter((entry) => {
    const entryDate = new Date(entry.fecha)
    const matchesDateRange =
      (!fechaInicio || entryDate >= new Date(fechaInicio)) && (!fechaFin || entryDate <= new Date(fechaFin))

    return matchesDateRange
  })

  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)
  const paginatedEntries = useMemo(() => {
    return filteredEntries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredEntries, currentPage, itemsPerPage])

  const totalEntradas = filteredEntries.reduce((sum, e) => sum + e.entrada, 0)
  const totalSalidas = filteredEntries.reduce((sum, e) => sum + e.salida, 0)

  const saldoActual =
    selectedProductName === "all"
      ? products.reduce((sum, p) => sum + (p.stockUnidad || 0), 0)
      : filteredEntries[0]?.saldo || 0

  const beneficioNeto = useMemo(() => {
    return filteredEntries
      .filter(e => e.tipo === "Salida")
      .reduce((sum, e) => {
        const ganancia = ((e.precioVentaUnidad || 0) - (e.precioCostoUnidad || 0)) * (e.salida || 0);
        return sum + (ganancia > 0 ? ganancia : 0);
      }, 0);
  }, [filteredEntries]);

  const valorizado = useMemo(() => {
    if (selectedProductName === "all") {
      return products.reduce((sum, p: any) => sum + (p.valorTotalProducto !== undefined ? p.valorTotalProducto : ((p.stockUnidad || 0) * (p.precioCostoUnidad || 0))), 0)
    }
    const filteredProds = products.filter(p => p.nombre === selectedProductName)
    return filteredProds.reduce((sum, p: any) => sum + (p.valorTotalProducto !== undefined ? p.valorTotalProducto : ((p.stockUnidad || 0) * (p.precioCostoUnidad || 0))), 0)
  }, [selectedProductName, products])

  const exportToExcel = () => {
    const exportData = filteredEntries.map((entry) => {
      const isAll = selectedProductName === "all";
      const baseRow = {
        "Fecha": formatLocalDateTime(entry.fecha),
        ...(isAll ? { "Producto": entry.productoNombre || "", "GTIN": entry.productoCodigo || "" } : {}),
        "Tipo": entry.tipo,
        "Motivo": entry.motivo,
        "Cantidad": entry.cantidadUnidad,
        "Entrada": entry.entrada,
        "Salida": entry.salida,
        "Stock Anterior": entry.stockAnterior,
        "Saldo": entry.saldo,
        "Lote": entry.lote || "",
        "Expiración": entry.fechaExpiracion ? formatLocalDate(entry.fechaExpiracion) : "",
        "Usuario": entry.usuario,
        "P. Costo (Unid)": entry.precioCostoUnidad || 0,
        "P. Venta (Unid)": entry.precioVentaUnidad || 0,
        "Beneficio": entry.tipo === "Salida" ? ((entry.precioVentaUnidad || 0) - (entry.precioCostoUnidad || 0)) * entry.salida : 0
      };
      return baseRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex_Movimientos");

    const dateStr = getLocalDateString();
    const fileName = `Kardex_${selectedProductName === "all" ? "Todos" : selectedProductName}_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Kardex de Inventario</h1>
        <p className="text-muted-foreground mt-1">Historial detallado de movimientos por producto (en unidades base)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Producto</CardTitle>
          <CardDescription>
            Elige un medicamento/insumo para ver su kardex completo o selecciona "Todos" para ver todos los movimientos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {selectedProductName === "all"
                  ? "Todos los productos"
                  : selectedProductMetadata
                  ? `${selectedProductMetadata.codigoBarras ? selectedProductMetadata.codigoBarras + " - " : ""}${selectedProductMetadata.nombre}`
                  : "Seleccionar producto..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
              <Command
                filter={(value, search) => {
                  if (value === "all") return "todos los productos".includes(search.toLowerCase()) ? 1 : 0
                  const product = uniqueProducts.find(p => p.nombre === value)
                  if (!product) return 0
                  const searchStr = search.toLowerCase()
                  const matchName = product.nombre.toLowerCase().includes(searchStr)
                  const matchCode = product.codigoBarras?.toLowerCase().includes(searchStr)
                  return matchName || matchCode ? 1 : 0
                }}
              >
                <CommandInput placeholder="Buscar por nombre o código de barras..." />
                <CommandList>
                  <CommandEmpty>No se encontró ningún producto.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={(currentValue) => {
                        setSelectedProductName("all")
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedProductName === "all" ? "opacity-100" : "opacity-0"
                        )}
                      />
                      Todos los productos
                    </CommandItem>
                    {uniqueProducts.map((product: any) => (
                      <CommandItem
                        key={product.id || product.nombre}
                        value={product.nombre}
                        onSelect={(currentValue) => {
                          setSelectedProductName(product.nombre)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductName === product.nombre ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {product.codigoBarras && (
                          <span className="text-muted-foreground mr-2 font-mono text-xs">
                            {product.codigoBarras}
                          </span>
                        )}
                        {product.nombre}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {(selectedProductMetadata || selectedProductName === "all") && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {selectedProductName === "all" ? "Vista" : "Producto"}
                    </p>
                    <p className="text-lg font-bold text-foreground truncate max-w-[160px]" title={selectedProductName === "all" ? "Todos los productos" : selectedProductMetadata?.nombre}>
                      {selectedProductName === "all" ? "Todos los productos" : selectedProductMetadata?.nombre}
                    </p>
                    {selectedProductMetadata && (
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground mt-1">
                        <span>
                          {selectedProductMetadata.presentacion} x {selectedProductMetadata.cantidadPorPresentacion} {selectedProductMetadata.unidadBase}s
                        </span>
                        {(() => {
                          const desglosado = obtenerStockDesglosado(selectedProductMetadata.stockUnidad || 0, selectedProductMetadata.cantidadPorPresentacion || 1)
                          return (
                            <span className="text-foreground/80 font-medium">
                              Stock: {desglosado.stockPresentacion} {selectedProductMetadata.presentacion}{desglosado.stockPresentacion !== 1 ? 's' : ''}
                              {desglosado.unidadesSueltas > 0 ? ` + ${desglosado.unidadesSueltas} ${selectedProductMetadata.unidadBase}${desglosado.unidadesSueltas !== 1 ? 's' : ''}` : ''}
                            </span>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Entradas</p>
                    <p className="text-3xl font-bold text-accent">
                      {isLoading ? "..." : formatQuantity(totalEntradas)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedProductMetadata ? selectedProductMetadata.unidadBase : "unidades"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/10 shrink-0">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Salidas</p>
                    <p className="text-3xl font-bold text-destructive">
                      {isLoading ? "..." : formatQuantity(totalSalidas)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedProductMetadata ? selectedProductMetadata.unidadBase : "unidades"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 shrink-0">
                    <TrendingDown className="h-6 w-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Stock Valorizado</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {isLoading ? "..." : formatCurrency(valorizado)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Costo total del stock
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 shrink-0">
                    <Coins className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {role === UserRole.ADMIN && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Beneficio Neto</p>
                      <p className="text-3xl font-bold text-green-600">
                        {isLoading ? "..." : formatCurrency(beneficioNeto)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ganancia de salidas
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 shrink-0">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historial de Movimientos</CardTitle>
                    <CardDescription>Total: {filteredEntries.length} registros</CardDescription>
                  </div>
                  <Button onClick={exportToExcel} variant="outline" className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Exportar a Excel
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha Inicio</label>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      placeholder="Fecha inicio"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha Fin</label>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      placeholder="Fecha fin"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto max-w-[1600px] mx-auto">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px] min-w-[110px] max-w-[110px] text-center">Fecha y Hora</TableHead>
                      {selectedProductName === "all" && (
                        <>
                          <TableHead className="w-[280px] min-w-[280px] max-w-[280px] text-left">Producto</TableHead>
                          <TableHead className="w-[130px] min-w-[130px] max-w-[130px] text-center">GTIN</TableHead>
                        </>
                      )}
                      <TableHead className="w-[100px] min-w-[100px] text-center">Tipo</TableHead>
                      <TableHead className="w-[200px] min-w-[200px] max-w-[200px] text-left">Motivo</TableHead>
                      <TableHead className="w-[130px] min-w-[130px] max-w-[130px] text-center">Cantidad</TableHead>
                      <TableHead className="text-right w-[90px] min-w-[90px] max-w-[90px] text-center">Entrada</TableHead>
                      <TableHead className="text-right w-[90px] min-w-[90px] max-w-[90px] text-center">Salida</TableHead>
                      <TableHead className="text-right w-[130px] min-w-[130px] max-w-[130px] text-center">Stock Anterior</TableHead>
                      <TableHead className="text-right w-[90px] min-w-[90px] max-w-[90px] text-center">Saldo</TableHead>
                      <TableHead className="w-[115px] min-w-[115px] max-w-[115px] text-center">Lote</TableHead>
                      <TableHead className="w-[130px] min-w-[130px] max-w-[130px] text-center">Usuario</TableHead>
                      <TableHead className="w-[125px] min-w-[125px] max-w-[125px] text-center">Guía</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableSkeleton columns={selectedProductName === "all" ? 13 : 11} rows={8} />
                    ) : filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={selectedProductName === "all" ? 13 : 11}
                          className="text-center text-muted-foreground py-8"
                        >
                          No se encontraron movimientos
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedEntries.map((entry) => {
                        const cantidadTexto =
                          entry.tipoUnidad === "presentacion" && entry.cantidadPresentacion && selectedProductMetadata
                            ? `${formatQuantity(entry.cantidadPresentacion)} ${selectedProductMetadata.presentacion.toLowerCase()} (${formatQuantity(entry.cantidadUnidad)} ${selectedProductMetadata.unidadBase})`
                            : `${formatQuantity(entry.cantidadUnidad)} ${selectedProductMetadata?.unidadBase || ""}`

                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium w-[110px] min-w-[110px] max-w-[110px] text-center text-xs">
                              <span className="block">{formatLocalDate(entry.fecha)}</span>
                              <span className="block text-muted-foreground">{formatLocalTime(entry.fecha)}</span>
                            </TableCell>
                            {selectedProductName === "all" && (
                              <>
                                <TableCell className="text-sm w-[280px] min-w-[280px] max-w-[280px] text-left">
                                  <span className="truncate block max-w-[270px] cursor-default font-medium" title={entry.productoNombre}>
                                    {entry.productoNombre}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm font-mono w-[130px] min-w-[130px] max-w-[130px] break-all text-center">{entry.productoCodigo}</TableCell>
                              </>
                            )}
                            <TableCell className="w-[100px] min-w-[100px] max-w-[100px] text-center">
                              <Badge variant={entry.tipo === "Ingreso" ? "default" : "secondary"}>{entry.tipo}</Badge>
                            </TableCell>
                            <TableCell className="text-sm w-[200px] min-w-[200px] max-w-[200px] break-words whitespace-normal text-left">{entry.motivo}</TableCell>
                            <TableCell className="text-sm w-[130px] min-w-[130px] max-w-[130px] break-words whitespace-normal text-center">
                              {cantidadTexto}
                              {entry.tipoUnidad && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {entry.tipoUnidad}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-accent w-[90px] min-w-[90px] max-w-[90px] text-center">
                              {entry.entrada > 0 ? `+${formatQuantity(entry.entrada)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-bold text-destructive w-[90px] min-w-[90px] max-w-[90px] text-center">
                              {entry.salida > 0 ? `-${formatQuantity(entry.salida)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground font-medium w-[130px] min-w-[130px] max-w-[130px] text-center">
                              {formatQuantity(entry.stockAnterior)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-foreground w-[90px] min-w-[90px] max-w-[90px] text-center">{formatQuantity(entry.saldo)}</TableCell>
                            <TableCell className="font-mono text-xs w-[115px] min-w-[115px] max-w-[115px] text-center">{entry.lote || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground w-[130px] min-w-[130px] max-w-[130px] break-words text-center">{entry.usuario}</TableCell>
                            <TableCell className="w-[125px] min-w-[125px] max-w-[125px] text-center">
                              {entry.tipo === "Salida" && !entry.id.startsWith("inicial") ? (() => {
                                const guiasList = entry.guiasSalida || (entry.guiaSalida ? [entry.guiaSalida] : [])
                                const cantEmitida = guiasList.reduce((sum, g) => sum + g.cantidad, 0)
                                const totalCant = entry.cantidadUnidad

                                return (
                                  <Button
                                    variant={cantEmitida >= totalCant ? "outline" : cantEmitida > 0 ? "outline" : "ghost"}
                                    size="sm"
                                    onClick={() => {
                                      setSelectedMovementForGuia({
                                        id: entry.id,
                                        productoId: entry.id,
                                        productoNombre: entry.productoNombre || selectedProductMetadata?.nombre || "Medicamento",
                                        tipo: "Salida",
                                        cantidadUnidad: entry.cantidadUnidad,
                                        tipoUnidad: "unidad",
                                        motivo: entry.motivo,
                                        lote: entry.lote,
                                        fechaExpiracion: entry.fechaExpiracion,
                                        usuario: entry.usuario,
                                        fecha: entry.fecha,
                                        guiaSalida: entry.guiaSalida,
                                        guiasSalida: guiasList,
                                      })
                                      setIsGuiaModalOpen(true)
                                    }}
                                    className={cn(
                                      "h-7 px-2 text-xs font-mono font-bold gap-1",
                                      cantEmitida >= totalCant
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                        : cantEmitida > 0
                                        ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                                        : "text-primary hover:bg-primary/10"
                                    )}
                                    title={
                                      cantEmitida >= totalCant
                                        ? `Guías emitidas (${guiasList.length} guías / ${cantEmitida} u.)`
                                        : cantEmitida > 0
                                        ? `Guías parciales: ${cantEmitida} de ${totalCant} u. emitidas`
                                        : "Emitir Guías de Salida Controladas"
                                    }
                                  >
                                    <FileText className="h-3 w-3" />
                                    {cantEmitida >= totalCant
                                      ? `Guías (${guiasList.length})`
                                      : cantEmitida > 0
                                      ? `Guías ${cantEmitida}/${totalCant}`
                                      : "+ Emitir Guías"}
                                  </Button>
                                )
                              })() : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {!isLoading && filteredEntries.length > 0 && (
                <DataTablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredEntries.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(newSize) => {
                    setItemsPerPage(newSize)
                    setCurrentPage(1)
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de Guía de Salida para Medicamentos Controlados */}
      <GuiaSalidaControladoDialog
        isOpen={isGuiaModalOpen}
        onClose={() => {
          setIsGuiaModalOpen(false)
        }}
        movement={selectedMovementForGuia}
        onGuiaSaved={handleGuiaSaved}
      />
    </div>
  )
}
