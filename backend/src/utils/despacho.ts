// Guardas de concurrencia del despacho (caso R-01: dos despachos simultáneos del mismo requerimiento).
// La exclusión la da PostgreSQL: un UPDATE condicionado bloquea la fila y el segundo, al reevaluar
// la condición tras el commit del primero, ya no la cumple y actualiza 0 filas.

export class RequerimientoYaAtendidoError extends Error {
  constructor(public readonly requerimientoId: string) {
    super('El requerimiento ya fue atendido por otro despacho');
    this.name = 'RequerimientoYaAtendidoError';
  }
}

export class StockCambiadoError extends Error {
  constructor(public readonly batchId: string) {
    super('El stock del lote cambió durante el despacho; vuelva a intentarlo');
    this.name = 'StockCambiadoError';
  }
}

type UpdateMany = (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
export interface DespachoTx {
  requerimiento: { updateMany: UpdateMany };
  batch: { updateMany: UpdateMany };
}

/** Pasa el requerimiento de PENDIENTE a DESPACHADO solo si sigue PENDIENTE; si otro despacho lo tomó, lanza error. */
export async function reservarRequerimiento(tx: DespachoTx, id: string, atendidoPor: string, ahora = new Date()) {
  const r = await tx.requerimiento.updateMany({
    where: { id, estado: 'PENDIENTE' },
    data: { estado: 'DESPACHADO', atendidoPor, fechaAtencion: ahora },
  });
  if (r.count === 0) throw new RequerimientoYaAtendidoError(id);
}

/** Descuenta del lote solo si aún tiene el saldo necesario; evita saldos negativos por despachos concurrentes. */
export async function descontarLote(tx: DespachoTx, batchId: string, cantidad: number) {
  const r = await tx.batch.updateMany({
    where: { id: batchId, stockActual: { gte: cantidad } },
    data: { stockActual: { decrement: cantidad } },
  });
  if (r.count === 0) throw new StockCambiadoError(batchId);
}
