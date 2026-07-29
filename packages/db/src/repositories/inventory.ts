import type { ReservationStatus } from "@shoppp/domain";

export interface ReserveInventoryInput {
  readonly cartId?: string;
  readonly checkoutAttemptId?: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly quantity: number;
  readonly variantId: string;
  readonly warehouseId: string;
}

export interface ReservationLineInput {
  readonly id: string;
  readonly quantity: number;
  readonly variantId: string;
  readonly warehouseId: string;
}

export interface ReserveInventoryGroupInput {
  readonly cartId?: string;
  readonly checkoutAttemptId?: string;
  readonly createdAt?: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly idempotencyKey?: string;
  readonly lines: readonly ReservationLineInput[];
}

export interface InventoryReservationRecord {
  readonly expiresAt: string;
  readonly id: string;
  readonly quantity: number;
  readonly status: "active";
  readonly variantId: string;
  readonly warehouseId: string;
}

export interface InventoryReservationGroupRecord {
  readonly expiresAt: string;
  readonly id: string;
  readonly lines: readonly ReservationLineInput[];
  readonly status: ReservationStatus;
}

export interface ReservationTransitionResult {
  readonly changed: boolean;
  readonly id: string;
  readonly status: ReservationStatus;
}

export class InsufficientInventoryError extends Error {
  constructor() {
    super("The requested inventory is no longer available.");
    this.name = "InsufficientInventoryError";
  }
}

export class InventoryReservationConflictError extends Error {
  constructor() {
    super("This cart already has an active inventory reservation.");
    this.name = "InventoryReservationConflictError";
  }
}

function assertLine(line: ReservationLineInput): void {
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
    throw new RangeError("Reservation quantity must be a positive safe integer.");
  }
}

function isConstraintMessage(error: unknown, message: string): boolean {
  return error instanceof Error && error.message.includes(message);
}

export async function reserveInventoryGroup(
  db: D1Database,
  input: ReserveInventoryGroupInput,
): Promise<InventoryReservationGroupRecord> {
  if (input.lines.length === 0) {
    throw new RangeError("A reservation must contain at least one inventory line.");
  }
  const pairs = new Set<string>();
  for (const line of input.lines) {
    assertLine(line);
    const pair = `${line.variantId}\0${line.warehouseId}`;
    if (pairs.has(pair)) {
      throw new RangeError("A reservation cannot contain duplicate inventory positions.");
    }
    pairs.add(pair);
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(input.expiresAt)) || input.expiresAt <= createdAt) {
    throw new RangeError("Reservation expiry must be later than its creation timestamp.");
  }
  const statements = [
    db
      .prepare(
        `INSERT INTO inventory_reservation_groups
           (id, cart_id, idempotency_key, status, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      )
      .bind(
        input.id,
        input.cartId ?? null,
        input.idempotencyKey ?? null,
        input.expiresAt,
        createdAt,
        createdAt,
      ),
    ...input.lines.map((line) =>
      db
        .prepare(
          `INSERT INTO inventory_reservations
             (id, cart_id, checkout_attempt_id, variant_id, warehouse_id, quantity, status,
              expires_at, created_at, updated_at, group_id)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .bind(
          line.id,
          input.cartId ?? null,
          input.checkoutAttemptId ?? null,
          line.variantId,
          line.warehouseId,
          line.quantity,
          input.expiresAt,
          createdAt,
          createdAt,
          input.id,
        ),
    ),
  ];
  try {
    await db.batch(statements);
  } catch (error) {
    if (isConstraintMessage(error, "inventory_unavailable")) {
      throw new InsufficientInventoryError();
    }
    if (
      isConstraintMessage(error, "inventory_reservation_groups_active_cart_unique") ||
      isConstraintMessage(error, "UNIQUE constraint failed: inventory_reservation_groups.cart_id")
    ) {
      throw new InventoryReservationConflictError();
    }
    throw error;
  }
  return {
    expiresAt: input.expiresAt,
    id: input.id,
    lines: input.lines,
    status: "active",
  };
}

export async function reserveInventory(
  db: D1Database,
  input: ReserveInventoryInput,
): Promise<InventoryReservationRecord> {
  const group = await reserveInventoryGroup(db, {
    ...(input.cartId ? { cartId: input.cartId } : {}),
    ...(input.checkoutAttemptId ? { checkoutAttemptId: input.checkoutAttemptId } : {}),
    expiresAt: input.expiresAt,
    id: `irg_${crypto.randomUUID().replaceAll("-", "")}`,
    lines: [
      {
        id: input.id,
        quantity: input.quantity,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
      },
    ],
  });
  return {
    expiresAt: group.expiresAt,
    id: input.id,
    quantity: input.quantity,
    status: "active",
    variantId: input.variantId,
    warehouseId: input.warehouseId,
  };
}

export async function getInventoryReservationGroup(
  db: D1Database,
  id: string,
): Promise<InventoryReservationGroupRecord | null> {
  const group = await db
    .prepare("SELECT id, status, expires_at FROM inventory_reservation_groups WHERE id = ?")
    .bind(id)
    .first<{ expires_at: string; id: string; status: ReservationStatus }>();
  if (!group) return null;
  const lines = await db
    .prepare(
      `SELECT id, quantity, variant_id, warehouse_id
         FROM inventory_reservations WHERE group_id = ? ORDER BY id`,
    )
    .bind(id)
    .all<{
      id: string;
      quantity: number;
      variant_id: string;
      warehouse_id: string;
    }>();
  return {
    expiresAt: group.expires_at,
    id: group.id,
    lines: lines.results.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      variantId: line.variant_id,
      warehouseId: line.warehouse_id,
    })),
    status: group.status,
  };
}

export async function transitionInventoryReservation(
  db: D1Database,
  id: string,
  status: Exclude<ReservationStatus, "active">,
  at = new Date().toISOString(),
): Promise<ReservationTransitionResult | null> {
  const current = await db
    .prepare("SELECT status FROM inventory_reservation_groups WHERE id = ?")
    .bind(id)
    .first<{ status: ReservationStatus }>();
  if (!current) return null;
  if (current.status !== "active") {
    return { changed: false, id, status: current.status };
  }
  const results = await db.batch([
    db
      .prepare(
        `UPDATE inventory_reservations
            SET status = ?, updated_at = ?
          WHERE group_id = ? AND status = 'active'`,
      )
      .bind(status, at, id),
    db
      .prepare(
        `UPDATE inventory_reservation_groups
            SET status = ?, updated_at = ?
          WHERE id = ? AND status = 'active'`,
      )
      .bind(status, at, id),
  ]);
  const changed = (results[1]?.meta.changes ?? 0) === 1;
  if (changed) return { changed: true, id, status };
  const converged = await db
    .prepare("SELECT status FROM inventory_reservation_groups WHERE id = ?")
    .bind(id)
    .first<{ status: ReservationStatus }>();
  return converged ? { changed: false, id, status: converged.status } : null;
}

export async function confirmInventoryReservation(
  db: D1Database,
  id: string,
  at?: string,
): Promise<ReservationTransitionResult | null> {
  return transitionInventoryReservation(db, id, "confirmed", at);
}

export async function releaseInventoryReservation(
  db: D1Database,
  id: string,
  at?: string,
): Promise<ReservationTransitionResult | null> {
  return transitionInventoryReservation(db, id, "released", at);
}

export async function expireInventoryReservation(
  db: D1Database,
  id: string,
  at?: string,
): Promise<ReservationTransitionResult | null> {
  return transitionInventoryReservation(db, id, "expired", at);
}
