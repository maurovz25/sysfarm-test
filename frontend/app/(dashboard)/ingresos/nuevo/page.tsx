"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash as Trash2, ArrowLeft, FloppyDisk as Save, CircleNotch as Loader2, Warning as AlertTriangle, Barcode, X, Check, CaretUpDown as ChevronsUpDown, CalendarBlank as CalendarIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import type { Product, InventoryMovement, TipoUnidad } from "@/lib/types"
import { cn } from "@/lib/utils"
import { obtenerStockDesglosado, calcularUnidadesDesdePresentacion } from "@/lib/inventory"
import { api } from "@/lib/api"
import { BatchDialog } from "@/components/batches/batch-dialog"
import { useUserRole } from "@/hooks/use-user-role"
import { useRef } from "react"
import { combineDateWithCurrentTime, isDateWithinFutureLimit, formatLocalDate } from "@/lib/date-utils"

export default function NuevoIngresoPage() {
    const { user } = useUserRole()
    const router = useRouter()
    const currentUserName = user?.user_metadata?.full_name || 'Usuario'
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // List of added items
    const [items, setItems] = useState<Partial<InventoryMovement>[]>([])

    // Form states
    const [selectedProductName, setSelectedProductName] = useState<string>("")
    const [productoId, setProductoId] = useState<string>("") // Represents the selected "Reference Lot"
    const [openProductSelect, setOpenProductSelect] = useState(false)

    const [showGtinSearch, setShowGtinSearch] = useState(false)
    const [gtin, setGtin] = useState("")
    const lastSearchedGtin = useRef("")
    const [pendingLotCode, setPendingLotCode] = useState<string | null>(null)

    // Derived state: Get all unique product names
    const uniqueProducts = useMemo(() => {
        const seen = new Set()
        return products.filter(p => {
            const duplicate = seen.has(p.nombre)
            seen.add(p.nombre)
            return !duplicate
        })
    }, [products])

    const selectedProductMetadata = useMemo(() => {
        return uniqueProducts.find(p => p.nombre === selectedProductName)
    }, [uniqueProducts, selectedProductName])

    // Derived state: Get all lots available for the selected name, sorted by expiry
    const availableLots = useMemo(() => {
        if (!selectedProductName) return []
        return products
            .filter(p => p.nombre === selectedProductName)
            .sort((a, b) => {
                const dateA = a.fechaExpiracion ? new Date(a.fechaExpiracion).getTime() : 0
                const dateB = b.fechaExpiracion ? new Date(b.fechaExpiracion).getTime() : 0
                return dateA - dateB
            })
    }, [selectedProductName, products])

    const [cantidadPresentacion, setCantidadPresentacion] = useState<number>(0)
    const [cantidadUnidad, setCantidadUnidad] = useState<number>(0)
    const [tipoUnidad, setTipoUnidad] = useState<TipoUnidad>("presentacion")
    const [motivo, setMotivo] = useState<string>("Compra a proveedor")
    const [fechaMovimiento, setFechaMovimiento] = useState<Date | undefined>(undefined)

    // Proveedor and other info


    const [proveedorNombre, setProveedorNombre] = useState<string>("")
    const [proveedorRuc, setProveedorRuc] = useState<string>("")
    const [observaciones, setObservaciones] = useState<string>("")

    // Fetch products from API
    const loadProducts = async () => {
        try {
            const data = await api.get('/products')
            // Flatten backend response (products with batches) into Product[]
            const flatProducts: Product[] = data.flatMap((bp: any) => {
                const formatTipo = (backendTipo: string): "Medicamento" | "Dispositivo Médico" => {
                    if (!backendTipo) return "Medicamento";
                    const upper = backendTipo.toUpperCase();
                    if (upper.includes("MEDICAMENTO")) return "Medicamento";
                    if (upper.includes("DISPOSITIVO") || upper.includes("INSUMO")) return "Dispositivo Médico";
                    return "Medicamento";
                }

                if (!bp.batches || bp.batches.length === 0) {
                    return [{
                        id: bp.id,
                        productId: bp.id,
                        codigoBarras: bp.codigoBarras || "",
                        nombre: bp.nombre,
                        descripcionCorta: bp.descripcion || "",
                        tipo: formatTipo(bp.tipo),
                        lote: "SIN-LOTE",
                        fechaExpiracion: "",
                        registroSanitario: bp.registroSanitario || "",
                        laboratorio: bp.laboratorio || "",
                        presentacion: bp.presentacion || "Unidad",
                        cantidadPorPresentacion: bp.cantidadPorPresentacion || 1,
                        unidadBase: bp.unidadBase || "Unidad",
                        stockUnidad: 0,
                        stockMinimo: bp.stockMinimo || 0,
                        precioCostoPresentacion: bp.precioCostoPresentacion || 0,
                        precioVentaPresentacion: bp.precioVentaPresentacion || 0,
                        precioCostoUnidad: bp.precioCostoUnidad || 0,
                        precioVentaUnidad: bp.precioVentaUnidad || 0,
                        fechaCreacion: bp.createdAt || new Date().toISOString(),
                        ultimaActualizacion: bp.updatedAt || new Date().toISOString(),
                    }]
                }

                return bp.batches.map((batch: any) => ({
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
                    cantidadPorPresentacion: batch.cantidadPorPresentacion || 1,
                    unidadBase: bp.unidadBase || "Unidad",
                    stockUnidad: batch.stockActual,
                    stockMinimo: bp.stockMinimo || 0,
                    precioCostoPresentacion: bp.precioCostoPresentacion || 0,
                    precioVentaPresentacion: bp.precioVentaPresentacion || 0,
                    precioCostoUnidad: bp.precioCostoUnidad || 0,
                    precioVentaUnidad: bp.precioVentaUnidad || 0,
                    fechaCreacion: bp.createdAt || new Date().toISOString(),
                    ultimaActualizacion: bp.updatedAt || new Date().toISOString(),
                }))
            })
            setProducts(flatProducts)
        } catch (error) {
            console.error("Failed to fetch products", error)
        }
    }

    useEffect(() => {
        loadProducts()
    }, [])

    const executeSearch = (searchValue: string) => {
        if (!searchValue || lastSearchedGtin.current === searchValue) return
        lastSearchedGtin.current = searchValue
        const found = products.find(p => p.codigoBarras === searchValue)
        if (found) {
            setSelectedProductName(found.nombre)
            setShowGtinSearch(false)
            setGtin("")
            lastSearchedGtin.current = "" // Reset for next time
        } else {
            toast.warning(`No se encontró ningún producto con el código de barras: ${searchValue}`)
        }
    }

    // Debounced automatic search
    useEffect(() => {
        if (!showGtinSearch || !gtin) return
        const timer = setTimeout(() => {
            executeSearch(gtin)
        }, 1000)
        return () => clearTimeout(timer)
    }, [gtin, showGtinSearch])

    // Auto-select pending lot when products reload
    useEffect(() => {
        if (pendingLotCode && products.length > 0) {
            const newLot = products.find(p => p.lote === pendingLotCode)
            if (newLot) {
                setSelectedProductName(newLot.nombre)
                setProductoId(newLot.id)
                setPendingLotCode(null)
            }
        }
    }, [products, pendingLotCode])

    const selectedProduct = products.find(p => p.id === productoId)

    // Auto-select the first lot (nearest expiry) when product name changes, to provide a default "Product Definition"
    useEffect(() => {
        if (availableLots.length > 0) {
            const currentIsValid = availableLots.some(l => l.id === productoId)
            if (!productoId || !currentIsValid) {
                setProductoId(availableLots[0].id)
            }
        }
    }, [availableLots, productoId])

    // When a specific lot is selected (productoId changes), sync the local state
    // purely for internal use or display. 
    useEffect(() => {
        if (selectedProduct) {
            // setLote(selectedProduct.lote || "") // Removed manual input
            // setFechaExpiracion(selectedProduct.fechaExpiracion ? selectedProduct.fechaExpiracion.split('T')[0] : "") // Removed manual input
        }
    }, [selectedProduct])



    const stockDesglosado = selectedProduct
        ? obtenerStockDesglosado(selectedProduct.stockUnidad, selectedProduct.cantidadPorPresentacion)
        : null

    // Calculate units when presentation quantity changes
    useEffect(() => {
        if (selectedProduct && tipoUnidad === "presentacion") {
            const unidades = calcularUnidadesDesdePresentacion(
                cantidadPresentacion,
                selectedProduct.cantidadPorPresentacion
            )
            setCantidadUnidad(unidades)
        }
    }, [cantidadPresentacion, tipoUnidad, selectedProduct])

    // Calculate the default product ID if we open the new lot modal
    const defaultProductIdForBatch = useMemo(() => {
        if (!selectedProductName || products.length === 0) return undefined;
        const p = products.find(prod => prod.nombre === selectedProductName);
        // Note: products array has flattened items where `productId` points to the actual DB product ID.
        return p ? p.productId : undefined;
    }, [selectedProductName, products]);

    const handleAddItem = () => {
        if (!selectedProduct || cantidadUnidad <= 0 || !motivo) return

        const fechaFinal = combineDateWithCurrentTime(fechaMovimiento)

        const newItem: Partial<InventoryMovement> = {
            productId: selectedProduct.productId, // UUID del producto
            batchId: selectedProduct.lote !== "SIN-LOTE" ? selectedProduct.id : undefined, // UUID del lote si existe
            productoId: selectedProduct.id,
            productoNombre: selectedProduct.nombre,
            cantidadUnidad,
            cantidadPresentacion: tipoUnidad === "presentacion" ? cantidadPresentacion : 0,
            tipoUnidad,
            lote: selectedProduct.lote,
            fechaExpiracion: selectedProduct.fechaExpiracion,
            motivo,
            proveedorNombre,
            proveedorRuc,
            observaciones,
            usuario: currentUserName,
            fecha: fechaFinal.toISOString(),
            tipo: "Ingreso"
        }

        setItems([...items, newItem])

        // Reset specific item fields
        setSelectedProductName("")
        setProductoId("")
        setCantidadPresentacion(0)
        setCantidadUnidad(0)
        setFechaMovimiento(undefined)
    }


    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        if (items.length === 0) return
        setLoading(true)

        try {
            const payloadItems = items.map(item => {
                let isoFechaExp = item.fechaExpiracion
                if (isoFechaExp && isoFechaExp.length === 10) { // Formato YYYY-MM-DD
                    isoFechaExp = new Date(`${isoFechaExp}T12:00:00Z`).toISOString()
                } else if (!isoFechaExp) {
                    isoFechaExp = new Date().toISOString()
                }

                return {
                    productId: item.productId,
                    batchId: item.batchId,
                    productoNombre: item.productoNombre,
                    cantidad: item.cantidadUnidad,
                    lote: item.lote || "LOTE-DEFAULT",
                    fechaExpiracion: isoFechaExp,
                    motivo: item.motivo || "Ingreso",
                    usuario: item.usuario || "Admin",
                    proveedor: item.proveedorNombre || "",
                    fecha: item.fecha,
                }
            })

            const response = await api.post('/inventory/ingresos-bulk', { items: payloadItems })

            toast.success(response.message || `${items.length} movimiento(s) registrado(s) exitosamente`)
            router.push("/ingresos")
        } catch (error: any) {
            console.error("Error saving movements:", error)
            toast.error(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    const isAddDisabled = !productoId || cantidadUnidad <= 0 || !motivo

    if (!mounted) {
        return null
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Registrar Nuevo Ingreso</h1>
                    <p className="text-muted-foreground mt-1">Completa el formulario para registrar el movimiento</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
                {/* Form Column */}
                <Card className="w-full shadow-md border-muted">
                    <CardHeader>
                        <CardTitle>Detalles del Ingreso</CardTitle>
                        <CardDescription>Selecciona el producto y el lote específico</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* 1. Producto (Generic Name) */}
                        <div className="space-y-2">
                            <Label>Medicamento/Insumo *</Label>
                            {showGtinSearch ? (
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            autoFocus
                                            placeholder="Escanear o ingresar código de barras..."
                                            value={gtin}
                                            onChange={(e) => setGtin(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    executeSearch(gtin)
                                                }
                                            }}
                                            className="pr-8"
                                        />
                                        {gtin && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGtin("")
                                                    lastSearchedGtin.current = ""
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setShowGtinSearch(false)} title="Volver a lista">
                                        <Barcode className="h-4 w-4 text-primary" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openProductSelect}
                                                    className="w-full justify-between font-normal"
                                                >
                                                    {selectedProductName
                                                        ? selectedProductMetadata
                                                            ? `${selectedProductMetadata.codigoBarras ? selectedProductMetadata.codigoBarras + " - " : ""}${selectedProductMetadata.nombre}`
                                                            : selectedProductName
                                                        : "Buscar o seleccionar producto..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                                                <Command
                                                    filter={(value, search) => {
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
                                                            {uniqueProducts.map((product) => (
                                                                <CommandItem
                                                                    key={product.id || product.nombre}
                                                                    value={product.nombre}
                                                                    onSelect={(currentValue) => {
                                                                        setSelectedProductName(product.nombre)
                                                                        setOpenProductSelect(false)
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
                                    </div>
                                    <Button type="button" variant="outline" size="icon" onClick={() => setShowGtinSearch(true)} title="Buscar por Código de Barras">
                                        <Barcode className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* 2. Select Specific Lot (Mandatory) */}
                        {selectedProductName && (
                            <div className="space-y-2">
                                <Label>Seleccionar Lote *</Label>
                                <Select value={productoId} onValueChange={(val) => {
                                    if (val === "nuevo_lote") {
                                        document.getElementById("hidden-batch-trigger")?.click();
                                    } else {
                                        setProductoId(val);
                                    }
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar lote existente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nuevo_lote" className="text-blue-600 font-medium">
                                            + Crear Nuevo Lote
                                        </SelectItem>
                                        {availableLots.map((lot) => (
                                            <SelectItem key={lot.id} value={lot.id}>
                                                <span className="font-medium">{lot.lote}</span>
                                                <span className="text-muted-foreground mx-2">|</span>
                                                <span>Vence: {lot.fechaExpiracion ? formatLocalDate(lot.fechaExpiracion) : 'N/A'}</span>
                                                <span className="text-muted-foreground mx-2">|</span>
                                                <span>Stock Actual: {lot.stockUnidad}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Debes seleccionar un lote existente. Si es un lote nuevo, regístralo primero en el módulo de Lotes.
                                </p>
                            </div>
                        )}

                        {/* 3. Lote y Fecha de Expiración - REMOVED MANUAL INPUTS */}
                        {/* {selectedProductName && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="lote">Lote *</Label>
                                    <Input
                                        id="lote"
                                        value={lote}
                                        onChange={(e) => setLote(e.target.value)}
                                        placeholder="Ingrese código de lote"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fechaExpiracion">Fecha de Expiración *</Label>
                                    <Input
                                        id="fechaExpiracion"
                                        type="date"
                                        value={fechaExpiracion}
                                        onChange={(e) => setFechaExpiracion(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )} */}

                        {/* Product/Stock Info Alert */}
                        {selectedProduct && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    <div className="space-y-1">
                                        <p>
                                            <strong>Producto:</strong> {selectedProduct.nombre}
                                        </p>
                                        <p>
                                            <strong>Presentación:</strong> {selectedProduct.presentacion} ({selectedProduct.cantidadPorPresentacion} {selectedProduct.unidadBase})
                                        </p>
                                        {selectedProduct.lote !== "SIN-LOTE" && (
                                            <p>
                                                <strong>Referencia Lote Seleccionado:</strong> {selectedProduct.lote} (Vence: {selectedProduct.fechaExpiracion ? formatLocalDate(selectedProduct.fechaExpiracion) : 'N/A'})
                                            </p>
                                        )}
                                        <p>
                                            <strong>Stock del Lote Referenciado:</strong> {selectedProduct.stockUnidad} {selectedProduct.unidadBase}
                                        </p>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}


                        {/* Ingresar por (Tipo Unidad) */}
                        {selectedProduct && (
                            <div className="space-y-2">
                                <Label>Ingresar por *</Label>
                                <Select
                                    value={tipoUnidad}
                                    onValueChange={(val) => {
                                        setTipoUnidad(val as TipoUnidad)
                                        setCantidadPresentacion(0)
                                        setCantidadUnidad(0)
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="presentacion">
                                            {selectedProduct.presentacion} ({selectedProduct.cantidadPorPresentacion} {selectedProduct.unidadBase})
                                        </SelectItem>
                                        <SelectItem value="unidad">
                                            {selectedProduct.unidadBase} (unidades sueltas)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Cantidad Input */}
                        {selectedProduct && (
                            tipoUnidad === "presentacion" ? (
                                <div className="space-y-2">
                                    <Label>Cantidad ({selectedProduct.presentacion}) *</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={cantidadPresentacion || ""}
                                        onChange={(e) => setCantidadPresentacion(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                    {cantidadPresentacion > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Equivale a: {cantidadUnidad} {selectedProduct.unidadBase}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>Cantidad ({selectedProduct.unidadBase}) *</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={cantidadUnidad || ""}
                                        onChange={(e) => setCantidadUnidad(Number(e.target.value))}
                                        placeholder="0"
                                    />
                                </div>
                            )
                        )}

                        {/* Fecha del Movimiento (Opcional) */}
                        <div className="space-y-2">
                            <Label>Fecha del Movimiento (Opcional)</Label>
                            <div className="flex items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !fechaMovimiento && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {fechaMovimiento ? (
                                                formatLocalDate(fechaMovimiento)
                                            ) : (
                                                <span>Hoy (Fecha y hora actual)</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={fechaMovimiento}
                                            onSelect={setFechaMovimiento}
                                            disabled={(date) => !isDateWithinFutureLimit(date, 3)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                {fechaMovimiento && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setFechaMovimiento(undefined)}
                                        title="Restablecer a Hoy"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Si no seleccionas fecha, se usará el momento actual. Máximo 3 días en el futuro o cualquier día anterior.
                            </p>
                        </div>

                        {/* Motivo */}
                        <div className="space-y-2">
                            <Label>Motivo *</Label>
                            <Select value={motivo} onValueChange={setMotivo}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Compra a proveedor">Compra a proveedor</SelectItem>
                                    <SelectItem value="Devolución">Devolución</SelectItem>
                                    <SelectItem value="Ajuste de inventario">Ajuste de inventario</SelectItem>
                                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                                    <SelectItem value="Otro">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Proveedor Info */}
                        <div className="space-y-2">
                            <Label>Nombre del Proveedor</Label>
                            <Input
                                value={proveedorNombre}
                                onChange={(e) => setProveedorNombre(e.target.value)}
                                placeholder="Nombre del proveedor (opcional)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>RUC del Proveedor</Label>
                            <Input
                                value={proveedorRuc}
                                onChange={(e) => setProveedorRuc(e.target.value)}
                                placeholder="RUC (opcional)"
                                maxLength={11}
                            />
                        </div>

                        {/* Observaciones */}
                        <div className="space-y-2">
                            <Label>Observaciones</Label>
                            <Textarea
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                placeholder="Información adicional (opcional)"
                                rows={3}
                            />
                        </div>

                        <Button className="w-full" onClick={handleAddItem} disabled={isAddDisabled}>
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar a la Lista
                        </Button>
                    </CardContent>
                </Card>

                {/* List Column */}
                <div className="space-y-4">
                    <Card className="h-full shadow-md border-muted">
                        <CardHeader>
                            <CardTitle>Productos a Ingresar</CardTitle>
                            <CardDescription>Revisa la lista antes de guardar</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Cant.</TableHead>
                                            <TableHead>Lote</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    No hay productos agregados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="font-medium">
                                                        {item.productoNombre}
                                                        <div className="text-xs text-muted-foreground">{item.motivo}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.cantidadUnidad}
                                                        {item.cantidadPresentacion ? <div className="text-xs text-muted-foreground">({item.cantidadPresentacion} cajas)</div> : null}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.lote}
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.fechaExpiracion ? formatLocalDate(item.fechaExpiracion) : "-"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <Button variant="outline" onClick={() => router.back()} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={items.length === 0 || loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Procesar Todo ({items.length})
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* Hidden Dialog for creating new lot */}
            <BatchDialog 
                isAdmin={true} 
                defaultProductId={defaultProductIdForBatch}
                onSave={(codigo) => {
                    if (codigo) setPendingLotCode(codigo);
                    loadProducts();
                }}
                trigger={<button id="hidden-batch-trigger" className="hidden" />}
            />
        </div>
    )
}
