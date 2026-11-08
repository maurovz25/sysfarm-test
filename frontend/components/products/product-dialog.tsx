"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, CircleNotch as Loader2, Warning as AlertTriangle, Package, Stack as Layers } from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Product, TipoProducto, TipoPresentacion } from "@/lib/types"

const OPCIONES_PRESENTACION: { value: TipoPresentacion; label: string }[] = [
  { value: "Caja", label: "Caja" },
  { value: "Blister", label: "Blister" },
  { value: "Unidad", label: "Unidad" },
  { value: "Frasco", label: "Frasco" },
  { value: "Botella", label: "Botella" },
  { value: "Sobre", label: "Sobre" },
  { value: "Ampolla", label: "Ampolla" },
]

interface ProductDialogProps {
  product?: Product
  lotesAsociados?: Array<Partial<Product>>
  onSave: (product: Partial<Product> & { motivoAjuste?: string; isNuevoLote?: boolean }) => void | Promise<void>
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProductDialog({ product, lotesAsociados, onSave, trigger, open: externalOpen, onOpenChange: externalOnOpenChange }: ProductDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = externalOpen !== undefined
  const open = isControlled ? externalOpen : internalOpen
  const setOpen = (val: boolean) => {
    if (externalOnOpenChange) externalOnOpenChange(val)
    setInternalOpen(val)
  }

  const [loading, setLoading] = useState(false)
  const [originalStock, setOriginalStock] = useState<number | undefined>(undefined)
  const [motivoAjuste, setMotivoAjuste] = useState("")
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const [isNuevoLote, setIsNuevoLote] = useState(false)

  const [formData, setFormData] = useState<Partial<Product>>({
    codigoBarras: "",
    nombre: "",
    descripcionCorta: "",
    tipo: "Medicamento",
    registroSanitario: "",
    presentacion: "Caja",
    cantidadPorPresentacion: 1,
    unidadBase: "Unidad",
    stockMinimo: 0,
    laboratorio: "",
    lote: "",
    fechaExpiracion: "",
    precioCostoPresentacion: 0,
    precioVentaPresentacion: 0,
    stockUnidad: 0
  })

  useEffect(() => {
    if (open) {
      setIsNuevoLote(false)
      if (product) {
        let formattedExp = ""
        if (product.fechaExpiracion) {
          formattedExp = product.fechaExpiracion.split("T")[0]
        }
        setFormData({
          ...product,
          fechaExpiracion: formattedExp
        })
        setSelectedBatchId(product.id || "")
        setOriginalStock(product.stockUnidad !== undefined ? Number(product.stockUnidad) : undefined)
      } else {
        setSelectedBatchId("")
        setFormData({
          codigoBarras: "",
          nombre: "",
          descripcionCorta: "",
          tipo: "Medicamento",
          registroSanitario: "",
          presentacion: "Caja",
          cantidadPorPresentacion: 1,
          unidadBase: "Unidad",
          stockMinimo: 0,
          laboratorio: "",
          lote: "",
          fechaExpiracion: "",
          precioCostoPresentacion: 0,
          precioVentaPresentacion: 0,
          stockUnidad: 0
        })
        setOriginalStock(undefined)
      }
      setMotivoAjuste("")
    }
  }, [product, open])

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId)
    setMotivoAjuste("")

