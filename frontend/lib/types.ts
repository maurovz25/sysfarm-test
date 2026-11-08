export type TipoProducto = "Medicamento" | "Dispositivo Médico"
export type TipoPresentacion = "Caja" | "Blister" | "Unidad" | "Frasco" | "Botella" | "Sobre" | "Ampolla"
export type TipoUnidad = "presentacion" | "unidad"

export interface Product {
  id: string
  productId?: string // ID del producto padre (si es un lote aplanado)
  codigoBarras: string // GTIN - código de barras
  nombre: string
  descripcionCorta?: string
  tipo: TipoProducto // "Medicamento" | "Insumo"
  lote?: string
  fechaExpiracion?: string // formato YYYY-MM-DD
  registroSanitario: string // R.S
  laboratorio: string // Nuevo campo Laboratorio
  presentacion: TipoPresentacion
  cantidadPorPresentacion: number // número de unidades contenidas en la presentación (ej: 10 tabletas por caja)
  unidadBase: TipoPresentacion // misma lista que presentación; por defecto "Unidad"
  // Stock: ÚNICA FUENTE DE VERDAD en unidades base (opcionales; si no se definen se guardan en 0)
  stockUnidad: number
  stockMinimo: number
  // Precios (opcionales; si no se definen se guardan en 0)
  precioCostoPresentacion: number
  precioVentaPresentacion: number
  precioCostoUnidad: number
  precioVentaUnidad: number
  // Metadata
  proveedor?: string
  batches?: any[]
  fechaCreacion: string
  ultimaActualizacion: string
}

export interface InventoryMovement {
  id: string
  productId?: string
  batchId?: string
  productoId: string
  productoNombre: string
  tipo: "Ingreso" | "Salida" | "Ajuste"
  // Cantidad y tipo de unidad
  cantidadPresentacion?: number // cantidad en presentaciones (ej: 5 cajas)
  cantidadUnidad: number // cantidad en unidades base (SIEMPRE almacenada)
  cantidadOriginal?: number // cantidad original firmada en backend (para ajustes)
  tipoUnidad: TipoUnidad // "presentacion" | "unidad"
  factorConversion?: number // cantidadPorPresentacion al momento del movimiento
  // Información del movimiento
  motivo: string
  lote?: string // lote del producto en este movimiento
  fechaExpiracion?: string // fecha de expiración del lote
  usuario: string
  fecha: string
  observaciones?: string
  // Campos para ingresos
  proveedorNombre?: string
  proveedorRuc?: string
  // Precios para cálculo de ventas (mapeados desde el producto actual)
  precioCostoUnidad?: number
  precioVentaPresentacion?: number
  precioVentaUnidad?: number
  // Campos para salidas (farmacia interna)
  departamento?: string // departamento que solicita (para farmacia interna)
  solicitante?: string // persona que solicita
  // Guías de salida para medicamentos controlados
  guiaSalida?: GuiaSalida
  guiasSalida?: GuiaSalida[]
}

export interface GuiaSalida {
  id: string
  codigo: string // Ej: GS-1, GS-2
  correlativo: number
  medicoAnestesiologo: string
  cmpMedico?: string | null
  paciente: string
  dniPaciente?: string | null
  direccionPaciente?: string | null
  distritoPaciente?: string | null
  numeroReceta: string
  fechaSalida: string
  fechaEmision: string
  medicamentoNombre: string
  loteCodigo?: string | null
  fechaVencimiento?: string | null
  cantidad: number
  unidadMedida?: string | null
  usuarioEmisor?: string | null
  movementId: string
  createdAt?: string
  updatedAt?: string
}

// Interfaz para ventas (futuro - venta al público)
export interface Venta {
  id: string
  fecha: string
  usuario: string
  total: number
  tipoComprobante?: string
  clienteNombre?: string
  clienteDocumento?: string
  detalles: DetalleVenta[]
}

export interface DetalleVenta {
  id: string
  ventaId: string
  productoId: string
  productoNombre: string
  cantidad: number
  tipoUnidad: TipoUnidad
  precioUnitario: number
  subtotal: number
  lote?: string
  fechaExpiracion?: string
}

export type EstadoRequerimiento = "PENDIENTE" | "DESPACHADO" | "RECHAZADO" | "CANCELADO"

export interface RequerimientoItem {
  id: string
  requerimientoId: string
  productId: string
  batchId?: string
  cantidadSolicitada: number
  cantidadAprobada?: number
  tipoUnidad: TipoUnidad
  observacion?: string
  product?: Product
  batch?: any
}

export interface Requerimiento {
  id: string
  codigo: string
  solicitante: string
  departamento: string
  estado: EstadoRequerimiento
  observaciones?: string
  atendidoPor?: string
  motivoRechazo?: string
  fechaAtencion?: string
  createdAt: string
  updatedAt: string
  items: RequerimientoItem[]
}

