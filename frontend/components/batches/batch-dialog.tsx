"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, CircleNotch as Loader2, MagnifyingGlass as Search, X } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { Product } from "@/lib/types"
import { useUserRole } from "@/hooks/use-user-role"

interface BatchDialogProps {
    batch?: any // Batch to edit
    isAdmin?: boolean
    onSave: (codigoLote?: string) => void
    trigger?: React.ReactNode
    defaultProductId?: string
}

export function BatchDialog({ batch, isAdmin = true, onSave, trigger, defaultProductId }: BatchDialogProps) {
    const { user } = useUserRole()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [products, setProducts] = useState<Product[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [isSearching, setIsSearching] = useState(false)

    const [formData, setFormData] = useState({
        productId: batch?.productId || "",
        codigo: batch?.codigo || "",
        fechaExpiracion: batch?.fechaExpiracion ? batch.fechaExpiracion.split('T')[0] : "",
        stockActual: batch?.stockActual || 0,
        precioCostoPresentacion: batch?.precioCostoPresentacion || 0,
        precioVentaPresentacion: batch?.precioVentaPresentacion || 0,
        laboratorio: batch?.laboratorio || "",
    })
    const [motivoAjuste, setMotivoAjuste] = useState("")


    // Update form data if batch prop changes (when opening for edit)
    useEffect(() => {
        if (batch) {
            setFormData({
                productId: batch.productId,
                codigo: batch.codigo,
                fechaExpiracion: batch.fechaExpiracion ? batch.fechaExpiracion.split('T')[0] : "",
                stockActual: batch.stockActual,
                precioCostoPresentacion: batch.precioCostoPresentacion || 0,
                precioVentaPresentacion: batch.precioVentaPresentacion || 0,
                laboratorio: batch.laboratorio || ""
            })
        }
    }, [batch])


    useEffect(() => {
        if (open) {
            fetchProducts()
        } else {
            setSearchTerm("")
            setIsSearching(false)
            setMotivoAjuste("")
        }
    }, [open])

    useEffect(() => {
        if (products.length > 0) {
            if (batch) {
                const p = products.find(prod => prod.id === batch.productId)
                if (p) setSearchTerm(p.nombre)
            } else if (defaultProductId) {
                const p = products.find(prod => prod.id === defaultProductId)
                if (p) {
                    setFormData(prev => ({ ...prev, productId: p.id || "" }))
                    setSearchTerm(p.nombre)
                }
            }
        }
    }, [products, batch, defaultProductId])

    const fetchProducts = async () => {
        try {
            const data = await api.get('/products')
            setProducts(data)
        } catch (error) {
            console.error("Error fetching products:", error)
        }
    }

    const filteredProducts = products.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigoBarras?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 20)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.productId || !formData.codigo || !formData.fechaExpiracion) {
            toast.warning("Por favor complete todos los campos obligatorios.")
            return
        }

        const stockChanged = batch?.id && Number(formData.stockActual) !== batch.stockActual;
        if (stockChanged && !motivoAjuste) {
            toast.warning("Por favor ingrese un motivo para el ajuste de stock.");
            return;
        }

        const nombreUsuario = user?.user_metadata?.full_name || 'Usuario'
        const currentData = { ...formData }
        const currentMotivo = motivoAjuste
        const isEditing = !!batch?.id
        const batchId = batch?.id

        // Cerrar modal al instante (0ms)
        setOpen(false)
        if (!batch) {
            setFormData({
                productId: "",
                codigo: "",
                fechaExpiracion: "",
                stockActual: 0,
                precioCostoPresentacion: 0,
                precioVentaPresentacion: 0,
                laboratorio: "",
            })
        }

        const toastId = toast.loading(isEditing ? `Actualizando lote "${currentData.codigo}"...` : `Creando lote "${currentData.codigo}"...`)

        // Ejecutar en segundo plano
        ;(async () => {
            try {
                if (isEditing && batchId) {
                    await api.put(`/batches/${batchId}`, {
                        codigo: currentData.codigo,
                        fechaExpiracion: currentData.fechaExpiracion,
                        stockActual: Number(currentData.stockActual),
                        precioCostoPresentacion: Number(currentData.precioCostoPresentacion),
                        precioVentaPresentacion: Number(currentData.precioVentaPresentacion),
                        laboratorio: currentData.laboratorio,
                        motivo: currentMotivo,
                        usuario: nombreUsuario
                    })
                    toast.success("Lote actualizado exitosamente", { id: toastId })
                } else {
                    await api.post('/batches', {
                        ...currentData,
                        stockActual: Number(currentData.stockActual),
                        precioCostoPresentacion: Number(currentData.precioCostoPresentacion),
                        precioVentaPresentacion: Number(currentData.precioVentaPresentacion),
                        laboratorio: currentData.laboratorio,
                        usuario: nombreUsuario
                    })
                    toast.success("Lote creado exitosamente", { id: toastId })
                }
                onSave(currentData.codigo)
            } catch (error: any) {
                console.error("Error saving batch:", error)
                toast.error(error.message || (isEditing ? "Error al actualizar el lote" : "Error al crear el lote"), { id: toastId, duration: 6000 })
            }
        })()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Lote
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{batch ? "Editar Lote" : "Crear Nuevo Lote"}</DialogTitle>
                    <DialogDescription>
                        {batch ? "Modifica los datos del lote seleccionado." : "Crea un lote vinculado a un producto existente."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="producto">Producto *</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Buscar por código de barras o nombre..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value)
                                        setFormData(prev => ({ ...prev, productId: "" }))
                                        setIsSearching(true)
                                    }}
                                    onFocus={() => setIsSearching(true)}
                                    disabled={!!batch}
                                />
                                {searchTerm && formData.productId && !batch && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm("")
                                            setFormData(prev => ({ ...prev, productId: "" }))
                                            setIsSearching(true)
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            
                            {isSearching && !formData.productId && searchTerm && !batch && (
                                <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {filteredProducts.map((p) => (
                                        <div 
                                            key={p.id} 
                                            className="p-2 hover:bg-muted cursor-pointer text-sm border-b last:border-0"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, productId: p.id || "" }))
                                                setSearchTerm(p.nombre)
                                                setIsSearching(false)
                                            }}
                                        >
                                            <div className="font-medium">{p.nombre}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {p.codigoBarras ? `Cód: ${p.codigoBarras} | ` : ""}{p.presentacion}
                                            </div>
                                        </div>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="p-2 text-xs text-center text-muted-foreground">
                                            No se encontraron productos
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="codigo">Código de Lote *</Label>
                                <Input
                                    id="codigo"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                                    placeholder="Ej: LOTE-2024-X"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="laboratorio">Laboratorio</Label>
                                <Input
                                    id="laboratorio"
                                    value={formData.laboratorio}
                                    onChange={(e) => setFormData(prev => ({ ...prev, laboratorio: e.target.value }))}
                                    placeholder="Marca/Fabricante"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="fechaExpiracion">Fecha de Expiración *</Label>
                            <Input
                                id="fechaExpiracion"
                                type="date"
                                value={formData.fechaExpiracion}
                                onChange={(e) => setFormData(prev => ({ ...prev, fechaExpiracion: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="stockActual">
                                {batch ? "Stock Actual" : "Stock Inicial (opcional)"}
                            </Label>
                            <Input
                                id="stockActual"
                                type="number"
                                min="0"
                                value={formData.stockActual === 0 ? "" : formData.stockActual}
                                onChange={(e) => setFormData(prev => ({ ...prev, stockActual: e.target.value === "" ? 0 : Number(e.target.value) || 0 }))}
                                placeholder="0"
                                disabled={!!batch && !isAdmin}
                            />
                            {batch && isAdmin && (
                                <p className="text-xs text-orange-500">
                                    Estás editando el stock directamente como Administrador.
                                </p>
                            )}
                            {!batch && (
                                <p className="text-xs text-muted-foreground">
                                    Normalmente se inicia en 0 y se carga vía Ingresos.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="precioCosto">Precio Costo (Pres.)</Label>
                                <Input
                                    id="precioCosto"
                                    type="number"
                                    step="0.01"
                                    value={formData.precioCostoPresentacion === 0 ? "" : formData.precioCostoPresentacion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, precioCostoPresentacion: e.target.value === "" ? 0 : Number(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="precioVenta">Precio Venta (Pres.)</Label>
                                <Input
                                    id="precioVenta"
                                    type="number"
                                    step="0.01"
                                    value={formData.precioVentaPresentacion === 0 ? "" : formData.precioVentaPresentacion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, precioVentaPresentacion: e.target.value === "" ? 0 : Number(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {batch && isAdmin && Number(formData.stockActual) !== batch.stockActual && (
                            <div className="space-y-2">
                                <Label htmlFor="motivoAjuste" className="text-orange-600 font-bold italic">
                                    Motivo del Ajuste *
                                </Label>
                                <Textarea
                                    id="motivoAjuste"
                                    value={motivoAjuste}
                                    onChange={(e) => setMotivoAjuste(e.target.value)}
                                    placeholder="Explique por qué está realizando este ajuste manual..."
                                    required
                                    className="border-orange-300 focus-visible:ring-orange-500"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {batch ? "Guardando..." : "Creando..."}
                                </>
                            ) : (
                                batch ? "Guardar Cambios" : "Crear Lote"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