    if (batchId === "NUEVO_LOTE") {
      setIsNuevoLote(true)
      setFormData((prev) => ({
        ...prev,
        id: "NUEVO_LOTE",
        lote: "",
        fechaExpiracion: "",
        precioCostoPresentacion: prev.precioCostoPresentacion || 0,
        precioVentaPresentacion: prev.precioVentaPresentacion || 0,
        stockUnidad: 0
      }))
      setOriginalStock(undefined)
    } else {
      setIsNuevoLote(false)
      const targetBatch = lotesAsociados?.find((b) => b.id === batchId)
      if (targetBatch) {
        let formattedExp = ""
        if (targetBatch.fechaExpiracion) {
          formattedExp = targetBatch.fechaExpiracion.split("T")[0]
        }
        setFormData((prev) => ({
          ...prev,
          ...targetBatch,
          fechaExpiracion: formattedExp
        }))
        setOriginalStock(targetBatch.stockUnidad !== undefined ? Number(targetBatch.stockUnidad) : undefined)
      }
    }
  }

  const stockCambiado = originalStock !== undefined &&
    formData.stockUnidad !== undefined &&
    Number(formData.stockUnidad) !== originalStock

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Validar motivo si cambió el stock
    if (stockCambiado && !motivoAjuste.trim()) {
      toast.warning("Debe ingresar un motivo para el ajuste manual de stock del lote.")
      setLoading(false)
      return
    }

    // Validar fecha de expiración si existe
    if (formData.fechaExpiracion) {
      const fechaExp = new Date(formData.fechaExpiracion)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      if (fechaExp < hoy) {
        toast.warning("La fecha de expiración no puede ser anterior a la fecha actual")
        setLoading(false)
        return
      }
    }

    // Validar coherencia de lote y fecha al crear nuevo producto
    if (!product) {
      const stockVal = formData.stockUnidad !== undefined && formData.stockUnidad !== null ? Number(formData.stockUnidad) : 0
      const tieneStock = !isNaN(stockVal) && stockVal > 0
      const tieneLote = Boolean(formData.lote && formData.lote.trim().length > 0)
      const tieneFecha = Boolean(formData.fechaExpiracion && formData.fechaExpiracion.trim().length > 0)

      if (tieneStock && !tieneLote) {
        toast.warning("Debe ingresar el código de lote si asigna stock inicial.")
        setLoading(false)
        return
      }
      if (tieneStock && !tieneFecha) {
        toast.warning("Debe ingresar la fecha de expiración del lote si asigna stock inicial.")
        setLoading(false)
        return
      }
      if (tieneLote && !tieneFecha) {
        toast.warning("Debe ingresar la fecha de expiración para el lote ingresado.")
        setLoading(false)
        return
      }
      if (tieneFecha && !tieneLote) {
        toast.warning("Debe ingresar el código de lote para la fecha de expiración indicada.")
        setLoading(false)
        return
      }
    }

    // Normalizar opcionales: vacíos o no definidos → valores seguros
    const toSave: Partial<Product> & { motivoAjuste?: string; isNuevoLote?: boolean } = {
      ...formData,
      codigoBarras: formData.codigoBarras !== undefined ? (formData.codigoBarras.trim() === "" ? "" : formData.codigoBarras.trim()) : undefined,
      nombre: formData.nombre?.trim(),
      descripcionCorta: formData.descripcionCorta !== undefined ? (formData.descripcionCorta.trim() === "" ? "" : formData.descripcionCorta.trim()) : undefined,
      registroSanitario: formData.registroSanitario !== undefined ? (formData.registroSanitario.trim() === "" ? "" : formData.registroSanitario.trim()) : undefined,
      laboratorio: formData.laboratorio !== undefined ? (formData.laboratorio.trim() === "" ? "" : formData.laboratorio.trim()) : undefined,
      lote: formData.lote?.trim() || undefined,
      fechaExpiracion: formData.fechaExpiracion || undefined,
      cantidadPorPresentacion: formData.cantidadPorPresentacion ? Math.max(1, Number(formData.cantidadPorPresentacion)) : 1,
      stockUnidad: formData.stockUnidad !== undefined && formData.stockUnidad !== null ? Number(formData.stockUnidad) : undefined,
      stockMinimo: formData.stockMinimo !== undefined && formData.stockMinimo !== null ? Math.max(0, Number(formData.stockMinimo)) : 0,
      precioCostoPresentacion: formData.precioCostoPresentacion !== undefined && formData.precioCostoPresentacion !== null ? Math.max(0, Number(formData.precioCostoPresentacion)) : 0,
      precioVentaPresentacion: formData.precioVentaPresentacion !== undefined && formData.precioVentaPresentacion !== null ? Math.max(0, Number(formData.precioVentaPresentacion)) : 0,
      motivoAjuste: motivoAjuste.trim() || undefined,
      isNuevoLote: isNuevoLote || selectedBatchId === "NUEVO_LOTE"
    }

    // Cerrar inmediatamente el modal para UX instantánea (0ms)
    setOpen(false)

    // Ejecutar guardado en segundo plano
    try {
      onSave(toSave)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Valor mostrado en inputs numéricos
  const numVal = (n: number | undefined | null) => (n === undefined || n === null || n === 0 ? "" : n)

  const handleChange = (field: keyof Product, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Cálculos derivados memoizados
  const { cantXPres, costoPres, ventaPres, costoUnit, ventaUnit, margenGanancia } = useMemo(() => {
    const cantXPres = Math.max(1, Number(formData.cantidadPorPresentacion) || 1)
    const costoPres = Number(formData.precioCostoPresentacion) || 0
    const ventaPres = Number(formData.precioVentaPresentacion) || 0
    const costoUnit = costoPres / cantXPres
    const ventaUnit = ventaPres / cantXPres
    const margenGanancia = costoPres > 0 ? (((ventaPres - costoPres) / costoPres) * 100) : 0
    return { cantXPres, costoPres, ventaPres, costoUnit, ventaUnit, margenGanancia }
  }, [formData.cantidadPorPresentacion, formData.precioCostoPresentacion, formData.precioVentaPresentacion])

  // Estado del lote por fecha memoizado
  const { estaProximoAVencer, estaVencido } = useMemo(() => {
    if (!formData.fechaExpiracion) return { estaProximoAVencer: false, estaVencido: false }
    const fechaExp = new Date(formData.fechaExpiracion)
    const hoy = new Date()
    const diffTime = fechaExp.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const estaProximoAVencer = diffDays > 0 && diffDays <= 30
    const estaVencido = fechaExp < hoy
    return { estaProximoAVencer, estaVencido }
  }, [formData.fechaExpiracion])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Medicamento/Insumo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product ? "Editar Producto y Lote" : "Nuevo Medicamento/Insumo"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? ""
              : "Completa la información para registrar un nuevo medicamento o insumo en el inventario."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contenedor de 2 columnas con separador vertical */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative pt-2">
            {/* Línea Divisoria Vertical Elegante (solo en MD+) */}
            <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-[1px] bg-border/70 -translate-x-1/2" />

            {/* COLUMNA IZQUIERDA: INFORMACIÓN DEL PRODUCTO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-4">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
                  Información del Producto
                </h3>
              </div>

              {/* Fila: Código de barras y Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigoBarras">Código de Barras (GTIN) *</Label>
                  <Input
                    id="codigoBarras"
                    value={formData.codigoBarras || ""}
                    onChange={(e) => handleChange("codigoBarras", e.target.value)}
                    required
                    placeholder="7751234001234"
                    maxLength={13}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={formData.tipo || "Medicamento"}
                    onValueChange={(value) => handleChange("tipo", value as TipoProducto)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Medicamento">Medicamento</SelectItem>
                      <SelectItem value="Dispositivo Médico">Dispositivo Médico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Comercial *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre || ""}
                  onChange={(e) => handleChange("nombre", e.target.value)}
                  required
                  placeholder="Paracetamol 500mg"
                />
              </div>

              {/* Descripción corta */}
              <div className="space-y-2">
                <Label htmlFor="descripcionCorta">Descripción Corta</Label>
                <Input
                  id="descripcionCorta"
                  value={formData.descripcionCorta ?? ""}
                  onChange={(e) => handleChange("descripcionCorta", e.target.value)}
                  placeholder="Analgésico y antipirético (opcional)"
                  maxLength={100}
                />
              </div>

              {/* Registro Sanitario */}
              <div className="space-y-2">
                <Label htmlFor="registroSanitario">Registro Sanitario</Label>
                <Input
                  id="registroSanitario"
                  value={formData.registroSanitario || ""}
                  onChange={(e) => handleChange("registroSanitario", e.target.value)}
                  placeholder="R.S. EE-12345 (Opcional)"
                />
              </div>

              {/* Presentación, Cantidad por Presentación, Unidad Base */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="presentacion">Presentación *</Label>
                  <Select
                    value={formData.presentacion || "Caja"}
                    onValueChange={(value) => handleChange("presentacion", value as TipoPresentacion)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_PRESENTACION.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cantidadPorPresentacion">Cant. x Pres. *</Label>
                  <Input
                    id="cantidadPorPresentacion"
                    type="number"
                    min="1"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={numVal(formData.cantidadPorPresentacion)}
                    onChange={(e) => handleChange("cantidadPorPresentacion", e.target.value === "" ? 0 : Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                    required
                    placeholder="20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidadBase">Unidad Base *</Label>
                  <Select
                    value={formData.unidadBase ?? "Unidad"}
                    onValueChange={(value) => handleChange("unidadBase", value as TipoPresentacion)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCIONES_PRESENTACION.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Stock Mínimo */}
              <div className="space-y-2">
                <Label htmlFor="stockMinimo">Stock Mínimo (Unidades Alerta)</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  min="0"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={numVal(formData.stockMinimo)}
                  onChange={(e) => handleChange("stockMinimo", e.target.value === "" ? 0 : Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* COLUMNA DERECHA: INFORMACIÓN DEL LOTE Y PRECIOS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-4">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
                  Información de Lote y Precios
                </h3>
              </div>

              {/* Selector dinámico de Lote si existen lotes asociados o se está editando un producto */}
              {product && lotesAsociados && lotesAsociados.length > 0 && (
                <div className="bg-primary/5 p-2.5 rounded-lg border border-primary/20 space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      Lote a Editar:
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      {lotesAsociados.length} lote{lotesAsociados.length !== 1 ? 's' : ''} registrado{lotesAsociados.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Select
                    value={selectedBatchId || product.id || ""}
                    onValueChange={(val) => handleSelectBatch(val)}
                  >
                    <SelectTrigger className="bg-background text-xs h-9">
                      <SelectValue placeholder="Seleccionar lote a editar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesAsociados.map((b) => (
                        <SelectItem key={b.id} value={b.id || ""} className="text-xs">
                          Lote: <span className="font-semibold">{b.lote || "Sin Código"}</span> (Stock: {b.stockUnidad || 0} | Vence: {b.fechaExpiracion ? b.fechaExpiracion.split("T")[0] : "S/F"})
                        </SelectItem>
                      ))}
                      <SelectItem value="NUEVO_LOTE" className="text-xs font-bold text-primary">
                        + Registrar Nuevo Lote para este Producto
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Lote y Fecha de Expiración */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lote">Código de Lote</Label>
                  <Input
                    id="lote"
                    value={formData.lote || ""}
                    onChange={(e) => handleChange("lote", e.target.value)}
                    placeholder="Ej: LOTE-2026-A"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fechaExpiracion">Fecha Expiración</Label>
                    {estaVencido ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Vencido</Badge>
                    ) : estaProximoAVencer ? (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-500 text-orange-500">Prox. Vencer</Badge>
                    ) : null}
                  </div>
                  <Input
                    id="fechaExpiracion"
                    type="date"
                    value={formData.fechaExpiracion || ""}
                    onChange={(e) => handleChange("fechaExpiracion", e.target.value)}
                  />
                </div>
              </div>

              {/* Laboratorio */}
              <div className="space-y-2">
                <Label htmlFor="laboratorio">Laboratorio Fabricante</Label>
                <Input
                  id="laboratorio"
                  value={formData.laboratorio || ""}
                  onChange={(e) => handleChange("laboratorio", e.target.value)}
                  placeholder="Ej: Farmindustria / Bazo (Opcional)"
                />
              </div>

              {/* Precios de Costo y Venta por Presentación */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precioCostoPresentacion">Precio Costo ({formData.presentacion || "Caja"}) S/</Label>
                  <Input
                    id="precioCostoPresentacion"
                    type="number"
                    step="0.01"
                    min="0"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={numVal(formData.precioCostoPresentacion)}
                    onChange={(e) => handleChange("precioCostoPresentacion", e.target.value === "" ? 0 : Number(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioVentaPresentacion">Precio Venta ({formData.presentacion || "Caja"}) S/</Label>
                  <Input
                    id="precioVentaPresentacion"
                    type="number"
                    step="0.01"
                    min="0"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={numVal(formData.precioVentaPresentacion)}
                    onChange={(e) => handleChange("precioVentaPresentacion", e.target.value === "" ? 0 : Number(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Tarjeta de métricas calculadas (Costo unitario, Venta unitaria, Margen %) */}
              <div className="bg-muted/40 p-3 rounded-lg border grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-muted-foreground font-medium">Costo Unit.</p>
                  <p className="font-bold text-foreground mt-0.5">S/ {costoUnit.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Venta Unit.</p>
                  <p className="font-bold text-foreground mt-0.5">S/ {ventaUnit.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-medium">Margen %</p>
                  <p className={`font-bold mt-0.5 ${margenGanancia >= 20 ? 'text-green-600' : margenGanancia > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                    {margenGanancia.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Stock del Lote y Ajuste Directo */}
              <div className="space-y-2 pt-1 border-t">
                <Label htmlFor="stockUnidad" className="font-medium">
                  Stock Actual del Lote ({formData.unidadBase || "Unidad"})
                </Label>
                <Input
                  id="stockUnidad"
                  type="number"
                  min="0"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={numVal(formData.stockUnidad)}
                  onChange={(e) => handleChange("stockUnidad", e.target.value === "" ? 0 : Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                />

                {stockCambiado && (
                  <div className="space-y-2 mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg animate-in fade-in-50">
                    <Label htmlFor="motivoAjuste" className="text-orange-600 font-bold text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Motivo Obligatorio del Ajuste de Stock *
                    </Label>
                    <Textarea
                      id="motivoAjuste"
                      value={motivoAjuste}
                      onChange={(e) => setMotivoAjuste(e.target.value)}
                      placeholder="Explique la razón del cambio de stock (ej: Conteo físico, Merma por vencimiento)..."
                      required
                      className="border-orange-300 focus-visible:ring-orange-500 text-xs h-16"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
