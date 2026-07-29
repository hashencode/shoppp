export interface ReserveInventoryInput {
  readonly cartId?: string;
  readonly checkoutAttemptId?: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly quantity: number;
  readonly variantId: string;
  readonly warehouseId: string;
}

export interface InventoryReservationRecord {
  readonly expiresAt: string;
  readonly id: string;
  readonly quantity: number;
  readonly status: "active";
  readonly variantId: string;
  readonly warehouseId: string;
}

export class InsufficientInventoryError extends Error {
  constructor() {
    super("The requested inventory is no longer available.");
    this.name = "InsufficientInventoryError";
  }
}

export async function reserveInventory(
  db: D1Database,
  input: ReserveInventoryInput,
): Promise<InventoryReservationRecord> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new RangeError("Reservation quantity must be a positive safe integer.");
  }
  const now = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(
        `UPDATE inventory_items
         SET reserved_quantity = reserved_quantity + ?,
             version = version + 1,
             updated_at = ?
         WHERE variant_id = ?
           AND warehouse_id = ?
           AND on_hand_quantity + oversell_limit - reserved_quantity >= ?`,
      )
      .bind(input.quantity, now, input.variantId, input.warehouseId, input.quantity),
    db
      .prepare(
        `INSERT INTO inventory_reservations
           (id, cart_id, checkout_attempt_id, variant_id, warehouse_id, quantity, status, expires_at, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?
         WHERE changes() = 1`,
      )
      .bind(
        input.id,
        input.cartId ?? null,
        input.checkoutAttemptId ?? null,
        input.variantId,
        input.warehouseId,
        input.quantity,
        input.expiresAt,
        now,
        now,
      ),
  ]);
  if ((results[0]?.meta.changes ?? 0) !== 1 || (results[1]?.meta.changes ?? 0) !== 1) {
    throw new InsufficientInventoryError();
  }
  return {
    expiresAt: input.expiresAt,
    id: input.id,
    quantity: input.quantity,
    status: "active",
    variantId: input.variantId,
    warehouseId: input.warehouseId,
  };
}
