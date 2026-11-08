/**
 * Utilitarios de manejo y formateo de números en el frontend de SysFarm.
 * Aplica agrupación de miles con coma (,) cada 3 dígitos para legibilidad visual.
 */

export interface FormatNumberOptions {
  decimals?: number;
  fallback?: string;
}

/**
 * Formatea un número o representación string de un número insertando comas cada 3 dígitos.
 * Ejemplo: 1000 -> "1,000", 1000000 -> "1,000,000"
 */
export function formatNumber(
  val: number | string | null | undefined,
  options?: FormatNumberOptions
): string {
  const fallback = options?.fallback ?? "0";
  if (val === null || val === undefined || val === "") return fallback;

  const num = typeof val === "number" ? val : Number(val);
  if (isNaN(num)) return fallback;

  if (options?.decimals !== undefined) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    }).format(num);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(num);
}

/**
 * Formatea cantidades enteras de inventario, stock o movimientos con separador de miles por comas.
 * Ejemplo: 1500 -> "1,500"
 */
export function formatQuantity(
  val: number | string | null | undefined,
  fallback: string = "0"
): string {
  return formatNumber(val, { decimals: 0, fallback });
}

/**
 * Formatea montos monetarios con símbolo de moneda y 2 decimales.
 * Ejemplo: 1234.5 -> "S/ 1,234.50"
 */
export function formatCurrency(
  val: number | string | null | undefined,
  currencySymbol: string = "S/"
): string {
  const formattedVal = formatNumber(val, { decimals: 2, fallback: "0.00" });
  return `${currencySymbol} ${formattedVal}`;
}

/**
 * Remueve comas de un string numérico formateado para convertirlo a number puro.
 */
export function parseFormattedNumber(val: string): number {
  if (!val) return 0;
  const cleanStr = String(val).replace(/,/g, "");
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}
