import type { CheckoutRequest, CheckoutSession } from "@shoppp/contracts";
import { releaseInventoryReservation } from "@shoppp/db";
import type { Context } from "hono";

import { quoteCart, type CartRow } from "../cart/service";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { createCartReservation } from "../inventory/reservations";
import { opaqueAccessToken, sha256Hex } from "../orders/tokens";
import {
  PaymentProviderError,
  type CheckoutSnapshot,
  type CheckoutSnapshotLine,
  type PaymentProvider,
} from "./port";

interface SnapshotLineRow {
  option_values_json: string;
  product_id: string;
  sku: string;
  variant_id: string;
}

function publicId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function guestTokenTtlHours(value: string | undefined): number {
  if (!value) return 24 * 30;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 24 * 90) {
    throw new ApiError(
      500,
      "guest_token_ttl_invalid",
      "The guest order access duration is invalid.",
    );
  }
  return parsed;
}

function checkoutUrls(env: ApiEnvironment["Bindings"]): { cancelUrl: string; successUrl: string } {
  const storefront = new URL(env.STOREFRONT_ORIGIN);
  const successUrl = new URL(
    env.PAYMENT_SUCCESS_URL ??
      `${storefront.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
  );
  const cancelUrl = new URL(env.PAYMENT_CANCEL_URL ?? `${storefront.origin}/checkout`);
  if (
    successUrl.origin !== storefront.origin ||
    cancelUrl.origin !== storefront.origin ||
    !successUrl.href.includes("{CHECKOUT_SESSION_ID}")
  ) {
    throw new ApiError(
      500,
      "payment_redirect_configuration_invalid",
      "Payment return URLs are invalid.",
    );
  }
  return { cancelUrl: cancelUrl.href, successUrl: successUrl.href };
}

function sameAddress(
  left: CheckoutRequest["shippingAddress"],
  right: CheckoutRequest["shippingAddress"] | null,
): boolean {
  if (!right) return false;
  const keys = [
    "city",
    "countryCode",
    "line1",
    "line2",
    "name",
    "phone",
    "postalCode",
    "region",
  ] as const;
  return keys.every((key) => (left[key] ?? "") === (right[key] ?? ""));
}

async function checkoutSnapshot(
  context: Context<ApiEnvironment>,
  cart: CartRow,
  input: CheckoutRequest,
): Promise<CheckoutSnapshot> {
  const quote = await quoteCart(context.env.DB, cart, context.env.TAX_MODE);
  if (
    input.cartId !== cart.id ||
    input.currency !== cart.currency ||
    input.countryCode !== cart.shipping_country ||
    input.shippingMethodId !== quote.selectedShippingMethodId ||
    !sameAddress(input.shippingAddress, quote.shippingAddress)
  ) {
    throw new ApiError(
      409,
      "checkout_snapshot_mismatch",
      "Checkout details changed. Review the latest cart quote before paying.",
    );
  }
  if (!quote.canCheckout || quote.lines.length === 0 || !quote.selectedShippingMethodId) {
    throw new ApiError(
      409,
      "cart_revalidation_required",
      "The cart changed and must be reviewed before payment.",
      { adjustments: quote.adjustments },
    );
  }
  const method = quote.shippingMethods.find(
    (candidate) => candidate.id === quote.selectedShippingMethodId,
  );
  if (!method) {
    throw new ApiError(
      409,
      "shipping_method_unavailable",
      "The selected shipping method is no longer available.",
    );
  }
  const metadata = await context.env.DB.prepare(
    `SELECT cl.variant_id, v.product_id, v.sku, v.option_values_json
       FROM cart_lines cl
       JOIN product_variants v ON v.id = cl.variant_id
      WHERE cl.cart_id = ?
      ORDER BY cl.created_at, cl.id`,
  )
    .bind(cart.id)
    .all<SnapshotLineRow>();
  const byVariant = new Map(metadata.results.map((row) => [row.variant_id, row]));
  const lines: CheckoutSnapshotLine[] = quote.lines.map((line) => {
    const facts = byVariant.get(line.variantId);
    if (!facts) {
      throw new ApiError(
        409,
        "checkout_snapshot_incomplete",
        "A cart item changed before payment.",
      );
    }
    return {
      currency: quote.currency,
      discountAmount: 0,
      lineTotalAmount: line.lineTotal.amount,
      optionValues: JSON.parse(facts.option_values_json) as Record<string, string>,
      productId: facts.product_id,
      productName: line.productName,
      quantity: line.quantity,
      sku: facts.sku,
      taxAmount: 0,
      unitPriceAmount: line.unitPrice.amount,
      variantId: line.variantId,
      variantName: line.variantName,
    };
  });
  return {
    currency: quote.currency,
    email: input.email.toLowerCase(),
    lines,
    shippingAddress: input.shippingAddress,
    shippingMethod: { amount: method.amount, id: method.id, name: method.name },
    totals: quote.totals,
  };
}

async function recordPaymentCreationAudit(
  context: Context<ApiEnvironment>,
  attemptId: string,
  result: "succeeded" | "failed",
  metadata: Record<string, unknown>,
): Promise<void> {
  await recordAuditEvent(context.env.DB, {
    action: "payment.session.create",
    actorId: "guest_cart",
    actorType: "shopper",
    id: publicId("aud"),
    metadata,
    requestId: context.get("requestId"),
    result,
    targetId: attemptId,
    targetType: "checkout_attempt",
  });
}

export async function createHostedCheckout(
  context: Context<ApiEnvironment>,
  cart: CartRow,
  input: CheckoutRequest,
  provider: PaymentProvider,
): Promise<CheckoutSession> {
  const headerKey = context.req.header("Idempotency-Key");
  if (headerKey !== input.idempotencyKey) {
    throw new ApiError(
      422,
      "idempotency_key_mismatch",
      "The checkout idempotency key must match the request header.",
    );
  }
  const snapshot = await checkoutSnapshot(context, cart, input);
  const reservation = await createCartReservation(context, cart);
  const attemptId = publicId("chk");
  const orderAccessToken = opaqueAccessToken();
  const tokenExpiresAt = new Date(
    Date.now() + guestTokenTtlHours(context.env.GUEST_ORDER_TOKEN_TTL_HOURS) * 60 * 60 * 1_000,
  ).toISOString();
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO checkout_attempts
         (id, cart_id, reservation_group_id, provider, provider_session_id,
          idempotency_key, currency, subtotal_amount, discount_amount, shipping_amount,
          tax_amount, grand_total_amount, shipping_address_json, email, snapshot_json,
          guest_access_token_hash, guest_access_expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validating', ?, ?)`,
    )
      .bind(
        attemptId,
        cart.id,
        reservation.id,
        provider.name,
        input.idempotencyKey,
        snapshot.currency,
        snapshot.totals.subtotal,
        snapshot.totals.discountTotal,
        snapshot.totals.shippingTotal,
        snapshot.totals.taxTotal,
        snapshot.totals.grandTotal,
        JSON.stringify(snapshot.shippingAddress),
        snapshot.email,
        JSON.stringify(snapshot),
        await sha256Hex(orderAccessToken),
        tokenExpiresAt,
        now,
        now,
      )
      .run();
  } catch (error) {
    await releaseInventoryReservation(context.env.DB, reservation.id);
    if (error instanceof Error && error.message.includes("checkout_attempts.idempotency_key")) {
      throw new ApiError(
        409,
        "checkout_attempt_exists",
        "This checkout idempotency key has already been used.",
      );
    }
    throw error;
  }
  const urls = checkoutUrls(context.env);
  try {
    const session = await provider.createHostedSession({
      attemptId,
      cancelUrl: urls.cancelUrl,
      expiresAt: reservation.expiresAt,
      idempotencyKey: input.idempotencyKey,
      snapshot,
      successUrl: urls.successUrl,
    });
    if (
      session.attemptId !== attemptId ||
      session.amountTotal !== snapshot.totals.grandTotal ||
      session.currency !== snapshot.currency ||
      !session.url
    ) {
      throw new PaymentProviderError(
        "provider_session_mismatch",
        "The payment provider returned a mismatched session.",
        false,
      );
    }
    await context.env.DB.prepare(
      `UPDATE checkout_attempts
          SET provider_session_id = ?, provider_session_url = ?, provider_status = ?,
              status = 'payment_pending', updated_at = ?
        WHERE id = ? AND status = 'validating'`,
    )
      .bind(session.id, session.url, session.paymentState, new Date().toISOString(), attemptId)
      .run();
    await recordPaymentCreationAudit(context, attemptId, "succeeded", {
      provider: provider.name,
      providerSessionId: session.id,
    });
    return {
      attemptId,
      checkoutUrl: session.url,
      expiresAt: reservation.expiresAt,
      orderAccessToken,
      status: "payment_pending",
    };
  } catch (error) {
    const code = error instanceof PaymentProviderError ? error.code : "provider_session_failed";
    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE checkout_attempts
            SET status = 'failed', provider_status = ?, updated_at = ?
          WHERE id = ? AND status = 'validating'`,
      ).bind(code, new Date().toISOString(), attemptId),
    ]);
    await releaseInventoryReservation(context.env.DB, reservation.id);
    await recordPaymentCreationAudit(context, attemptId, "failed", {
      code,
      provider: provider.name,
    });
    throw error instanceof PaymentProviderError
      ? error
      : new PaymentProviderError(code, "The payment session could not be created.", true);
  }
}
