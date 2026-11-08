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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, CircleNotch as Loader2, Warning as AlertTriangle } from "@phosphor-icons/react"
import { toast } from "sonner"
import type { InventoryMovement, Product, TipoUnidad } from "@/lib/types"
import {
  calcularUnidadesDesdePresentacion,
  puedeVender,
  obtenerStockDesglosado,
} from "@/lib/inventory"

interface MovementDialogProps {
  tipo: "Ingreso" | "Salida"
  products: Product[]
  onSave: (movement: Partial<InventoryMovement>) => void
  trigger?: React.ReactNode
}

export function MovementDialog({ tipo, products, onSave, trigger }: MovementDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Partial<InventoryMovement>>({
    tipo,
    productoId: "",
    cantidadPresentacion: 0,
    cantidadUnidad: 0,
    tipoUnidad: "presentacion",
    motivo: "",
    lote: "",
    fechaExpiracion: "",
    observaciones: "",
    proveedorNombre: "",
    proveedorRuc: "",
    departamento: "",
    solicitante: "",
  })

  const selectedProduct = products.find((p) => p.id === formData.productoId)
  const stockDesglosado = selectedProduct
    ? obtenerStockDesglosado(selectedProduct.stockUnidad, selectedProduct.cantidadPorPresentacion)
    : null

  // Calcular cantidadUnidad cuando cambia cantidadPresentacion o tipoUnidad
  useEffect(() => {
    if (selectedProduct && formData.tipoUnidad === "presentacion" && formData.cantidadPresentacion) {
      const unidades = calcularUnidadesDesdePresentacion(
        formData.cantidadPresentacion,
        selectedProduct.cantidadPorPresentacion,
      )
      setFormData((prev) => ({ ...prev, cantidadUnidad: unidades }))
    } else if (formData.tipoUnidad === "unidad" && formData.cantidadUnidad !== undefined) {
      // Ya está en unidades, no hacer nada
    }
  }, [formData.cantidadPresentacion, formData.tipoUnidad, selectedProduct])

  // Validación de stock para salidas
  const validacionStock = selectedProduct && tipo === "Salida" && formData.tipoUnidad && formData.cantidadUnidad
    ? puedeVender(
        selectedProduct.stockUnidad,
        formData.tipoUnidad === "presentacion" ? formData.cantidadPresentacion || 0 : formData.cantidadUnidad,
        formData.tipoUnidad as TipoUnidad,
        selectedProduct.cantidadPorPresentacion,
      )
    : { puede: true }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProduct) {
      toast.warning("Por favor seleccione un producto")
      return
    }

    // Validar stock para salidas
    if (tipo === "Salida" && !validacionStock.puede) {
      toast.warning(validacionStock.mensaje || "No hay stock suficiente")
      return
    }

    setLoading(true)

    // TODO: Guardar en Supabase y actualizar stock
    // const supabase = getSupabaseBrowserClient()
    // await supabase.from('movimientos').insert({
    //   ...formData,
    //   fecha: new Date().toISOString(),
    //   usuario: 'Usuario actual',
    //   factorConversion: selectedProduct.cantidadPorPresentacion
    // })
    // Actualizar stock del producto

    setTimeout(() => {
      onSave({
        ...formData,
        productoNombre: selectedProduct.nombre,
        fecha: new Date().toISOString().split("T")[0],
        usuario: "Usuario Demo",
        factorConversion: selectedProduct.cantidadPorPresentacion,
        lote: formData.lote || selectedProduct.lote,
        fechaExpiracion: formData.fechaExpiracion || selectedProduct.fechaExpiracion,
      })
      setLoading(false)
      setOpen(false)
      // Reset form
      setFormData({
        tipo,
        productoId: "",
        cantidadPresentacion: 0,
        cantidadUnidad: 0,
        tipoUnidad: "presentacion",
        motivo: "",
        lote: "",
        fechaExpiracion: "",
        observaciones: "",
        proveedorNombre: "",
        proveedorRuc: "",
        departamento: "",
        solicitante: "",
      })
    }, 500)
  }

  const handleChange = (field: keyof InventoryMovement, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Registrar {tipo}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar {tipo}</DialogTitle>
          <DialogDescription>Completa el formulario para registrar el movimiento de inventario</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Selección de producto */}
            <div className="space-y-2">
              <Label htmlFor="producto">Medicamento/Insumo *</Label>
              <Select value={formData.productoId} onValueChange={(value) => handleChange("productoId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => {
                    const stockDesc = obtenerStockDesglosado(product.stockUnidad, product.cantidadPorPresentacion)
                    return (
                      <SelectItem key={product.id} value={product.id}>
                        {product.nombre} - Stock: {product.stockUnidad} {product.unidadBase}
                        {stockDesc.stockPresentacion > 0 &&
                          ` (${stockDesc.stockPresentacion} ${product.presentacion.toLowerCase()}s)`}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Información del producto seleccionado */}
            {selectedProduct && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="space-y-1">
                    <p>
                      <strong>Presentación:</strong> {selectedProduct.presentacion} ({selectedProduct.cantidadPorPresentacion}{" "}
                      {selectedProduct.unidadBase})
                    </p>
                    <p>
                      <strong>Stock disponible:</strong> {selectedProduct.stockUnidad} {selectedProduct.unidadBase}
                      {stockDesglosado && stockDesglosado.stockPresentacion > 0 && (
                        <>
                          {" "}
                          ({stockDesglosado.stockPresentacion} {selectedProduct.presentacion.toLowerCase()}
                          {stockDesglosado.stockPresentacion !== 1 ? "s" : ""} completas
                          {stockDesglosado.unidadesSueltas > 0 && ` + ${stockDesglosado.unidadesSueltas} sueltas`})
                        </>
                      )}
                    </p>
                    {tipo === "Salida" && (
                      <p>
                        <strong>Precio venta:</strong> S/ {selectedProduct.precioVentaPresentacion.toFixed(2)} /{" "}
                        {selectedProduct.presentacion.toLowerCase()} o S/ {selectedProduct.precioVentaUnidad.toFixed(2)} /{" "}
                        {selectedProduct.unidadBase}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Tipo de unidad */}
            {selectedProduct && (
              <div className="space-y-2">
                <Label htmlFor="tipoUnidad">{tipo === "Salida" ? "Vender por *" : "Ingresar por *"}</Label>
                <Select
                  value={formData.tipoUnidad}
                  onValueChange={(value) => {
                    handleChange("tipoUnidad", value as TipoUnidad)
                    // Reset cantidades
                    setFormData((prev) => ({
                      ...prev,
                      tipoUnidad: value as TipoUnidad,
                      cantidadPresentacion: 0,
                      cantidadUnidad: 0,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presentacion">
                      {selectedProduct.presentacion} ({selectedProduct.cantidadPorPresentacion}{" "}
                      {selectedProduct.unidadBase})
                    </SelectItem>
                    <SelectItem value="unidad">{selectedProduct.unidadBase} (unidades sueltas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cantidad según tipo de unidad */}
            {formData.tipoUnidad === "presentacion" ? (
              <div className="space-y-2">
                <Label htmlFor="cantidadPresentacion">
                  Cantidad ({selectedProduct?.presentacion || "presentaciones"}) *
                </Label>
                <Input
                  id="cantidadPresentacion"
                  type="number"
                  min="1"
                  value={formData.cantidadPresentacion || ""}
                  onChange={(e) => handleChange("cantidadPresentacion", Number.parseInt(e.target.value) || 0)}
                  required
                  placeholder="0"
                />
                {selectedProduct && formData.cantidadPresentacion && (
                  <p className="text-xs text-muted-foreground">
                    Equivale a: {formData.cantidadUnidad} {selectedProduct.unidadBase}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="cantidadUnidad">
                  Cantidad ({selectedProduct?.unidadBase || "unidades"}) *
                </Label>
                <Input
                  id="cantidadUnidad"
                  type="number"
                  min="1"
                  value={formData.cantidadUnidad || ""}
                  onChange={(e) => handleChange("cantidadUnidad", Number.parseInt(e.target.value) || 0)}
                  required
                  placeholder="0"
                />
              </div>
            )}

            {/* Validación de stock para salidas */}
            {tipo === "Salida" && !validacionStock.puede && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{validacionStock.mensaje}</AlertDescription>
              </Alert>
            )}

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Select value={formData.motivo} onValueChange={(value) => handleChange("motivo", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {tipo === "Ingreso" ? (
                    <>
                      <SelectItem value="Compra a proveedor">Compra a proveedor</SelectItem>
                      <SelectItem value="Devolución">Devolución</SelectItem>
                      <SelectItem value="Ajuste de inventario">Ajuste de inventario</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="Venta">Venta</SelectItem>
                      <SelectItem value="Uso interno">Uso interno</SelectItem>
                      <SelectItem value="Devolución a proveedor">Devolución a proveedor</SelectItem>
                      <SelectItem value="Ajuste de inventario">Ajuste de inventario</SelectItem>
                      <SelectItem value="Merma o pérdida">Merma o pérdida</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Lote y Fecha de Expiración */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lote">Lote</Label>
                <Input
                  id="lote"
                  value={formData.lote || selectedProduct?.lote || ""}
                  onChange={(e) => handleChange("lote", e.target.value)}
                  placeholder={selectedProduct?.lote || "Lote"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaExpiracion">Fecha Expiración</Label>
                <Input
                  id="fechaExpiracion"
                  type="date"
                  value={formData.fechaExpiracion || selectedProduct?.fechaExpiracion || ""}
                  onChange={(e) => handleChange("fechaExpiracion", e.target.value)}
                />
              </div>
            </div>

            {/* Campos específicos por tipo */}
            {tipo === "Ingreso" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="proveedorNombre">Nombre del Proveedor</Label>
                  <Input
                    id="proveedorNombre"
                    value={formData.proveedorNombre}
                    onChange={(e) => handleChange("proveedorNombre", e.target.value)}
                    placeholder="Nombre del proveedor (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proveedorRuc">RUC del Proveedor</Label>
                  <Input
                    id="proveedorRuc"
                    value={formData.proveedorRuc}
                    onChange={(e) => handleChange("proveedorRuc", e.target.value)}
                    placeholder="RUC (opcional)"
                    maxLength={11}
                  />
                </div>
              </>
            )}

            {tipo === "Salida" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    value={formData.departamento}
                    onChange={(e) => handleChange("departamento", e.target.value)}
                    placeholder="Departamento que solicita (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="solicitante">Solicitante</Label>
                  <Input
                    id="solicitante"
                    value={formData.solicitante}
                    onChange={(e) => handleChange("solicitante", e.target.value)}
                    placeholder="Persona que solicita (opcional)"
                  />
                </div>
              </>
            )}

            {/* Observaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={formData.observaciones}
                onChange={(e) => handleChange("observaciones", e.target.value)}
                placeholder="Información adicional (opcional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || (tipo === "Salida" && !validacionStock.puede)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
