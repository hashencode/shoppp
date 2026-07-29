import * as z from "zod";

import {
  PaymentProviderError,
  type CreateHostedSessionInput,
  type PaymentProvider,
  type ProviderSession,
  type VerifiedProviderEvent,
} from "./port";

const stripeSessionSchema = z
  .object({
    amount_total: z.number().int().nonnegative().nullable(),
    client_reference_id: z.string().nullable(),
    created: z.number().int().nonnegative(),
    currency: z.string().nullable(),
    expires_at: z.number().int().positive(),
    id: z.string().min(1),
    metadata: z.record(z.string(), z.string()).optional(),
    payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
    status: z.enum(["open", "complete", "expired"]).nullable(),
    url: z.string().url().nullable().optional(),
  })
  .passthrough();
const stripeEventSchema = z
  .object({
    created: z.number().int().nonnegative(),
    data: z.object({ object: z.unknown() }).passthrough(),
    id: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough();

interface StripeAdapterOptions {
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
  readonly secretKey: string;
  readonly webhookSecret: string;
}

function isoFromSeconds(value: number): string {
  return new Date(value * 1_000).toISOString();
}

function paymentState(
  session: z.infer<typeof stripeSessionSchema>,
): ProviderSession["paymentState"] {
  if (session.status === "expired") return "expired";
  if (session.payment_status === "paid") return "approved";
  return "pending";
}

function normalizeSession(session: z.infer<typeof stripeSessionSchema>): ProviderSession {
  const attemptId = session.client_reference_id ?? session.metadata?.checkout_attempt_id;
  if (!attemptId || session.amount_total === null || !session.currency) {
    throw new PaymentProviderError(
      "stripe_session_incomplete",
      "Stripe returned an incomplete Checkout Session.",
      false,
    );
  }
  return {
    amountTotal: session.amount_total,
    attemptId,
    createdAt: isoFromSeconds(session.created),
    currency: session.currency.toUpperCase(),
    expiresAt: isoFromSeconds(session.expires_at),
    id: session.id,
    paymentState: paymentState(session),
    ...(session.url ? { url: session.url } : {}),
  };
}

function appendLineItem(
  body: URLSearchParams,
  index: number,
  name: string,
  currency: string,
  unitAmount: number,
  quantity = 1,
): void {
  body.set(`line_items[${index}][price_data][currency]`, currency.toLowerCase());
  body.set(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
  body.set(`line_items[${index}][price_data][product_data][name]`, name);
  body.set(`line_items[${index}][quantity]`, String(quantity));
}

function sessionBody(input: CreateHostedSessionInput): URLSearchParams {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("expires_at", String(Math.ceil(Date.parse(input.expiresAt) / 1_000)));
  body.set("client_reference_id", input.attemptId);
  body.set("customer_email", input.snapshot.email);
  body.set("metadata[checkout_attempt_id]", input.attemptId);
  body.set("payment_method_types[0]", "card");
  let index = 0;
  if (input.snapshot.totals.discountTotal > 0) {
    appendLineItem(
      body,
      index,
      "Shoppp order",
      input.snapshot.currency,
      input.snapshot.totals.grandTotal,
    );
    return body;
  }
  for (const line of input.snapshot.lines) {
    appendLineItem(
      body,
      index,
      `${line.productName} · ${line.variantName}`,
      line.currency,
      line.unitPriceAmount,
      line.quantity,
    );
    index += 1;
  }
  if (input.snapshot.totals.shippingTotal > 0) {
    appendLineItem(
      body,
      index,
      input.snapshot.shippingMethod.name,
      input.snapshot.currency,
      input.snapshot.totals.shippingTotal,
    );
    index += 1;
  }
  if (input.snapshot.totals.taxTotal > 0) {
    appendLineItem(body, index, "Tax", input.snapshot.currency, input.snapshot.totals.taxTotal);
  }
  return body;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function expectedSignature(
  secret: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)),
  );
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;
  readonly #secretKey: string;
  readonly #webhookSecret: string;

  constructor(options: StripeAdapterOptions) {
    if (!options.secretKey.startsWith("sk_") || !options.webhookSecret.startsWith("whsec_")) {
      throw new PaymentProviderError(
        "stripe_not_configured",
        "Stripe credentials are not configured.",
        false,
      );
    }
    this.#fetch = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#secretKey = options.secretKey;
    this.#webhookSecret = options.webhookSecret;
  }

  async #request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(`https://api.stripe.com/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.#secretKey}`,
          ...init.headers,
        },
      });
    } catch {
      throw new PaymentProviderError(
        "stripe_unreachable",
        "The payment provider could not be reached.",
        true,
      );
    }
    if (!response.ok) {
      throw new PaymentProviderError(
        "stripe_api_error",
        "The payment provider rejected the request.",
        response.status === 429 || response.status >= 500,
      );
    }
    return response.json();
  }

  async createHostedSession(input: CreateHostedSessionInput): Promise<ProviderSession> {
    const parsed = stripeSessionSchema.safeParse(
      await this.#request("/checkout/sessions", {
        body: sessionBody(input),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": input.idempotencyKey,
        },
        method: "POST",
      }),
    );
    if (!parsed.success) {
      throw new PaymentProviderError(
        "stripe_response_invalid",
        "Stripe returned an invalid Checkout Session.",
        true,
      );
    }
    return normalizeSession(parsed.data);
  }

  async retrieveSession(id: string): Promise<ProviderSession> {
    if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
      throw new PaymentProviderError("stripe_session_invalid", "Stripe session is invalid.", false);
    }
    const parsed = stripeSessionSchema.safeParse(
      await this.#request(`/checkout/sessions/${encodeURIComponent(id)}`, { method: "GET" }),
    );
    if (!parsed.success) {
      throw new PaymentProviderError(
        "stripe_response_invalid",
        "Stripe returned an invalid Checkout Session.",
        true,
      );
    }
    return normalizeSession(parsed.data);
  }

  async verifyWebhook(rawPayload: string, signatureHeader: string): Promise<VerifiedProviderEvent> {
    const fields = signatureHeader.split(",").map((field) => field.trim().split("=", 2));
    const timestamp = fields.find(([key]) => key === "t")?.[1];
    const signatures = fields
      .filter(([key, value]) => key === "v1" && value)
      .map(([, value]) => value!);
    if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) {
      throw new PaymentProviderError(
        "stripe_signature_invalid",
        "Stripe webhook signature is invalid.",
        false,
      );
    }
    if (Math.abs(Math.floor(this.#now() / 1_000) - Number(timestamp)) > 300) {
      throw new PaymentProviderError(
        "stripe_signature_expired",
        "Stripe webhook signature is outside the accepted time window.",
        false,
      );
    }
    const expected = await expectedSignature(this.#webhookSecret, timestamp, rawPayload);
    if (!signatures.some((signature) => constantTimeEqual(signature, expected))) {
      throw new PaymentProviderError(
        "stripe_signature_invalid",
        "Stripe webhook signature is invalid.",
        false,
      );
    }
    const parsedJson = (() => {
      try {
        return JSON.parse(rawPayload) as unknown;
      } catch {
        throw new PaymentProviderError(
          "stripe_payload_invalid",
          "Stripe webhook payload is invalid.",
          false,
        );
      }
    })();
    const parsed = stripeEventSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new PaymentProviderError(
        "stripe_payload_invalid",
        "Stripe webhook payload is invalid.",
        false,
      );
    }
    const typeMap: Record<string, VerifiedProviderEvent["type"]> = {
      "checkout.session.async_payment_failed": "checkout.payment_failed",
      "checkout.session.async_payment_succeeded": "checkout.payment_succeeded",
      "checkout.session.completed": "checkout.completed",
      "checkout.session.expired": "checkout.expired",
    };
    const type = typeMap[parsed.data.type] ?? "ignored";
    if (type === "ignored") {
      return {
        createdAt: isoFromSeconds(parsed.data.created),
        id: parsed.data.id,
        type,
      };
    }
    const session = stripeSessionSchema.safeParse(parsed.data.data.object);
    if (!session.success) {
      throw new PaymentProviderError(
        "stripe_payload_invalid",
        "Stripe webhook payload is invalid.",
        false,
      );
    }
    return {
      createdAt: isoFromSeconds(parsed.data.created),
      id: parsed.data.id,
      session: normalizeSession(session.data),
      type,
    };
  }
}

export function createStripePaymentProvider(
  bindings: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
  options: Pick<StripeAdapterOptions, "fetcher" | "now"> = {},
): StripePaymentProvider {
  return new StripePaymentProvider({
    ...options,
    secretKey: bindings.STRIPE_SECRET_KEY ?? "",
    webhookSecret: bindings.STRIPE_WEBHOOK_SECRET ?? "",
  });
}
