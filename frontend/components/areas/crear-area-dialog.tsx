"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Buildings as Building2, CircleNotch as Loader2 } from "@phosphor-icons/react"

export interface AreaData {
    id?: string
    nombre: string
    descripcion?: string | null
    activo?: boolean
}

interface CrearAreaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: AreaData | null
    onSuccess?: (area: AreaData) => void
}

export function CrearAreaDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess,
}: CrearAreaDialogProps) {
    const [nombre, setNombre] = useState("")
    const [descripcion, setDescripcion] = useState("")
    const [activo, setActivo] = useState(true)
    const [saving, setSaving] = useState(false)

    const isEditing = Boolean(initialData?.id)

    useEffect(() => {
        if (open) {
            if (initialData) {
                setNombre(initialData.nombre || "")
                setDescripcion(initialData.descripcion || "")
                setActivo(initialData.activo !== false)
            } else {
                setNombre("")
                setDescripcion("")
                setActivo(true)
            }
        }
    }, [open, initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const trimmedNombre = nombre.trim()
        if (!trimmedNombre) {
            toast.warning("El nombre del área es obligatorio")
            return
        }

        setSaving(true)
        try {
            if (isEditing && initialData?.id) {
                const updated = await api.put(`/areas/${initialData.id}`, {
                    nombre: trimmedNombre,
                    descripcion: descripcion.trim() || null,
                    activo,
                })
                toast.success(`Área "${trimmedNombre}" actualizada exitosamente`)
                onSuccess?.(updated)
            } else {
                const created = await api.post("/areas", {
                    nombre: trimmedNombre,
                    descripcion: descripcion.trim() || null,
                })
                toast.success(`Área "${trimmedNombre}" creada exitosamente`)
                onSuccess?.(created)
            }
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving area:", error)
            const errorMsg = error?.response?.data?.error || error?.message || "No se pudo guardar el área"
            toast.error(errorMsg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle>
                                    {isEditing ? "Editar Área" : "Nueva Área"}
                                </DialogTitle>
                                <DialogDescription>
                                    {isEditing
                                        ? "Modifica los datos del área solicitante"
                                        : "Registra una nueva área para salidas y pedidos"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="area-nombre">
                                Nombre del Área <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="area-nombre"
                                autoFocus
                                placeholder="Ej: Traumatología, Sala de Espera..."
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                disabled={saving}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="area-descripcion">
                                Descripción (Opcional)
                            </Label>
                            <Textarea
                                id="area-descripcion"
                                placeholder="Breve descripción o ubicación del área..."
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                rows={3}
                                disabled={saving}
                            />
                        </div>

                        {isEditing && (
                            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                <div>
                                    <Label className="text-sm font-medium">Estado del Área</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {activo ? "Disponible para seleccionar en salidas" : "Oculta en selectores"}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant={activo ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setActivo(!activo)}
                                    className="h-8 text-xs"
                                >
                                    {activo ? "Activo" : "Inactivo"}
                                </Button>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditing ? "Guardar Cambios" : "Crear Área"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
