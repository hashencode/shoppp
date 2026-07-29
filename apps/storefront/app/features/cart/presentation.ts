import type { Cart } from "@shoppp/contracts";

export function authoritativeTotalLabel(cart: Cart): string {
  return new Intl.NumberFormat("en", {
    currency: cart.currency,
    style: "currency",
  }).format(cart.totals.grandTotal / 100);
}

export function acknowledgementKeys(cart: Cart): string[] {
  return cart.adjustments
    .filter((adjustment) => adjustment.requiresAcknowledgement)
    .map((adjustment) => adjustment.key);
}
