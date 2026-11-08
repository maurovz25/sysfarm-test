"use client"

import { useState, useMemo, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { 
    MagnifyingGlass as Search, 
    SquaresFour as LayoutTemplate, 
    ClipboardText as ClipboardList, 
    Warning as AlertTriangle, 
    ArrowRight, 
    CalendarBlank as CalendarIcon, 
    User, 
    Buildings as Building2,
    X
} from "@phosphor-icons/react"
import { formatLocalDate, isDateWithinFutureLimit } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

interface PlantillaProduct {
    id: string
    productId: string
    orden: number
    product: {
        id: string
        nombre: string
        presentacion?: string
        cantidadPorPresentacion?: number
        unidadBase?: string
        deletedAt?: string | null
    }
}

export interface PlantillaOption {
    id: string
    nombre: string
    descripcion?: string | null
    areaId?: string | null
    area?: { id: string; nombre: string } | null
    items: PlantillaProduct[]
}

export interface PlantillaApplyConfig {
    fecha?: Date
    solicitante?: string
}

interface CargarPlantillaSalidaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    plantillas: PlantillaOption[]
    currentItemsCount: number
    defaultFecha?: Date
    defaultSolicitante?: string
    onApplyPlantilla: (
        plantilla: PlantillaOption, 
        mode: "replace" | "merge",
        config?: PlantillaApplyConfig
    ) => void
}

