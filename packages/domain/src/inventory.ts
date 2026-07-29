export interface InventoryPosition {
  readonly onHand: number;
  readonly oversellLimit: number;
  readonly reserved: number;
}

function assertQuantity(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a safe non-negative integer.`);
  }
}

export function availableQuantity(position: InventoryPosition): number {
  assertQuantity(position.onHand, "On-hand quantity");
  assertQuantity(position.reserved, "Reserved quantity");
  assertQuantity(position.oversellLimit, "Oversell limit");
  const available = position.onHand + position.oversellLimit - position.reserved;
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
