import type { InventoryReservation } from "@shoppp/contracts";
import {
  InventoryReservationConflictError,
  InsufficientInventoryError,
  reserveInventoryGroup,
} from "@shoppp/db";
import type { Context } from "hono";

import { quoteCart, type CartRow } from "../cart/service";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

interface InventoryPositionRow {
  warehouse_id: string;
}

function publicId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function reservationTtlMinutes(value: string | undefined): number {
  if (value === undefined || value === "") return 30;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 60) {
    throw new ApiError(
      500,
      "reservation_ttl_invalid",
      "The reservation duration configuration is invalid.",
    );
  }
  return parsed;
}

export async function createCartReservation(
  context: Context<ApiEnvironment>,
  cart: CartRow,
): Promise<InventoryReservation> {
  const quote = await quoteCart(context.env.DB, cart, context.env.TAX_MODE);
  if (!quote.canCheckout || quote.lines.length === 0) {
    throw new ApiError(
      409,
      "cart_revalidation_required",
      "The cart changed and must be reviewed before checkout.",
      { adjustments: quote.adjustments },
    );
  }
  if (!quote.shippingAddress || !quote.selectedShippingMethodId) {
    throw new ApiError(
      422,
      "shipping_selection_required",
      "Select a valid shipping address and method before reserving inventory.",
    );
  }
  const lines = [];
  for (const line of quote.lines) {
    const position = await context.env.DB.prepare(
      `SELECT warehouse_id
         FROM inventory_items
        WHERE variant_id = ?
          AND on_hand_quantity + oversell_limit - reserved_quantity >= ?
        ORDER BY warehouse_id
        LIMIT 1`,
    )
      .bind(line.variantId, line.quantity)
      .first<InventoryPositionRow>();
    if (!position) {
      throw new ApiError(
        409,
        "inventory_unavailable",
        "One or more cart items are no longer available.",
        { variantId: line.variantId },
      );
    }
    lines.push({
      id: publicId("ir"),
      quantity: line.quantity,
      variantId: line.variantId,
      warehouseId: position.warehouse_id,
    });
  }
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + reservationTtlMinutes(context.env.RESERVATION_TTL_MINUTES) * 60_000,
  ).toISOString();
  try {
    const reservation = await reserveInventoryGroup(context.env.DB, {
      cartId: cart.id,
      createdAt: createdAt.toISOString(),
      expiresAt,
      id: publicId("irg"),
      ...(context.req.header("Idempotency-Key")
        ? { idempotencyKey: context.req.header("Idempotency-Key")! }
        : {}),
      lines,
    });
    return { ...reservation, lines: [...reservation.lines] };
  } catch (error) {
    if (error instanceof InsufficientInventoryError) {
      throw new ApiError(
        409,
        "inventory_unavailable",
        "One or more cart items were reserved by another checkout.",
      );
    }
    if (error instanceof InventoryReservationConflictError) {
      throw new ApiError(
        409,
        "reservation_already_active",
        "This cart already has an active inventory reservation.",
      );
    }
    throw error;
  }
}
