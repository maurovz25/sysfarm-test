"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    MagnifyingGlass as Search,
    Trash as Trash2,
    Warning as AlertTriangle,
    CalendarBlank as Calendar,
    Package,
    ClockCounterClockwise as History,
    PencilSimple as Edit,
    DotsThreeVertical as MoreVertical,
    ArrowsDownUp as ArrowUpDown,
    ArrowUp,
    ArrowDown,
} from "@phosphor-icons/react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BatchDialog } from "@/components/batches/batch-dialog"
import { ProductDialog } from "@/components/products/product-dialog"
import type { Product } from "@/lib/types"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { Separator } from "@/components/ui/separator"
import { useUserRole } from "@/hooks/use-user-role"
import { hasPermission, UserRole } from "@/lib/roles"
import { toast } from "sonner"
import { formatCurrency, formatQuantity } from "@/lib/number-utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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

interface Batch {
    id: string
    codigo: string
    fechaExpiracion: string
    stockActual: number
    cantidadPorPresentacion?: number
    precioCostoPresentacion?: number
    precioVentaPresentacion?: number
    precioCostoUnidad?: number
    precioVentaUnidad?: number
    laboratorio?: string
    productId?: string
    product: {
        id: string
        nombre: string
        tipo: string
        presentacion: string
        unidadBase: string
        cantidadPorPresentacion?: number
        codigoBarras?: string
        descripcion?: string
        registroSanitario?: string
        stockMinimo?: number
        laboratorio?: string
    }
}

interface Adjustment {
    id: string
    tipo: string
    cantidad: number
    fecha: string
    motivo: string
    usuario: string
    product: {
        nombre: string
    }
    batch: {
        codigo: string
    }
}


import { useBatches, useBatchAdjustments } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"

