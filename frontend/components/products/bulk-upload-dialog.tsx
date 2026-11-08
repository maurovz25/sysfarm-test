"use client"

import { useState, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    UploadSimple as Upload,
    FileXls as FileSpreadsheet,
    WarningCircle as AlertCircle,
    CheckCircle as CheckCircle2,
    CircleNotch as Loader2,
    X,
    DownloadSimple as Download,
    Warning as AlertTriangle,
    ShieldWarning as ShieldAlert
} from "@phosphor-icons/react"
import { api } from "@/lib/api"
import * as XLSX from "xlsx"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface BulkUploadDialogProps {
    onSuccess: () => void
}

export function BulkUploadDialog({ onSuccess }: BulkUploadDialogProps) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [validationResult, setValidationResult] = useState<any | null>(null)
    const [progress, setProgress] = useState(0)
    const [processedCount, setProcessedCount] = useState({ created: 0, updated: 0, batches: 0 })
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<any | null>(null)
    const [activeSection, setActiveSection] = useState<"none" | "collisions" | "duplicates" | "errors" | "warnings" | "stock" | "costs" | "exp" | "names" | "newBatches">("none")
    const fileInputRef = useRef<HTMLInputElement>(null)

    const downloadTemplate = () => {
        const templateData = [
            {
                GTIN: "7891234567890",
                Nombre: "PARACETAMOL 500MG TAB",
                Tipo: "Medicamento",
                RS: "EE-12345",
                Laboratorio: "LABORATORIO PERU",
                Presentacion: "Caja",
                Cantidad_x_Pres: 100,
                Unidad_Base: "Tableta",
                Stock_Min: 10,
                Lote_Inicial: "LOTE1001",
                Expiracion: "2026-12-31",
                Stock_Inicial: 500,
                Precio_Costo_Pres: 25.50,
                Precio_Venta_Pres: 40.00
            },
            {
                GTIN: "7899876543210",
                Nombre: "IBUPROFENO 400MG TAB",
                Tipo: "Medicamento",
                RS: "EE-67890",
                Laboratorio: "FARMA PERU",
                Presentacion: "Blister",
                Cantidad_x_Pres: 10,
                Unidad_Base: "Tableta",
                Stock_Min: 5,
                Lote_Inicial: "LOTE2002",
                Expiracion: "2027-06-30",
                Stock_Inicial: 100,
                Precio_Costo_Pres: 5.00,
                Precio_Venta_Pres: 8.50
            }
        ]

        const ws = XLSX.utils.json_to_sheet(templateData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla Carga")

        ws['!cols'] = [
            { wch: 15 }, // GTIN
            { wch: 30 }, // Nombre
            { wch: 15 }, // Tipo
            { wch: 15 }, // RS
            { wch: 20 }, // Laboratorio
            { wch: 15 }, // Presentacion
            { wch: 15 }, // Cantidad_x_Pres
            { wch: 15 }, // Unidad_Base
            { wch: 12 }, // Stock_Min
            { wch: 15 }, // Lote_Inicial
            { wch: 15 }, // Expiracion
            { wch: 12 }, // Stock_Inicial
            { wch: 18 }, // Precio_Costo_Pres
            { wch: 18 }  // Precio_Venta_Pres
        ]

        XLSX.writeFile(wb, "PLANTILLA_CARGA_MASIVA_SYSFARM.xlsx")
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const droppedFile = e.dataTransfer.files?.[0]
        if (droppedFile) {
            const isExcel = droppedFile.name.endsWith('.xlsx') ||
                droppedFile.name.endsWith('.xls') ||
                droppedFile.name.endsWith('.csv')

            if (isExcel) {
                setFile(droppedFile)
                setError(null)
                parseFile(droppedFile)
            } else {
                setError("Por favor, sube un archivo Excel o CSV válido.")
            }
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setError(null)
            parseFile(selectedFile)
        }
    }

    const parseFile = (file: File) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer
                const data = new Uint8Array(arrayBuffer)
                const wb = XLSX.read(data, { type: "array" })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]

                const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

                if (rawRows.length === 0) {
                    setError("El archivo parece estar vacío.")
                    setData([])
                    return
                }

                const firstRow = rawRows[0] || []
                const expectedHeaders = [
                    "GTIN", "Nombre", "Tipo", "RS", "Laboratorio",
                    "Presentacion", "Cantidad_x_Pres", "Unidad_Base", "Stock_Min",
                    "Lote_Inicial", "Expiracion", "Stock_Inicial",
                    "Precio_Costo_Pres", "Precio_Venta_Pres"
                ]

                const isHeaderRow = firstRow.some(cell =>
                    typeof cell === 'string' &&
                    ["GTIN", "NOMBRE", "LOTE", "STOCK"].some(key => cell.toUpperCase().includes(key))
                )

                const rawItems = (isHeaderRow ? XLSX.utils.sheet_to_json(ws) : rawRows.map(row => {
                    const obj: any = {}
                    expectedHeaders.forEach((header, index) => {
                        obj[header] = row[index]
                    })
                    return obj
                }).filter(row => row.GTIN || row.Nombre))

                const normalizedData = rawItems.map((row: any) => {
                    const getCol = (...keys: string[]) => {
                        for (const k of keys) {
                            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k]
                        }
                        return undefined
                    }

                    const rawGtin = getCol("GTIN", "gtin", "Codigo", "Código", "CodigoBarras", "Código de Barras")
                    const rawNombre = getCol("Nombre", "nombre", "Producto", "PRODUCTO", "Descripcion", "Descripción")
                    const rawTipo = getCol("Tipo", "tipo", "TIPO")
                    const rawRS = getCol("RS", "R.S.", "rs", "RegistroSanitario", "Registro Sanitario")
                    const rawLab = getCol("Laboratorio", "laboratorio", "Lab", "LAB")
                    const rawPres = getCol("Presentacion", "Presentación", "presentacion", "presentación")
                    const rawCantPres = getCol("Cantidad_x_Pres", "Cantidad x Pres", "Cantidad por Presentación", "Cant_Pres", "Factor")
                    const rawUB = getCol("Unidad_Base", "Unidad Base", "unidad_base", "Unidad")
                    const rawStockMin = getCol("Stock_Min", "Stock Mínimo", "Stock Minimo", "stock_min", "Stock Min")
                    const rawLote = getCol("Lote_Inicial", "Lote", "lote", "LOTE", "Lote Inicial")
                    const rawExp = getCol("Expiracion", "Expiración", "expiracion", "expiración", "EXP", "Vencimiento")
                    const rawStock = getCol("Stock_Inicial", "Stock Total", "Stock", "stock", "STOCK", "Stock Inicial")
                    const rawPCosto = getCol("Precio_Costo_Pres", "Precio Costo (Pres)", "Precio Costo Pres", "Costo Pres", "precio_costo_pres")
                    const rawPVenta = getCol("Precio_Venta_Pres", "Precio Venta (Pres)", "Precio Venta Pres", "Venta Pres", "precio_venta_pres")

                    // Sanitizar expiración si viene numérica de Excel
                    let expVal = rawExp
                    if (typeof expVal === 'number') {
                        const date = new Date((expVal - 25569) * 86400 * 1000)
                        date.setUTCHours(12, 0, 0, 0)
                        expVal = date.toISOString().split('T')[0]
                    }

                    // Convertir GTIN si viene en notación científica o con decimales
                    let gtinVal = rawGtin !== undefined && rawGtin !== null ? String(rawGtin).trim() : ""
                    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(gtinVal)) {
                        try {
                            const num = Number(rawGtin)
                            if (!isNaN(num)) gtinVal = BigInt(Math.round(num)).toString()
                        } catch (_) { }
                    }
                    if (gtinVal.endsWith('.0')) gtinVal = gtinVal.slice(0, -2)

                    return {
                        GTIN: gtinVal,
                        Nombre: rawNombre,
                        Tipo: rawTipo || "Medicamento",
                        RS: rawRS,
                        Laboratorio: rawLab,
                        Presentacion: rawPres || "Caja",
                        Cantidad_x_Pres: rawCantPres !== undefined ? Number(rawCantPres) : 1,
                        Unidad_Base: rawUB || "Unidad",
                        Stock_Min: rawStockMin !== undefined ? Number(rawStockMin) : 0,
                        Lote_Inicial: rawLote ? String(rawLote).trim() : undefined,
                        Expiracion: expVal,
                        Stock_Inicial: rawStock !== undefined ? Number(rawStock) : 0,
                        Precio_Costo_Pres: rawPCosto !== undefined ? Number(rawPCosto) : 0,
                        Precio_Venta_Pres: rawPVenta !== undefined ? Number(rawPVenta) : 0,
                    }
                })

                if (normalizedData.length === 0) {
                    setError("No se detectaron datos válidos en el archivo.")
                    setData([])
                    return
                }

                const firstItem = normalizedData[0]
                const crucialMissing = ["GTIN", "Nombre", "Lote_Inicial", "Stock_Inicial"].filter(col => firstItem[col as keyof typeof firstItem] === undefined)

                if (crucialMissing.length > 0) {
                    setError(`Formato no reconocido. Faltan columnas cruciales: ${crucialMissing.join(", ")}`)
                    setData([])
                    return
                }

                setData(normalizedData)
                setError(null)
                validateWithServer(normalizedData)
            } catch (err) {
                console.error("Error parsing file:", err)
                setError("Error al procesar el archivo. Asegúrate de que sea un Excel o CSV válido.")
            }
        }
        reader.onerror = () => {
            setError("Error al leer el archivo desde el disco.")
        }
        reader.readAsArrayBuffer(file)
    }

    const validateWithServer = async (items: any[]) => {
        try {
            setIsLoading(true)
            setError(null)
            const result = await api.post("/products/bulk/validate", items)
            setValidationResult(result)
            if (result.rowErrors && result.rowErrors.length > 0) {
                setActiveSection("errors")
            }
        } catch (err: any) {
            console.error("Validation error:", err)
            setError(err.response?.data?.error || err.message || "Error al validar el archivo con el servidor.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpload = async () => {
        if (data.length === 0) return
        if (validationResult?.rowErrors && validationResult.rowErrors.length > 0) {
            setError(`El archivo contiene ${validationResult.rowErrors.length} errores. Debes corregirlos antes de subir.`)
            return
        }

        try {
            setIsLoading(true)
            setError(null)
            setProgress(0)

            const CHUNK_SIZE = 50
            let totalCreated = 0
            let totalUpdated = 0
            let totalBatches = 0

            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE)
                const response = await api.post("/products/bulk", { items: chunk })

                totalCreated += response.createdCount || 0
                totalUpdated += response.updatedCount || 0
                totalBatches += response.batchCount || 0

                const currentProgress = Math.min(Math.round(((i + chunk.length) / data.length) * 100), 100)
                setProgress(currentProgress)
            }

            setProcessedCount({ created: totalCreated, updated: totalUpdated, batches: totalBatches })
            setSuccess({ createdCount: totalCreated, updatedCount: totalUpdated, batchCount: totalBatches })
            onSuccess()
        } catch (err: any) {
            console.error("Upload error:", err)
            setError(err.response?.data?.error || err.message || "Error al subir los datos. Verifica el formato de tu archivo.")
        } finally {
            setIsLoading(false)
        }
    }

    const reset = () => {
        setFile(null)
        setData([])
        setSuccess(null)
        setValidationResult(null)
        setError(null)
        setActiveSection("none")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const hasErrors = validationResult?.rowErrors && validationResult.rowErrors.length > 0

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val)
            if (!val) reset()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Carga Masiva
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pr-6 border-b pb-3">
                    <div>
                        <DialogTitle className="text-xl">Carga Masiva de Productos y Lotes</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                            Sube un archivo Excel (.xlsx, .xls) o CSV. El sistema creará nuevos productos o actualizará los existentes.
                        </DialogDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 text-xs border-green-600 text-green-700 hover:bg-green-50">
                        <Download className="h-3.5 w-3.5" />
                        Plantilla Oficial (.xlsx)
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                    {!file && (
                        <div
                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${isDragging
                                    ? "border-primary bg-primary/5 scale-[1.02]"
                                    : "border-muted-foreground/25 hover:border-primary/50"
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                            <p className="text-lg font-medium">Haz clic o arrastra para subir tu archivo Excel</p>
                            <p className="text-sm text-muted-foreground mt-2">Formatos soportados: .xlsx, .xls, .csv</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    {file && !success && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-md border">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                                    <div>
                                        <p className="font-medium text-sm">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB • {data.length} filas detectadas</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={reset} disabled={isLoading}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {isLoading && (
                                <div className="space-y-2 py-4">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>Procesando datos...</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground italic">
                                        No cierres esta ventana hasta que finalice la carga.
                                    </p>
                                </div>
                            )}

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error de Procesamiento</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {hasErrors && (
                                <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
                                    <ShieldAlert className="h-5 w-5 text-red-600" />
                                    <AlertTitle className="font-bold">Rollback Total Activo: Errores Detectados ({validationResult.rowErrors.length})</AlertTitle>
                                    <AlertDescription className="text-xs mt-1">
                                        Se han encontrado errores de formato o lógica en tu Excel. El botón de confirmación está bloqueado hasta que los corrijas en tu archivo y vuelvas a subirlo.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {validationResult && (() => {
                                const diff = validationResult.diffSummary || {}
                                const totales = diff.totales || {}

                                return (
                                    <div className="space-y-4">
                                            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                                                {/* 1. Errores */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "errors" ? "none" : "errors")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "errors"
                                                            ? "bg-red-200 border-red-400 ring-2 ring-red-300"
                                                            : validationResult.rowErrors?.length > 0
                                                                ? "bg-red-100 border-red-300 animate-pulse"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-red-700">{validationResult.rowErrors?.length || 0}</p>
                                                    <p className="text-[9px] uppercase font-bold text-red-600">Errores</p>
                                                </button>

                                                {/* 2. Cambios de Stock */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "stock" ? "none" : "stock")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "stock"
                                                            ? "bg-emerald-200 border-emerald-400 ring-2 ring-emerald-300"
                                                            : (totales.stockCount || 0) > 0
                                                                ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/60"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-emerald-700">{totales.stockCount || 0}</p>
                                                    <p className="text-[9px] uppercase font-semibold text-emerald-700">📦 Ajustes Stock</p>
                                                </button>

                                                {/* 3. Cambios de Costo */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "costs" ? "none" : "costs")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "costs"
                                                            ? "bg-amber-200 border-amber-400 ring-2 ring-amber-300"
                                                            : (totales.costCount || 0) > 0
                                                                ? "bg-amber-50 border-amber-200 hover:bg-amber-100/60"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-amber-700">{totales.costCount || 0}</p>
                                                    <p className="text-[9px] uppercase font-semibold text-amber-700">💲 Ajustes Costo</p>
                                                </button>

                                                {/* 4. Fechas de Expiración */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "exp" ? "none" : "exp")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "exp"
                                                            ? "bg-purple-200 border-purple-400 ring-2 ring-purple-300"
                                                            : (totales.expCount || 0) > 0
                                                                ? "bg-purple-50 border-purple-200 hover:bg-purple-100/60"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-purple-700">{totales.expCount || 0}</p>
                                                    <p className="text-[9px] uppercase font-semibold text-purple-700">📅 Expiraciones</p>
                                                </button>

                                                {/* 5. Nombres Corregidos */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "names" ? "none" : "names")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "names"
                                                            ? "bg-sky-200 border-sky-400 ring-2 ring-sky-300"
                                                            : (totales.nameCount || 0) > 0
                                                                ? "bg-sky-50 border-sky-200 hover:bg-sky-100/60"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-sky-700">{totales.nameCount || 0}</p>
                                                    <p className="text-[9px] uppercase font-semibold text-sky-700">🏷️ Nombres</p>
                                                </button>

                                                {/* 6. Nuevos Lotes / Productos */}
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSection(activeSection === "newBatches" ? "none" : "newBatches")}
                                                    className={`p-2 rounded-lg text-center border transition-all ${activeSection === "newBatches"
                                                            ? "bg-blue-200 border-blue-400 ring-2 ring-blue-300"
                                                            : (totales.newLotesCount || 0) > 0
                                                                ? "bg-blue-50 border-blue-200 hover:bg-blue-100/60"
                                                                : "bg-gray-50 border-gray-200 opacity-60"
                                                        }`}
                                                >
                                                    <p className="text-lg font-bold text-blue-700">
                                                        {(totales.newLotesCount || 0) + (validationResult.newProducts || 0)}
                                                    </p>
                                                    <p className="text-[9px] uppercase font-semibold text-blue-700">➕ Nuevos</p>
                                                </button>
                                            </div>

                                            {/* Detalle de Errores Bloqueantes */}
                                            {activeSection === "errors" && validationResult.rowErrors && (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-red-900 flex items-center gap-2">
                                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                                            Detalle de Errores por Fila (Debes corregirlos en Excel):
                                                        </p>
                                                        <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold">
                                                            {validationResult.rowErrors.length} errores
                                                        </span>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y divide-red-100">
                                                        {validationResult.rowErrors.map((errItem: any, idx: number) => (
                                                            <div key={idx} className="p-2 flex items-start justify-between gap-4 hover:bg-red-50/50">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-red-600 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                                        Fila {errItem.row}
                                                                    </span>
                                                                    <span className="font-semibold text-foreground">{errItem.field}:</span>
                                                                    <span className="text-red-700">{errItem.error}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalle de Cambios de Stock */}
                                            {activeSection === "stock" && diff.cambiosStock && (
                                                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-emerald-900">📦 Detalle de Ajustes de Stock a Aplicar:</p>
                                                        <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                                            {diff.cambiosStock.length} lotes
                                                        </span>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y">
                                                        {diff.cambiosStock.map((item: any, idx: number) => (
                                                            <div key={idx} className="p-2 flex items-center justify-between gap-4 hover:bg-emerald-50/30">
                                                                <div>
                                                                    <p className="font-medium text-foreground">{item.nombre}</p>
                                                                    <p className="text-[10px] font-mono text-muted-foreground">GTIN: {item.gtin} | Lote: <strong className="text-foreground">{item.lote}</strong></p>
                                                                </div>
                                                                <div className="text-right whitespace-nowrap">
                                                                    <span className="text-muted-foreground line-through mr-2">{item.stockAnterior}</span>
                                                                    <span className="font-bold text-emerald-700">{item.stockNuevo}</span>
                                                                    <span className={`text-[10px] ml-1.5 font-bold ${item.diferencia > 0 ? "text-green-600" : "text-amber-600"}`}>
                                                                        ({item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalle de Cambios de Costo */}
                                            {activeSection === "costs" && diff.cambiosCosto && (
                                                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-amber-900">💲 Detalle de Modificaciones en Precio de Costo (Pres):</p>
                                                        <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold">
                                                            {diff.cambiosCosto.length} lotes
                                                        </span>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y">
                                                        {diff.cambiosCosto.map((item: any, idx: number) => (
                                                            <div key={idx} className="p-2 flex items-center justify-between gap-4 hover:bg-amber-50/30">
                                                                <div>
                                                                    <p className="font-medium text-foreground">{item.nombre}</p>
                                                                    <p className="text-[10px] font-mono text-muted-foreground">GTIN: {item.gtin} | Lote: <strong className="text-foreground">{item.lote}</strong></p>
                                                                </div>
                                                                <div className="text-right whitespace-nowrap">
                                                                    <span className="text-muted-foreground line-through mr-2">S/ {Number(item.costoAnterior).toFixed(2)}</span>
                                                                    <span className="font-bold text-amber-700">S/ {Number(item.costoNuevo).toFixed(2)}</span>
                                                                    <span className="text-[10px] ml-1.5 font-bold text-amber-600">
                                                                        ({item.diferencia >= 0 ? `+S/ ${item.diferencia.toFixed(2)}` : `-S/ ${Math.abs(item.diferencia).toFixed(2)}`})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalle de Fechas de Expiración */}
                                            {activeSection === "exp" && diff.cambiosExpiracion && (
                                                <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4 space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-purple-900">📅 Detalle de Fechas de Expiración Modificadas:</p>
                                                        <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold">
                                                            {diff.cambiosExpiracion.length} lotes
                                                        </span>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y">
                                                        {diff.cambiosExpiracion.map((item: any, idx: number) => (
                                                            <div key={idx} className="p-2 flex items-center justify-between gap-4 hover:bg-purple-50/30">
                                                                <div>
                                                                    <p className="font-medium text-foreground">{item.nombre}</p>
                                                                    <p className="text-[10px] font-mono text-muted-foreground">GTIN: {item.gtin} | Lote: <strong className="text-foreground">{item.lote}</strong></p>
                                                                </div>
                                                                <div className="text-right whitespace-nowrap font-mono text-xs">
                                                                    <span className="text-muted-foreground line-through mr-2">{item.expAnterior}</span>
                                                                    <span className="font-bold text-purple-700">{item.expNuevo}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalle de Nombres Corregidos */}
                                            {activeSection === "names" && diff.cambiosNombre && (
                                                <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-4 space-y-2 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-sky-900">🏷️ Detalle de Nombres de Producto Actualizados:</p>
                                                        <span className="text-[10px] bg-sky-200 text-sky-800 px-2 py-0.5 rounded font-bold">
                                                            {diff.cambiosNombre.length} productos
                                                        </span>
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y">
                                                        {diff.cambiosNombre.map((item: any, idx: number) => (
                                                            <div key={idx} className="p-2 space-y-1 hover:bg-sky-50/30">
                                                                <p className="text-[10px] font-mono text-muted-foreground">GTIN: {item.gtin}</p>
                                                                <p className="text-xs text-muted-foreground line-through">{item.nombreAnterior}</p>
                                                                <p className="text-xs font-bold text-sky-800">➔ {item.nombreNuevo}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Detalle de Nuevos Lotes */}
                                            {activeSection === "newBatches" && (
                                                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-2 text-left">
                                                    <p className="text-xs font-bold text-blue-900">➕ Detalle de Nuevos Lotes a Registrar:</p>
                                                    {(diff.lotesNuevos || []).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic">No hay nuevos lotes en este archivo (todos son actualizaciones de lotes existentes).</p>
                                                    ) : (
                                                        <div className="max-h-48 overflow-y-auto border rounded bg-white text-xs divide-y">
                                                            {(diff.lotesNuevos || []).map((item: any, idx: number) => (
                                                                <div key={idx} className="p-2 flex items-center justify-between gap-4 hover:bg-blue-50/30">
                                                                    <div>
                                                                        <p className="font-medium text-foreground">{item.nombre}</p>
                                                                        <p className="text-[10px] font-mono text-muted-foreground">GTIN: {item.gtin} | Lote: <strong className="text-blue-700">{item.lote}</strong></p>
                                                                    </div>
                                                                    <div className="text-right whitespace-nowrap">
                                                                        <p className="font-bold text-xs">{item.stock} unidades</p>
                                                                        <p className="text-[10px] text-muted-foreground">Costo: S/ {Number(item.costo || 0).toFixed(2)}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )
                            })()}

                            {data.length > 0 && (
                                <div className="border rounded-md overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50 sticky top-0">
                                            <TableRow>
                                                <TableHead className="w-[100px]">GTIN</TableHead>
                                                <TableHead className="min-w-[150px]">Nombre</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>RS</TableHead>
                                                <TableHead>Lab.</TableHead>
                                                <TableHead>Pres.</TableHead>
                                                <TableHead className="text-right">#</TableHead>
                                                <TableHead>U. Base</TableHead>
                                                <TableHead className="text-right">Min</TableHead>
                                                <TableHead>Lote</TableHead>
                                                <TableHead>Expiración</TableHead>
                                                <TableHead className="text-right">Stock</TableHead>
                                                <TableHead className="text-right whitespace-nowrap">P.C. Pres</TableHead>
                                                <TableHead className="text-right whitespace-nowrap">P.V. Pres</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.slice(0, 5).map((row, idx) => {
                                                let dateStr = row.Expiracion
                                                if (typeof row.Expiracion === 'number') {
                                                    const date = new Date((row.Expiracion - 25569) * 86400 * 1000)
                                                    date.setUTCHours(12, 0, 0, 0)
                                                    dateStr = date.toISOString().split('T')[0]
                                                }

                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-mono text-[10px]">{row.GTIN || '-'}</TableCell>
                                                        <TableCell className="font-medium truncate max-w-[120px] text-xs">{row.Nombre}</TableCell>
                                                        <TableCell className="text-[10px]">{row.Tipo || 'Medicamento'}</TableCell>
                                                        <TableCell className="text-[10px]">{row.RS || '-'}</TableCell>
                                                        <TableCell className="text-[10px]">{row.Laboratorio || '-'}</TableCell>
                                                        <TableCell className="text-[10px]">{row.Presentacion || 'Caja'}</TableCell>
                                                        <TableCell className="text-right text-[10px]">{row.Cantidad_x_Pres || 1}</TableCell>
                                                        <TableCell className="text-[10px]">{row.Unidad_Base || 'Unidad'}</TableCell>
                                                        <TableCell className="text-right text-[10px]">{row.Stock_Min || 0}</TableCell>
                                                        <TableCell className="text-[10px] font-mono">{row.Lote_Inicial || '-'}</TableCell>
                                                        <TableCell className="text-[10px] whitespace-nowrap">{dateStr || '-'}</TableCell>
                                                        <TableCell className="text-right text-xs font-bold">{row.Stock_Inicial || 0}</TableCell>
                                                        <TableCell className="text-right text-xs">S/ {Number(row.Precio_Costo_Pres || 0).toFixed(2)}</TableCell>
                                                        <TableCell className="text-right text-xs text-green-600 font-medium">S/ {Number(row.Precio_Venta_Pres || 0).toFixed(2)}</TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                            {data.length > 5 && (
                                                <TableRow>
                                                    <TableCell colSpan={14} className="text-center text-muted-foreground text-[10px] py-3">
                                                        Y {data.length - 5} filas más...
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                        </div>
                    )}

                    {success && (
                        <div className="text-center py-8 space-y-4">
                            <div className="bg-green-100 text-green-700 h-16 w-16 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold">¡Carga Masiva Completada!</h3>
                            <div className="bg-muted/50 rounded-lg p-6 max-w-sm mx-auto grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-primary">{success.createdCount}</p>
                                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Nuevos</p>
                                </div>
                                <div className="text-center border-x">
                                    <p className="text-2xl font-bold text-primary">{success.updatedCount}</p>
                                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Act.</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-primary">{success.batchCount}</p>
                                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Lotes</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">Todos los registros se han procesado correctamente.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    {!success ? (
                        <>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={data.length === 0 || isLoading || !!error || hasErrors}
                                className={`gap-2 ${hasErrors ? "bg-red-600 hover:bg-red-700 cursor-not-allowed opacity-80" : ""}`}
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {hasErrors ? "Carga Bloqueada (Errores)" : "Confirmar Carga"}
                            </Button>
                        </>
                    ) : (
                        <Button className="w-full" onClick={() => setOpen(false)}>
                            Finalizar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