export function CargarPlantillaSalidaModal({
    open,
    onOpenChange,
    plantillas,
    currentItemsCount,
    defaultFecha,
    defaultSolicitante,
    onApplyPlantilla,
}: CargarPlantillaSalidaModalProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedPlantilla, setSelectedPlantilla] = useState<PlantillaOption | null>(null)
    const [showMergePrompt, setShowMergePrompt] = useState(false)
    
    // Valores base configurables para la plantilla
    const [fechaSalida, setFechaSalida] = useState<Date | undefined>(defaultFecha)
    const [solicitante, setSolicitante] = useState<string>(defaultSolicitante || "")

    useEffect(() => {
        if (open) {
            setFechaSalida(defaultFecha)
            setSolicitante(defaultSolicitante || "")
        }
    }, [open, defaultFecha, defaultSolicitante])

    // Filtrar plantillas por nombre, área o descripción
    const filteredPlantillas = useMemo(() => {
        if (!searchTerm.trim()) return plantillas
        const q = searchTerm.toLowerCase().trim()
        return plantillas.filter((p) => {
            const matchName = p.nombre.toLowerCase().includes(q)
            const matchDesc = p.descripcion?.toLowerCase().includes(q)
            const matchArea = p.area?.nombre.toLowerCase().includes(q)
            return matchName || matchDesc || matchArea
        })
    }, [plantillas, searchTerm])

    const handleSelectPlantilla = (plantilla: PlantillaOption) => {
        setSelectedPlantilla(plantilla)
        if (currentItemsCount > 0) {
            setShowMergePrompt(true)
        } else {
            onApplyPlantilla(plantilla, "replace", {
                fecha: fechaSalida,
                solicitante: solicitante.trim(),
            })
            handleClose()
        }
    }

    const handleConfirmMerge = (mode: "replace" | "merge") => {
        if (!selectedPlantilla) return
        onApplyPlantilla(selectedPlantilla, mode, {
            fecha: fechaSalida,
            solicitante: solicitante.trim(),
        })
        handleClose()
    }

    const handleClose = () => {
        setShowMergePrompt(false)
        setSelectedPlantilla(null)
        setSearchTerm("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-6 gap-4">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <LayoutTemplate className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Cargar Plantilla</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Selecciona una plantilla para cargar los medicamentos e insumos a la salida con cantidad en 0.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {showMergePrompt && selectedPlantilla ? (
                    <div className="flex-1 flex flex-col justify-center items-center py-6 px-4 space-y-4 text-center">
                        <div className="p-3 bg-amber-500/10 rounded-full text-amber-600">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div className="space-y-1 max-w-md">
                            <h3 className="font-bold text-base text-foreground">
                                Ya tienes {currentItemsCount} producto(s) en la lista de salida
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                ¿Deseas reemplazar la lista actual con los productos de la plantilla{" "}
                                <span className="font-semibold text-foreground">"{selectedPlantilla.nombre}"</span> o agregarla conservando los productos existentes?
                            </p>
                            {selectedPlantilla.area && (
                                <p className="text-xs text-primary font-medium mt-1">
                                    Área a asignar: {selectedPlantilla.area.nombre}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full max-w-sm">
                            <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => handleConfirmMerge("replace")}
                            >
                                Reemplazar Lista
                            </Button>
                            <Button
                                variant="default"
                                className="flex-1"
                                onClick={() => handleConfirmMerge("merge")}
                            >
                                Agregar a la Lista
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground mt-2"
                            onClick={() => setShowMergePrompt(false)}
                        >
                            Volver a la selección
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Configuración inicial para los medicamentos cargados */}
                        <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <span>Valores iniciales para la plantilla</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    Podrás editarlos luego por producto en la tabla
                                </span>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                                {/* Fecha configurable */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                        <CalendarIcon className="h-3 w-3 text-primary" /> Fecha de salida
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "w-full justify-start text-left text-xs h-8 font-normal",
                                                        !fechaSalida && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                                    {fechaSalida ? formatLocalDate(fechaSalida) : "Hoy (Momento actual)"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={fechaSalida}
                                                    onSelect={setFechaSalida}
                                                    disabled={(date) => !isDateWithinFutureLimit(date, 3)}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        {fechaSalida && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => setFechaSalida(undefined)}
                                                title="Restablecer a hoy"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Solicitante configurable */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                        <User className="h-3 w-3 text-primary" /> Solicitante inicial
                                    </label>
                                    <Input
                                        placeholder="Nombre de quien solicita (opcional)"
                                        value={solicitante}
                                        onChange={(e) => setSolicitante(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Buscador de plantillas */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                autoFocus
                                placeholder="Buscar plantilla por nombre o área..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 text-sm"
                            />
                        </div>

                        <ScrollArea className="flex-1 max-h-[46vh] pr-3">
                            {filteredPlantillas.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground space-y-2">
                                    <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
                                    <p className="text-sm font-medium">No se encontraron plantillas</p>
                                    <p className="text-xs">
                                        {searchTerm
                                            ? `No hay resultados para "${searchTerm}"`
                                            : "No tienes plantillas creadas en el sistema."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-2.5">
                                    {filteredPlantillas.map((plantilla) => {
                                        const activeItemsCount = (plantilla.items || []).filter(
                                            (i) => !i.product?.deletedAt
                                        ).length

                                        return (
                                            <div
                                                key={plantilla.id}
                                                className="group border rounded-lg p-3.5 hover:border-primary/50 hover:bg-muted/40 transition-all flex items-center justify-between gap-3 cursor-pointer"
                                                onClick={() => handleSelectPlantilla(plantilla)}
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="p-2 rounded-md bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
                                                        <ClipboardList className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                                                {plantilla.nombre}
                                                            </span>
                                                            {plantilla.area ? (
                                                                <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                                                                    <Building2 className="h-3 w-3" />
                                                                    {plantilla.area.nombre}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    General
                                                                </span>
                                                            )}
                                                        </div>
                                                        {plantilla.descripcion && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {plantilla.descripcion}
                                                            </p>
                                                        )}
                                                        <div className="text-[11px] text-muted-foreground font-mono">
                                                            {activeItemsCount} medicamento{activeItemsCount !== 1 ? "s" : ""}
                                                            {plantilla.area && (
                                                                <span className="text-primary ml-2 font-sans font-medium">
                                                                    • Carga automática de área: {plantilla.area.nombre}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="gap-1 text-xs shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                                >
                                                    Cargar
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </ScrollArea>

                        <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-between">
                            <span className="text-xs text-muted-foreground">
                                Total: {filteredPlantillas.length} plantilla(s)
                            </span>
                            <Button variant="outline" size="sm" onClick={handleClose}>
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
