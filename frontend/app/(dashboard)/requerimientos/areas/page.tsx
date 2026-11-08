"use client"

import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
    Buildings as Building2,
    Plus,
    PencilSimple as Pencil,
    Power as PowerOff,
    CheckCircle as CheckCircle2,
    MagnifyingGlass as Search,
    CircleNotch as Loader2,
    Stack as Layers,
    Check,
    XCircle,
    ArrowLeft,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { formatLocalDate } from "@/lib/date-utils"
import { CrearAreaDialog, type AreaData } from "@/components/areas/crear-area-dialog"
import Link from "next/link"
import { useUserRole } from "@/hooks/use-user-role"
import { getUserRole, UserRole } from "@/lib/roles"
import { cn } from "@/lib/utils"

interface AreaItem {
    id: string
    nombre: string
    descripcion: string | null
    activo: boolean
    createdAt: string
    updatedAt: string
}

type StatusFilter = "todas" | "activas" | "inactivas"

export default function AreasPage() {
    const { user } = useUserRole()
    const role = getUserRole(user)
    const canManage = role === UserRole.ADMIN || role === UserRole.FARMACEUTICO

    const [areas, setAreas] = useState<AreaItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")

    // Modal de creación / edición
    const [openDialog, setOpenDialog] = useState(false)
    const [selectedArea, setSelectedArea] = useState<AreaData | null>(null)

    // Confirmación para cambiar estado (activar/desactivar)
    const [confirmActionArea, setConfirmActionArea] = useState<AreaItem | null>(null)
    const [togglingStatus, setTogglingStatus] = useState(false)

    const fetchAreas = async () => {
        try {
            setLoading(true)
            const data = await api.get("/areas?incluirInactivas=true")
            setAreas(data || [])
        } catch (error) {
            console.error("Error al cargar áreas:", error)
            toast.error("Error al cargar la lista de áreas")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAreas()
    }, [])

    // Filtrado por texto y estado
    const filteredAreas = useMemo(() => {
        return areas.filter((area) => {
            const matchesSearch =
                area.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (area.descripcion && area.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))

            if (!matchesSearch) return false

            if (statusFilter === "activas") return area.activo === true
            if (statusFilter === "inactivas") return area.activo === false
            return true
        })
    }, [areas, searchTerm, statusFilter])

    const totalCount = areas.length
    const activeCount = areas.filter((a) => a.activo).length
    const inactiveCount = totalCount - activeCount

    const handleOpenCreate = () => {
        setSelectedArea(null)
        setOpenDialog(true)
    }

    const handleOpenEdit = (area: AreaItem) => {
        setSelectedArea({
            id: area.id,
            nombre: area.nombre,
            descripcion: area.descripcion,
            activo: area.activo,
        })
        setOpenDialog(true)
    }

    const handleToggleStatus = async () => {
        if (!confirmActionArea) return
        setTogglingStatus(true)
        try {
            if (confirmActionArea.activo) {
                // Desactivar (DELETE lógico)
                await api.delete(`/areas/${confirmActionArea.id}`)
                toast.success(`Área "${confirmActionArea.nombre}" desactivada`)
            } else {
                // Reactivar (PUT activo: true)
                await api.put(`/areas/${confirmActionArea.id}`, { activo: true })
                toast.success(`Área "${confirmActionArea.nombre}" reactivada`)
            }
            await fetchAreas()
            setConfirmActionArea(null)
        } catch (error: any) {
            console.error("Error toggling area status:", error)
            const msg = error?.response?.data?.error || "Error al cambiar estado del área"
            toast.error(msg)
        } finally {
            setTogglingStatus(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link
                            href="/requerimientos"
                            className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Requerimientos
                        </Link>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                        Áreas
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Gestiona las áreas solicitantes de la clínica para pedidos y salidas de medicamentos
                    </p>
                </div>
                {canManage && (
                    <Button onClick={handleOpenCreate} className="gap-2 shrink-0">
                        <Plus className="h-4 w-4" />
                        Nueva Área
                    </Button>
                )}
            </div>

            {/* Métricas rápidas compactas e interactivas (sirven como filtros directos y ahorran espacio) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                    type="button"
                    onClick={() => setStatusFilter("todas")}
                    className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                        statusFilter === "todas"
                            ? "bg-primary/5 border-primary ring-1 ring-primary"
                            : "bg-card hover:bg-muted/40 border-border"
                    )}
                >
                    <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Total de Áreas</p>
                        <p className="text-lg font-bold leading-tight">{totalCount}</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter("activas")}
                    className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                        statusFilter === "activas"
                            ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500"
                            : "bg-card hover:bg-emerald-500/5 border-border"
                    )}
                >
                    <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Solo Activas</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">{activeCount}</p>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter("inactivas")}
                    className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                        statusFilter === "inactivas"
                            ? "bg-muted border-foreground/30 ring-1 ring-muted-foreground"
                            : "bg-card hover:bg-muted/40 border-border"
                    )}
                >
                    <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
                        <PowerOff className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">Solo Inactivas</p>
                        <p className="text-lg font-bold text-muted-foreground leading-tight">{inactiveCount}</p>
                    </div>
                </button>
            </div>

            {/* Controles de Búsqueda y Filtros */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Buscador */}
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar área por nombre o descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>

                        {/* Filtros de estado solicitados por el usuario */}
                        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border">
                            <Button
                                type="button"
                                variant={statusFilter === "todas" ? "default" : "ghost"}
                                size="sm"
                                className="h-7 text-xs px-3"
                                onClick={() => setStatusFilter("todas")}
                            >
                                Todas ({totalCount})
                            </Button>
                            <Button
                                type="button"
                                variant={statusFilter === "activas" ? "default" : "ghost"}
                                size="sm"
                                className="h-7 text-xs px-3"
                                onClick={() => setStatusFilter("activas")}
                            >
                                Solo Activas ({activeCount})
                            </Button>
                            <Button
                                type="button"
                                variant={statusFilter === "inactivas" ? "default" : "ghost"}
                                size="sm"
                                className="h-7 text-xs px-3"
                                onClick={() => setStatusFilter("inactivas")}
                            >
                                Solo Inactivas ({inactiveCount})
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="border-t">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40px]">#</TableHead>
                                    <TableHead>Nombre del Área</TableHead>
                                    <TableHead className="hidden md:table-cell">Descripción</TableHead>
                                    <TableHead className="w-[120px]">Estado</TableHead>
                                    <TableHead className="hidden lg:table-cell w-[150px]">Registrada</TableHead>
                                    <TableHead className="text-right w-[140px]">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Cargando áreas...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredAreas.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Building2 className="h-8 w-8 text-muted-foreground/40" />
                                                <p className="font-medium text-sm">No se encontraron áreas</p>
                                                <p className="text-xs">
                                                    {searchTerm
                                                        ? "Intenta con otro término de búsqueda"
                                                        : "Comienza registrando una nueva área con el botón superior"}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAreas.map((area, index) => (
                                        <TableRow key={area.id} className={!area.activo ? "opacity-60 bg-muted/20" : undefined}>
                                            <TableCell className="text-xs text-muted-foreground font-mono">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                                                    <span className="font-semibold text-sm">{area.nombre}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                                {area.descripcion || (
                                                    <span className="italic text-xs text-muted-foreground/60">
                                                        Sin descripción
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {area.activo ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Activo
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-muted text-muted-foreground border-muted-foreground/30 gap-1 text-xs"
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                        Inactivo
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                                {area.createdAt ? formatLocalDate(area.createdAt) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canManage ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleOpenEdit(area)}
                                                            title="Editar nombre o descripción"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className={`h-8 w-8 ${
                                                                area.activo
                                                                    ? "text-muted-foreground hover:text-destructive"
                                                                    : "text-muted-foreground hover:text-emerald-600"
                                                            }`}
                                                            onClick={() => setConfirmActionArea(area)}
                                                            title={area.activo ? "Desactivar área" : "Reactivar área"}
                                                        >
                                                            {area.activo ? (
                                                                <PowerOff className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Lectura</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Diálogo de Creación / Edición */}
            <CrearAreaDialog
                open={openDialog}
                onOpenChange={setOpenDialog}
                initialData={selectedArea}
                onSuccess={() => fetchAreas()}
            />

            {/* Diálogo de Confirmación para Activar/Desactivar */}
            <AlertDialog
                open={Boolean(confirmActionArea)}
                onOpenChange={(open) => !open && setConfirmActionArea(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmActionArea?.activo ? "¿Desactivar esta área?" : "¿Reactivar esta área?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmActionArea?.activo ? (
                                <>
                                    El área <strong>"{confirmActionArea?.nombre}"</strong> dejará de aparecer como
                                    opción seleccionable en el registro de salidas y requerimientos nuevos. Los
                                    registros históricos y plantillas existentes no se verán afectados.
                                </>
                            ) : (
                                <>
                                    El área <strong>"{confirmActionArea?.nombre}"</strong> volverá a estar disponible
                                    para su selección inmediata en salidas y requerimientos.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={togglingStatus}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            disabled={togglingStatus}
                            className={
                                confirmActionArea?.activo
                                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }
                        >
                            {togglingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {confirmActionArea?.activo ? "Sí, Desactivar" : "Sí, Reactivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