export default function LotesPage() {
    const { data: rawBatches = [], isLoading: isLoadingBatches, refetch: refetchBatches } = useBatches()
    const { data: rawAdjustments = [], isLoading: isLoadingAdjustments, refetch: refetchAdjustments } = useBatchAdjustments()

    const [searchTerm, setSearchTerm] = useState("")
    const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null)
    const [isDeletingBatch, setIsDeletingBatch] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingLotesAsociados, setEditingLotesAsociados] = useState<Array<Partial<Product>>>([])
    const { user, role } = useUserRole()

    const canCreate = hasPermission(user, 'canCreateProducts')
    const canEdit = hasPermission(user, 'canEditInventory')
    const canDelete = hasPermission(user, 'canDeleteBatches')

    const isLoading = isLoadingBatches
    const adjustments: Adjustment[] = rawAdjustments

    const batches: Batch[] = useMemo(() => {
        return rawBatches.map((b: any) => {
            let formattedTipo = "Medicamento";
            if (b.product?.tipo) {
                const upper = b.product.tipo.toUpperCase();
                if (upper.includes("DISPOSITIVO") || upper.includes("INSUMO")) {
                    formattedTipo = "Dispositivo Médico";
                }
            }
            return {
                ...b,
                product: {
                    ...b.product,
                    tipo: formattedTipo
                }
            }
        })
    }, [rawBatches])

    const fetchBatches = async (_silent = false) => {
        refetchBatches()
    }

    const fetchAdjustments = async () => {
        refetchAdjustments()
    }

    const handleOpenEditDialog = (batch: Batch) => {
        const cantXPres = batch.cantidadPorPresentacion || batch.product.cantidadPorPresentacion || 1
        const pCostoPres = batch.precioCostoPresentacion || 0
        const pVentaPres = batch.precioVentaPresentacion || 0
        const pCostoUnit = batch.precioCostoUnidad || (cantXPres > 0 ? pCostoPres / cantXPres : 0)
        const pVentaUnit = batch.precioVentaUnidad || (cantXPres > 0 ? pVentaPres / cantXPres : 0)

        const prod: Product = {
            id: batch.id,
            productId: batch.product.id || batch.productId,
            nombre: batch.product.nombre,
            codigoBarras: batch.product.codigoBarras || "",
            descripcionCorta: batch.product.descripcion || "",
            tipo: batch.product.tipo as any,
            registroSanitario: batch.product.registroSanitario || "",
            presentacion: batch.product.presentacion as any,
            cantidadPorPresentacion: cantXPres,
            unidadBase: batch.product.unidadBase as any,
            stockMinimo: batch.product.stockMinimo || 0,
            lote: batch.codigo,
            fechaExpiracion: batch.fechaExpiracion,
            laboratorio: batch.laboratorio || batch.product.laboratorio || "",
            precioCostoPresentacion: pCostoPres,
            precioVentaPresentacion: pVentaPres,
            stockUnidad: batch.stockActual,
            precioCostoUnidad: pCostoUnit,
            precioVentaUnidad: pVentaUnit,
            fechaCreacion: "",
            ultimaActualizacion: ""
        }

        const lotes = batches
            .filter((b) => (b.product.id === batch.product.id) || (b.productId && b.productId === batch.product.id))
            .map((b) => {
                const bCantXPres = b.cantidadPorPresentacion || b.product.cantidadPorPresentacion || 1
                const bPCostoPres = b.precioCostoPresentacion || 0
                const bPVentaPres = b.precioVentaPresentacion || 0
                return {
                    id: b.id,
                    productId: b.product.id || b.productId,
                    nombre: b.product.nombre,
                    codigoBarras: b.product.codigoBarras || "",
                    descripcionCorta: b.product.descripcion || "",
                    tipo: b.product.tipo as any,
                    registroSanitario: b.product.registroSanitario || "",
                    presentacion: b.product.presentacion as any,
                    cantidadPorPresentacion: bCantXPres,
                    unidadBase: b.product.unidadBase as any,
                    stockMinimo: b.product.stockMinimo || 0,
                    lote: b.codigo,
                    fechaExpiracion: b.fechaExpiracion,
                    laboratorio: b.laboratorio || b.product.laboratorio || "",
                    precioCostoPresentacion: bPCostoPres,
                    precioVentaPresentacion: bPVentaPres,
                    stockUnidad: b.stockActual,
                    precioCostoUnidad: b.precioCostoUnidad || (bCantXPres > 0 ? bPCostoPres / bCantXPres : 0),
                    precioVentaUnidad: b.precioVentaUnidad || (bCantXPres > 0 ? bPVentaPres / bCantXPres : 0),
                }
            })

        setEditingProduct(prod)
        setEditingLotesAsociados(lotes)
        setIsEditDialogOpen(true)
    }

    const handleDeleteBatch = (batch: Batch) => {
        if (batch.stockActual > 0) {
            toast.warning(`No se puede eliminar el lote "${batch.codigo}" porque tiene stock de ${batch.stockActual} unidades. Debe reducir el stock a 0 primero.`)
            return
        }
        setBatchToDelete(batch)
    }

    const handleSaveBatchUnified = async (productData: Partial<Product> & { motivoAjuste?: string; isNuevoLote?: boolean }) => {
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

            const prodId = productData.productId || productData.id
            const batchId = productData.id
            const isNewBatch = productData.isNuevoLote || productData.id === "NUEVO_LOTE"

            if (!prodId) return

            const cantXPres = Number(productData.cantidadPorPresentacion) || 1
            const pCostoPres = Number(productData.precioCostoPresentacion) || 0
            const pVentaPres = Number(productData.precioVentaPresentacion) || 0

            // Peticiones paralelas en segundo plano
            const toastId = toast.loading(`Guardando lote "${productData.lote || productData.nombre}"...`)

            const productPromise = api.put(`/products/${prodId}`, {
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
                    cantidadPorPresentacion: cantXPres,
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
                    cantidadPorPresentacion: cantXPres,
                    precioCostoPresentacion: pCostoPres,
                    precioVentaPresentacion: pVentaPres,
                    laboratorio: cleanLab,
                    motivo: productData.motivoAjuste,
                    usuario: user?.user_metadata?.full_name || 'Usuario'
                })
            }

            try {
                if (batchPromise) {
                    await Promise.all([productPromise, batchPromise])
                } else {
                    await productPromise
                }
                toast.success("Producto y lote actualizados exitosamente.", { id: toastId })
                await refetchBatches()
                await fetchAdjustments()
            } catch (err: any) {
                console.error("Error al actualizar producto/lote en servidor:", err)
                toast.error(`Error al guardar: ${err.message || 'Error en servidor'}`, { id: toastId, duration: 6000 })
            }
        } catch (error: any) {
            console.error("Error al actualizar producto/lote:", error)
            toast.error(error.message || "Error al actualizar")
        }
    }

    const confirmDeleteBatch = async () => {
        if (!batchToDelete) return

        try {
            setIsDeletingBatch(true)
            await api.delete(`/products/batch/${batchToDelete.id}`)
            toast.success('Lote eliminado exitosamente. El historial se mantiene en el kardex.')
            setBatchToDelete(null)
            await fetchBatches(true)
            await fetchAdjustments()
        } catch (error: any) {
            console.error('Error al eliminar lote:', error)
            toast.error(error.response?.data?.error || 'Error al eliminar el lote')
        } finally {
            setIsDeletingBatch(false)
        }
    }

    const estaVencido = (fechaExpiracion: string) => {
        return new Date(fechaExpiracion) < new Date()
    }

    const estaProximoAVencer = (fechaExpiracion: string) => {
        const fechaExp = new Date(fechaExpiracion)
        const hoy = new Date()
        const diffTime = fechaExp.getTime() - hoy.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays > 0 && diffDays <= 30
    }

    const obtenerStockDesglosado = (stockTotalUnidad: number, cantidadPorPresentacion?: number) => {
        const cant = cantidadPorPresentacion || 1
        if (cant <= 1) {
            return { stockPresentacion: 0, unidadesSueltas: stockTotalUnidad }
        }
        const stockPresentacion = Math.floor(stockTotalUnidad / cant)
        const unidadesSueltas = stockTotalUnidad % cant
        return { stockPresentacion, unidadesSueltas }
    }

    const [itemsPerPage, setItemsPerPage] = useState(15)
    const [currentPage, setCurrentPage] = useState(1)

    const [adjItemsPerPage, setAdjItemsPerPage] = useState(15)
    const [adjCurrentPage, setAdjCurrentPage] = useState(1)

    const [filterTipo, setFilterTipo] = useState<string>("all")
    const [filterBatchState, setFilterBatchState] = useState<string>("all")
    const [sortField, setSortField] = useState<"producto" | "codigo" | "expiracion" | "precioCosto" | "precioVenta" | "stock" | null>(null)
    const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null)

    const handleSort = (field: "producto" | "codigo" | "expiracion" | "precioCosto" | "precioVenta" | "stock") => {
        if (sortField === field) {
            if (sortOrder === "asc") setSortOrder("desc")
            else if (sortOrder === "desc") {
                setSortField(null)
                setSortOrder(null)
            }
        } else {
            setSortField(field)
            setSortOrder("asc")
        }
    }

    const filteredBatches = batches.filter((batch) => {
        const matchesSearch =
            batch.product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            batch.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            batch.product.tipo.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesTipo = filterTipo === "all" || batch.product.tipo === filterTipo

        const vencido = estaVencido(batch.fechaExpiracion)
        const proximoAVencer = estaProximoAVencer(batch.fechaExpiracion)
        const sinStock = batch.stockActual === 0
        const stockMinimoProd = batch.product.stockMinimo || 0
        const stockBajo = batch.stockActual > 0 && batch.stockActual <= stockMinimoProd

        let matchesState = true
        if (filterBatchState === "vencido") matchesState = vencido
        else if (filterBatchState === "proximo_vencer") matchesState = !vencido && proximoAVencer
        else if (filterBatchState === "sin_stock") matchesState = sinStock
        else if (filterBatchState === "stock_bajo") matchesState = stockBajo
        else if (filterBatchState === "normal") matchesState = !vencido && !proximoAVencer && !sinStock && !stockBajo

        return matchesSearch && matchesTipo && matchesState
    })

    if (sortField && sortOrder) {
        filteredBatches.sort((a, b) => {
            let valA: any
            let valB: any
            if (sortField === "producto") {
                valA = a.product.nombre.toLowerCase()
                valB = b.product.nombre.toLowerCase()
            } else if (sortField === "codigo") {
                valA = a.codigo.toLowerCase()
                valB = b.codigo.toLowerCase()
            } else if (sortField === "expiracion") {
                valA = new Date(a.fechaExpiracion).getTime()
                valB = new Date(b.fechaExpiracion).getTime()
            } else if (sortField === "precioCosto") {
                valA = a.precioCostoPresentacion || 0
                valB = b.precioCostoPresentacion || 0
            } else if (sortField === "precioVenta") {
                valA = a.precioVentaPresentacion || 0
                valB = b.precioVentaPresentacion || 0
            } else if (sortField === "stock") {
                valA = a.stockActual
                valB = b.stockActual
            }
            if (valA < valB) return sortOrder === "asc" ? -1 : 1
            if (valA > valB) return sortOrder === "asc" ? 1 : -1
            return 0
        })
    }

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, filterTipo, filterBatchState])

    const totalPages = Math.ceil(filteredBatches.length / itemsPerPage)
    const paginatedBatches = filteredBatches.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const totalAdjPages = Math.ceil(adjustments.length / adjItemsPerPage)
    const paginatedAdjustments = adjustments.slice(
        (adjCurrentPage - 1) * adjItemsPerPage,
        adjCurrentPage * adjItemsPerPage
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Gestión de Lotes</h1>
                    <p className="text-muted-foreground mt-1">
                        Administra y crea lotes para tus productos
                    </p>
                </div>
                {canCreate && (
                    <BatchDialog
                        isAdmin={role === UserRole.ADMIN || role === UserRole.FARMACEUTICO}
                        onSave={() => { fetchBatches(true); fetchAdjustments(); }}
                    />
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Lista de Lotes Activos</CardTitle>
                            <CardDescription>
                                {isLoading
                                    ? "Cargando..."
                                    : `${filteredBatches.length} lote${filteredBatches.length !== 1 ? 's' : ''} encontrado${filteredBatches.length !== 1 ? 's' : ''}`}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por producto o lote..."
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
                            <Select value={filterBatchState} onValueChange={setFilterBatchState}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Estado de lote" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="stock_bajo">Stock Bajo</SelectItem>
                                    <SelectItem value="proximo_vencer">Próximo a Vencer</SelectItem>
                                    <SelectItem value="vencido">Vencido</SelectItem>
                                    <SelectItem value="sin_stock">Sin Stock</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-3 h-8 font-bold"
                                        onClick={() => handleSort("producto")}
                                    >
                                        Producto
                                        {sortField === "producto" ? (
                                            sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead>Presentación</TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-3 h-8 font-bold"
                                        onClick={() => handleSort("codigo")}
                                    >
                                        Código de Lote
                                        {sortField === "codigo" ? (
                                            sortOrder === "asc" ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" /> : <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-3 h-8 font-bold"
                                        onClick={() => handleSort("expiracion")}
                                    >
                                        Fecha de Expiración
                                        {sortField === "expiracion" ? (
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
                                <TableHead className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-mr-3 h-8 font-bold ml-auto"
                                        onClick={() => handleSort("precioVenta")}
                                    >
                                        Precio Venta
                                        {sortField === "precioVenta" ? (
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
                                <TableHead>Estado</TableHead>
                                {(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) && (
                                    <TableHead className="w-[50px]"></TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableSkeleton
                                    columns={(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) ? 9 : 8}
                                    rows={10}
                                    columnWidths={["w-48", "w-28", "w-24", "w-28", "w-24", "w-24", "w-24", "w-20"]}
                                />
                            ) : filteredBatches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) ? 9 : 8} className="text-center py-8 text-muted-foreground">
                                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        No se encontraron lotes
                                    </TableCell>
                                </TableRow>) : (
                                paginatedBatches.map((batch) => {
                                    const vencido = estaVencido(batch.fechaExpiracion)
                                    const proximoAVencer = estaProximoAVencer(batch.fechaExpiracion)
                                    const sinStock = batch.stockActual === 0
                                    const stockMinimoProd = batch.product.stockMinimo || 0
                                    const stockBajo = batch.stockActual > 0 && batch.stockActual <= stockMinimoProd
                                    const cantXPres = (batch as any).cantidadPorPresentacion || batch.product.cantidadPorPresentacion || 1
                                    const stockDesglosado = obtenerStockDesglosado(batch.stockActual, cantXPres)

                                    return (
                                        <TableRow key={batch.id}>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col max-w-[240px]">
                                                    <span className="font-medium truncate" title={batch.product.nombre}>{batch.product.nombre}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {batch.product.tipo}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="text-sm">
                                                    <p>{batch.product.presentacion || "Unidad"}</p>
                                                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {cantXPres} {batch.product.unidadBase || "Unidad"}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                                    {batch.codigo}
                                                </code>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs align-top">
                                                {format(new Date(batch.fechaExpiracion), "dd/MM/yyyy", { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-right align-top">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-medium text-sm whitespace-nowrap">
                                                        {formatCurrency(batch.precioCostoPresentacion)} / {batch.product.presentacion || 'Caja'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatCurrency(batch.precioCostoUnidad)} / {batch.product.unidadBase || 'Unidad'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-top">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-medium text-sm whitespace-nowrap">
                                                        {formatCurrency(batch.precioVentaPresentacion)} / {batch.product.presentacion || 'Caja'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatCurrency(batch.precioVentaUnidad)} / {batch.product.unidadBase || 'Unidad'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-top">
                                                <div className="flex flex-col items-end">
                                                    <span className={
                                                        sinStock
                                                            ? "text-red-600 dark:text-red-400 font-bold"
                                                            : stockBajo
                                                            ? "text-amber-600 dark:text-amber-500 font-bold"
                                                            : "text-emerald-700 dark:text-emerald-400 font-semibold"
                                                    }>
                                                        {formatQuantity(batch.stockActual)} {batch.product.unidadBase || 'Unidad'}
                                                    </span>
                                                    {(stockDesglosado.stockPresentacion > 0 || stockDesglosado.unidadesSueltas > 0) && (
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                            ({[
                                                                stockDesglosado.stockPresentacion > 0 ? `${stockDesglosado.stockPresentacion} ${batch.product.presentacion || 'Caja'}s` : null,
                                                                stockDesglosado.unidadesSueltas > 0 ? `${stockDesglosado.unidadesSueltas} sueltas` : null
                                                            ].filter(Boolean).join(" + ")})
                                                        </span>
                                                    )}
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
                                            {(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) && (
                                                <TableCell className="align-top text-right">
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
                                                                        onClick={() => handleOpenEditDialog(batch)}
                                                                    >
                                                                        <Edit className="mr-2 h-4 w-4" />
                                                                        Editar Producto/Lote
                                                                    </DropdownMenuItem>
                                                                    {canDelete && (
                                                                        <DropdownMenuItem
                                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                                            onClick={() => handleDeleteBatch(batch)}
                                                                        >
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Eliminar Lote
                                                                        </DropdownMenuItem>
                                                                    )}
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
                            )}
                        </TableBody>
                    </Table>

                    {!isLoading && filteredBatches.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredBatches.length}
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

            <Separator className="my-8" />

            {(role === UserRole.ADMIN || role === UserRole.FARMACEUTICO) && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <History className="h-6 w-6 text-orange-600" />
                        <h2 className="text-2xl font-bold">Historial de Ajustes Manuales</h2>
                    </div>
                    <Card className="border-orange-200">
                        <CardHeader className="bg-orange-50/50">
                            <CardDescription>
                                Registro de todos los cambios de stock realizados manualmente.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Lote</TableHead>
                                        <TableHead className="text-right">Ajuste</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead>Usuario</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingAdjustments ? (
                                        <TableSkeleton columns={6} rows={5} columnWidths={["w-28", "w-40", "w-24", "w-20", "w-48", "w-24"]} />
                                    ) : adjustments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                                                No hay ajustes registrados aún.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedAdjustments.map((adj) => (
                                            <TableRow key={adj.id}>
                                                <TableCell className="text-xs">
                                                    {format(new Date(adj.fecha), "dd/MM/yyyy HH:mm", { locale: es })}
                                                </TableCell>
                                                <TableCell className="font-medium">{adj.product.nombre}</TableCell>
                                                <TableCell>
                                                    <code className="text-xs bg-muted px-1 rounded">{adj.batch.codigo}</code>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge
                                                        variant={adj.cantidad > 0 ? "outline" : "destructive"}
                                                        className={adj.cantidad > 0 ? "text-green-600 border-green-600" : ""}
                                                    >
                                                        {adj.cantidad > 0 ? `+${formatQuantity(adj.cantidad)}` : formatQuantity(adj.cantidad)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-xs truncate text-xs" title={adj.motivo}>
                                                    {adj.motivo}
                                                </TableCell>
                                                <TableCell className="text-xs">{adj.usuario}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>

                            {adjustments.length > 0 && (
                                <DataTablePagination
                                    currentPage={adjCurrentPage}
                                    totalPages={totalAdjPages}
                                    totalItems={adjustments.length}
                                    itemsPerPage={adjItemsPerPage}
                                    onPageChange={setAdjCurrentPage}
                                    onItemsPerPageChange={(newSize) => {
                                        setAdjItemsPerPage(newSize)
                                        setAdjCurrentPage(1)
                                    }}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación de Lote */}
            <AlertDialog open={!!batchToDelete} onOpenChange={(open) => !open && setBatchToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este lote?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 pt-2">
                            <span>
                                Se eliminará el lote <strong className="text-foreground">{batchToDelete?.codigo}</strong> del producto <strong className="text-foreground">{batchToDelete?.product?.nombre}</strong>.
                            </span>
                            <span className="text-xs bg-muted p-2.5 rounded-md block border text-muted-foreground">
                                El historial de movimientos previos de este lote se mantendrá registrado en el Kardex.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel disabled={isDeletingBatch}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={isDeletingBatch}
                            onClick={confirmDeleteBatch}
                        >
                            {isDeletingBatch ? "Eliminando..." : "Eliminar Lote"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal Centralizado Único de Edición en Lotes */}
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
                    onSave={(updatedProduct) => {
                        handleSaveBatchUnified(updatedProduct)
                        setIsEditDialogOpen(false)
                        setEditingProduct(null)
                        setEditingLotesAsociados([])
                    }}
                />
            )}
        </div>
    )
}
