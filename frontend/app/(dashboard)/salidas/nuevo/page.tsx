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
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash as Trash2, ArrowLeft, FloppyDisk as Save, CircleNotch as Loader2, Warning as AlertTriangle, Check, CaretUpDown as ChevronsUpDown, Barcode, X, CalendarBlank as CalendarIcon, SquaresFour as LayoutTemplate, Eraser, ClipboardText as ClipboardList, ArrowsClockwise as RefreshCw, Buildings as Building2 } from "@phosphor-icons/react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import type { Product, InventoryMovement, TipoUnidad } from "@/lib/types"
import { cn } from "@/lib/utils"
import { obtenerStockDesglosado, calcularUnidadesDesdePresentacion, puedeVender } from "@/lib/inventory"
import { api } from "@/lib/api"
import { useUserRole } from "@/hooks/use-user-role"
import { combineDateWithCurrentTime, isDateWithinFutureLimit, formatLocalDate } from "@/lib/date-utils"
import { formatQuantity } from "@/lib/number-utils"
import { CargarPlantillaSalidaModal, type PlantillaOption, type PlantillaApplyConfig } from "@/components/movements/cargar-plantilla-salida-modal"
import { CrearAreaDialog } from "@/components/areas/crear-area-dialog"

export default function NuevoSalidaPage() {
    const { user } = useUserRole()
    const router = useRouter()
    const currentUserName = user?.user_metadata?.full_name || 'Usuario'
    const [products, setProducts] = useState<Product[]>([])
    const [areas, setAreas] = useState<any[]>([])
    const [plantillas, setPlantillas] = useState<PlantillaOption[]>([])
    const [openPlantillaModal, setOpenPlantillaModal] = useState(false)
    const [openCrearAreaModal, setOpenCrearAreaModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // List of added items
    const [items, setItems] = useState<Partial<InventoryMovement>[]>([])

    // Form states
    const [selectedProductName, setSelectedProductName] = useState<string>("")
    const [productoId, setProductoId] = useState<string>("")
    const [openProductSelect, setOpenProductSelect] = useState(false)
    const [showGtinSearch, setShowGtinSearch] = useState(false)
    const [gtin, setGtin] = useState("")
    const lastSearchedGtin = useRef("")

    const executeSearch = (searchValue: string) => {
        if (!searchValue || lastSearchedGtin.current === searchValue) return
        lastSearchedGtin.current = searchValue
        const found = products.find(p => p.codigoBarras === searchValue)
        if (found) {
            setSelectedProductName(found.nombre)
            setShowGtinSearch(false)
            setGtin("")
            lastSearchedGtin.current = ""
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

    // Derived state: Get all lots (product entries) available for the selected name
    const availableLots = useMemo(() => {
        if (!selectedProductName) return []
        // Return sorted by expiration date (nearest first)
        return products
            .filter(p => p.nombre === selectedProductName)
            .sort((a, b) => new Date(a.fechaExpiracion || 0).getTime() - new Date(b.fechaExpiracion || 0).getTime())
    }, [selectedProductName, products])

    const [cantidadPresentacion, setCantidadPresentacion] = useState<number>(0)
    const [cantidadUnidad, setCantidadUnidad] = useState<number>(0)
    const [tipoUnidad, setTipoUnidad] = useState<TipoUnidad>("presentacion")
    const [motivo, setMotivo] = useState<string>("Uso interno")
    const [observaciones, setObservaciones] = useState<string>("")
    const [fechaMovimiento, setFechaMovimiento] = useState<Date | undefined>(undefined)
    const [departamento, setDepartamento] = useState<string>("")
    const [solicitante, setSolicitante] = useState<string>("")

    // Lista dinámica de solicitantes sugeridos (Opción C)
    const solicitantesSugeridos = useMemo(() => {
        const set = new Set<string>()
        if (solicitante.trim()) set.add(solicitante.trim())
        items.forEach(i => {
            if (i.solicitante?.trim()) set.add(i.solicitante.trim())
        })
        return Array.from(set)
    }, [items, solicitante])

    // Fetch products from API
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.get('/products')
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
        const fetchAreas = async () => {
            try {
                const data = await api.get('/areas')
                setAreas(data || [])
            } catch (error) {
                console.error("Failed to fetch areas", error)
            }
        }
        const fetchPlantillas = async () => {
            try {
                const data = await api.get('/plantillas')
                setPlantillas(data || [])
            } catch (error) {
                console.error("Failed to fetch plantillas", error)
            }
        }
        fetchProducts()
        fetchAreas()
        fetchPlantillas()
    }, [])

    const selectedProduct = productoId === "AUTO_FEFO"
        ? availableLots[0]
        : products.find(p => p.id === productoId)

    const totalStockDisponible = useMemo(() => {
        if (!selectedProductName) return 0
        if (productoId === "AUTO_FEFO") {
            return availableLots.reduce((sum, l) => sum + (l.stockUnidad || 0), 0)
        }
        return selectedProduct?.stockUnidad || 0
    }, [productoId, selectedProductName, availableLots, selectedProduct])

    // Auto-select AUTO_FEFO as default when product changes
    useEffect(() => {
        if (availableLots.length > 0) {
            const currentLotIsValid = productoId === "AUTO_FEFO" || availableLots.some(l => l.id === productoId)
            if (!productoId || !currentLotIsValid) {
                setProductoId("AUTO_FEFO")
            }
        } else {
            setProductoId("")
        }
    }, [availableLots, productoId])

    const stockDesglosado = selectedProduct
        ? obtenerStockDesglosado(totalStockDisponible, selectedProduct.cantidadPorPresentacion)
        : null

    // Calculate units when quantity changes
    useEffect(() => {
        if (selectedProduct) {
            if (tipoUnidad === "presentacion") {
                const unidades = calcularUnidadesDesdePresentacion(
                    cantidadPresentacion,
                    selectedProduct.cantidadPorPresentacion
                )
                setCantidadUnidad(unidades)
            }
        }
    }, [cantidadPresentacion, tipoUnidad, selectedProduct])

    // Validation logic for stock
    const validacionStock = selectedProduct && tipoUnidad && cantidadUnidad
        ? puedeVender(
            totalStockDisponible,
            tipoUnidad === "presentacion" ? cantidadPresentacion : cantidadUnidad,
            tipoUnidad,
            selectedProduct.cantidadPorPresentacion
        )
        : { puede: true }

    const handleAddItem = () => {
        if (!selectedProductName || cantidadUnidad <= 0 || !motivo || !selectedProduct) return
        if (availableLots.length === 0 || totalStockDisponible <= 0) {
            toast.warning("El producto seleccionado no tiene lotes con stock disponible para salida")
            return
        }
        if (!validacionStock.puede) return

        const fechaFinal = fechaMovimiento ? combineDateWithCurrentTime(fechaMovimiento) : new Date()

        if (productoId === "AUTO_FEFO") {
            // Asignación FEFO Automática Multilote
            const currentInList = items.filter(i => availableLots.some(l => l.id === i.batchId))
            const currentTotalQtyInList = currentInList.reduce((sum, i) => sum + (i.cantidadUnidad || 0), 0)

            if (currentTotalQtyInList + cantidadUnidad > totalStockDisponible) {
                toast.warning(`Stock total insuficiente para '${selectedProductName}'. Disponible total: ${formatQuantity(totalStockDisponible)}, Ya en lista: ${formatQuantity(currentTotalQtyInList)}, Intentando agregar: ${formatQuantity(cantidadUnidad)}.`)
                return
            }

            let remainingToAllocate = cantidadUnidad
            const newItemsList = [...items]

            for (const lot of availableLots) {
                if (remainingToAllocate <= 0) break

                const existingIndex = newItemsList.findIndex(i => i.batchId === lot.id)
                const existingQty = existingIndex >= 0 ? (newItemsList[existingIndex].cantidadUnidad || 0) : 0
                const lotAvailable = lot.stockUnidad - existingQty

                if (lotAvailable <= 0) continue

                const amountFromThisLot = Math.min(remainingToAllocate, lotAvailable)

                if (existingIndex >= 0) {
                    newItemsList[existingIndex] = {
                        ...newItemsList[existingIndex],
                        cantidadUnidad: existingQty + amountFromThisLot,
                        cantidadPresentacion: tipoUnidad === "presentacion"
                            ? (newItemsList[existingIndex].cantidadPresentacion || 0) + (amountFromThisLot / (lot.cantidadPorPresentacion || 1))
                            : 0
                    }
                } else {
                    newItemsList.push({
                        productId: lot.productId,
                        batchId: lot.id,
                        productoId: lot.id,
                        productoNombre: lot.nombre,
                        cantidadUnidad: amountFromThisLot,
                        cantidadPresentacion: tipoUnidad === "presentacion" ? (amountFromThisLot / (lot.cantidadPorPresentacion || 1)) : 0,
                        tipoUnidad,
                        lote: lot.lote,
                        fechaExpiracion: lot.fechaExpiracion,
                        motivo,
                        departamento: departamento || "",
                        solicitante: solicitante || "",
                        observaciones,
                        usuario: currentUserName,
                        fecha: fechaFinal.toISOString(),
                        tipo: "Salida"
                    })
                }

                remainingToAllocate -= amountFromThisLot
            }

            setItems(newItemsList)
            toast.success(`Se agregaron ${formatQuantity(cantidadUnidad)} unidades asignadas automáticamente por vencimiento (FEFO).`)
        } else {
            // Lote Específico Seleccionado Manualmente
            const targetLot = products.find(p => p.id === productoId)
            if (!targetLot) return

            if (targetLot.lote === "SIN-LOTE" || targetLot.stockUnidad <= 0) {
                toast.warning("El lote seleccionado no tiene stock disponible para salida")
                return
            }

            const existingIndex = items.findIndex(i => i.batchId === targetLot.id)
            const existingQty = existingIndex >= 0 ? (items[existingIndex].cantidadUnidad || 0) : 0

            if (existingQty + cantidadUnidad > targetLot.stockUnidad) {
                toast.warning(`Stock insuficiente en el lote '${targetLot.lote}'. Disponible: ${targetLot.stockUnidad}, Ya en lista: ${existingQty}, Intentando agregar: ${cantidadUnidad}.`)
                return
            }

            const newItemsList = [...items]
            if (existingIndex >= 0) {
                newItemsList[existingIndex] = {
                    ...newItemsList[existingIndex],
                    cantidadUnidad: existingQty + cantidadUnidad,
                    cantidadPresentacion: tipoUnidad === "presentacion"
                        ? (newItemsList[existingIndex].cantidadPresentacion || 0) + cantidadPresentacion
                        : 0
                }
            } else {
                newItemsList.push({
                    productId: targetLot.productId,
                    batchId: targetLot.id,
                    productoId: targetLot.id,
                    productoNombre: targetLot.nombre,
                    cantidadUnidad,
                    cantidadPresentacion: tipoUnidad === "presentacion" ? cantidadPresentacion : 0,
                    tipoUnidad,
                    lote: targetLot.lote,
                    fechaExpiracion: targetLot.fechaExpiracion,
                    motivo,
                    departamento: departamento || "",
                    solicitante: solicitante || "",
                    observaciones,
                    usuario: currentUserName,
                    fecha: fechaFinal.toISOString(),
                    tipo: "Salida"
                })
            }

            setItems(newItemsList)
            toast.success(`Se agregaron ${formatQuantity(cantidadUnidad)} unidades al lote ${targetLot.lote}.`)
        }

        resetForm()
    }

    const resetForm = () => {
        setSelectedProductName("")
        setProductoId("")
        setCantidadPresentacion(0)
        setCantidadUnidad(0)
        setTipoUnidad("presentacion")
        setMotivo("Uso interno")
        setObservaciones("")
    }

    // Sincronizar departamento, solicitante y fecha del formulario a todos los items de la lista
    const handleSyncFormToAllItems = () => {
        if (items.length === 0) {
            toast.info("No hay productos en la lista para sincronizar.")
            return
        }
        const effectiveFecha = fechaMovimiento ? combineDateWithCurrentTime(fechaMovimiento).toISOString() : undefined

        setItems(prev => prev.map(item => ({
            ...item,
            ...(departamento ? { departamento } : {}),
            ...(solicitante ? { solicitante } : {}),
            ...(effectiveFecha ? { fecha: effectiveFecha } : {})
        })))
        toast.success(`Datos del formulario aplicados a los ${items.length} productos de la lista.`)
    }

    // Aplicar plantilla cargada en 0 con asignación automática de lote FEFO y área
    const handleApplyPlantilla = (
        plantilla: PlantillaOption, 
        mode: "replace" | "merge",
        config?: PlantillaApplyConfig
    ) => {
        // Área vinculada a la plantilla
        const areaNombre = plantilla.area?.nombre || areas.find(a => a.id === plantilla.areaId)?.nombre || ""
        if (areaNombre) {
            setDepartamento(areaNombre)
        }
        if (config?.fecha) {
            setFechaMovimiento(config.fecha)
        }
        if (config?.solicitante) {
            setSolicitante(config.solicitante)
        }

        // Fecha y solicitante iniciales configurados al cargar la plantilla
        const effectiveFecha = config?.fecha ? combineDateWithCurrentTime(config.fecha) : new Date()
        const effectiveSolicitante = config?.solicitante || ""

        const activeItems = (plantilla.items || [])
            .filter(item => !item.product?.deletedAt)
            .sort((a, b) => a.orden - b.orden)

        const newItems: Partial<InventoryMovement>[] = []
        let withoutStockCount = 0

        activeItems.forEach(item => {
            // Buscar todos los lotes de este producto ordenados por FEFO
            const productLots = products
                .filter(p => p.productId === item.productId || p.id === item.productId)
                .sort((a, b) => new Date(a.fechaExpiracion || 0).getTime() - new Date(b.fechaExpiracion || 0).getTime())

            const lotsWithStock = productLots.filter(l => l.stockUnidad > 0)
            const targetLot = lotsWithStock.length > 0 ? lotsWithStock[0] : (productLots[0] || null)

            if (!targetLot) return

            if (lotsWithStock.length === 0) {
                withoutStockCount++
            }

            newItems.push({
                productId: targetLot.productId,
                batchId: targetLot.id,
                productoId: targetLot.id,
                productoNombre: targetLot.nombre,
                cantidadUnidad: 0,
                cantidadPresentacion: 0,
                tipoUnidad: "unidad",
                lote: targetLot.lote,
                fechaExpiracion: targetLot.fechaExpiracion,
                motivo: motivo || "Uso interno",
                departamento: areaNombre,
                solicitante: effectiveSolicitante,
                observaciones: observaciones || "",
                usuario: currentUserName,
                fecha: effectiveFecha.toISOString(),
                tipo: "Salida",
            })
        })

        if (mode === "replace") {
            setItems(newItems)
        } else {
            setItems(prev => {
                const existingProductIds = new Set(prev.map(i => i.productId))
                const uniqueNewItems = newItems.filter(i => !existingProductIds.has(i.productId))
                return [...prev, ...uniqueNewItems]
            })
        }

        if (withoutStockCount > 0) {
            toast.warning(`Plantilla cargada. ${withoutStockCount} producto(s) no tienen stock en farmacia actualmente.`)
        } else {
            toast.success(`Plantilla "${plantilla.nombre}" cargada (${newItems.length} productos con cantidad en 0).${areaNombre ? ` Área asignada: ${areaNombre}` : ''}`)
        }
    }

    // Actualizar fecha por ítem individual en la tabla
    const handleUpdateFechaInList = (index: number, newDate: Date | undefined) => {
        const finalDate = combineDateWithCurrentTime(newDate)
        setItems(prev => {
            const next = [...prev]
            if (next[index]) {
                next[index] = { ...next[index], fecha: finalDate.toISOString() }
            }
            return next
        })
    }

    // Actualizar solicitante por ítem individual en la tabla
    const handleUpdateSolicitanteInList = (index: number, newSolicitante: string) => {
        setItems(prev => {
            const next = [...prev]
            if (next[index]) {
                next[index] = { ...next[index], solicitante: newSolicitante }
            }
            return next
        })
    }

    // Actualizar departamento por ítem individual en la tabla
    const handleUpdateDepartamentoInList = (index: number, newDept: string) => {
        setItems(prev => {
            const next = [...prev]
            if (next[index]) {
                next[index] = { ...next[index], departamento: newDept }
            }
            return next
        })
    }

    // Actualizar cantidad directamente en la tabla de Productos a Salir
    const handleUpdateQuantityInList = (index: number, rawValue: number) => {
        const val = Math.max(0, isNaN(rawValue) ? 0 : rawValue)
        setItems(prevItems => {
            const nextItems = [...prevItems]
            const targetItem = nextItems[index]
            if (!targetItem) return prevItems

            const currentBatch = products.find(p => p.id === targetItem.batchId)
            const cantPorPres = currentBatch?.cantidadPorPresentacion || 1
            const maxLotStock = currentBatch?.stockUnidad || 0

            if (targetItem.tipoUnidad === "presentacion") {
                const unidadesEquivalentes = val * cantPorPres
                if (unidadesEquivalentes > maxLotStock) {
                    const maxCajas = Math.floor(maxLotStock / cantPorPres)
                    toast.warning(`Stock insuficiente en el lote '${targetItem.lote}'. Máximo disponible: ${maxCajas} caja(s) (${maxLotStock} unid.)`)
                    nextItems[index] = {
                        ...targetItem,
                        cantidadPresentacion: maxCajas,
                        cantidadUnidad: maxCajas * cantPorPres,
                    }
                } else {
                    nextItems[index] = {
                        ...targetItem,
                        cantidadPresentacion: val,
                        cantidadUnidad: unidadesEquivalentes,
                    }
                }
            } else {
                if (val > maxLotStock) {
                    toast.warning(`Stock insuficiente en el lote '${targetItem.lote}'. Máximo disponible: ${formatQuantity(maxLotStock)} unidades.`)
                    nextItems[index] = {
                        ...targetItem,
                        cantidadUnidad: maxLotStock,
                        cantidadPresentacion: Math.floor(maxLotStock / cantPorPres),
                    }
                } else {
                    nextItems[index] = {
                        ...targetItem,
                        cantidadUnidad: val,
                        cantidadPresentacion: Math.floor(val / cantPorPres),
                    }
                }
            }

            return nextItems
        })
    }

    // Cambiar tipo de unidad (caja vs unidad) en la fila de la tabla
    const handleToggleUnitTypeInList = (index: number, newType: TipoUnidad) => {
        setItems(prevItems => {
            const nextItems = [...prevItems]
            const targetItem = nextItems[index]
            if (!targetItem) return prevItems

            const currentBatch = products.find(p => p.id === targetItem.batchId)
            const cantPorPres = currentBatch?.cantidadPorPresentacion || 1

            if (newType === "presentacion") {
                const cajas = Math.floor((targetItem.cantidadUnidad || 0) / cantPorPres)
                nextItems[index] = {
                    ...targetItem,
                    tipoUnidad: "presentacion",
                    cantidadPresentacion: cajas,
                    cantidadUnidad: cajas * cantPorPres,
                }
            } else {
                nextItems[index] = {
                    ...targetItem,
                    tipoUnidad: "unidad",
                    cantidadUnidad: targetItem.cantidadUnidad || 0,
                }
            }

            return nextItems
        })
    }

    // Descartar todos los productos que tengan cantidad 0 en la lista
    const handleClearZeroItems = () => {
        const zeroItems = items.filter(i => (i.cantidadUnidad || 0) <= 0)
        if (zeroItems.length === 0) {
            toast.info("No hay productos con cantidad 0 en la lista.")
            return
        }
        setItems(prevItems => prevItems.filter(i => (i.cantidadUnidad || 0) > 0))
        toast.success(`Se descartaron ${zeroItems.length} producto(s) con cantidad 0.`)
    }

    // Navegación rápida por teclado entre inputs de cantidad (Enter o flechas)
    const handleListKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault()
            const nextInput = document.querySelector<HTMLInputElement>(`input[data-salida-row="${rowIndex + 1}"]`)
            if (nextInput) {
                nextInput.focus()
                nextInput.select()
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prevInput = document.querySelector<HTMLInputElement>(`input[data-salida-row="${rowIndex - 1}"]`)
            if (prevInput) {
                prevInput.focus()
                prevInput.select()
            }
        }
    }

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        const validItems = items.filter(item => (item.cantidadUnidad || 0) > 0)

        if (validItems.length === 0) {
            toast.warning("No hay productos con cantidad mayor a 0 para procesar.")
            return
        }

        const zeroCount = items.length - validItems.length
        if (zeroCount > 0) {
            toast.info(`Se enviaron ${validItems.length} ítem(s) válidos. Se omitieron ${zeroCount} ítem(s) con cantidad 0.`)
        }

        setLoading(true)

        try {
            const payloadItems = validItems.map(item => ({
                productId: item.productId,
                batchId: item.batchId,
                productoNombre: item.productoNombre,
                cantidad: item.cantidadUnidad,
                lote: item.lote || "SIN-LOTE",
                fechaExpiracion: item.fechaExpiracion || new Date().toISOString(),
                motivo: item.motivo || "Salida",
                usuario: item.usuario || "Admin",
                departamento: item.departamento || "",
                solicitante: item.solicitante || "",
                observaciones: item.observaciones || "",
                fecha: item.fecha,
            }))

            const response = await api.post('/inventory/salidas-bulk', { items: payloadItems })

            toast.success(response.message || `${validItems.length} movimiento(s) registrado(s) exitosamente`)
            router.push("/salidas")
        } catch (error: any) {
            console.error("Error saving movements:", error)
            toast.error(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setLoading(false)
        }
    }

    const isAddDisabled = !productoId || cantidadUnidad <= 0 || !motivo || !validacionStock.puede

    if (!mounted) {
        return null
    }

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Registrar Nueva Salida</h1>
                    <p className="text-muted-foreground mt-1">Completa el formulario para registrar el movimiento</p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-primary/40 hover:bg-primary/5 text-primary shrink-0 self-start sm:self-auto font-medium"
                    onClick={() => setOpenPlantillaModal(true)}
                >
                    <LayoutTemplate className="h-4 w-4" />
                    Cargar Plantilla
                </Button>
            </div>

            <div className="grid lg:grid-cols-12 gap-6 items-start">
                <Card className="w-full lg:w-[calc(100%+2px)] lg:col-span-4 shadow-md border-muted">
                    <CardHeader>
                        <CardTitle>Detalles de la Salida</CardTitle>
                        <CardDescription>Selecciona el producto y el lote específico</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                        {/* 1. Select Generic Product Name */}
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
                                    <Button type="button" variant="outline" size="icon" onClick={() => setShowGtinSearch(true)} title="Escanear código de barras">
                                        <Barcode className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* 2. Select Specific Lot (Batch) */}
                        {selectedProductName && (
                            <div className="space-y-2">
                                <Label>Seleccionar Lote *</Label>
                                <Select value={productoId} onValueChange={setProductoId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar lote específico" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AUTO_FEFO">
                                            Asignación Automática FEFO
                                        </SelectItem>
                                        {availableLots.map((lot) => (
                                            <SelectItem key={lot.id} value={lot.id}>
                                                <span className="font-medium">{lot.lote}</span>
                                                <span className="text-muted-foreground mx-2">|</span>
                                                <span>Vence: {lot.fechaExpiracion ? formatLocalDate(lot.fechaExpiracion) : 'N/A'}</span>
                                                <span className="text-muted-foreground mx-2">|</span>
                                                <span>Lab: {lot.laboratorio || "N/A"}</span>
                                                <span className="text-muted-foreground mx-2">|</span>
                                                <span>Stock: {formatQuantity(lot.stockUnidad)} {lot.unidadBase}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {availableLots.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {productoId === "AUTO_FEFO"
                                            ? `* Se asignarán automáticamente los lotes empezando por el más próximo a vencer (${availableLots[0].fechaExpiracion ? formatLocalDate(availableLots[0].fechaExpiracion) : 'N/A'})`
                                            : `* Lote seleccionado manualmente. Lote más próximo a vencer: (${availableLots[0].fechaExpiracion ? formatLocalDate(availableLots[0].fechaExpiracion) : 'N/A'})`
                                        }
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Product/Stock Info Alert */}
                        {selectedProduct && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-sm">
                                    <div className="space-y-1">
                                        <p>
                                            <strong>Lote Seleccionado:</strong> {productoId === "AUTO_FEFO" ? "Asignación Automática FEFO" : selectedProduct.lote}
                                        </p>
                                        <p>
                                            <strong>Laboratorio:</strong> {selectedProduct.laboratorio || "N/A"}
                                        </p>
                                        {productoId !== "AUTO_FEFO" && (
                                            <p>
                                                <strong>Vencimiento:</strong> {selectedProduct.fechaExpiracion ? formatLocalDate(selectedProduct.fechaExpiracion) : 'N/A'}
                                            </p>
                                        )}
                                        <p>
                                            <strong>Stock disponible:</strong> {formatQuantity(totalStockDisponible)} {selectedProduct.unidadBase}
                                            {stockDesglosado && stockDesglosado.stockPresentacion > 0 && (
                                                <> ({formatQuantity(stockDesglosado.stockPresentacion)} {selectedProduct.presentacion.toLowerCase()}{stockDesglosado.stockPresentacion !== 1 ? "s" : ""} completas
                                                    {stockDesglosado.unidadesSueltas > 0 && ` + ${formatQuantity(stockDesglosado.unidadesSueltas)} sueltas`})
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Vender por (Tipo Unidad) */}
                        {selectedProduct && (
                            <div className="space-y-2">
                                <Label>Vender por *</Label>
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
                                            Equivale a: {formatQuantity(cantidadUnidad)} {selectedProduct.unidadBase}
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

                        {/* Stock Validation Error */}
                        {!validacionStock.puede && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{validacionStock.mensaje}</AlertDescription>
                            </Alert>
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
                                Si no seleccionas fecha, se usará el momento actual. Máximo 3 días en el futuro.
                            </p>
                        </div>

                        {/* Área / Departamento & Creación Rápida */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Área Solicitante</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-2 gap-1 text-primary hover:text-primary/80"
                                    onClick={() => setOpenCrearAreaModal(true)}
                                    title="Registrar una nueva área"
                                >
                                    <Plus className="h-3 w-3" />
                                    Nueva Área
                                </Button>
                            </div>
                            <Select value={departamento} onValueChange={setDepartamento}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar área (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" className="text-xs text-muted-foreground">
                                        (Sin área asignada)
                                    </SelectItem>
                                    {areas.map((area: any) => (
                                        <SelectItem key={area.id} value={area.nombre}>
                                            {area.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Solicitante */}
                        <div className="space-y-2">
                            <Label>Solicitante</Label>
                            <Input
                                list="solicitantes-sugeridos"
                                value={solicitante}
                                onChange={(e) => setSolicitante(e.target.value)}
                                placeholder="Persona que solicita (opcional)"
                            />
                        </div>

                        {/* Motivo */}
                        <div className="space-y-2">
                            <Label>Motivo *</Label>
                            <Select value={motivo} onValueChange={setMotivo}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Venta">Venta</SelectItem>
                                    <SelectItem value="Uso interno">Uso interno</SelectItem>
                                    <SelectItem value="Devolución a proveedor">Devolución a proveedor</SelectItem>
                                    <SelectItem value="Ajuste de inventario">Ajuste de inventario</SelectItem>
                                    <SelectItem value="Merma o pérdida">Merma o pérdida</SelectItem>
                                    <SelectItem value="Otro">Otro</SelectItem>
                                </SelectContent>
                            </Select>
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
                <div className="space-y-4 lg:col-span-8">
                    <Card className="h-full shadow-md border-muted">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                    <CardTitle>Productos a Salir</CardTitle>
                                    <CardDescription>Revisa la lista antes de guardar</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {items.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                            onClick={handleSyncFormToAllItems}
                                            title="Aplicar Área, Solicitante y Fecha del formulario a todos los productos de la lista"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            <span className="hidden sm:inline">Sincronizar a la Lista</span>
                                        </Button>
                                    )}
                                    {items.some(i => (i.cantidadUnidad || 0) <= 0) && items.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive border-dashed"
                                            onClick={handleClearZeroItems}
                                            title="Descartar productos que tienen cantidad 0"
                                        >
                                            <Eraser className="h-3.5 w-3.5" />
                                            Descartar en 0 ({items.filter(i => (i.cantidadUnidad || 0) <= 0).length})
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs gap-1.5"
                                        onClick={() => setOpenPlantillaModal(true)}
                                    >
                                        <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                                        Plantilla
                                    </Button>
                                </div>
                            </div>
                            {items.length > 0 && (
                                <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                                    <span>
                                        <strong>{items.filter(i => (i.cantidadUnidad || 0) > 0).length}</strong> de {items.length} con cantidad
                                    </span>
                                    <span>•</span>
                                    <span>
                                        Total: <strong>{formatQuantity(items.reduce((s, i) => s + (i.cantidadUnidad || 0), 0))}</strong> unid.
                                    </span>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30px] text-center text-xs">#</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="w-[105px]">Unidad</TableHead>
                                            <TableHead className="w-[85px] text-center">Cant.</TableHead>
                                            <TableHead className="w-[125px]">Fecha</TableHead>
                                            <TableHead className="min-w-[170px]">Destino y Solicitante</TableHead>
                                            <TableHead className="w-[36px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
                                                        <p className="font-medium text-sm">No hay productos en la lista</p>
                                                        <p className="text-xs text-muted-foreground">Agrega productos manualmente desde la izquierda o carga una plantilla</p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-2 gap-1.5 text-xs text-primary"
                                                            onClick={() => setOpenPlantillaModal(true)}
                                                        >
                                                            <LayoutTemplate className="h-3.5 w-3.5" />
                                                            Cargar Plantilla
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, index) => {
                                                const currentBatch = products.find(p => p.id === item.batchId)
                                                const cantPorPres = currentBatch?.cantidadPorPresentacion || 1
                                                const maxLotStock = currentBatch?.stockUnidad || 0
                                                const isZero = (item.cantidadUnidad || 0) <= 0
                                                const isNoStock = maxLotStock <= 0

                                                return (
                                                    <TableRow
                                                        key={index}
                                                        className={cn(
                                                            "transition-colors",
                                                            isZero && "bg-amber-500/5 hover:bg-amber-500/10",
                                                            isNoStock && "opacity-60 bg-muted/30"
                                                        )}
                                                    >
                                                        <TableCell className="text-center font-mono text-xs text-muted-foreground px-2">
                                                            {index + 1}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="text-sm font-semibold truncate max-w-[190px]" title={item.productoNombre}>
                                                                {item.productoNombre}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                                                <span>Lote: {item.lote}</span>
                                                                <span>•</span>
                                                                {isNoStock ? (
                                                                    <Badge variant="destructive" className="text-[10px] py-0 px-1 font-normal">
                                                                        Sin stock
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-[11px] text-emerald-600 font-medium">
                                                                        Disp: {formatQuantity(maxLotStock)} {currentBatch?.unidadBase}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                value={item.tipoUnidad || "unidad"}
                                                                onValueChange={(val) => handleToggleUnitTypeInList(index, val as TipoUnidad)}
                                                                disabled={isNoStock}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="unidad" className="text-xs">
                                                                        {currentBatch?.unidadBase || "Unidad"}
                                                                    </SelectItem>
                                                                    {cantPorPres > 1 && (
                                                                        <SelectItem value="presentacion" className="text-xs">
                                                                            {currentBatch?.presentacion || "Caja"} ({cantPorPres})
                                                                        </SelectItem>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex flex-col items-center">
                                                                <Input
                                                                    data-salida-row={index}
                                                                    type="number"
                                                                    min="0"
                                                                    disabled={isNoStock}
                                                                    className={cn(
                                                                        "h-8 w-20 text-center font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                                                        isZero && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                                                                    )}
                                                                    value={
                                                                        item.tipoUnidad === "presentacion"
                                                                            ? (item.cantidadPresentacion || "")
                                                                            : (item.cantidadUnidad || "")
                                                                    }
                                                                    placeholder="0"
                                                                    onChange={(e) => handleUpdateQuantityInList(index, Number(e.target.value))}
                                                                    onKeyDown={(e) => handleListKeyDown(e, index)}
                                                                />
                                                                {item.tipoUnidad === "presentacion" && (item.cantidadPresentacion || 0) > 0 && (
                                                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                        ={formatQuantity(item.cantidadUnidad)} unid.
                                                                    </span>
                                                                )}
                                                                {isZero && !isNoStock && (
                                                                    <span className="text-[10px] text-amber-600 font-medium mt-0.5">
                                                                        En 0
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 px-2 text-[11px] font-normal w-full justify-start text-left gap-1 truncate"
                                                                        title="Cambiar fecha de salida para este producto"
                                                                    >
                                                                        <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                        <span className="truncate">
                                                                            {item.fecha ? formatLocalDate(item.fecha) : "Hoy"}
                                                                        </span>
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start">
                                                                    <CalendarComponent
                                                                        mode="single"
                                                                        selected={item.fecha ? new Date(item.fecha) : undefined}
                                                                        onSelect={(d) => handleUpdateFechaInList(index, d)}
                                                                        disabled={(date) => !isDateWithinFutureLimit(date, 3)}
                                                                        initialFocus
                                                                    />
                                                                </PopoverContent>
                                                            </Popover>
                                                        </TableCell>
                                                        <TableCell className="space-y-1 py-2">
                                                            <Select
                                                                value={item.departamento || "none"}
                                                                onValueChange={(val) => handleUpdateDepartamentoInList(index, val === "none" ? "" : val)}
                                                            >
                                                                <SelectTrigger className="h-7 text-[11px] py-0">
                                                                    <SelectValue placeholder="Área destino" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none" className="text-xs text-muted-foreground">
                                                                        (Sin área asignada)
                                                                    </SelectItem>
                                                                    {areas.map((area: any) => (
                                                                        <SelectItem key={area.id} value={area.nombre} className="text-xs">
                                                                            {area.nombre}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                list="solicitantes-sugeridos"
                                                                placeholder="Nombre solicitante..."
                                                                value={item.solicitante || ""}
                                                                onChange={(e) => handleUpdateSolicitanteInList(index, e.target.value)}
                                                                className="h-7 text-[11px] px-2"
                                                                title="Escribe o selecciona sugerencia de solicitante"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                onClick={() => handleRemoveItem(index)}
                                                                title="Eliminar producto de la salida"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t p-6">
                            <Button variant="outline" onClick={() => router.back()} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleSave}
                                disabled={items.filter(i => (i.cantidadUnidad || 0) > 0).length === 0 || loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Procesar Salida ({items.filter(i => (i.cantidadUnidad || 0) > 0).length})
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* Sugerencias de solicitantes frecuentes (Opción C) */}
            <datalist id="solicitantes-sugeridos">
                {solicitantesSugeridos.map((s, idx) => (
                    <option key={idx} value={s} />
                ))}
            </datalist>

            <CargarPlantillaSalidaModal
                open={openPlantillaModal}
                onOpenChange={setOpenPlantillaModal}
                plantillas={plantillas}
                currentItemsCount={items.length}
                defaultFecha={fechaMovimiento}
                defaultSolicitante={solicitante}
                onApplyPlantilla={handleApplyPlantilla}
            />

            {/* Modal de Creación Rápida de Área */}
            <CrearAreaDialog
                open={openCrearAreaModal}
                onOpenChange={setOpenCrearAreaModal}
                onSuccess={(newArea) => {
                    setAreas(prev => {
                        const exists = prev.some(a => a.id === newArea.id || a.nombre.toLowerCase() === newArea.nombre.toLowerCase())
                        if (exists) return prev
                        return [...prev, newArea].sort((a, b) => a.nombre.localeCompare(b.nombre))
                    })
                    setDepartamento(newArea.nombre)
                }}
            />
        </div>
    )
}
