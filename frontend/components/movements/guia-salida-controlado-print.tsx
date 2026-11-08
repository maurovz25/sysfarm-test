"use client"

import React from "react"
import type { GuiaSalida } from "@/lib/types"
import { formatLocalDate, formatLocalDateTime } from "@/lib/date-utils"
import { formatQuantity } from "@/lib/number-utils"
import { ShieldCheck, Pill } from "@phosphor-icons/react"

interface GuiaSalidaControladoPrintProps {
  guia: GuiaSalida
  onClose?: () => void
}

export function GuiaSalidaControladoPrint({ guia }: GuiaSalidaControladoPrintProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="bg-background text-foreground">
      {/* Controles visibles en pantalla (ocultos al imprimir) */}
      <div className="print:hidden flex justify-end gap-3 mb-6 p-4 bg-muted/40 rounded-lg border">
        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-md shadow hover:bg-primary/90 flex items-center gap-2 cursor-pointer transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir Guía de Salida
        </button>
      </div>

      {/* DOCUMENTO FORMAL DE GUÍA DE SALIDA DE MEDICAMENTOS CONTROLADOS */}
      <div className="printable-document bg-white text-black p-8 max-w-[820px] mx-auto border border-gray-300 rounded-lg shadow-sm font-sans text-sm print:p-0 print:border-none print:shadow-none print:max-w-full">
        
        {/* Encabezado Institucional */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-emerald-700 flex items-center justify-center text-white font-black text-lg">
                S
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">SYSFARM</h2>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Farmacia Central / Servicios Quirúrgicos</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">Sistema de Control y Dispensación de Medicamentos Fiscalizados</p>
          </div>

          <div className="text-right border-2 border-gray-800 rounded-md p-3 bg-gray-50 min-w-[210px]">
            <span className="block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Guía de Salida</span>
            <span className="block text-2xl font-black text-emerald-800 font-mono">{guia.codigo}</span>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
              Medicamento Controlado
            </span>
          </div>
        </div>

        {/* Título Principal */}
        <div className="text-center my-4">
          <h1 className="text-lg font-black tracking-wide uppercase text-gray-900 border-y border-gray-300 py-1.5 bg-gray-50">
            Guía de Salida de Medicamento Controlado
          </h1>
        </div>

        {/* Bloque de Fechas */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-xs bg-gray-50 p-3 rounded border border-gray-200">
          <div>
            <span className="font-bold text-gray-700 block">Fecha de Salida del Medicamento:</span>
            <span className="text-gray-900 font-medium text-sm">
              {formatLocalDateTime(guia.fechaSalida)}
            </span>
          </div>
          <div>
            <span className="font-bold text-gray-700 block">Fecha de Emisión de la Guía:</span>
            <span className="text-gray-900 font-medium text-sm">
              {formatLocalDateTime(guia.fechaEmision)}
            </span>
          </div>
        </div>

        {/* Bloque: Información de Prescripción y Paciente */}
        <div className="mb-5 border border-gray-300 rounded overflow-hidden">
          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-gray-800">
            1. Datos de Prescripción Médica y Paciente
          </div>
          <div className="p-3 grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
            <div>
              <span className="font-bold text-gray-600 block">Médico Anestesiólogo:</span>
              <span className="text-gray-900 font-semibold text-sm block">
                {guia.medicoAnestesiologo}
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-600 block">CMP (Colegiatura Médica):</span>
              <span className="text-gray-900 font-semibold text-sm block font-mono">
                {guia.cmpMedico || "No especificado"}
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-600 block">Paciente:</span>
              <span className="text-gray-900 font-semibold text-sm block">
                {guia.paciente}
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-600 block">Nº Documento (DNI):</span>
              <span className="text-gray-900 font-semibold text-sm block font-mono">
                {guia.dniPaciente || "No especificado"}
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-600 block">Dirección Domiciliaria:</span>
              <span className="text-gray-900 font-semibold text-sm block">
                {guia.direccionPaciente || "No especificada"}
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-600 block">Distrito:</span>
              <span className="text-gray-900 font-semibold text-sm block">
                {guia.distritoPaciente || "No especificado"}
              </span>
            </div>
            <div className="col-span-2 pt-1 border-t border-gray-200">
              <span className="font-bold text-gray-600 block">Nº de Referencia de Receta:</span>
              <span className="text-emerald-900 font-bold text-sm font-mono tracking-wide">
                {guia.numeroReceta}
              </span>
            </div>
          </div>
        </div>

        {/* Bloque: Detalle del Medicamento Controlado */}
        <div className="mb-5 border border-gray-300 rounded overflow-hidden">
          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-300 font-bold text-xs uppercase tracking-wider text-gray-800">
            2. Detalle del Medicamento Entregado
          </div>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300 text-gray-700">
                <th className="p-2.5 font-bold">Medicamento / Insumo</th>
                <th className="p-2.5 font-bold text-center">Lote</th>
                <th className="p-2.5 font-bold text-center">F. Vencimiento</th>
                <th className="p-2.5 font-bold text-center">Presentación</th>
                <th className="p-2.5 font-bold text-right">Cantidad Salida</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="p-2.5 font-bold text-gray-900 text-sm">
                  {guia.medicamentoNombre}
                </td>
                <td className="p-2.5 text-center font-mono text-xs">
                  {guia.loteCodigo || "-"}
                </td>
                <td className="p-2.5 text-center font-mono text-xs">
                  {guia.fechaVencimiento ? formatLocalDate(guia.fechaVencimiento) : "-"}
                </td>
                <td className="p-2.5 text-center text-gray-600">
                  {guia.unidadMedida || "Unidad"}
                </td>
                <td className="p-2.5 text-right font-bold text-emerald-800 text-base">
                  {formatQuantity(guia.cantidad)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Nota Legal / Declaración */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600 mb-8 leading-relaxed">
          <p className="font-semibold text-gray-800 mb-0.5">Constancia de Entrega y Recepción:</p>
          Se emite la presente Guía de Salida para fines de control de estupefacientes y medicamentos fiscalizados. El profesional médico receptor declara la recepción conforme del medicamento prescrito para el tratamiento exclusivo del paciente indicado.
        </div>

        {/* Firmas de Conformidad */}
        <div className="grid grid-cols-2 gap-12 pt-10 pb-4">
          <div className="text-center">
            <div className="border-t border-gray-800 pt-2 mx-4">
              <p className="font-bold text-xs text-gray-900 uppercase">Químico Farmacéutico</p>
              <p className="text-[11px] text-gray-600">Responsable de Dispensación</p>
              <p className="text-[10px] text-gray-500 mt-1">Usuario: {guia.usuarioEmisor || "Farmacia"}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-800 pt-2 mx-4">
              <p className="font-bold text-xs text-gray-900 uppercase">Médico Anestesiólogo</p>
              <p className="text-[11px] text-gray-600">Receptor Conforme / CMP: {guia.cmpMedico || "_________"}</p>
              <p className="text-[10px] text-gray-500 mt-1">{guia.medicoAnestesiologo}</p>
            </div>
          </div>
        </div>

        {/* Pie de Página */}
        <div className="border-t border-gray-200 mt-6 pt-2 flex justify-between items-center text-[10px] text-gray-400">
          <span>SysFarm v1.0 • Módulo Kardex de Inventario</span>
          <span>Impreso el: {new Date().toLocaleString("es-PE")}</span>
        </div>
      </div>
    </div>
  )
}
