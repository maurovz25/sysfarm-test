import type { Product, TipoUnidad } from "./types"

/**
 * Calcula las unidades base desde una cantidad de presentaciones
 * @param cantidadPresentacion Cantidad de presentaciones (ej: 5 cajas)
 * @param cantidadPorPresentacion Unidades por presentación (ej: 10 unidades por caja)
 * @returns Total de unidades base
 */
export function calcularUnidadesDesdePresentacion(
  cantidadPresentacion: number,
  cantidadPorPresentacion: number,
): number {
  return cantidadPresentacion * cantidadPorPresentacion
}

/**
 * Calcula el stock en presentaciones completas disponibles
 * SIEMPRE DERIVADO - nunca almacenado
 * @param stockUnidad Stock en unidades base
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns Número de presentaciones completas disponibles (ej: 2 cajas completas)
 */
export function calcularStockPresentacion(stockUnidad: number, cantidadPorPresentacion: number): number {
  return Math.floor(stockUnidad / cantidadPorPresentacion)
}

/**
 * Valida si se puede realizar una venta
 * @param stockUnidad Stock actual en unidades base
 * @param cantidad Cantidad solicitada
 * @param tipoUnidad Tipo de unidad ("presentacion" o "unidad")
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns true si se puede vender, false en caso contrario
 */
export function puedeVender(
  stockUnidad: number,
  cantidad: number,
  tipoUnidad: TipoUnidad,
  cantidadPorPresentacion: number,
): { puede: boolean; mensaje?: string } {
  if (tipoUnidad === "presentacion") {
    // Para venta por presentación:
    // 1. Debe haber al menos una caja completa disponible
    if (stockUnidad < cantidadPorPresentacion) {
      return {
        puede: false,
        mensaje: `No hay presentaciones completas disponibles. Stock actual: ${stockUnidad} ${stockUnidad === 1 ? "unidad" : "unidades"}`,
      }
    }
    // 2. Debe haber suficiente stock para la cantidad solicitada
    const unidadesNecesarias = cantidad * cantidadPorPresentacion
    if (stockUnidad < unidadesNecesarias) {
      return {
        puede: false,
        mensaje: `Stock insuficiente. Se necesitan ${unidadesNecesarias} unidades, disponibles: ${stockUnidad}`,
      }
    }
    return { puede: true }
  } else {
    // Para venta por unidad: solo verificar stock suficiente
    if (stockUnidad < cantidad) {
      return {
        puede: false,
        mensaje: `Stock insuficiente. Se solicitan ${cantidad} unidades, disponibles: ${stockUnidad}`,
      }
    }
    return { puede: true }
  }
}

/**
 * Aplica una venta y retorna el nuevo stock en unidades base
 * @param stockUnidad Stock actual en unidades base
 * @param cantidad Cantidad a vender
 * @param tipoUnidad Tipo de unidad ("presentacion" o "unidad")
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns Nuevo stock en unidades base
 */
export function aplicarVenta(
  stockUnidad: number,
  cantidad: number,
  tipoUnidad: TipoUnidad,
  cantidadPorPresentacion: number,
): number {
  const unidadesAVender = tipoUnidad === "presentacion" ? cantidad * cantidadPorPresentacion : cantidad
  return stockUnidad - unidadesAVender
}

/**
 * Calcula el precio por unidad base desde el precio de presentación
 * @param precioPresentacion Precio de la presentación
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns Precio por unidad base
 */
export function calcularPrecioUnidad(precioPresentacion: number, cantidadPorPresentacion: number): number {
  if (!cantidadPorPresentacion || cantidadPorPresentacion <= 0) return 0
  return precioPresentacion / cantidadPorPresentacion
}

/**
 * Calcula el precio de presentación desde el precio por unidad
 * @param precioUnidad Precio por unidad base
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns Precio de la presentación
 */
export function calcularPrecioPresentacion(precioUnidad: number, cantidadPorPresentacion: number): number {
  return precioUnidad * cantidadPorPresentacion
}

/**
 * Calcula el valor total del stock de un producto
 * @param stockUnidad Stock en unidades base
 * @param precioCostoUnidad Precio de costo por unidad
 * @returns Valor total del stock
 */
export function calcularTotalStock(stockUnidad: number, precioCostoUnidad: number): number {
  return stockUnidad * precioCostoUnidad
}

/**
 * Obtiene el stock en presentaciones y unidades sueltas
 * @param stockUnidad Stock total en unidades base
 * @param cantidadPorPresentacion Unidades por presentación
 * @returns Objeto con stock en presentaciones completas y unidades sueltas
 */
export function obtenerStockDesglosado(stockUnidad: number, cantidadPorPresentacion: number) {
  const stockPresentacion = calcularStockPresentacion(stockUnidad, cantidadPorPresentacion)
  const unidadesSueltas = stockUnidad % cantidadPorPresentacion
  return {
    stockPresentacion,
    unidadesSueltas,
    stockUnidad,
  }
}
