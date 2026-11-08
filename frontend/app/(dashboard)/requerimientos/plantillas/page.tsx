"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Plus,
    PencilSimple as Pencil,
    Trash as Trash2,
    CircleNotch as Loader2,
    ClipboardText as ClipboardList,
    CaretUpDown as ChevronsUpDown,
    X,
    Warning as AlertTriangle,
    Package as PackageSearch,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { useUserRole } from "@/hooks/use-user-role"
import { UserRole } from "@/lib/roles"
import { cn } from "@/lib/utils"

interface PlantillaItem {
    id: string
    productId: string
    orden: number
    product: {
        id: string
        nombre: string
        unidadBase: string | null
        deletedAt: string | null
    }
}

interface Plantilla {
    id: string
    nombre: string
    descripcion: string | null
    areaId?: string | null
    area?: { id: string; nombre: string } | null
    createdAt: string
    items: PlantillaItem[]
}

interface ProductOption {
    id: string
    nombre: string
    unidadBase: string
}

export default function PlantillasPage() {
    const { role } = useUserRole()
    const canManage = role === UserRole.ADMIN || role === UserRole.SOLICITANTE

    const [plantillas, setPlantillas] = useState<Plantilla[]>([])
    const [products, setProducts] = useState<ProductOption[]>([])
    const [areas, setAreas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Modal crear/editar
    const [modalOpen, setModalOpen] = useState(false)
    const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(null)
    const [modalNombre, setModalNombre] = useState("")
    const [modalDescripcion, setModalDescripcion] = useState("")
    const [modalAreaId, setModalAreaId] = useState<string>("none")
    const [modalProductIds, setModalProductIds] = useState<string[]>([])
    const [openProductSelect, setOpenProductSelect] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Modal eliminar
    const [deletingPlantilla, setDeletingPlantilla] = useState<Plantilla | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const fetchPlantillas = async () => {
        try {
            const data = await api.get('/plantillas')
            setPlantillas(data || [])
        } catch (error) {
            console.error("Error fetching plantillas:", error)
            toast.error("Error al cargar las plantillas")
        } finally {
            setLoading(false)
        }
    }

    const fetchProducts = async () => {
        try {
            const data = await api.get('/products')
            setProducts(
                (data || []).map((p: any) => ({
                    id: p.id,
                    nombre: p.nombre,
                    unidadBase: p.unidadBase || "Unidad",
                }))
            )
        } catch (error) {
            console.error("Error fetching products:", error)
        }
    }

    const fetchAreas = async () => {
        try {
            const data = await api.get('/areas')
            setAreas(data || [])
        } catch (error) {
            console.error("Error fetching areas:", error)
        }
    }

    useEffect(() => {
        fetchPlantillas()
        fetchProducts()
        fetchAreas()
    }, [])

    // Productos ya seleccionados en el modal (objetos completos)
    const selectedProductObjects = useMemo(() => {
        return modalProductIds
            .map(id => products.find(p => p.id === id))
            .filter(Boolean) as ProductOption[]
    }, [modalProductIds, products])

    // Abrir modal para crear
    const handleOpenCreate = () => {
        setEditingPlantilla(null)
        setModalNombre("")
        setModalDescripcion("")
        setModalAreaId("none")
        setModalProductIds([])
        setModalOpen(true)
    }

    // Abrir modal para editar
    const handleOpenEdit = (plantilla: Plantilla) => {
        setEditingPlantilla(plantilla)
        setModalNombre(plantilla.nombre)
        setModalDescripcion(plantilla.descripcion || "")
        setModalAreaId(plantilla.areaId || "none")
        setModalProductIds(
            plantilla.items
                .filter(item => !item.product.deletedAt)
                .sort((a, b) => a.orden - b.orden)
                .map(item => item.productId)
        )
        setModalOpen(true)
    }

    const handleAddProduct = (productId: string) => {
        if (modalProductIds.includes(productId)) {
            const p = products.find(p => p.id === productId)
            toast.warning(`"${p?.nombre}" ya está en la plantilla`)
            return
        }
        setModalProductIds(prev => [...prev, productId])
        setOpenProductSelect(false)
    }

    const handleRemoveProduct = (productId: string) => {
        setModalProductIds(prev => prev.filter(id => id !== productId))
    }

    const handleSave = async () => {
        if (!modalNombre.trim()) {
            toast.warning("El nombre de la plantilla es obligatorio")
            return
        }
        if (modalProductIds.length === 0) {
            toast.warning("Agrega al menos un medicamento a la plantilla")
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                nombre: modalNombre.trim(),
                descripcion: modalDescripcion.trim() || null,
                areaId: modalAreaId === "none" ? null : modalAreaId,
                productIds: modalProductIds,
            }

            if (editingPlantilla) {
                await api.put(`/plantillas/${editingPlantilla.id}`, payload)
                toast.success(`Plantilla "${modalNombre}" actualizada exitosamente`)
            } else {
                await api.post('/plantillas', payload)
                toast.success(`Plantilla "${modalNombre}" creada exitosamente`)
            }
            setModalOpen(false)
            await fetchPlantillas()
        } catch (error: any) {
            toast.error(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deletingPlantilla) return
        setIsDeleting(true)
        try {
            await api.delete(`/plantillas/${deletingPlantilla.id}`)
            toast.success(`Plantilla "${deletingPlantilla.nombre}" eliminada`)
            setDeletingPlantilla(null)
            await fetchPlantillas()
        } catch (error: any) {
            toast.error(`Error al eliminar: ${error.message || "Error desconocido"}`)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Plantillas de Requerimientos</h1>
                    <p className="text-muted-foreground mt-1">
                        Listas predefinidas de medicamentos para agilizar la creación de pedidos
                    </p>
                </div>
                {canManage && (
                    <Button onClick={handleOpenCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Plantilla
                    </Button>
                )}
            </div>

            {/* Contenido */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : plantillas.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="p-4 rounded-full bg-muted">
                            <PackageSearch className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-semibold text-lg">No hay plantillas creadas</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Crea una plantilla para pre-cargar listas de medicamentos al hacer un requerimiento
                            </p>
                        </div>
                        {canManage && (
                            <Button onClick={handleOpenCreate} className="gap-2 mt-2">
                                <Plus className="h-4 w-4" />
                                Crear primera plantilla
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {plantillas.map(plantilla => {
                        const itemsActivos = plantilla.items.filter(i => !i.product.deletedAt)
                        const itemsEliminados = plantilla.items.filter(i => i.product.deletedAt)

                        return (
                            <Card key={plantilla.id} className="flex flex-col hover:shadow-md transition-shadow">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                                <ClipboardList className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <CardTitle className="text-base truncate">{plantilla.nombre}</CardTitle>
                                                {plantilla.area ? (
                                                    <Badge variant="secondary" className="text-[10px] mt-0.5 font-normal">
                                                        {plantilla.area.nombre}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                        General (Todas las áreas)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleOpenEdit(plantilla)}
                                                    title="Editar plantilla"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setDeletingPlantilla(plantilla)}
                                                    title="Eliminar plantilla"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {plantilla.descripcion && (
                                        <CardDescription className="text-xs mt-1 line-clamp-2">
                                            {plantilla.descripcion}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-1 pt-0">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="secondary" className="text-xs">
                                            {itemsActivos.length} medicamentos
                                        </Badge>
                                        {itemsEliminados.length > 0 && (
                                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50 gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {itemsEliminados.length} eliminados del inventario
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                        {plantilla.items
                                            .sort((a, b) => a.orden - b.orden)
                                            .map(item => (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "text-xs px-2 py-1 rounded flex items-center gap-1.5",
                                                        item.product.deletedAt
                                                            ? "bg-red-50 text-red-600 line-through"
                                                            : "bg-muted/50 text-foreground"
                                                    )}
                                                >
                                                    {item.product.deletedAt && (
                                                        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                                                    )}
                                                    <span className="truncate">{item.product.nombre}</span>
                                                </div>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal Crear / Editar */}
            <Dialog open={modalOpen} onOpenChange={(open) => !isSaving && setModalOpen(open)}>
                <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            {editingPlantilla ? "Editar Plantilla" : "Nueva Plantilla"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPlantilla
                                ? "Modifica el nombre, descripción o lista de medicamentos de esta plantilla."
                                : "Define un nombre y selecciona los medicamentos que conformarán esta plantilla."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Nombre y Área en la misma fila */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plantilla-nombre">Nombre de la plantilla *</Label>
                                <Input
                                    id="plantilla-nombre"
                                    value={modalNombre}
                                    onChange={e => setModalNombre(e.target.value)}
                                    placeholder="Ej: Botiquín Emergencia, Carro de Paro UCI..."
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="plantilla-area">Área / Departamento (opcional)</Label>
                                <Select value={modalAreaId} onValueChange={setModalAreaId} disabled={isSaving}>
                                    <SelectTrigger id="plantilla-area">
                                        <SelectValue placeholder="Seleccionar área o General" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">General (Todas las áreas)</SelectItem>
                                        {areas.map((area: any) => (
                                            <SelectItem key={area.id} value={area.id}>
                                                {area.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label htmlFor="plantilla-descripcion">Descripción (opcional)</Label>
                            <Textarea
                                id="plantilla-descripcion"
                                value={modalDescripcion}
                                onChange={e => setModalDescripcion(e.target.value)}
                                placeholder="Describe para qué área o personal es esta plantilla..."
                                rows={2}
                                disabled={isSaving}
                            />
                        </div>

                        {/* Selector de Producto */}
                        <div className="space-y-2">
                            <Label>Agregar medicamento / insumo</Label>
                            <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between font-normal"
                                        disabled={isSaving}
                                    >
                                        Buscar y agregar producto...
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                                    <Command
                                        filter={(value, search) => {
                                            const product = products.find(p => p.id === value)
                                            if (!product) return 0
                                            return product.nombre.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                        }}
                                    >
                                        <CommandInput placeholder="Buscar por nombre..." />
                                        <CommandList>
                                            <CommandEmpty>No se encontró ningún producto.</CommandEmpty>
                                            <CommandGroup>
                                                {products.map(product => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={product.id}
                                                        onSelect={() => handleAddProduct(product.id)}
                                                        className={cn(
                                                            modalProductIds.includes(product.id) && "opacity-50"
                                                        )}
                                                    >
                                                        <div className="flex flex-col flex-1 min-w-0">
                                                            <span className="font-medium text-sm truncate">{product.nombre}</span>
                                                            <span className="text-xs text-muted-foreground">{product.unidadBase}</span>
                                                        </div>
                                                        {modalProductIds.includes(product.id) && (
                                                            <Badge variant="secondary" className="text-[10px] ml-2">Ya agregado</Badge>
                                                        )}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Lista de productos seleccionados */}
                        {selectedProductObjects.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm text-muted-foreground">
                                        Medicamentos en la plantilla ({selectedProductObjects.length})
                                    </Label>
                                </div>
                                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                                    {selectedProductObjects.map((product, index) => (
                                        <div key={product.id} className="flex items-center gap-3 px-3 py-2">
                                            <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                                                {index + 1}.
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{product.nombre}</p>
                                                <p className="text-xs text-muted-foreground">{product.unidadBase}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => handleRemoveProduct(product.id)}
                                                disabled={isSaving}
                                            >
                                                <X className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedProductObjects.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
                                No has agregado ningún medicamento a la plantilla
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setModalOpen(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                editingPlantilla ? "Guardar Cambios" : "Crear Plantilla"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AlertDialog de Eliminación */}
            <AlertDialog open={!!deletingPlantilla} onOpenChange={(open) => !open && setDeletingPlantilla(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará la plantilla <strong>"{deletingPlantilla?.nombre}"</strong> con sus {deletingPlantilla?.items.length} medicamentos.
                            Esta acción no se puede deshacer. Los requerimientos ya creados a partir de esta plantilla no se verán afectados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
                            ) : "Sí, eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
