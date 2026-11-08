import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { GuiaSalida } from "./types"
import { formatLocalDate, formatLocalDateTime } from "./date-utils"
import { formatQuantity } from "./number-utils"

async function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generarPdfGuiaSalida(
  guia: GuiaSalida,
  action: "download" | "print" = "download"
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  let currentY = 10

  // --- 1. ENCABEZADO INSTITUCIONAL ---
  const logoImg = await loadLogoImage("/logo_csc_1.png")

  if (logoImg) {
    // Logo Clínica San Clemente (proporción 512x195 -> 2.625)
    const logoWidth = 48
    const logoHeight = 18.28
    doc.addImage(logoImg, "PNG", margin, currentY, logoWidth, logoHeight)
  } else {
    // Fallback en caso de no cargar la imagen
    doc.setTextColor(17, 24, 39)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("CLÍNICA SAN CLEMENTE", margin, currentY + 10)
  }

  // Título institucional centrado exactamente en el medio de la cabecera
  doc.setFontSize(13.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 41, 55)
  doc.text("ÁREA DE FARMACIA", pageWidth / 2, currentY + 10.5, { align: "center" })

  // Recuadro de Código de Guía a la derecha
  const boxWidth = 48
  const boxHeight = 13
  const boxX = pageWidth - margin - boxWidth
  const boxY = currentY + 2.5

  doc.setDrawColor(31, 41, 55)
  doc.setLineWidth(0.4)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 1.5, 1.5, "FD")

  doc.setFontSize(6.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(75, 85, 99)
  doc.text("GUÍA DE SALIDA", boxX + boxWidth / 2, boxY + 4.2, { align: "center" })

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(6, 95, 70) // Emerald dark
  doc.text(guia.codigo, boxX + boxWidth / 2, boxY + 10, { align: "center" })

  currentY = 32

  // Línea divisoria
  doc.setDrawColor(31, 41, 55)
  doc.setLineWidth(0.5)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4

  // --- 2. TÍTULO PRINCIPAL ---
  doc.setFillColor(243, 244, 246)
  doc.setDrawColor(209, 213, 219)
  doc.setLineWidth(0.3)
  doc.rect(margin, currentY, contentWidth, 7, "FD")

  doc.setFontSize(9.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text("GUÍA DE SALIDA DE MEDICAMENTO CONTROLADO", pageWidth / 2, currentY + 4.8, { align: "center" })
  currentY += 10

  // --- 3. BLOQUE DE FECHAS ---
  const dateBoxHeight = 11
  const halfWidth = (contentWidth - 4) / 2

  // Caja 1: Fecha de Salida
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, currentY, halfWidth, dateBoxHeight, 1, 1, "FD")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(75, 85, 99)
  doc.text("Fecha y Hora de Salida del Medicamento:", margin + 3, currentY + 4)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text(formatLocalDateTime(guia.fechaSalida), margin + 3, currentY + 8.5)

  // Caja 2: Fecha de Emisión (Asegurando fill/draw color para evitar fondo negro)
  const dateBox2X = margin + halfWidth + 4
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.roundedRect(dateBox2X, currentY, halfWidth, dateBoxHeight, 1, 1, "FD")
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(75, 85, 99)
  doc.text("Fecha y Hora de Emisión de la Guía:", dateBox2X + 3, currentY + 4)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text(formatLocalDateTime(guia.fechaEmision), dateBox2X + 3, currentY + 8.5)

  currentY += dateBoxHeight + 5

  // --- 4. SECCIÓN 1: DATOS DE PRESCRIPCIÓN Y PACIENTE ---
  const sec1Height = 40
  doc.setFillColor(229, 231, 235) // Gris cabecera
  doc.setDrawColor(209, 213, 219)
  doc.roundedRect(margin, currentY, contentWidth, sec1Height, 1, 1, "D")

  // Barra de título de la sección
  doc.rect(margin, currentY, contentWidth, 5.5, "FD")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 41, 55)
  doc.text("1. DATOS DE PRESCRIPCIÓN MÉDICA Y PACIENTE", margin + 3, currentY + 4)

  // Contenido sección 1 (2 columnas)
  const contentStartY = currentY + 9

  // Fila 1: Médico Anestesiólogo y CMP
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(107, 114, 128)
  doc.text("Médico Anestesiólogo:", margin + 4, contentStartY)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.medicoAnestesiologo || "No especificado", margin + 4, contentStartY + 4)

  const colRightX = margin + contentWidth / 2 + 4
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text("CMP (Colegiatura Médica):", colRightX, contentStartY)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.cmpMedico ? `${guia.cmpMedico}` : "No especificado", colRightX, contentStartY + 4)

  // Fila 2: Paciente y DNI
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text("Paciente:", margin + 4, contentStartY + 9.5)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.paciente || "No especificado", margin + 4, contentStartY + 13.5)

  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text("Nº Documento:", colRightX, contentStartY + 9.5)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.dniPaciente ? `DNI: ${guia.dniPaciente}` : "No especificado", colRightX, contentStartY + 13.5)

  // Fila 3: Dirección y Distrito
  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text("Dirección Domiciliaria:", margin + 4, contentStartY + 18.5)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.direccionPaciente || "No especificada", margin + 4, contentStartY + 22.5)

  doc.setFontSize(7)
  doc.setTextColor(107, 114, 128)
  doc.text("Distrito:", colRightX, contentStartY + 18.5)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(guia.distritoPaciente || "No especificado", colRightX, contentStartY + 22.5)

  // Fila 4: Receta Médica (ancho completo)
  const recetaY = contentStartY + 25
  doc.setDrawColor(229, 231, 235)
  doc.line(margin + 2, recetaY, margin + contentWidth - 2, recetaY)

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(107, 114, 128)
  doc.text("Nº de Referencia de Receta Médica:", margin + 4, recetaY + 4)
  doc.setFontSize(8.5)
  doc.setTextColor(6, 78, 59)
  doc.text(guia.numeroReceta || "No especificado", margin + 49, recetaY + 4)

  currentY += sec1Height + 5

  // --- 5. SECCIÓN 2: DETALLE DEL MEDICAMENTO ENTREGADO ---
  // Barra de título
  doc.setFillColor(229, 231, 235)
  doc.setDrawColor(209, 213, 219)
  doc.rect(margin, currentY, contentWidth, 5.5, "FD")
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 41, 55)
  doc.text("2. DETALLE DEL MEDICAMENTO ENTREGADO", margin + 3, currentY + 4)
  currentY += 5.5

  const vencimientoStr = guia.fechaVencimiento ? formatLocalDate(guia.fechaVencimiento) : "-"
  const tableData = [
    [
      guia.medicamentoNombre,
      guia.loteCodigo || "-",
      vencimientoStr,
      guia.unidadMedida || "Unidad",
      `${formatQuantity(guia.cantidad)} unidad(es)`,
    ],
  ]

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["Medicamento", "Lote", "F. Vencimiento", "Presentación", "Cantidad Salida"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [249, 250, 251],
      textColor: [55, 65, 81],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left",
      lineColor: [209, 213, 219],
      lineWidth: 0.3,
    },
    bodyStyles: {
      textColor: [17, 24, 39],
      fontSize: 8,
      lineColor: [229, 231, 235],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 26, halign: "center" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
      4: {
        cellWidth: 32,
        fontStyle: "bold",
        textColor: [6, 95, 70],
        halign: "center",
      },
    },
  })

  // @ts-ignore autoTable attaches lastAutoTable
  currentY = (doc as any).lastAutoTable.finalY + 6

  // --- 6. CONSTANCIA / DECLARACIÓN LEGAL ---
  const constanciaHeight = 15
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(margin, currentY, contentWidth, constanciaHeight, 1, 1, "FD")

  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(31, 41, 55)
  doc.text("Constancia de Entrega y Recepción:", margin + 3, currentY + 4)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(75, 85, 99)
  const legalText =
    "Se emite la presente Guía de Salida para fines de control de estupefacientes y medicamentos fiscalizados. " +
    "El profesional médico receptor declara la recepción conforme del medicamento prescrito para el tratamiento exclusivo del paciente indicado."
  const splitLegalText = doc.splitTextToSize(legalText, contentWidth - 6)
  doc.text(splitLegalText, margin + 3, currentY + 8)

  // Separación amplia hacia la sección de firmas (ancladas elegantemente en la zona inferior de la hoja)
  currentY = Math.max(currentY + constanciaHeight + 48, 236)

  // --- 7. FIRMAS DE CONFORMIDAD ---
  const firmaBoxWidth = 65
  const firma1X = margin + 12
  const firma2X = pageWidth - margin - firmaBoxWidth - 12

  // Línea y textos de Firma 1 (Químico Farmacéutico)
  doc.setDrawColor(17, 24, 39)
  doc.setLineWidth(0.4)
  doc.line(firma1X, currentY, firma1X + firmaBoxWidth, currentY)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text("QUÍMICO FARMACÉUTICO", firma1X + firmaBoxWidth / 2, currentY + 4, { align: "center" })

  doc.setFontSize(6.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(75, 85, 99)
  doc.text("Responsable de Dispensación", firma1X + firmaBoxWidth / 2, currentY + 7.5, { align: "center" })
  doc.text(guia.usuarioEmisor || "Farmacia", firma1X + firmaBoxWidth / 2, currentY + 11, { align: "center" })

  // Línea y textos de Firma 2 (Médico Anestesiólogo)
  doc.line(firma2X, currentY, firma2X + firmaBoxWidth, currentY)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text("MÉDICO ANESTESIÓLOGO", firma2X + firmaBoxWidth / 2, currentY + 4, { align: "center" })

  doc.setFontSize(6.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(75, 85, 99)
  doc.text(`Receptor Conforme / CMP: ${guia.cmpMedico || "_________"}`, firma2X + firmaBoxWidth / 2, currentY + 7.5, { align: "center" })
  doc.text(guia.medicoAnestesiologo, firma2X + firmaBoxWidth / 2, currentY + 11, { align: "center" })

  // --- 8. PIE DE PÁGINA ---
  const footerY = 282
  doc.setDrawColor(209, 213, 219)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY, pageWidth - margin, footerY)

  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(55, 65, 81) // Color oscuro y bien legible
  doc.text("SysFarm • Sistema de Gestión Farmacéutica", margin, footerY + 4)
  doc.text(`Impreso el: ${formatLocalDateTime(new Date())}`, pageWidth - margin, footerY + 4, { align: "right" })

  const filename = `Guia_Salida_${guia.codigo}.pdf`

  // Ejecución de la acción
  if (action === "download") {
    doc.save(filename)
  } else {
    // Generar Blob URL e imprimir en ventana/iframe limpio
    const pdfBlob = doc.output("blob")
    const blobUrl = URL.createObjectURL(pdfBlob)

    const printWindow = window.open(blobUrl, "_blank")
    if (printWindow) {
      printWindow.focus()
    } else {
      // Fallback si el navegador bloquea popups: usar iframe temporal oculto
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      iframe.src = blobUrl
      document.body.appendChild(iframe)

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.error("Error al imprimir desde iframe:", e)
        }
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
          URL.revokeObjectURL(blobUrl)
        }, 60000)
      }
    }
  }
}
