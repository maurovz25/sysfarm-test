"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { InventoryMovement, GuiaSalida } from "@/lib/types"
import { formatLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { formatQuantity } from "@/lib/number-utils"
import { generarPdfGuiaSalida } from "@/lib/guia-salida-pdf"
import {
  Printer,
  DownloadSimple as Download,
  PlusCircle,
  MagnifyingGlass as Search,
  CircleNotch as Loader2,
  UserCheck,
  FileText as FileCheck,
} from "@phosphor-icons/react"

export const MEDICOS_ANESTESIOLOGOS = [
  { id: "1", nombre: "Dra. Mayra Priscila Chinchayán Chávez", cmp: "53791", rne: "34585", docTipo: "DNI", docNumero: "42770989" },
  { id: "2", nombre: "Dr. Danny Pablo Palomino Gamero", cmp: "61875", rne: "42428", docTipo: "DNI", docNumero: "43217789" },
  { id: "3", nombre: "Dra. Yanet Castro Tapia", cmp: "29628", rne: "26696", docTipo: "DNI", docNumero: "29409564" },
  { id: "4", nombre: "Dr. Irving Antonio Guedez Ledezma", cmp: "87231", rne: "41379", docTipo: "C.E.", docNumero: "003561871" },
]

interface GuiaSalidaControladoDialogProps {
  isOpen: boolean
  onClose: () => void
  movement: InventoryMovement | null
  onGuiaSaved?: (guia: GuiaSalida) => void
}

export function GuiaSalidaControladoDialog({
  isOpen,
  onClose,
  movement,
  onGuiaSaved,
}: GuiaSalidaControladoDialogProps) {
  const [selectedMedicoId, setSelectedMedicoId] = useState("")
  const [medicoAnestesiologo, setMedicoAnestesiologo] = useState("")
  const [cmpMedico, setCmpMedico] = useState("")
  const [paciente, setPaciente] = useState("")
  const [dniPaciente, setDniPaciente] = useState("")
  const [direccionPaciente, setDireccionPaciente] = useState("")
  const [distritoPaciente, setDistritoPaciente] = useState("")
  const [numeroReceta, setNumeroReceta] = useState("")
  const [cantidadAEntregar, setCantidadAEntregar] = useState(1)

  const [isSaving, setIsSaving] = useState(false)
  const [isSearchingDni, setIsSearchingDni] = useState(false)
  const [isLoadingGuias, setIsLoadingGuias] = useState(false)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)

  const [guiasEmitidas, setGuiasEmitidas] = useState<GuiaSalida[]>([])
  const [totalCantidad, setTotalCantidad] = useState(0)
  const [emitidasCantidad, setEmitidasCantidad] = useState(0)
  const [pendienteCantidad, setPendienteCantidad] = useState(0)

  // Cargar lista de guías emitidas cuando se abre el modal
  const fetchMovementGuias = async (mId: string) => {
    setIsLoadingGuias(true)
    try {
      const res = await api.get(`/guias/movimiento/${mId}`)
      if (res && Array.isArray(res.guias)) {
        setGuiasEmitidas(res.guias)
        setTotalCantidad(res.totalCantidad || 0)
        setEmitidasCantidad(res.emitidasCantidad || 0)
        setPendienteCantidad(res.pendienteCantidad || 0)

        // Ajustar cantidad por defecto a 1 (o saldo pendiente si es menor)
        const pend = res.pendienteCantidad || 0
        setCantidadAEntregar(pend > 0 ? 1 : 0)
      }
    } catch (err) {
      console.error("Error al cargar guías emitidas del movimiento:", err)
    } finally {
      setIsLoadingGuias(false)
    }
  }

  useEffect(() => {
    if (isOpen && movement) {
      setSelectedMedicoId("")
      setMedicoAnestesiologo("")
      setCmpMedico("")
      setPaciente("")
      setDniPaciente("")
      setDireccionPaciente("")
      setDistritoPaciente("")
      setNumeroReceta("")
      setCantidadAEntregar(1)
      fetchMovementGuias(movement.id)
    }
  }, [isOpen, movement])

  // Limpieza preventiva de estilos residuales de Radix en el body al cerrar
  useEffect(() => {
    if (!isOpen) {
      const cleanupBody = () => {
        if (typeof document !== "undefined") {
          document.body.style.pointerEvents = ""
          document.body.style.overflow = ""
          document.body.removeAttribute("data-scroll-locked")
        }
      }
      cleanupBody()
      const timer = setTimeout(cleanupBody, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Manejador de selección de médico anestesiólogo
  const handleMedicoChange = (id: string) => {
    setSelectedMedicoId(id)
    const medico = MEDICOS_ANESTESIOLOGOS.find((m) => m.id === id)
    if (medico) {
      setMedicoAnestesiologo(medico.nombre)
      setCmpMedico(medico.cmp)
    }
  }

  // Búsqueda de DNI a través del endpoint privado /api/consultas/dni
  const handleConsultarDni = async () => {
    const cleanDni = dniPaciente.trim().replace(/\D/g, "")
    if (cleanDni.length !== 8) {
      toast.warning("Ingresa un número de DNI de 8 dígitos para realizar la búsqueda.")
      return
    }

    setIsSearchingDni(true)
    try {
      const res = await api.get(`/consultas/dni?dni=${cleanDni}`)
      if (res && res.success && res.name) {
        let formattedName = (res.name || "").trim()
        if (formattedName.includes(",")) {
          const parts = formattedName.split(",")
          formattedName = `${parts[1].trim()} ${parts[0].trim()}`
        }
        formattedName = formattedName.replace(/,/g, "").replace(/\s+/g, " ").trim()
        setPaciente(formattedName)
        if (res.address) {
          setDireccionPaciente(res.address.trim())
        }
        if (res.district) {
          setDistritoPaciente(res.district.trim())
        }
        toast.success(`DNI Encontrado: ${formattedName}`)
      } else {
        toast.error("No se encontraron nombres registrados para el DNI ingresado.")
      }
    } catch (err: any) {
      console.error("Error al consultar DNI:", err)
      toast.error(err.message || "Error al consultar DNI.")
    } finally {
      setIsSearchingDni(false)
    }
  }

  // Guardar nueva guía de salida
  const handleSaveGuia = async () => {
    if (!movement) return
    if (pendienteCantidad <= 0) {
      toast.warning("Este movimiento ya tiene el 100% de sus unidades cubiertas por guías emitidas.")
      return
    }
    if (!medicoAnestesiologo.trim()) {
      toast.error("Selecciona o ingresa el nombre del Médico Anestesiólogo.")
      return
    }
    if (!paciente.trim()) {
      toast.error("El nombre y apellidos del paciente son requeridos.")
      return
    }
    if (!numeroReceta.trim()) {
      toast.error("El número de referencia de receta es requerido.")
      return
    }
    if (cantidadAEntregar <= 0 || cantidadAEntregar > pendienteCantidad) {
      toast.error(`La cantidad a entregar debe estar entre 1 y ${pendienteCantidad} unidad(es).`)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        movementId: movement.id,
        medicoAnestesiologo: medicoAnestesiologo.trim(),
        cmpMedico: cmpMedico.trim() || null,
        paciente: paciente.trim(),
        dniPaciente: dniPaciente.trim() || null,
        direccionPaciente: direccionPaciente.trim() || null,
        distritoPaciente: distritoPaciente.trim() || null,
        numeroReceta: numeroReceta.trim(),
        cantidad: cantidadAEntregar,
        usuarioEmisor: movement.usuario || "Farmacéutico",
      }

      const res = await api.post("/guias", payload)
      const newGuia: GuiaSalida = res.guia

      toast.success(res.message || `Guía ${newGuia.codigo} registrada exitosamente`)

      if (onGuiaSaved) {
        onGuiaSaved(newGuia)
      }

      // Limpiar formulario específico de paciente/receta
      setPaciente("")
      setDniPaciente("")
      setDireccionPaciente("")
      setDistritoPaciente("")
      setNumeroReceta("")

      // Recargar la lista de guías emitidas
      await fetchMovementGuias(movement.id)
    } catch (error: any) {
      console.error("Error al guardar guía de salida:", error)
      toast.error(error.message || "Error al procesar la guía de salida.")
    } finally {
      setIsSaving(false)
    }
  }

  // Generación/Impresión de PDF vectorial nativo
  const handlePdfAction = async (guia: GuiaSalida, action: "download" | "print") => {
    setGeneratingPdfId(guia.id)
    try {
      await generarPdfGuiaSalida(guia, action)
      if (action === "download") {
        toast.success(`Archivo Guia_Salida_${guia.codigo}.pdf descargado`)
      }
    } catch (err: any) {
      toast.error(`Error al procesar PDF de la guía: ${err.message || "Error desconocido"}`)
    } finally {
      setGeneratingPdfId(null)
    }
  }

  const porcentajeAvance = totalCantidad > 0 ? Math.round((emitidasCantidad / totalCantidad) * 100) : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {movement && (
        <DialogContent className="w-[90vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6">
          <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <DialogTitle className="text-xl font-bold">
                  Emisión de Guías de Salida Controladas
                </DialogTitle>
              </div>
            </div>
            <Badge
              variant={pendienteCantidad === 0 ? "default" : emitidasCantidad > 0 ? "outline" : "secondary"}
              className={
                pendienteCantidad === 0
                  ? "bg-emerald-600 font-mono text-sm px-3 py-1"
                  : emitidasCantidad > 0
                  ? "bg-amber-50 text-amber-800 border-amber-300 font-mono text-sm px-3 py-1"
                  : "font-mono text-sm px-3 py-1"
              }
            >
              {pendienteCantidad === 0
                ? "🟢 Completo (100%)"
                : `🟡 Avanzado (${emitidasCantidad}/${totalCantidad} Uds.)`}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 my-2">
          {/* Resumen del Movimiento de Inventario */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medicamento Controlado</span>
                <h4 className="text-base font-bold text-foreground">{movement.productoNombre}</h4>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Salida Registrada</span>
                <p className="text-lg font-black text-destructive">
                  {formatQuantity(movement.cantidadUnidad)} unidades
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/60">
              <div>
                <span className="text-muted-foreground block font-medium">Lote Físico:</span>
                <span className="font-mono font-semibold">{movement.lote || "No especificado"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">F. Vencimiento:</span>
                <span className="font-mono font-semibold">
                  {movement.fechaExpiracion ? formatLocalDate(movement.fechaExpiracion) : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">Fecha y Hora de Salida:</span>
                <span className="font-semibold">{formatLocalDateTime(movement.fecha)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">Estado Guías:</span>
                <span className="font-semibold text-emerald-700">
                  {emitidasCantidad} emitidas / {pendienteCantidad} pendientes
                </span>
              </div>
            </div>
          </div>

          {/* Formulario de Registro de Nueva Guía (si hay unidades pendientes) */}
          {pendienteCantidad > 0 ? (
            <div className="space-y-4 rounded-lg border border-emerald-600/30 bg-emerald-50/20 p-4">
              <div className="flex items-center justify-between border-b pb-2 border-emerald-600/20">
                <h4 className="text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Emitir Guía de Salida (Saldo Pendiente: {pendienteCantidad} Unidades)
                </h4>
                <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-300">
                  Siguiente Guía
                </Badge>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Selector Médico Anestesiólogo */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="select-medico" className="font-semibold text-xs">
                    Médico Anestesiólogo *
                  </Label>
                  <Select value={selectedMedicoId} onValueChange={handleMedicoChange}>
                    <SelectTrigger id="select-medico">
                      <SelectValue placeholder="-- Seleccionar Médico Anestesiólogo --" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDICOS_ANESTESIOLOGOS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="font-semibold">{m.nombre}</span>
                          <span className="text-muted-foreground mx-2">|</span>
                          <span className="font-mono text-xs">CMP: {m.cmp}</span>
                          <span className="text-muted-foreground mx-2">|</span>
                          <span className="font-mono text-xs">{m.docTipo}: {m.docNumero}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>



                {/* DNI / C.E. Paciente con búsqueda en OkFac API */}
                <div className="space-y-1.5">
                  <Label htmlFor="dni" className="font-semibold text-xs">
                    Nº de Documento del Paciente *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="dni"
                      placeholder="Ingresar 8 dígitos (ej. 47281920)"
                      value={dniPaciente}
                      onChange={(e) => setDniPaciente(e.target.value)}
                      className="font-mono"
                      maxLength={12}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleConsultarDni()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleConsultarDni}
                      disabled={isSearchingDni || dniPaciente.trim().length !== 8}
                      title="Consultar DNI en OkFac API"
                    >
                      {isSearchingDni ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Nombre y Apellidos del Paciente */}
                <div className="space-y-1.5">
                  <Label htmlFor="paciente" className="font-semibold text-xs">
                    Nombre y Apellidos del Paciente *
                  </Label>
                  <Input
                    id="paciente"
                    placeholder="Autocompletado o manual (ej. Juan Pérez Mendoza)"
                    value={paciente}
                    onChange={(e) => setPaciente(e.target.value)}
                  />
                </div>

                {/* Dirección del Paciente */}
                <div className="space-y-1.5">
                  <Label htmlFor="direccion" className="font-semibold text-xs">
                    Dirección del Paciente *
                  </Label>
                  <Input
                    id="direccion"
                    placeholder="Autocompletado o manual (ej. Av. Arequipa 1234)"
                    value={direccionPaciente}
                    onChange={(e) => setDireccionPaciente(e.target.value)}
                  />
                </div>

                {/* Distrito del Paciente */}
                <div className="space-y-1.5">
                  <Label htmlFor="distrito" className="font-semibold text-xs">
                    Distrito del Paciente *
                  </Label>
                  <Input
                    id="distrito"
                    placeholder="Autocompletado o manual (ej. Breña, Lima)"
                    value={distritoPaciente}
                    onChange={(e) => setDistritoPaciente(e.target.value)}
                  />
                </div>

                {/* Número de Referencia de Receta Médica */}
                <div className="space-y-1.5">
                  <Label htmlFor="receta" className="font-semibold text-xs text-emerald-800">
                    Nº Referencia de Receta Médica *
                  </Label>
                  <Input
                    id="receta"
                    placeholder="Ej. REC-ESP-2026-00412"
                    value={numeroReceta}
                    onChange={(e) => setNumeroReceta(e.target.value)}
                    className="font-mono font-semibold"
                  />
                </div>

                {/* Cantidad a Entregar (Unidades) */}
                <div className="space-y-1.5">
                  <Label htmlFor="cantidad-guia" className="font-semibold text-xs text-emerald-800">
                    Cantidad a Entregar para esta Guía (Máx: {pendienteCantidad}) *
                  </Label>
                  <Input
                    id="cantidad-guia"
                    type="number"
                    min={1}
                    max={pendienteCantidad}
                    value={cantidadAEntregar}
                    onChange={(e) => setCantidadAEntregar(Math.max(1, Math.min(pendienteCantidad, Number(e.target.value) || 1)))}
                    className="font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleSaveGuia}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-4 w-4" />
                      Registrar Guía de Salida ({cantidadAEntregar} unid.)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-4 text-center space-y-1">
              <FileCheck className="h-8 w-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-900">¡Todas las guías han sido emitidas!</h4>
              <p className="text-xs text-emerald-700">
                Se han emitido exitosamente {guiasEmitidas.length} guía(s) cubriendo las {totalCantidad} unidades totales del movimiento.
              </p>
            </div>
          )}

          {/* Lista de Guías Emitidas para este Movimiento */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Historial de Guías Emitidas ({guiasEmitidas.length})
            </h4>

            {isLoadingGuias ? (
              <div className="py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando guías emitidas...
              </div>
            ) : guiasEmitidas.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm border rounded-lg bg-muted/10">
                Aún no se ha registrado ninguna guía de salida para este movimiento.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                      <th className="p-3 font-mono">Código</th>
                      <th className="p-3">Paciente / DNI</th>
                      <th className="p-3">Médico Anestesiólogo</th>
                      <th className="p-3 font-mono">Nº Receta</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-center">Acciones PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {guiasEmitidas.map((guia) => (
                      <tr key={guia.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold font-mono text-emerald-700">{guia.codigo}</td>
                        <td className="p-3">
                          <span className="font-semibold block">{guia.paciente}</span>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {guia.dniPaciente ? `DNI: ${guia.dniPaciente}` : "Sin DNI"}
                          </span>
                          {(guia.direccionPaciente || guia.distritoPaciente) && (
                            <span className="text-muted-foreground block text-[10.5px] truncate max-w-[220px]" title={[guia.direccionPaciente, guia.distritoPaciente].filter(Boolean).join(" - ")}>
                              {[guia.direccionPaciente, guia.distritoPaciente].filter(Boolean).join(" - ")}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-medium block">{guia.medicoAnestesiologo}</span>
                          {guia.cmpMedico && <span className="text-muted-foreground font-mono text-[11px]">CMP: {guia.cmpMedico}</span>}
                        </td>
                        <td className="p-3 font-mono font-semibold">{guia.numeroReceta}</td>
                        <td className="p-3 text-right font-black text-emerald-800 text-sm">
                          {formatQuantity(guia.cantidad)} u.
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handlePdfAction(guia, "download")}
                              disabled={generatingPdfId === guia.id}
                              className="h-8 gap-1 text-xs"
                              title="Descargar Guía_Salida_GS-X.pdf"
                            >
                              {generatingPdfId === guia.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              Descargar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePdfAction(guia, "print")}
                              disabled={generatingPdfId === guia.id}
                              className="h-8 gap-1 text-xs bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              title="Imprimir PDF nativo limpio"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              Imprimir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      )}
    </Dialog>
  )
}
