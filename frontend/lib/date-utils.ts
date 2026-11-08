/**
 * Utilitarios de manejo y formateo de fechas locales (UTC-5 / Perú)
 * Evita el desfase de 5 horas producido por la conversión automática a UTC mediante toISOString().
 */

/**
 * Retorna la representación YYYY-MM-DD en hora local real.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Opción A: Combina el año, mes y día de la fecha elegida (chosenDate)
 * con la hora, minutos y segundos del momento actual de registro.
 * Si no se pasa chosenDate, retorna la fecha y hora actuales.
 */
export function combineDateWithCurrentTime(chosenDate?: Date): Date {
  const now = new Date();
  if (!chosenDate) return now;

  return new Date(
    chosenDate.getFullYear(),
    chosenDate.getMonth(),
    chosenDate.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
}

/**
 * Formatea una fecha a string de solo fecha en formato local (dd/MM/yyyy).
 * Maneja correctamente strings de fecha ISO ("2029-11-30" o "2029-11-30T00:00:00.000Z")
 * evitando el desfase de zona horaria (UTC-5) para fechas de calendario.
 */
export function formatLocalDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";

  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/);
    if (isoDateMatch) {
      const [, year, month, day, hour, min, sec] = isoDateMatch;
      // Fechas sin hora o con medianoche UTC (00:00:00) o mediodía UTC (12:00:00)
      if (!hour || (hour === "00" && min === "00" && sec === "00") || (hour === "12" && min === "00" && sec === "00")) {
        return `${day}/${month}/${year}`;
      }
    }
  }

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formatea específicamente fechas de expiración o vencimiento (dd/MM/yyyy).
 * Las fechas de vencimiento son de calendario puro (no tienen hora relevante).
 */
export function formatExpirationDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }
  return formatLocalDate(dateInput);
}

/**
 * Formatea una fecha a string de fecha y hora en formato local sin segundos (dd/MM/yyyy HH:mm).
 */
export function formatLocalDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Retorna únicamente la parte de hora en formato local (HH:mm).
 */
export function formatLocalTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Comprueba si una fecha dada es válida (hasta maxDaysInFuture días en el futuro).
 * Retorna true si la fecha es válida, false si supera el límite de futuro.
 */
export function isDateWithinFutureLimit(date: Date, maxDaysInFuture: number = 3): boolean {
  const now = new Date();
  const limitDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + maxDaysInFuture,
    23,
    59,
    59,
    999
  );
  return date <= limitDate;
}
