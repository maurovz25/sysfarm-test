"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    MagnifyingGlass as Search,
    Plus,
    CheckCircle,
    XCircle,
    Clock,
    Warning as AlertTriangle,
    CircleNotch as Loader2,
    Eye,
    ShieldCheck,
    PencilSimple as Pencil,
    Trash as Trash2,
    Check,
    CaretUpDown as ChevronsUpDown,
} from "@phosphor-icons/react"
import { useUserRole } from "@/hooks/use-user-role"
import { UserRole } from "@/lib/roles"
import { toast } from "sonner"
import type { Requerimiento, EstadoRequerimiento } from "@/lib/types"
import { formatLocalDateTime } from "@/lib/date-utils"
import { formatQuantity } from "@/lib/number-utils"
import { cn } from "@/lib/utils"

import { useRequerimientos, useProducts, useAreas } from "@/hooks/use-queries"
import { TableSkeleton } from "@/components/ui/table-skeleton"

interface GroupedProduct {
    id: string
    nombre: string
    codigoBarras: string
    tipo: string
    unidadBase: string
    stockTotal: number
}

export default function RequerimientosPage() {
    const { user, role } = useUserRole()
    const currentUserName = user?.user_metadata?.full_name || 'Administrador'
    const isAdminOrPharm = role === UserRole.ADMIN || role === UserRole.FARMACEUTICO

    const { data: requerimientosRes, isLoading: loadingRequerimientos, refetch: refetchRequerimientos } = useRequerimientos()
    const { data: productsRawData = [] } = useProducts()
    const { data: areasData = [] } = useAreas()

    const requerimientos: Requerimiento[] = requerimientosRes?.requerimientos || []
    const pendingCount = requerimientosRes?.pendingCount || 0
    const productsRaw: any[] = productsRawData
    const areas: any[] = areasData
    const loading = loadingRequerimientos

    // Filtros
    const [activeTab, setActiveTab] = useState<string>("PENDIENTE")
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedDept, setSelectedDept] = useState<string>("all")

    // Modal de Despacho (Admin / Farmacéutico)
    const [dispatchingReq, setDispatchingReq] = useState<Requerimiento | null>(null)
    const [adjustedQuantities, setAdjustedQuantities] = useState<Record<string, number>>({})
    const [isDispatching, setIsDispatching] = useState(false)
    // Ítems adicionales en despacho
    const [additionalDispatchItems, setAdditionalDispatchItems] = useState<Array<{
        productId: string
        productoNombre: string
        codigoBarras?: string
        cantidadSolicitada: number
        cantidadAprobada: number
        unidadBase: string
        stockTotal: number
    }>>([])
    const [openDispatchProductSelect, setOpenDispatchProductSelect] = useState(false)
    const [selectedDispatchProductId, setSelectedDispatchProductId] = useState<string>("")
    const [newDispatchProductQty, setNewDispatchProductQty] = useState<number>(0)

    // Modal de Edición (Solicitante)
    const [editingReq, setEditingReq] = useState<Requerimiento | null>(null)
    const [editItems, setEditItems] = useState<Array<{
        productId: string
        productoNombre: string
        codigoBarras?: string
        cantidadSolicitada: number
        unidadBase: string
        stockTotal: number
    }>>([])
    const [editObservaciones, setEditObservaciones] = useState("")
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const [openEditProductSelect, setOpenEditProductSelect] = useState(false)

    // Modal de Rechazo
    const [rejectingReq, setRejectingReq] = useState<Requerimiento | null>(null)
    const [motivoRechazo, setMotivoRechazo] = useState("")
    const [isRejecting, setIsRejecting] = useState(false)

    // Modal de Detalle
    const [viewingReq, setViewingReq] = useState<Requerimiento | null>(null)

    const fetchRequerimientos = async (_silent = false) => {
        refetchRequerimientos()
    }


    const groupedProducts: GroupedProduct[] = useMemo(() => {
        return productsRaw.map((p: any) => {
            const activeBatches = (p.batches || []).filter((b: any) => !b.deletedAt)
            const totalStock = activeBatches.reduce((sum: number, b: any) => sum + (b.stockActual || 0), 0)
            return {
                id: p.id,
                nombre: p.nombre,
                codigoBarras: p.codigoBarras || "",
                tipo: p.tipo || "Medicamento",
                unidadBase: p.unidadBase || "Unidad",
                stockTotal: totalStock,
            }
        })
    }, [productsRaw])

    // Abrir modal de despacho e inicializar mapa de cantidades ajustadas
    const handleOpenDispatch = async (req: Requerimiento) => {
        setDispatchingReq(req)
        const initialQtyMap: Record<string, number> = {}
        req.items.forEach(item => {
            initialQtyMap[item.id] = item.cantidadSolicitada
        })
        setAdjustedQuantities(initialQtyMap)
        setAdditionalDispatchItems([])
        setSelectedDispatchProductId("")
        setNewDispatchProductQty(0)

        // Cargar lotes activos y actualizados del requerimiento para despacho
        try {
            const fullReq = await api.get(`/requerimientos/${req.id}`)
            if (fullReq) {
                setDispatchingReq(fullReq)
            }
        } catch (error) {
            console.error("Error al cargar lotes para despacho:", error)
        }
    }

    // Agregar producto adicional en despacho (Farmacéutico / Admin) al seleccionarlo del combobox
    const handleAddProductToDispatch = (productId: string) => {
        const prod = groupedProducts.find(p => p.id === productId)
        if (!prod) return

        const existsInReq = dispatchingReq?.items.some(i => i.productId === prod.id)
        const existsInAdditional = additionalDispatchItems.some(i => i.productId === prod.id)
        if (existsInReq || existsInAdditional) {
            toast.warning(`El producto "${prod.nombre}" ya está en la lista de este requerimiento.`)
            return
        }

        setAdditionalDispatchItems([
            ...additionalDispatchItems,
            {
                productId: prod.id,
                productoNombre: prod.nombre,
                codigoBarras: prod.codigoBarras,
                cantidadSolicitada: 0,
                cantidadAprobada: 0, // Se inicializa en 0 (input vacío en la tabla para escribir directamente)
                unidadBase: prod.unidadBase,
                stockTotal: prod.stockTotal,
            }
        ])

        setOpenDispatchProductSelect(false)
    }

    // Eliminar producto adicional del despacho
    const handleRemoveProductFromDispatch = (index: number) => {
        setAdditionalDispatchItems(additionalDispatchItems.filter((_, i) => i !== index))
    }

    // Confirmar Despacho FEFO
    const handleConfirmDispatch = async () => {
        if (!dispatchingReq) return

        // Validar si hay ítems adicionales con cantidadAprobada <= 0
        const invalidAdd = additionalDispatchItems.find(i => i.cantidadAprobada <= 0)
        if (invalidAdd) {
            toast.warning(`Ingrese una cantidad a entregar mayor a 0 para "${invalidAdd.productoNombre}".`)
            return
        }

        setIsDispatching(true)

        try {
            const itemsAprobados: Array<{ itemId?: string; productId?: string; cantidadSolicitada?: number; cantidadAprobada: number }> = Object.entries(adjustedQuantities).map(([itemId, cantidadAprobada]) => ({
                itemId,
                cantidadAprobada,
            }))

            additionalDispatchItems.forEach((item) => {
                itemsAprobados.push({
                    productId: item.productId,
                    cantidadSolicitada: item.cantidadAprobada,
                    cantidadAprobada: item.cantidadAprobada,
                })
            })

            await api.post(`/requerimientos/${dispatchingReq.id}/despachar`, {
                atendidoPor: currentUserName,
                itemsAprobados,
            })

            toast.success(`Requerimiento ${dispatchingReq.codigo} aprobado y despachado con éxito. Se generó el movimiento en Kardex.`)
            setDispatchingReq(null)
            await fetchRequerimientos(true)
        } catch (error: any) {
            console.error("Error al despachar:", error)
            toast.error(`Error al despachar: ${error.message || "Verifique el stock disponible"}`)
        } finally {
            setIsDispatching(false)
        }
    }

    // Abrir modal de edición (Solicitante)
    const handleOpenEdit = (req: Requerimiento) => {
        setEditingReq(req)
        setEditObservaciones(req.observaciones || "")
        setEditItems(
            req.items.map((item) => {
                const prod = groupedProducts.find(p => p.id === item.productId)
                return {
                    productId: item.productId,
                    productoNombre: item.product?.nombre || prod?.nombre || "Producto",
                    codigoBarras: item.product?.codigoBarras || prod?.codigoBarras || "",
                    cantidadSolicitada: item.cantidadSolicitada,
                    unidadBase: item.product?.unidadBase || prod?.unidadBase || "unid.",
                    stockTotal: prod?.stockTotal ?? 0,
                }
            })
        )
    }

    // Agregar producto al modal de edición de Solicitante
    const handleAddProductToEdit = (productId: string) => {
        const prod = groupedProducts.find(p => p.id === productId)
        if (!prod) return

        const existing = editItems.find(i => i.productId === productId)
        if (existing) {
            toast.warning(`El producto "${prod.nombre}" ya está en la lista del requerimiento.`)
            return
        }

        setEditItems([
            ...editItems,
            {
                productId: prod.id,
                productoNombre: prod.nombre,
                codigoBarras: prod.codigoBarras,
                cantidadSolicitada: 0, // Se inicializa en 0 como especificó el usuario
                unidadBase: prod.unidadBase,
                stockTotal: prod.stockTotal,
            }
        ])
        setOpenEditProductSelect(false)
    }

    // Eliminar producto en modal de edición
    const handleRemoveProductFromEdit = (index: number) => {
        setEditItems(editItems.filter((_, i) => i !== index))
    }

    // Confirmar edición de Solicitante
    const handleConfirmEdit = async () => {
        if (!editingReq) return

        if (editItems.length === 0) {
            toast.warning("El requerimiento debe contener al menos un producto.")
            return
        }

        const invalidItem = editItems.find(i => i.cantidadSolicitada <= 0)
        if (invalidItem) {
            toast.warning(`Ingrese una cantidad solicitada mayor a 0 para "${invalidItem.productoNombre}".`)
            return
        }

        setIsSavingEdit(true)

        try {
            await api.put(`/requerimientos/${editingReq.id}`, {
                observaciones: editObservaciones,
                items: editItems.map(item => ({
                    productId: item.productId,
                    cantidadSolicitada: item.cantidadSolicitada,
                })),
            })

            toast.success(`Requerimiento ${editingReq.codigo} actualizado exitosamente.`)
            setEditingReq(null)
            await fetchRequerimientos(true)
        } catch (error: any) {
            console.error("Error al actualizar requerimiento:", error)
            toast.error(`Error al actualizar: ${error.message || "Error desconocido"}`)
        } finally {
            setIsSavingEdit(false)
        }
    }

    // Confirmar Rechazo
    const handleConfirmReject = async () => {
        if (!rejectingReq) return
        setIsRejecting(true)

        try {
            await api.post(`/requerimientos/${rejectingReq.id}/rechazar`, {
                atendidoPor: currentUserName,
                motivoRechazo,
            })

            toast.success(`Requerimiento ${rejectingReq.codigo} marcado como RECHAZADO.`)
            setRejectingReq(null)
            setMotivoRechazo("")
            await fetchRequerimientos(true)
        } catch (error: any) {
            console.error("Error al rechazar:", error)
            toast.error(`Error al rechazar: ${error.message || "Error desconocido"}`)
        } finally {
            setIsRejecting(false)
        }
    }

    // Filtrar requerimientos por Tab, Búsqueda y Departamento
    const filteredRequerimientos = useMemo(() => {
        return requerimientos.filter(req => {
            const matchesTab = activeTab === "ALL" || req.estado === activeTab
            const matchesDept = selectedDept === "all" || req.departamento === selectedDept
            const matchesSearch =
                req.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.departamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.items.some(i => i.product?.nombre.toLowerCase().includes(searchTerm.toLowerCase()))

            return matchesTab && matchesDept && matchesSearch
        })
    }, [requerimientos, activeTab, selectedDept, searchTerm])

    const getStatusBadge = (estado: EstadoRequerimiento) => {
        switch (estado) {
            case "PENDIENTE":
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1"><Clock className="h-3 w-3" /> PENDIENTE</Badge>
            case "DESPACHADO":
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 gap-1"><CheckCircle className="h-3 w-3" /> DESPACHADO</Badge>
            case "RECHAZADO":
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1"><XCircle className="h-3 w-3" /> RECHAZADO</Badge>
            default:
                return <Badge variant="secondary">{estado}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Gestión de Requerimientos</h1>
                    <p className="text-muted-foreground mt-1">Solicitudes de medicamentos e insumos por área de atención</p>
                </div>
                <Link href="/requerimientos/nuevo">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Requerimiento
                    </Button>
                </Link>
            </div>

            {/* Tarjetas resumen */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Pendientes de Despacho</p>
                                <p className="text-3xl font-bold text-amber-600">{formatQuantity(pendingCount)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-amber-500/10">
                                <Clock className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Total Solicitudes Hoy</p>
                                <p className="text-3xl font-bold text-foreground">
                                    {formatQuantity(requerimientos.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length)}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-primary/10">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Despachados Exitosamente</p>
                                <p className="text-3xl font-bold text-green-600">
                                    {formatQuantity(requerimientos.filter(r => r.estado === 'DESPACHADO').length)}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-green-500/10">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Contenido Principal con Tabs */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Listado de Requerimientos</CardTitle>
                            <CardDescription>Filtra por estado, área o busca por código de requerimiento</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por código, área o producto..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Select value={selectedDept} onValueChange={setSelectedDept}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Área" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las áreas</SelectItem>
                                    {areas.map((area: any) => (
                                        <SelectItem key={area.id} value={area.nombre}>
                                            {area.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
                            <TabsTrigger value="PENDIENTE" className="relative">
                                Pendientes
                                {pendingCount > 0 && (
                                    <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.2 text-xs font-bold">
                                        {pendingCount}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="DESPACHADO">Despachados</TabsTrigger>
                            <TabsTrigger value="RECHAZADO">Rechazados</TabsTrigger>
                            <TabsTrigger value="ALL">Todos</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab}>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[120px]">Código</TableHead>
                                            <TableHead className="w-[140px]">Fecha / Hora</TableHead>
                                            <TableHead>Área / Departamento</TableHead>
                                            <TableHead>Solicitante</TableHead>
                                            <TableHead className="text-center">Ítems</TableHead>
                                            <TableHead className="text-center">Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableSkeleton columns={7} rows={6} columnWidths={["w-24", "w-28", "w-32", "w-36", "w-20", "w-24", "w-24 ml-auto"]} />
                                        ) : filteredRequerimientos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                    No se encontraron requerimientos en esta categoría.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredRequerimientos.map((req) => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="font-mono font-bold text-primary">
                                                        {req.codigo}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {formatLocalDateTime(req.createdAt)}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {req.departamento}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {req.solicitante}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary">{formatQuantity(req.items.length)} prod.</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {getStatusBadge(req.estado)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {/* Botón Ver Detalle */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setViewingReq(req)}
                                                                title="Ver Detalle"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>

                                                            {/* Botón Editar Requerimiento si está PENDIENTE */}
                                                            {req.estado === "PENDIENTE" && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleOpenEdit(req)}
                                                                    title="Editar Requerimiento"
                                                                >
                                                                    <Pencil className="h-4 w-4 text-blue-600" />
                                                                </Button>
                                                            )}

                                                            {/* Acciones para Admin / Farmacéutico si está PENDIENTE */}
                                                            {isAdminOrPharm && req.estado === "PENDIENTE" && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700 gap-1"
                                                                        onClick={() => handleOpenDispatch(req)}
                                                                    >
                                                                        <CheckCircle className="h-4 w-4" />
                                                                        Atender
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => setRejectingReq(req)}
                                                                        title="Rechazar"
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* MODAL DE ATENCIÓN / DESPACHO (ADMIN / FARMACEÚTICO) */}
            <Dialog open={!!dispatchingReq} onOpenChange={(open) => !open && setDispatchingReq(null)}>
                <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-700 pr-6">
                            <CheckCircle className="h-5 w-5 shrink-0" />
                            <span>Aprobar y Despachar Requerimiento {dispatchingReq?.codigo}</span>
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Revisa y ajusta las cantidades antes de despachar. Puedes agregar medicamentos adicionales al pedido. El sistema asignará automáticamente los lotes por vencimiento (FEFO) y registrará la salida en Kardex.
                        </DialogDescription>
                    </DialogHeader>

                    {dispatchingReq && (
                        <div className="space-y-4 py-2">
                            <div className="grid sm:grid-cols-2 gap-4 text-sm bg-muted/40 p-3 rounded-lg border">
                                <div>
                                    <p><strong>Área Solicitante:</strong> {dispatchingReq.departamento}</p>
                                    <p><strong>Solicitante:</strong> {dispatchingReq.solicitante}</p>
                                </div>
                                <div>
                                    <p><strong>Fecha de Solicitud:</strong> {formatLocalDateTime(dispatchingReq.createdAt)}</p>
                                    {dispatchingReq.observaciones && <p><strong>Notas:</strong> {dispatchingReq.observaciones}</p>}
                                </div>
                            </div>

                            {/* Selector para Agregar Medicamento Adicional al Despacho */}
                            <div className="space-y-2">
                                <Label>Agregar Medicamento / Dispositivo Adicional al Despacho</Label>
                                <Popover open={openDispatchProductSelect} onOpenChange={setOpenDispatchProductSelect}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openDispatchProductSelect}
                                            className="w-full justify-between font-normal"
                                        >
                                            Buscar producto a incluir en el despacho...
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                                        <Command
                                            filter={(value, search) => {
                                                const product = groupedProducts.find(p => p.id === value || p.nombre === value)
                                                if (!product) return 0
                                                const searchStr = search.toLowerCase()
                                                return product.nombre.toLowerCase().includes(searchStr) || product.codigoBarras?.toLowerCase().includes(searchStr) ? 1 : 0
                                            }}
                                        >
                                            <CommandInput placeholder="Buscar por nombre o código de barras..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontró ningún producto.</CommandEmpty>
                                                <CommandGroup>
                                                    {groupedProducts.map((product) => (
                                                        <CommandItem
                                                            key={product.id}
                                                            value={product.nombre}
                                                            onSelect={() => handleAddProductToDispatch(product.id)}
                                                        >
                                                            <div className="flex flex-col flex-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium">{product.nombre}</span>
                                                                    <span className={cn("text-xs px-2 py-0.5 rounded font-bold ml-2", product.stockTotal > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                                        Stock: {product.stockTotal} {product.unidadBase}
                                                                    </span>
                                                                </div>
                                                                {product.codigoBarras && (
                                                                    <span className="text-xs text-muted-foreground font-mono">
                                                                        GTIN: {product.codigoBarras}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="rounded-md border max-h-[300px] overflow-x-auto overflow-y-auto">
                                <Table className="w-full">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-center">Cant. Solicitada</TableHead>
                                            <TableHead className="text-center">Stock Total Almacén</TableHead>
                                            <TableHead className="w-[160px] text-center">Cant. Aprobada</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Ítems preexistentes */}
                                        {dispatchingReq.items.map((item) => {
                                            const totalStock = (item.product?.batches || [])
                                                .filter((b: any) => !b.deletedAt)
                                                .reduce((sum: number, b: any) => sum + (b.stockActual || 0), 0)

                                            const currentQty = adjustedQuantities[item.id] ?? item.cantidadSolicitada

                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">
                                                        <span 
                                                            className="truncate max-w-[280px] block cursor-default" 
                                                            title={`${item.product?.nombre || "Producto"} ${item.product?.presentacion || ""}`}
                                                        >
                                                            {item.product?.nombre || "Producto"}
                                                        </span>
                                                        {item.product?.codigoBarras && (
                                                            <div className="text-xs text-muted-foreground font-mono">{item.product.codigoBarras}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold whitespace-nowrap">
                                                        {item.cantidadSolicitada} {item.product?.unidadBase || "unid."}
                                                     </TableCell>
                                                    <TableCell className="text-center text-xs whitespace-nowrap">
                                                        <span className={cn("font-bold px-2 py-0.5 rounded", totalStock >= currentQty ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                            {totalStock} {item.product?.unidadBase || "unid."}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={totalStock}
                                                            className="w-20 text-center font-bold mx-auto"
                                                            value={currentQty === 0 ? "" : currentQty}
                                                            placeholder="0"
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value)
                                                                setAdjustedQuantities({
                                                                    ...adjustedQuantities,
                                                                    [item.id]: val < 0 ? 0 : val
                                                                })
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}

                                        {/* Ítems adicionales agregados durante el despacho */}
                                        {additionalDispatchItems.map((item, idx) => (
                                            <TableRow key={`add-${idx}`} className="bg-amber-50/50">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{item.productoNombre}</span>
                                                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">Adicional</Badge>
                                                    </div>
                                                    {item.codigoBarras && (
                                                        <div className="text-xs text-muted-foreground font-mono">{item.codigoBarras}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-semibold text-muted-foreground whitespace-nowrap">
                                                    -
                                                </TableCell>
                                                <TableCell className="text-center text-xs whitespace-nowrap">
                                                    <span className={cn("font-bold px-2 py-0.5 rounded", item.stockTotal >= item.cantidadAprobada ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                        {item.stockTotal} {item.unidadBase}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max={item.stockTotal}
                                                            placeholder="0"
                                                            className="w-20 text-center font-bold"
                                                            value={item.cantidadAprobada || ""}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value)
                                                                const updated = [...additionalDispatchItems]
                                                                updated[idx].cantidadAprobada = val < 0 ? 0 : val
                                                                updated[idx].cantidadSolicitada = val < 0 ? 0 : val
                                                                setAdditionalDispatchItems(updated)
                                                            }}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => setDispatchingReq(null)} disabled={isDispatching}>
                            Cancelar
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmDispatch} disabled={isDispatching}>
                            {isDispatching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando FEFO...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Confirmar y Despachar (Kardex)
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE EDICIÓN (SOLICITANTE) */}
            <Dialog open={!!editingReq} onOpenChange={(open) => !open && setEditingReq(null)}>
                <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-700 pr-6">
                            <Pencil className="h-5 w-5 shrink-0" />
                            <span>Editar Requerimiento {editingReq?.codigo}</span>
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Modifica las cantidades solicitadas, agrega o elimina medicamentos/dispositivos y edita las observaciones antes de la aprobación.
                        </DialogDescription>
                    </DialogHeader>

                    {editingReq && (
                        <div className="space-y-4 py-2">
                            {/* Selector para Agregar Medicamento/Dispositivo al Requerimiento */}
                            <div className="space-y-2">
                                <Label>Agregar Medicamento / Dispositivo *</Label>
                                <Popover open={openEditProductSelect} onOpenChange={setOpenEditProductSelect}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openEditProductSelect}
                                            className="w-full justify-between font-normal"
                                        >
                                            Buscar producto a agregar al requerimiento...
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                                        <Command
                                            filter={(value, search) => {
                                                const product = groupedProducts.find(p => p.id === value || p.nombre === value)
                                                if (!product) return 0
                                                const searchStr = search.toLowerCase()
                                                return product.nombre.toLowerCase().includes(searchStr) || product.codigoBarras?.toLowerCase().includes(searchStr) ? 1 : 0
                                            }}
                                        >
                                            <CommandInput placeholder="Buscar por nombre o código de barras..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontró ningún producto.</CommandEmpty>
                                                <CommandGroup>
                                                    {groupedProducts.map((product) => (
                                                        <CommandItem
                                                            key={product.id}
                                                            value={product.nombre}
                                                            onSelect={() => handleAddProductToEdit(product.id)}
                                                        >
                                                            <div className="flex flex-col flex-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium">{product.nombre}</span>
                                                                    <span className={cn("text-xs px-2 py-0.5 rounded font-bold ml-2", product.stockTotal > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                                        Stock: {product.stockTotal} {product.unidadBase}
                                                                    </span>
                                                                </div>
                                                                {product.codigoBarras && (
                                                                    <span className="text-xs text-muted-foreground font-mono">
                                                                        GTIN: {product.codigoBarras}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Tabla de ítems a editar */}
                            <div className="rounded-md border max-h-[300px] overflow-x-auto overflow-y-auto">
                                <Table className="w-full">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-center">Stock Almacén</TableHead>
                                            <TableHead className="w-[140px] text-center">Cant. Solicitada</TableHead>
                                            <TableHead className="w-[50px] text-center">Acción</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {editItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                                    No hay ningún producto en el requerimiento. Agrega uno usando el buscador arriba.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            editItems.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">
                                                        {item.productoNombre}
                                                        {item.codigoBarras && (
                                                            <div className="text-xs text-muted-foreground font-mono">{item.codigoBarras}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs whitespace-nowrap">
                                                        <span className="font-bold text-muted-foreground">
                                                            {item.stockTotal} {item.unidadBase}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            className="w-24 text-center font-bold mx-auto"
                                                            value={item.cantidadSolicitada || ""}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value)
                                                                const updated = [...editItems]
                                                                updated[index].cantidadSolicitada = val < 0 ? 0 : val
                                                                setEditItems(updated)
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveProductFromEdit(index)}
                                                            title="Eliminar producto"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Observaciones */}
                            <div className="space-y-2">
                                <Label>Observaciones adicionales</Label>
                                <Textarea
                                    value={editObservaciones}
                                    onChange={(e) => setEditObservaciones(e.target.value)}
                                    placeholder="Notas o justificación del requerimiento..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditingReq(null)} disabled={isSavingEdit}>
                            Cancelar
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirmEdit} disabled={isSavingEdit}>
                            {isSavingEdit ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar Cambios"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE RECHAZO */}
            <Dialog open={!!rejectingReq} onOpenChange={(open) => !open && setRejectingReq(null)}>
                <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2 pr-6">
                            <XCircle className="h-5 w-5 shrink-0" />
                            <span>Rechazar Requerimiento {rejectingReq?.codigo}</span>
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Indica la razón por la cual se rechaza este pedido para conocimiento del área solicitante.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Motivo de Rechazo *</Label>
                            <Textarea
                                value={motivoRechazo}
                                onChange={(e) => setMotivoRechazo(e.target.value)}
                                placeholder="Ej: Sin disponibilidad en almacén, falta de especificación..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => setRejectingReq(null)} disabled={isRejecting}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmReject} disabled={isRejecting || !motivoRechazo.trim()}>
                            {isRejecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                "Confirmar Rechazo"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE VER DETALLE */}
            <Dialog open={!!viewingReq} onOpenChange={(open) => !open && setViewingReq(null)}>
                <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 pr-6">
                            <span>Detalle del Requerimiento {viewingReq?.codigo}</span>
                        </DialogTitle>
                        <DialogDescription className="text-left">
                            Solicitado el {viewingReq && formatLocalDateTime(viewingReq.createdAt)}
                        </DialogDescription>
                    </DialogHeader>

                    {viewingReq && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-3 rounded-lg border">
                                <div>
                                    <p><strong>Área Solicitante:</strong> {viewingReq.departamento}</p>
                                    <p><strong>Solicitante:</strong> {viewingReq.solicitante}</p>
                                </div>
                                <div>
                                    <p><strong>Estado:</strong> {getStatusBadge(viewingReq.estado)}</p>
                                    {viewingReq.atendidoPor && <p><strong>Atendido por:</strong> {viewingReq.atendidoPor}</p>}
                                    {viewingReq.fechaAtencion && <p><strong>Fecha Atención:</strong> {formatLocalDateTime(viewingReq.fechaAtencion)}</p>}
                                </div>
                            </div>

                            {viewingReq.observaciones && (
                                <p className="text-sm"><strong>Observaciones:</strong> {viewingReq.observaciones}</p>
                            )}

                            {viewingReq.motivoRechazo && (
                                <p className="text-sm text-red-600"><strong>Motivo de Rechazo:</strong> {viewingReq.motivoRechazo}</p>
                            )}

                            <div className="rounded-md border max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-center">Cant. Solicitada</TableHead>
                                            <TableHead className="text-center">Cant. Entregada</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewingReq.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    <span
                                                        className="truncate max-w-[280px] block cursor-default"
                                                        title={`${item.product?.nombre || "Producto"} ${item.product?.presentacion || ""}`}
                                                    >
                                                        {item.product?.nombre || "Producto"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.cantidadSolicitada} {item.product?.unidadBase || "unid."}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-green-700">
                                                    {item.cantidadAprobada !== null && item.cantidadAprobada !== undefined
                                                        ? `${item.cantidadAprobada} ${item.product?.unidadBase || "unid."}`
                                                        : "-"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingReq(null)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
