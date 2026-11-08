"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  MagnifyingGlass as Search,
  DotsThreeVertical as MoreVertical,
  PencilSimple as Edit,
  Trash as Trash2,
  Warning as AlertTriangle,
  CalendarBlank as Calendar,
  ClockCounterClockwise as History,
  FileXls as FileSpreadsheet,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  ArrowsDownUp as ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react"
import { ProductDialog } from "@/components/products/product-dialog"
import { BulkUploadDialog } from "@/components/products/bulk-upload-dialog"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as XLSX from "xlsx"


import type { Product } from "@/lib/types"
import { obtenerStockDesglosado, calcularTotalStock } from "@/lib/inventory"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useUserRole } from "@/hooks/use-user-role"
import { hasPermission, UserRole } from "@/lib/roles"
import { toast } from "sonner"
import { formatCurrency, formatQuantity } from "@/lib/number-utils"

interface ProductAudit {
  id: string
  productName: string
  campoEditado: string
  valorAnterior: string
  valorNuevo: string
  usuario: string
  fecha: string
}


import { useProducts, useProductAudit } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"

export default function InventarioPage() {
  const { data: rawProductsData = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts()
  const { data: rawAuditsData = [], isLoading: isLoadingAudits, refetch: refetchAudits } = useProductAudit()

  const [searchTerm, setSearchTerm] = useState("")
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [auditItemsPerPage, setAuditItemsPerPage] = useState(15)
  const [auditCurrentPage, setAuditCurrentPage] = useState(1)
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingLotesAsociados, setEditingLotesAsociados] = useState<Array<Partial<Product>>>([])
  const { user, role } = useUserRole()

  const handleOpenEditDialog = (product: Product) => {
    const targetId = product.productId || product.id
    const lotes = products.filter((p) => (p.productId || p.id) === targetId)
    setEditingProduct(product)
    setEditingLotesAsociados(lotes)
    setIsEditDialogOpen(true)
  }

  const canEdit = hasPermission(user, 'canEditInventory')
  const canBulkUpload = hasPermission(user, 'canBulkUpload')
  const canCreate = hasPermission(user, 'canCreateProducts')

  const isLoading = isLoadingProducts

  const audits: ProductAudit[] = rawAuditsData || []

  // Transform Backend Data (Hierarchical) to Frontend Data (Flat per Batch)
  const products: Product[] = useMemo(() => {
    return rawProductsData.flatMap((bp: any) => {
      const formatTipo = (backendTipo: string): "Medicamento" | "Dispositivo Médico" => {
        if (!backendTipo) return "Medicamento";
        const upper = backendTipo.toUpperCase();
        if (upper.includes("MEDICAMENTO")) return "Medicamento";
        if (upper.includes("DISPOSITIVO")) return "Dispositivo Médico";
        return "Medicamento";
      }

      if (!bp.batches || bp.batches.length === 0) {
        return [{
          id: bp.id,
          codigoBarras: bp.codigoBarras || "",
          nombre: bp.nombre,
          descripcionCorta: bp.descripcion || "",
          tipo: formatTipo(bp.tipo),
          lote: "SIN-LOTE",
          fechaExpiracion: new Date().toISOString(),
          registroSanitario: bp.registroSanitario || "",
          laboratorio: bp.laboratorio || "",
          presentacion: bp.presentacion || "Unidad",
          cantidadPorPresentacion: bp.cantidadPorPresentacion || 1,
          unidadBase: bp.unidadBase || "Unidad",
          stockUnidad: 0,
          stockMinimo: bp.stockMinimo || 0,
          precioCostoPresentacion: bp.precioCostoPresentacion || 0,
          precioVentaPresentacion: bp.precioVentaPresentacion || 0,
          precioCostoUnidad: (bp.cantidadPorPresentacion || 1) > 0 ? ((bp.precioCostoPresentacion || 0) / (bp.cantidadPorPresentacion || 1)) : 0,
          precioVentaUnidad: (bp.cantidadPorPresentacion || 1) > 0 ? ((bp.precioVentaPresentacion || 0) / (bp.cantidadPorPresentacion || 1)) : 0,
          fechaCreacion: bp.createdAt || new Date().toISOString(),
          ultimaActualizacion: bp.updatedAt || new Date().toISOString(),
        }]
      }

      return bp.batches.map((batch: any) => {
        const cantXPres = batch.cantidadPorPresentacion || bp.cantidadPorPresentacion || 1;
        const pCostoPres = batch.precioCostoPresentacion > 0 ? batch.precioCostoPresentacion : (bp.precioCostoPresentacion || 0);
        const pVentaPres = batch.precioVentaPresentacion > 0 ? batch.precioVentaPresentacion : (bp.precioVentaPresentacion || 0);

        return {
          id: batch.id,
          productId: bp.id,
          codigoBarras: bp.codigoBarras || "",
          nombre: bp.nombre,
          descripcionCorta: bp.descripcion || "",
          tipo: formatTipo(bp.tipo),
          lote: batch.codigo,
          fechaExpiracion: batch.fechaExpiracion,
          registroSanitario: bp.registroSanitario || "",
          laboratorio: batch.laboratorio || bp.laboratorio || "",
          presentacion: bp.presentacion || "Unidad",
          cantidadPorPresentacion: cantXPres,
          unidadBase: bp.unidadBase || "Unidad",
          stockUnidad: batch.stockActual,
          stockMinimo: bp.stockMinimo || 0,
          precioCostoPresentacion: pCostoPres,
          precioVentaPresentacion: pVentaPres,
          precioCostoUnidad: cantXPres > 0 ? (pCostoPres / cantXPres) : 0,
          precioVentaUnidad: cantXPres > 0 ? (pVentaPres / cantXPres) : 0,
          fechaCreacion: bp.createdAt || new Date().toISOString(),
          ultimaActualizacion: bp.updatedAt || new Date().toISOString(),
        }
      })
    })
  }, [rawProductsData])

  const fetchProducts = async (_silent = false) => {
    refetchProducts()
  }

  const fetchAudits = async () => {
    refetchAudits()
  }



  const [filterTipo, setFilterTipo] = useState<string>("all")
  const [filterStockState, setFilterStockState] = useState<string>("all")
  const [sortField, setSortField] = useState<"nombre" | "tipo" | "stock" | "precioCosto" | "precioVenta" | "expiracion" | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null)

  const handleSort = (field: "nombre" | "tipo" | "stock" | "precioCosto" | "precioVenta" | "expiracion") => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc")
      } else if (sortOrder === "desc") {
        setSortField(null)
        setSortOrder(null)
      }
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.codigoBarras.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.registroSanitario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.lote || "").toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTipo = filterTipo === "all" || product.tipo === filterTipo

    return matchesSearch && matchesTipo
  })

  // Group products by GTIN
  const groupedProducts: Record<string, Product[]> = filteredProducts.reduce((acc: Record<string, Product[]>, product: Product) => {
    const key = product.codigoBarras || "SIN-GTIN-" + product.id
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  let groupedEntries = Object.entries(groupedProducts)

  if (filterStockState !== "all") {
    groupedEntries = groupedEntries.filter(([_, lots]) => {
      const totalStock = lots.reduce((sum, b) => sum + b.stockUnidad, 0)
      const stockMin = lots[0]?.stockMinimo || 0
      if (filterStockState === "con_stock") return totalStock > stockMin
      if (filterStockState === "stock_bajo") return totalStock <= stockMin && totalStock > 0
      if (filterStockState === "sin_stock") return totalStock === 0
      return true
    })
  }

  if (sortField && sortOrder) {
    groupedEntries.sort(([_, lotsA], [__, lotsB]) => {
      const prodA = lotsA[0]
      const prodB = lotsB[0]
      let valA: any
      let valB: any
      if (sortField === "nombre") {
        valA = prodA.nombre.toLowerCase()
        valB = prodB.nombre.toLowerCase()
      } else if (sortField === "tipo") {
        valA = prodA.tipo.toLowerCase()
        valB = prodB.tipo.toLowerCase()
      } else if (sortField === "stock") {
        valA = lotsA.reduce((sum, b) => sum + b.stockUnidad, 0)
        valB = lotsB.reduce((sum, b) => sum + b.stockUnidad, 0)
      } else if (sortField === "precioCosto") {
        valA = prodA.precioCostoPresentacion
        valB = prodB.precioCostoPresentacion
      } else if (sortField === "precioVenta") {
        valA = prodA.precioVentaPresentacion
        valB = prodB.precioVentaPresentacion
      } else if (sortField === "expiracion") {
        const getEarliestExp = (lots: Product[]) => {
          const dates = lots.map(l => l.fechaExpiracion ? new Date(l.fechaExpiracion).getTime() : Infinity)
          return dates.length > 0 ? Math.min(...dates) : Infinity
        }
        valA = getEarliestExp(lotsA)
        valB = getEarliestExp(lotsB)
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterTipo, filterStockState])

  // Pagination Logic
  const totalItems = groupedEntries.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedEntries = groupedEntries.slice(startIndex, startIndex + itemsPerPage)

  const showingStart = totalItems === 0 ? 0 : startIndex + 1
  const showingEnd = Math.min(startIndex + itemsPerPage, totalItems)

  // Audit Pagination Logic
  const totalAuditItems = audits.length
  const totalAuditPages = Math.ceil(totalAuditItems / auditItemsPerPage)
  const auditStartIndex = (auditCurrentPage - 1) * auditItemsPerPage
  const paginatedAudits = audits.slice(auditStartIndex, auditStartIndex + auditItemsPerPage)

  const showingAuditStart = totalAuditItems === 0 ? 0 : auditStartIndex + 1
  const showingAuditEnd = Math.min(auditStartIndex + auditItemsPerPage, totalAuditItems)

  const handleSaveProduct = async (productData: Partial<Product> & { motivoAjuste?: string; isNuevoLote?: boolean }) => {
    try {
      const cleanCodigoBarras = productData.codigoBarras !== undefined 
        ? (productData.codigoBarras && productData.codigoBarras.trim() !== "" ? productData.codigoBarras.trim() : null) 
        : undefined
      const cleanDescripcion = productData.descripcionCorta !== undefined 
        ? (productData.descripcionCorta && productData.descripcionCorta.trim() !== "" ? productData.descripcionCorta.trim() : null) 
        : undefined
      const cleanRegistro = productData.registroSanitario !== undefined 
        ? (productData.registroSanitario && productData.registroSanitario.trim() !== "" ? productData.registroSanitario.trim() : null) 
        : undefined
      const cleanLab = productData.laboratorio !== undefined 
        ? (productData.laboratorio && productData.laboratorio.trim() !== "" ? productData.laboratorio.trim() : null) 
        : undefined

      if (!productData.id && productData.nombre) {
        // CREATE NEW PRODUCT
        const toastId = toast.loading("Creando nuevo producto...")

        const cleanLote = productData.lote && productData.lote.trim() !== "" ? productData.lote.trim() : null
        const cleanFechaExp = productData.fechaExpiracion && productData.fechaExpiracion.trim() !== "" ? productData.fechaExpiracion.trim() : null
        const cleanStock = typeof productData.stockUnidad === "number" && !isNaN(productData.stockUnidad)
          ? productData.stockUnidad
          : (productData.stockUnidad !== undefined && productData.stockUnidad !== null && !isNaN(Number(productData.stockUnidad)) ? Number(productData.stockUnidad) : 0)

        const cantXPres = typeof productData.cantidadPorPresentacion === "number" && productData.cantidadPorPresentacion > 0
          ? productData.cantidadPorPresentacion
          : (productData.cantidadPorPresentacion ? Number(productData.cantidadPorPresentacion) : 1)

        const stockMin = typeof productData.stockMinimo === "number" && productData.stockMinimo >= 0
          ? productData.stockMinimo
          : (productData.stockMinimo ? Number(productData.stockMinimo) : 0)

        const pCostoPres = typeof productData.precioCostoPresentacion === "number" && productData.precioCostoPresentacion >= 0
          ? productData.precioCostoPresentacion
          : (productData.precioCostoPresentacion ? Number(productData.precioCostoPresentacion) : 0)

        const pVentaPres = typeof productData.precioVentaPresentacion === "number" && productData.precioVentaPresentacion >= 0
          ? productData.precioVentaPresentacion
          : (productData.precioVentaPresentacion ? Number(productData.precioVentaPresentacion) : 0)

        const newBackendProduct = {
          nombre: productData.nombre.trim(),
          codigoBarras: cleanCodigoBarras,
          descripcion: cleanDescripcion,
          tipo: productData.tipo,
          laboratorio: cleanLab,
          registroSanitario: cleanRegistro,
          presentacion: productData.presentacion ?? null,
          unidadBase: productData.unidadBase ?? null,
          cantidadPorPresentacion: cantXPres,
          stockMinimo: stockMin,
          precioCostoPresentacion: pCostoPres,
          precioVentaPresentacion: pVentaPres,
          lote: cleanLote,
          fechaExpiracion: cleanFechaExp,
          stockUnidad: cleanStock,
          usuario: user?.user_metadata?.full_name ?? user?.email ?? 'Usuario',
        }
        try {
          const created = await api.post('/products', newBackendProduct)
          toast.success(`Producto "${created?.nombre ?? productData.nombre}" creado exitosamente`, { id: toastId })
          await fetchProducts(true)
          await fetchAudits()
        } catch (err: any) {
          toast.error(`Error al crear producto: ${err.message ?? 'Error desconocido'}`, { id: toastId })
        }
      } else if (productData.id) {
        // ACTUALIZAR EXISTENTE (Producto y Lote) - Actualización Granular In-Place (0ms)
        const prodId = productData.productId || productData.id
        const batchId = productData.id
        const isNewBatch = productData.isNuevoLote || productData.id === "NUEVO_LOTE"

        const cantXPres = Number(productData.cantidadPorPresentacion) || 1
        const pCostoPres = Number(productData.precioCostoPresentacion) || 0
        const pVentaPres = Number(productData.precioVentaPresentacion) || 0

        // Sincronización en servidor con notificación toast
        const toastId = toast.loading(`Guardando cambios de "${productData.nombre}"...`)

        const productUpdatePromise = api.put(`/products/${prodId}`, {
          nombre: productData.nombre ? productData.nombre.trim() : undefined,
          codigoBarras: cleanCodigoBarras,
          descripcion: cleanDescripcion,
          tipo: productData.tipo,
          laboratorio: cleanLab,
          registroSanitario: cleanRegistro,
          presentacion: productData.presentacion,
          unidadBase: productData.unidadBase,
          cantidadPorPresentacion: cantXPres,
          stockMinimo: Number(productData.stockMinimo) || 0,
          precioCostoPresentacion: pCostoPres,
          precioVentaPresentacion: pVentaPres,
          usuario: user?.user_metadata?.full_name || 'Usuario',
        })

        let batchPromise: Promise<any> | null = null

        if (isNewBatch) {
          batchPromise = api.post(`/batches`, {
            productId: prodId,
            codigo: productData.lote ? productData.lote.trim() : "LOTE-NUEVO",
            fechaExpiracion: productData.fechaExpiracion,
            stockActual: Number(productData.stockUnidad) || 0,
            precioCostoPresentacion: pCostoPres,
            precioVentaPresentacion: pVentaPres,
            laboratorio: cleanLab,
            usuario: user?.user_metadata?.full_name || 'Usuario'
          })
        } else if (batchId && batchId !== prodId && batchId !== "SIN-LOTE") {
          batchPromise = api.put(`/batches/${batchId}`, {
            codigo: productData.lote ? productData.lote.trim() : undefined,
            fechaExpiracion: productData.fechaExpiracion,
            stockActual: productData.stockUnidad !== undefined ? Number(productData.stockUnidad) : undefined,
            precioCostoPresentacion: pCostoPres,
            precioVentaPresentacion: pVentaPres,
            laboratorio: cleanLab,
            motivo: productData.motivoAjuste,
            usuario: user?.user_metadata?.full_name || 'Usuario'
          })
        }

        try {
          if (batchPromise) {
            await Promise.all([productUpdatePromise, batchPromise])
          } else {
            await productUpdatePromise
          }
          toast.success("Producto y lote actualizados exitosamente.", { id: toastId })
          await refetchProducts()
          await fetchAudits()
        } catch (err: any) {
          console.error("Error al persistir cambios en el servidor:", err)
          toast.error(`Error al guardar: ${err.message || 'Error en servidor'}`, { id: toastId, duration: 6000 })
        }
      }
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || "Error al guardar el producto")
    }
  }

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return
    try {
      setIsDeletingProduct(true)
      await api.delete(`/products/${productToDelete.id}`)
      toast.success(`Producto "${productToDelete.name}" eliminado del inventario activo.`)
      setProductToDelete(null)
      await fetchProducts(true)
      await fetchAudits()
    } catch (e: any) {
      console.error(e)
      toast.error(`Error al eliminar el producto: ${e.message || "Error desconocido"}`)
    } finally {
      setIsDeletingProduct(false)
    }
  }

  const estaProximoAVencer = (fechaExpiracion: string) => {
    const fechaExp = new Date(fechaExpiracion)
    const hoy = new Date()
    const diffTime = fechaExp.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 && diffDays <= 30
  }

  const estaVencido = (fechaExpiracion: string) => {
    return new Date(fechaExpiracion) < new Date()
  }

  const exportToExcel = () => {
    const exportData = filteredProducts.map(p => {
      let expFormatted = ""
      if (p.fechaExpiracion) {
        try {
          expFormatted = format(new Date(p.fechaExpiracion), "dd/MM/yyyy")
        } catch (_) {
          expFormatted = ""
        }
      }

      return {
        "GTIN": p.codigoBarras || "",
        "Nombre": p.nombre || "",
        "Tipo": p.tipo || "Medicamento",
        "RS": p.registroSanitario || "",
        "Laboratorio": p.laboratorio || "",
        "Presentacion": p.presentacion || "Caja",
        "Cantidad_x_Pres": Number(p.cantidadPorPresentacion) || 1,
        "Unidad_Base": p.unidadBase || "Unidad",
        "Stock_Min": Number(p.stockMinimo) || 0,
        "Lote_Inicial": p.lote || "",
        "Expiracion": expFormatted,
        "Stock_Inicial": Number(p.stockUnidad) || 0,
        "Precio_Costo_Pres": Number(p.precioCostoPresentacion) || 0,
        "Precio_Venta_Pres": Number(p.precioVentaPresentacion) || 0,
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Carga")

    ws['!cols'] = [
      { wch: 15 }, // GTIN
      { wch: 30 }, // Nombre
      { wch: 15 }, // Tipo
      { wch: 15 }, // RS
      { wch: 20 }, // Laboratorio
      { wch: 15 }, // Presentacion
      { wch: 15 }, // Cantidad_x_Pres
      { wch: 15 }, // Unidad_Base
      { wch: 12 }, // Stock_Min
      { wch: 15 }, // Lote_Inicial
      { wch: 15 }, // Expiracion
      { wch: 12 }, // Stock_Inicial
      { wch: 18 }, // Precio_Costo_Pres
      { wch: 18 }  // Precio_Venta_Pres
    ]

    XLSX.writeFile(wb, `Inventario_SysFarm_${format(new Date(), "yyyyMMdd")}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventario de Farmacia</h1>
          <p className="text-muted-foreground mt-1">Gestiona medicamentos e insumos por lotes</p>
        </div>
        <div className="flex gap-2">
          {canBulkUpload && <BulkUploadDialog onSuccess={fetchProducts} />}
          {canCreate && <ProductDialog onSave={handleSaveProduct} />}
          <Button onClick={exportToExcel} variant="outline" className="gap-2 border-green-600/50 text-green-700 hover:bg-green-50">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Exportar
          </Button>
        </div>

      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle>Lista de Medicamentos e Insumos</CardTitle>
              <CardDescription>
                {isLoading
                  ? "Cargando..."
                  : `Total: ${totalItems} producto${totalItems !== 1 ? 's' : ''} (${filteredProducts.length} lotes)`
                }
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, GTIN, R.S o lote..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo de producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Medicamento">Medicamentos</SelectItem>
                  <SelectItem value="Dispositivo Médico">Dispositivos Médicos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStockState} onValueChange={setFilterStockState}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado de stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los stocks</SelectItem>
                  <SelectItem value="con_stock">Con Stock</SelectItem>
                  <SelectItem value="stock_bajo">Stock Bajo</SelectItem>
                  <SelectItem value="sin_stock">Sin Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">GTIN</TableHead>
                  <TableHead className="min-w-[150px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-bold"
                      onClick={() => handleSort("nombre")}
                    >
                      Nombre
                      {sortField === "nombre" ? (
                        sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Present.</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 font-bold"
                      onClick={() => handleSort("expiracion")}
                    >
                      EXP
                      {sortField === "expiracion" ? (
                        sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>R.S.</TableHead>
                  <TableHead>Laboratorio</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8 font-bold ml-auto"
                      onClick={() => handleSort("stock")}
                    >
                      Stock
                      {sortField === "stock" ? (
                        sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8 font-bold ml-auto"
                      onClick={() => handleSort("precioCosto")}
                    >
                      Precio Costo
                      {sortField === "precioCosto" ? (
                        sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Estado</TableHead>
                  {(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) && (
                    <TableHead className="w-[50px]"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columns={(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) ? 11 : 10} rows={10} columnWidths={["w-28", "w-44", "w-28", "w-24", "w-24", "w-28", "w-24", "w-20", "w-24", "w-20"]} />
                ) : Object.keys(groupedProducts).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) ? 11 : 10} className="text-center text-muted-foreground py-8">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEntries.map(([gtin, lots]) => {
                    return lots.map((product, index) => {
                      const isFirstRow = index === 0
                      const isLastRow = index === lots.length - 1
                      const rowSpan = lots.length

                      const stockDesglosado = obtenerStockDesglosado(product.stockUnidad, product.cantidadPorPresentacion)
                      const proximoAVencer = product.fechaExpiracion ? estaProximoAVencer(product.fechaExpiracion) : false
                      const vencido = product.fechaExpiracion ? estaVencido(product.fechaExpiracion) : false
                      const sinStock = product.stockUnidad === 0
                      const stockBajo = product.stockUnidad > 0 && product.stockUnidad <= product.stockMinimo

                      return (
                        <TableRow
                          key={product.id}
                          className={cn(
                            !isLastRow && "border-b-0",
                            "hover:bg-muted/50"
                          )}
                        >
                          {/* Shared Columns */}
                          {isFirstRow && (
                            <>
                              <TableCell rowSpan={rowSpan} className="font-mono text-sm align-top bg-background border-r">
                                {product.codigoBarras}
                              </TableCell>
                              <TableCell rowSpan={rowSpan} className="align-top bg-background border-r">
                                <span className="font-medium truncate block max-w-[280px] cursor-default" title={product.nombre}>{product.nombre}</span>
                              </TableCell>
                            </>
                          )}

                          {/* Varied Columns per Lot */}
                          <TableCell className="align-top">
                            <div className="text-sm">
                              <p>{product.presentacion}</p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatQuantity(product.cantidadPorPresentacion)} {product.unidadBase}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell className="font-mono text-xs font-medium align-top">{product.lote}</TableCell>
                          <TableCell className="font-mono text-xs align-top">
                            {product.fechaExpiracion ? format(new Date(product.fechaExpiracion), "dd/MM/yyyy") : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground align-top">{product.registroSanitario}</TableCell>
                          <TableCell className="text-xs align-top">{product.laboratorio}</TableCell>

                          <TableCell className="text-right align-top">
                            <div className="flex flex-col items-end">
                              <span className={
                                sinStock
                                  ? "text-red-600 dark:text-red-400 font-bold"
                                  : stockBajo
                                  ? "text-amber-600 dark:text-amber-500 font-bold"
                                  : "text-emerald-700 dark:text-emerald-400 font-semibold"
                              }>
                                {formatQuantity(product.stockUnidad)} {product.unidadBase}
                              </span>
                              {(stockDesglosado.stockPresentacion > 0 || stockDesglosado.unidadesSueltas > 0) && (
                                <span className="text-xs text-muted-foreground">
                                  ({[
                                    stockDesglosado.stockPresentacion > 0 ? `${formatQuantity(stockDesglosado.stockPresentacion)} ${product.presentacion}s` : null,
                                    stockDesglosado.unidadesSueltas > 0 ? `${formatQuantity(stockDesglosado.unidadesSueltas)} sueltas` : null
                                  ].filter(Boolean).join(" + ")})
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right align-top">
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-sm whitespace-nowrap">
                                {formatCurrency(product.precioCostoPresentacion)} / {product.presentacion}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatCurrency(product.precioCostoUnidad)} / {product.unidadBase}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            <div className="flex flex-col gap-1">
                              {vencido && (
                                <Badge variant="destructive" className="w-fit gap-1 text-[10px] px-1.5 py-0 h-5 bg-red-600 hover:bg-red-600/90 text-white font-medium">
                                  <AlertTriangle className="h-3 w-3" /> Vencido
                                </Badge>
                              )}
                              {!vencido && proximoAVencer && (
                                <Badge variant="outline" className="w-fit gap-1 text-[10px] px-1.5 py-0 h-5 border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 font-medium">
                                  <Calendar className="h-3 w-3" /> Prox. Vencer
                                </Badge>
                              )}
                              {sinStock && (
                                <Badge variant="destructive" className="w-fit gap-1 text-[10px] px-1.5 py-0 h-5 bg-red-600 hover:bg-red-600/90 text-white font-medium">
                                  Sin Stock
                                </Badge>
                              )}
                              {stockBajo && (
                                <Badge variant="outline" className="w-fit gap-1 text-[10px] px-1.5 py-0 h-5 border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 font-medium">
                                  <AlertTriangle className="h-3 w-3" /> Stock Bajo
                                </Badge>
                              )}
                              {!vencido && !proximoAVencer && !sinStock && !stockBajo && (
                                <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 h-5 text-emerald-600 border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 font-medium">
                                  Normal
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {canEdit && (
                            <TableCell className="align-top">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canEdit ? (
                                    <>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => handleOpenEditDialog(product)}
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Editar Producto/Lote
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive cursor-pointer"
                                        onClick={() => setProductToDelete({ id: product.productId || product.id, name: product.nombre })}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar Producto
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <DropdownMenuItem disabled>
                                      No tienes permisos para editar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>

                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {!isLoading && totalItems > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
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

      {role === UserRole.ADMIN && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Historial de Ediciones de Productos</h2>
          </div>
          <Card className="border-blue-200">
            <CardHeader className="bg-blue-50/50">
              <CardDescription>
                Registro de cambios realizados en los datos maestros de productos por administradores.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Valor Nuevo</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingAudits ? (
                    <TableSkeleton columns={6} rows={5} columnWidths={["w-28", "w-44", "w-24", "w-24", "w-24", "w-20"]} />
                  ) : audits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                        No hay ediciones registradas aún.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAudits.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell className="text-xs">
                          {format(new Date(audit.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">{audit.productName}</TableCell>
                        <TableCell className="capitalize text-xs font-mono">{audit.campoEditado}</TableCell>
                        <TableCell className="text-xs text-muted-foreground line-through">{audit.valorAnterior}</TableCell>
                        <TableCell className="text-xs font-medium text-blue-600">{audit.valorNuevo}</TableCell>
                        <TableCell className="text-xs">{audit.usuario}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Paginación de Auditoría */}
              {!isLoading && totalAuditItems > 0 && (
                <DataTablePagination
                  currentPage={auditCurrentPage}
                  totalPages={totalAuditPages}
                  totalItems={totalAuditItems}
                  itemsPerPage={auditItemsPerPage}
                  onPageChange={setAuditCurrentPage}
                  onItemsPerPageChange={(newSize) => {
                    setAuditItemsPerPage(newSize)
                    setAuditCurrentPage(1)
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {/* Modal de Confirmación de Eliminación de Producto */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deseas eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <span className="block">
                El producto <strong className="text-foreground">{productToDelete?.name}</strong> y sus lotes asociados se ocultarán del inventario activo y de las opciones de selección para nuevos pedidos.
              </span>
              <span className="text-xs bg-muted p-3 rounded-md block border text-muted-foreground leading-relaxed">
                <strong>Nota de Trazabilidad:</strong> El historial de movimientos en el Kardex, auditorías y requerimientos pasados se conservarán 100% intactos para trazabilidad contable.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={isDeletingProduct}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isDeletingProduct}
              onClick={confirmDeleteProduct}
            >
              {isDeletingProduct ? "Eliminando..." : "Eliminar Producto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Centralizado Único de Edición de Producto / Lote */}
      {editingProduct && (
        <ProductDialog
          open={isEditDialogOpen}
          onOpenChange={(isOpen) => {
            setIsEditDialogOpen(isOpen)
            if (!isOpen) {
              setEditingProduct(null)
              setEditingLotesAsociados([])
            }
          }}
          product={editingProduct}
          lotesAsociados={editingLotesAsociados}
          onSave={async (updatedProduct) => {
            await handleSaveProduct(updatedProduct)
            setIsEditDialogOpen(false)
            setEditingProduct(null)
            setEditingLotesAsociados([])
          }}
        />
      )}
    </div>
  )
}
