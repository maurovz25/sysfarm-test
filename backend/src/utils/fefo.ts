export interface FefoBatch {
  id: string;
  fechaExpiracion: Date | string;
  stockActual: number;
  deletedAt?: Date | null;
}

export interface FefoAllocation<T extends FefoBatch> {
  batch: T;
  quantity: number;
}

export class InsufficientFefoStockError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`INSUFFICIENT_STOCK:${required}:${available}`);
    this.name = "InsufficientFefoStockError";
  }
}

/** Plans a deterministic FEFO allocation over active batches with positive stock.
 * Expired dates are intentionally not filtered here because the current product
 * behavior flags them in the UI but does not block their dispatch.
 */
export function planFefoAllocation<T extends FefoBatch>(
  batches: readonly T[],
  required: number,
): FefoAllocation<T>[] {
  if (!Number.isInteger(required) || required < 0) {
    throw new RangeError("Required quantity must be a non-negative integer");
  }
  if (required === 0) return [];

  const eligible = batches
    .map((batch, index) => ({ batch, index }))
    .filter(({ batch }) => batch.deletedAt == null && batch.stockActual > 0)
    .sort((a, b) => {
      const byExpiry = new Date(a.batch.fechaExpiracion).getTime() - new Date(b.batch.fechaExpiracion).getTime();
      const byId = a.batch.id < b.batch.id ? -1 : a.batch.id > b.batch.id ? 1 : a.index - b.index;
      return byExpiry || byId;
    });

  const available = eligible.reduce((sum, { batch }) => sum + batch.stockActual, 0);
  if (available < required) throw new InsufficientFefoStockError(required, available);

  let remaining = required;
  const allocations: FefoAllocation<T>[] = [];
  for (const { batch } of eligible) {
    if (remaining === 0) break;
    const quantity = Math.min(remaining, batch.stockActual);
    allocations.push({ batch, quantity });
    remaining -= quantity;
  }
  return allocations;
}
