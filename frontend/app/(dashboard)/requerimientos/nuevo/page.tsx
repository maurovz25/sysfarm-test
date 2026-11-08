"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Trash as Trash2,
    FloppyDisk as Save,
    CircleNotch as Loader2,
    Warning as AlertTriangle,
    Check,
    CaretUpDown as ChevronsUpDown,
    Barcode,
    X,
    ClipboardText as ClipboardList,
    Cards as LayoutTemplate,
    MagnifyingGlass as Search,
    Eraser,
    ArrowLeft,
    Columns,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Product, TipoUnidad } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatQuantity } from "@/lib/number-utils"
import { api } from "@/lib/api"
import { useUserRole } from "@/hooks/use-user-role"
import { useProducts, usePlantillas, useAreas } from "@/hooks/use-queries"

interface GroupedProduct {
    id: string
    nombre: string
    codigoBarras: string
    tipo: string
    presentacion: string
    unidadBase: string
    cantidadPorPresentacion: number
    stockTotal: number
    batches: any[]
}

interface RequerimientoDraftItem {
    productId: string
    productoNombre: string
    codigoBarras?: string
    cantidadSolicitada: number
    tipoUnidad: TipoUnidad
    stockTotalDisponible: number
    unidadBase: string
    observacion?: string
}

export default function NuevoRequerimientoPage() {
    const { user } = useUserRole()
    const router = useRouter()
    const currentUserName = user?.user_metadata?.full_name || ""
    const currentUserDept = user?.user_metadata?.departamento || ""

    const { data: rawProductsData = [] } = useProducts()
    const { data: plantillasData = [] } = usePlantillas()
    const { data: areasData = [] } = useAreas()

    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const productsRaw: any[] = rawProductsData
    const plantillas: any[] = plantillasData
    const areas: any[] = areasData

    // Lista de ítems en la solicitud
    const [items, setItems] = useState<RequerimientoDraftItem[]>([])

    // Filtro de búsqueda en la tabla de ítems agregados
    const [tableSearch, setTableSearch] = useState("")

    // Modo 2 columnas (por defecto activado para visualizar plantillas sin scroll)
    const [isTwoColumns, setIsTwoColumns] = useState(true)

    // Form states cabecera
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [openProductSelect, setOpenProductSelect] = useState(false)
    const [showGtinSearch, setShowGtinSearch] = useState(false)
    const [gtin, setGtin] = useState("")
    const lastSearchedGtin = useRef("")

    const [departamento, setDepartamento] = useState<string>(currentUserDept)
    const [solicitante, setSolicitante] = useState<string>(currentUserName)
    const [observaciones, setObservaciones] = useState<string>("")

    // Estado para modal de plantillas
    const [templateModalOpen, setTemplateModalOpen] = useState(false)
    const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>("")
    const [mergeMode, setMergeMode] = useState<"replace" | "merge" | "ask" | null>(null)


    // Formatear lista de productos con stock total acumulado
    const groupedProducts: GroupedProduct[] = useMemo(() => {
        return productsRaw.map((p: any) => {
            const activeBatches = (p.batches || []).filter((b: any) => !b.deletedAt)
            const totalStock = activeBatches.reduce((sum: number, b: any) => sum + (b.stockActual || 0), 0)

            return {
                id: p.id,
                nombre: p.nombre,
                codigoBarras: p.codigoBarras || "",
                tipo: p.tipo || "Medicamento",
                presentacion: p.presentacion || "Unidad",
                unidadBase: p.unidadBase || "Unidad",
                cantidadPorPresentacion: p.cantidadPorPresentacion || 1,
                stockTotal: totalStock,
                batches: activeBatches,
            }
        })
    }, [productsRaw])

    const selectedProduct = useMemo(() => {
        return groupedProducts.find(p => p.id === selectedProductId)
    }, [groupedProducts, selectedProductId])

    const executeSearch = (searchValue: string) => {
        if (!searchValue || lastSearchedGtin.current === searchValue) return
        lastSearchedGtin.current = searchValue
        const found = groupedProducts.find(p => p.codigoBarras === searchValue)
        if (found) {
            handleAddSpecificProduct(found)
            setShowGtinSearch(false)
            setGtin("")
            lastSearchedGtin.current = ""
        } else {
            toast.warning(`No se encontró ningún producto con el código de barras: ${searchValue}`)
        }
    }

    useEffect(() => {
        if (!showGtinSearch || !gtin) return
        const timer = setTimeout(() => {
            executeSearch(gtin)
        }, 1000)
        return () => clearTimeout(timer)
    }, [gtin, showGtinSearch])

    const handleAddSpecificProduct = (prod: any) => {
        if (!prod) return
        const existingIndex = items.findIndex(i => i.productId === prod.id)
        if (existingIndex >= 0) {
            toast.info(`"${prod.nombre}" ya está en la lista.`)
        } else {
            const newItem: RequerimientoDraftItem = {
                productId: prod.id,
                productoNombre: prod.nombre,
                codigoBarras: prod.codigoBarras,
                cantidadSolicitada: 0,
                tipoUnidad: "unidad",
                stockTotalDisponible: prod.stockTotal,
                unidadBase: prod.unidadBase,
            }
            setItems([newItem, ...items])
            toast.success(`"${prod.nombre}" agregado a la lista. Ingresa su cantidad.`)
        }
        setSelectedProductId("")
        setOpenProductSelect(false)
    }

    // Actualizar cantidad directamente en la tabla
    const handleQuantityChange = (productId: string, newQuantity: number) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item.productId === productId
                    ? { ...item, cantidadSolicitada: Math.max(0, newQuantity) }
                    : item
            )
        )
    }

    const handleRemoveItem = (productId: string) => {
        setItems(prevItems => prevItems.filter(i => i.productId !== productId))
    }

    // Limpiar ítems cuya cantidad sea 0
    const handleClearZeroItems = () => {
        const zeroItems = items.filter(i => i.cantidadSolicitada <= 0)
        if (zeroItems.length === 0) {
            toast.info("No hay ítems con cantidad 0 en la lista.")
            return
        }
        setItems(prevItems => prevItems.filter(i => i.cantidadSolicitada > 0))
        toast.success(`Se descartaron ${zeroItems.length} producto(s) con cantidad 0.`)
    }

    // Navegación estilo Hoja de Cálculo (Excel) con flechas del teclado y Enter
    const handleTableKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        colIndex: number,
        rowIndex: number
    ) => {
        const key = e.key
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            let targetCol = colIndex
            let targetRow = rowIndex

            if (key === 'ArrowDown' || key === 'Enter') {
                e.preventDefault()
                targetRow = rowIndex + 1
            } else if (key === 'ArrowUp') {
                e.preventDefault()
                targetRow = rowIndex - 1
            } else if (key === 'ArrowRight') {
                if (splitColumns.isSplit && colIndex === 0) {
                    e.preventDefault()
                    targetCol = 1
                }
            } else if (key === 'ArrowLeft') {
                if (splitColumns.isSplit && colIndex === 1) {
                    e.preventDefault()
                    targetCol = 0
                }
            }

            const nextInput = document.querySelector<HTMLInputElement>(
                `input[data-col="${targetCol}"][data-row="${targetRow}"]`
            )
            if (nextInput) {
                nextInput.focus()
                nextInput.select()
            }
        }
    }

    // Guardar requerimiento
    const handleSave = async () => {
        if (!departamento || !solicitante) {
            toast.warning("Completa el área solicitante y el nombre del solicitante.")
            return
        }

        const validItems = items.filter(i => i.cantidadSolicitada > 0)

        if (validItems.length === 0) {
            toast.warning("Ingresa una cantidad mayor a 0 para al menos un producto de la lista.")
            return
        }

        const zeroCount = items.length - validItems.length
        if (zeroCount > 0) {
            toast.info(`Se enviará el requerimiento omitiendo ${zeroCount} producto(s) que tenían cantidad 0.`)
        }

        setLoading(true)

        try {
            await api.post('/requerimientos', {
                solicitante,
                departamento,
                observaciones,
                items: validItems.map(item => ({
                    productId: item.productId,
                    cantidadSolicitada: item.cantidadSolicitada,
                    tipoUnidad: item.tipoUnidad,
                })),
            })

            toast.success(`Solicitud enviada exitosamente con ${validItems.length} producto(s).`)
            router.push("/requerimientos")
        } catch (error: any) {
            console.error("Error saving requerimiento:", error)
            toast.error(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    const selectedPlantilla = plantillas.find((p: any) => p.id === selectedPlantillaId)

    // Aplica la plantilla seleccionada
    const applyTemplate = (mode: "replace" | "merge") => {
        if (!selectedPlantilla) return

        const templateItems = selectedPlantilla.items
            .filter((item: any) => !item.product?.deletedAt)
            .sort((a: any, b: any) => a.orden - b.orden)

        const matched: RequerimientoDraftItem[] = []
        const notFound: string[] = []

        templateItems.forEach((item: any) => {
            const prod = groupedProducts.find(p => p.id === item.productId)
            if (prod) {
                matched.push({
                    productId: prod.id,
                    productoNombre: prod.nombre,
                    codigoBarras: prod.codigoBarras,
                    cantidadSolicitada: 0,
                    tipoUnidad: "unidad",
                    stockTotalDisponible: prod.stockTotal,
                    unidadBase: prod.unidadBase,
                })
            } else {
                notFound.push(item.product?.nombre || item.productId)
            }
        })

        if (notFound.length > 0) {
            toast.warning(
                `${notFound.length} producto(s) no encontrado(s) en el inventario activo y fueron omitidos:\n• ${notFound.slice(0, 5).join("\n• ")}${notFound.length > 5 ? `\n...y ${notFound.length - 5} más` : ""}`,
                { duration: 6000 }
            )
        }

        if (mode === "replace") {
            setItems(matched)
        } else {
            setItems(prev => {
                const existingIds = new Set(prev.map(i => i.productId))
                const newItems = matched.filter(m => !existingIds.has(m.productId))
                return [...prev, ...newItems]
            })
        }

        toast.success(`Plantilla "${selectedPlantilla.nombre}" cargada (${matched.length} productos).`)
        setTemplateModalOpen(false)
        setSelectedPlantillaId("")
        setMergeMode(null)
    }

    const handleApplyTemplate = () => {
        if (!selectedPlantilla) return
        if (items.length > 0) {
            setMergeMode("ask" as any)
        } else {
            applyTemplate("replace")
        }
    }

    // Filtrar ítems de la tabla en tiempo real por búsqueda
    const filteredDraftItems = useMemo(() => {
        if (!tableSearch.trim()) return items
        const searchStr = tableSearch.toLowerCase().trim()
        return items.filter(
            item =>
                item.productoNombre.toLowerCase().includes(searchStr) ||
                item.codigoBarras?.toLowerCase().includes(searchStr)
        )
    }, [items, tableSearch])

    const zeroItemsCount = useMemo(() => {
        return items.filter(i => i.cantidadSolicitada <= 0).length
    }, [items])

    // División en 2 columnas paralelas para encajar 38 ítems sin scroll
    const splitColumns = useMemo(() => {
        if (!isTwoColumns || filteredDraftItems.length <= 6) {
            return { isSplit: false, left: filteredDraftItems, right: [] }
        }
        const half = Math.ceil(filteredDraftItems.length / 2)
        return {
            isSplit: true,
            left: filteredDraftItems.slice(0, half),
            right: filteredDraftItems.slice(half),
            halfOffset: half,
        }
    }, [filteredDraftItems, isTwoColumns])

    if (!mounted) {
        return null
    }

    // Componente interno para renderizar una sub-tabla con navegación por teclado
    const RenderSubTable = ({
        list,
        offset,
        colIndex,
    }: {
        list: RequerimientoDraftItem[]
        offset: number
        colIndex: number
    }) => (
        <div className="rounded-md border overflow-x-auto bg-card">
            <Table className="w-full text-sm">
                <TableHeader className="bg-muted/60">
                    <TableRow className="h-9">
                        <TableHead className="w-[36px] text-center font-bold text-xs py-1 px-1.5 text-foreground">#</TableHead>
                        <TableHead className="py-1 px-2.5 text-xs font-bold text-foreground uppercase tracking-wider">Medicamento / Insumo</TableHead>
                        <TableHead className="w-[95px] text-center text-xs font-bold py-1 px-1 text-foreground uppercase tracking-wider">Stock</TableHead>
                        <TableHead className="w-[140px] text-center font-bold text-xs py-1 px-1 text-foreground uppercase tracking-wider">Cant. Solicitada</TableHead>
                        <TableHead className="w-[34px] text-right pr-2 py-1 px-0.5"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {list.map((item, idx) => {
                        const actualIndex = offset + idx
                        const isZero = item.cantidadSolicitada <= 0

                        return (
                            <TableRow
                                key={item.productId}
                                className={cn(
                                    "h-9 border-b transition-colors",
                                    isZero && "bg-amber-50/50 hover:bg-amber-50/80"
                                )}
                            >
                                <TableCell className="text-center font-mono text-xs text-muted-foreground px-1.5 py-1">
                                    {actualIndex + 1}
                                </TableCell>
                                <TableCell className="py-1 px-2.5 font-medium">
                                    <div className="flex flex-col leading-tight min-w-0">
                                        <span className="text-xs sm:text-sm font-semibold truncate text-foreground" title={item.productoNombre}>
                                            {item.productoNombre}
                                        </span>
                                        {item.codigoBarras && (
                                            <span className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                                                {item.codigoBarras}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center px-1.5 py-1">
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap inline-block",
                                        item.stockTotalDisponible > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    )}>
                                        {formatQuantity(item.stockTotalDisponible)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center px-1.5 py-1">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Input
                                            type="number"
                                            min="0"
                                            data-col={colIndex}
                                            data-row={idx}
                                            className={cn(
                                                "w-16 text-center font-bold text-sm h-7 px-1 transition-all",
                                                isZero ? "border-amber-400 bg-amber-50/90 text-amber-950 font-extrabold" : "border-input focus:border-primary"
                                            )}
                                            value={item.cantidadSolicitada === 0 ? "" : item.cantidadSolicitada}
                                            placeholder="0"
                                            onKeyDown={(e) => handleTableKeyDown(e, colIndex, idx)}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const val = Number(e.target.value)
                                                handleQuantityChange(item.productId, val < 0 ? 0 : val)
                                            }}
                                        />
                                        <span className="text-xs font-medium text-foreground/80 shrink-0 w-10 text-left truncate" title={item.unidadBase}>
                                            {item.unidadBase}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right pr-2.5 py-1 px-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveItem(item.productId)}
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        title="Quitar"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )

    return (
        <div className="flex flex-col space-y-4 pb-8">
            {/* HEADER CON TÍTULO PRINCIPAL Y BOTONES */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Crear Solicitud de Requerimiento</h1>
                </div>

                <div className="flex items-center gap-2.5">
                    {plantillas.length > 0 && (
                        <Button
                            onClick={() => { setSelectedPlantillaId(""); setMergeMode(null); setTemplateModalOpen(true) }}
                            variant="outline"
                            size="sm"
                            className="gap-2 text-sm font-semibold border-primary/30 text-primary hover:bg-primary/5 h-9 px-4"
                        >
                            <LayoutTemplate className="h-4 w-4" />
                            Cargar Plantilla
                        </Button>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={items.length === 0 || loading || !solicitante || !departamento}
                        size="sm"
                        className="gap-2 font-bold text-sm bg-primary hover:bg-primary/90 h-9 px-5 shadow-sm"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Enviar Solicitud ({items.filter(i => i.cantidadSolicitada > 0).length})
                    </Button>
                </div>
            </div>

            {/* STRIP DE CABECERA HORIZONTAL CON LAYOUT EXPANDIDO PARA EL SELECTOR DE PRODUCTOS */}
            <div className="bg-card px-4 py-3 rounded-lg border shadow-sm text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-center">
                    {/* 1. Área Solicitante (col-span-2) */}
                    <div className="space-y-1 lg:col-span-2">
                        <Label htmlFor="area-select" className="text-xs font-bold text-foreground/80">
                            Área Solicitante *
                        </Label>
                        <Select value={departamento} onValueChange={setDepartamento}>
                            <SelectTrigger id="area-select" className="h-9 text-xs sm:text-sm bg-background font-medium">
                                <SelectValue placeholder="Seleccionar área" />
                            </SelectTrigger>
                            <SelectContent>
                                {areas.map((area: any) => (
                                    <SelectItem key={area.id} value={area.nombre}>
                                        {area.nombre}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 2. Nombre Solicitante (col-span-3) */}
                    <div className="space-y-1 lg:col-span-3">
                        <Label htmlFor="solicitante-input" className="text-xs font-bold text-foreground/80">
                            Nombre Solicitante *
                        </Label>
                        <Input
                            id="solicitante-input"
                            value={solicitante}
                            onChange={(e) => setSolicitante(e.target.value)}
                            placeholder="Ingrese el nombre del solicitante"
                            className="h-9 text-xs sm:text-sm bg-background font-medium"
                        />
                    </div>

                    {/* 3. Observaciones (col-span-3) */}
                    <div className="space-y-1 lg:col-span-3">
                        <Label htmlFor="obs-input" className="text-xs font-bold text-foreground/80">
                            Observaciones (Opcional)
                        </Label>
                        <Input
                            id="obs-input"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Notas o justificación..."
                            className="h-9 text-xs sm:text-sm bg-background"
                        />
                    </div>

                    {/* 4. Selector de Producto Individual (col-span-4) — MÁS ANCHO */}
                    <div className="space-y-1 lg:col-span-4">
                        <Label className="text-xs font-bold text-foreground/80">
                            + Agregar Producto Individual
                        </Label>
                        <Popover open={openProductSelect} onOpenChange={setOpenProductSelect}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full h-9 justify-between font-normal text-xs sm:text-sm bg-background">
                                    <span className="truncate">
                                        {selectedProduct ? selectedProduct.nombre : "Buscar producto..."}
                                    </span>
                                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
                                </Button>
                            </PopoverTrigger>
                            {/* Dropdown del mismo ancho extendido (min-w-[460px]) para ver el nombre completo sin cortes */}
                            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[460px] max-w-[95vw]" align="end">
                                <Command
                                    filter={(value, search) => {
                                        const product = groupedProducts.find(p => p.id === value || p.nombre === value)
                                        if (!product) return 0
                                        const searchStr = search.toLowerCase()
                                        return product.nombre.toLowerCase().includes(searchStr) || product.codigoBarras?.toLowerCase().includes(searchStr) ? 1 : 0
                                    }}
                                >
                                    <CommandInput placeholder="Buscar medicamento o insumo por nombre..." className="h-9 text-xs sm:text-sm" />
                                    <CommandList className="max-h-60">
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {groupedProducts.map((product) => (
                                                <CommandItem
                                                    key={product.id}
                                                    value={product.nombre}
                                                    onSelect={() => handleAddSpecificProduct(product)}
                                                    className="text-xs sm:text-sm py-2"
                                                >
                                                    <div className="flex justify-between items-center w-full gap-3">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-xs sm:text-sm text-foreground whitespace-normal leading-tight">
                                                                {product.nombre}
                                                            </span>
                                                            {product.codigoBarras && (
                                                                <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                                                    GTIN: {product.codigoBarras}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={cn("text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0", product.stockTotal > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                                            Stock: {formatQuantity(product.stockTotal)} {product.unidadBase}
                                                        </span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* SECCIÓN PRINCIPAL: TABLA DE MEDICAMENTOS */}
            <Card className="shadow-md border-muted">
                <div className="p-3 border-b flex flex-wrap items-center justify-between gap-2.5 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-foreground">Lista de Medicamentos</span>
                        <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">
                            {items.length} productos
                        </Badge>
                        {zeroItemsCount > 0 && (
                            <Badge variant="outline" className="text-xs font-semibold bg-amber-50 text-amber-800 border-amber-300 gap-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                {zeroItemsCount} en 0
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Buscador interno dentro de la lista de ítems */}
                        {items.length > 3 && (
                            <div className="relative w-44 sm:w-60">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Filtrar en la lista..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="pl-8 h-8 text-xs sm:text-sm bg-background"
                                />
                                {tableSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setTableSearch("")}
                                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Toggle de vista 1 o 2 columnas */}
                        {items.length > 6 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsTwoColumns(!isTwoColumns)}
                                className={cn("h-8 text-xs sm:text-sm gap-1.5 font-medium", isTwoColumns && "bg-primary/10 text-primary border-primary/30 font-bold")}
                                title="Alternar entre vista de 2 columnas o 1 columna"
                            >
                                <Columns className="h-3.5 w-3.5" />
                                {isTwoColumns ? "2 Col" : "1 Col"}
                            </Button>
                        )}

                        {zeroItemsCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearZeroItems}
                                className="h-8 text-xs sm:text-sm font-semibold text-amber-800 border-amber-300 hover:bg-amber-50 gap-1.5"
                                title="Descartar automáticamente productos con cantidad 0"
                            >
                                <Eraser className="h-3.5 w-3.5" />
                                Limpiar en 0 ({zeroItemsCount})
                            </Button>
                        )}

                        {items.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setItems([])}
                                className="h-8 text-xs sm:text-sm font-medium text-destructive hover:bg-destructive/10"
                            >
                                Vaciar
                            </Button>
                        )}
                    </div>
                </div>

                <div className="p-3">
                    {filteredDraftItems.length === 0 ? (
                        <div className="text-center py-14 text-muted-foreground">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2.5">
                                    <ClipboardList className="h-9 w-9 text-muted-foreground/40" />
                                    <p className="font-semibold text-base text-foreground">Lista de requerimiento vacía</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
                                        Haz clic en <strong>"Cargar Plantilla"</strong> para pre-cargar la lista de medicamentos o agrega uno individualmente.
                                    </p>
                                    {plantillas.length > 0 && (
                                        <Button
                                            onClick={() => { setSelectedPlantillaId(""); setMergeMode(null); setTemplateModalOpen(true) }}
                                            size="sm"
                                            className="gap-2 mt-1 text-xs sm:text-sm font-semibold"
                                        >
                                            <LayoutTemplate className="h-4 w-4" />
                                            Cargar Plantilla
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm">No se encontraron productos que coincidan con "{tableSearch}".</p>
                            )}
                        </div>
                    ) : splitColumns.isSplit ? (
                        /* VISTA EN 2 COLUMNAS PARALELAS SIDE-BY-SIDE (1..19 y 20..38) */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                            <RenderSubTable list={splitColumns.left} offset={0} colIndex={0} />
                            <RenderSubTable list={splitColumns.right} offset={splitColumns.halfOffset!} colIndex={1} />
                        </div>
                    ) : (
                        /* VISTA EN 1 COLUMNA */
                        <RenderSubTable list={filteredDraftItems} offset={0} colIndex={0} />
                    )}
                </div>

                {/* FOOTER AL PIE DE LA TABLA */}
                {items.length > 0 && (
                    <div className="p-3 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm">
                        <div className="text-muted-foreground font-medium">
                            {items.filter(i => i.cantidadSolicitada > 0).length} de {items.length} productos con cantidad asignada.
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={items.length === 0 || loading || !solicitante || !departamento}
                            size="sm"
                            className="gap-2 font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 h-9 px-6 shadow-sm"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Enviar Solicitud ({items.filter(i => i.cantidadSolicitada > 0).length} productos)
                        </Button>
                    </div>
                )}
            </Card>

            {/* Modal de selección de plantilla */}
            <Dialog open={templateModalOpen} onOpenChange={(open) => { if (!open) { setTemplateModalOpen(false); setSelectedPlantillaId(""); setMergeMode(null) } }}>
                <DialogContent className="sm:max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <LayoutTemplate className="h-5 w-5 text-primary" />
                            Cargar Plantilla de Requerimientos
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                            Selecciona una plantilla para pre-cargar la lista de medicamentos en la tabla.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Paso 1: Seleccionar plantilla */}
                    {mergeMode !== "ask" && (
                        <div className="space-y-3 py-2">
                            {plantillas.map((plantilla: any) => {
                                const activeItems = plantilla.items.filter((i: any) => !i.product?.deletedAt)
                                const isSelected = selectedPlantillaId === plantilla.id
                                return (
                                    <button
                                        key={plantilla.id}
                                        type="button"
                                        onClick={() => setSelectedPlantillaId(plantilla.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-lg border-2 transition-all",
                                            isSelected
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border hover:border-primary/40 hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate text-foreground">{plantilla.nombre}</p>
                                                {plantilla.descripcion && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plantilla.descripcion}</p>
                                                )}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0 text-xs font-semibold">
                                                {activeItems.length} productos
                                            </Badge>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Paso 2: Confirmar merge/replace si ya hay ítems */}
                    {mergeMode === "ask" && selectedPlantilla && (
                        <div className="space-y-4 py-2">
                            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                                <p className="font-bold">Ya tienes {items.length} producto(s) en tu lista.</p>
                                <p className="mt-1">¿Qué deseas hacer con la plantilla <strong>"{selectedPlantilla.nombre}"</strong>?</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => applyTemplate("replace")}
                                    className="p-4 rounded-lg border-2 border-destructive/30 bg-red-50 hover:bg-red-100 text-left transition-all"
                                >
                                    <p className="font-bold text-sm text-destructive">Reemplazar</p>
                                    <p className="text-xs text-muted-foreground mt-1">Elimina la lista actual y carga la plantilla</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTemplate("merge")}
                                    className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-left transition-all"
                                >
                                    <p className="font-bold text-sm text-primary">Combinar</p>
                                    <p className="text-xs text-muted-foreground mt-1">Agrega los productos nuevos de la plantilla</p>
                                </button>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button variant="outline" onClick={() => { setTemplateModalOpen(false); setSelectedPlantillaId(""); setMergeMode(null) }}>
                            Cancelar
                        </Button>
                        {mergeMode !== "ask" && (
                            <Button
                                onClick={handleApplyTemplate}
                                disabled={!selectedPlantillaId}
                                className="font-bold"
                            >
                                <LayoutTemplate className="mr-2 h-4 w-4" />
                                Cargar Plantilla
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
