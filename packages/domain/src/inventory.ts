import type { ReservationStatus } from "./order-state";

export interface InventoryPosition {
  readonly backordered?: number;
  readonly onHand: number;
  readonly oversellLimit: number;
  readonly reserved: number;
}

function assertQuantity(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a safe non-negative integer.`);
  }
}

const terminalReservationStatuses: readonly ReservationStatus[] = [
  "confirmed",
  "expired",
  "released",
];

export function assertInventoryAdjustment(
  quantityDelta: number,
  position: InventoryPosition,
): InventoryPosition {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
    throw new RangeError("Inventory adjustment must be a non-zero safe integer.");
  }
  availableQuantity(position);
  const onHand = position.onHand + quantityDelta;
  if (!Number.isSafeInteger(onHand) || onHand < 0) {
    throw new RangeError("Inventory adjustment cannot make on-hand quantity negative.");
  }
  const next = { ...position, onHand };
  if (position.reserved + (position.backordered ?? 0) > onHand + position.oversellLimit) {
    throw new RangeError("Inventory adjustment cannot invalidate active reservations.");
  }
  return next;
}

export function isReservationExpired(expiresAt: string, now: string): boolean {
  const expiry = Date.parse(expiresAt);
  const boundary = Date.parse(now);
  if (!Number.isFinite(expiry) || !Number.isFinite(boundary)) {
    throw new RangeError("Reservation timestamps must be valid ISO date-times.");
  }
  return expiry <= boundary;
}

export function canTransitionReservation(
  current: ReservationStatus,
  next: ReservationStatus,
): boolean {
  return current === next || (current === "active" && terminalReservationStatuses.includes(next));
}

export function availableQuantity(position: InventoryPosition): number {
  assertQuantity(position.onHand, "On-hand quantity");
  assertQuantity(position.reserved, "Reserved quantity");
  assertQuantity(position.oversellLimit, "Oversell limit");
  assertQuantity(position.backordered ?? 0, "Backordered quantity");
  const available =
    position.onHand + position.oversellLimit - position.reserved - (position.backordered ?? 0);
  if (!Number.isSafeInteger(available)) {
    throw new RangeError("Available quantity must be a safe non-negative integer.");
  }
  return Math.max(0, available);
}

export function assertReservable(quantity: number, position: InventoryPosition): void {
  assertQuantity(quantity, "Reservation quantity");
  if (quantity === 0) {
    throw new RangeError("Reservation quantity must be greater than zero.");
  }
  const available = availableQuantity(position);
  if (quantity > available) {
    throw new RangeError(`Requested ${quantity} units but only ${available} are available.`);
  }
}
