import type {
  AddCartLineRequest,
  Cart,
  CartAdjustment,
  CreateCartRequest,
  ShippingMethodQuote,
  ShippingQuoteRequest,
  UpdateCartLineRequest,
} from "@shoppp/contracts";
import { MAX_CART_LINE_QUANTITY } from "@shoppp/contracts";
import { calculatePricing, createMoney, quoteShippingMethods } from "@shoppp/domain";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { configuredTaxPort } from "../pricing/tax";
import { loadRuntimeLaunchConfiguration } from "../settings/runtime";

type CartContext = Context<ApiEnvironment>;

export interface CartRow {
  currency: string;
  expires_at: string;
  id: string;
  pricing_context_json: string;
  shipping_address_json: string | null;
  shipping_country: string | null;
  shipping_method_id: string | null;
  status: string;
}

interface PricingContext {
  pendingAdjustments: CartAdjustment[];
  priceSnapshots: Record<string, number>;
  releaseId?: string;
}

interface LineRow {
  available_quantity: number;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  variant_id: string;
  variant_name: string;
  weight_grams: number;
}

interface VariantAuthority {
  available_quantity: number;
  product_name: string;
  status: string;
  unit_price: number | null;
  variant_id: string;
  variant_name: string;
  weight_grams: number;
}

interface ShippingMethodRow {
  calculation_type: "flat" | "weight";
  currency: string;
  free_threshold_amount: number | null;
  id: string;
  max_weight_grams: number | null;
  min_weight_grams: number | null;
  name: string;
  price_amount: number;
}

function publicId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

function opaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parsePricingContext(value: string): PricingContext {
  try {
    const parsed = JSON.parse(value) as Partial<PricingContext>;
    return {
      pendingAdjustments: parsed.pendingAdjustments ?? [],
      priceSnapshots: parsed.priceSnapshots ?? {},
      ...(parsed.releaseId ? { releaseId: parsed.releaseId } : {}),
    };
  } catch {
    throw new ApiError(500, "cart_context_invalid", "The cart pricing context is invalid.");
  }
}

function cartToken(context: CartContext): string {
  const authorization = context.req.header("authorization") ?? "";
  const match = /^CartToken ([A-Za-z0-9_-]{32,160})$/.exec(authorization);
  if (!match?.[1]) {
    throw new ApiError(401, "cart_token_required", "A valid guest cart token is required.");
  }
  return match[1];
}

export async function requireCart(context: CartContext): Promise<CartRow> {
  const tokenHash = await sha256(cartToken(context));
  const cart = await context.env.DB.prepare(
    `SELECT id, currency, pricing_context_json, shipping_country, shipping_address_json,
            shipping_method_id, status, expires_at
       FROM carts WHERE public_token_hash = ?`,
  )
    .bind(tokenHash)
    .first<CartRow>();
  if (!cart) {
    throw new ApiError(401, "cart_token_invalid", "The guest cart token is invalid.");
  }
  if (cart.status !== "active" || Date.parse(cart.expires_at) <= Date.now()) {
    if (cart.status === "active") {
      await context.env.DB.prepare(
        "UPDATE carts SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'active'",
      )
        .bind(new Date().toISOString(), cart.id)
        .run();
    }
    throw new ApiError(409, "cart_expired", "This cart has expired. Start a new cart to continue.");
  }
  return cart;
}

async function authoritativeVariant(
  db: D1Database,
  variantId: string,
  currency: string,
): Promise<VariantAuthority> {
  const now = new Date().toISOString();
  const variant = await db
    .prepare(
      `SELECT v.id AS variant_id, v.title AS variant_name, v.weight_grams, v.status,
              p.name AS product_name,
              (SELECT pr.amount
                 FROM prices pr
                 JOIN price_lists pl ON pl.id = pr.price_list_id
                WHERE pr.variant_id = v.id AND pl.currency = ? AND pl.status = 'active'
                  AND (pl.starts_at IS NULL OR pl.starts_at <= ?)
                  AND (pl.ends_at IS NULL OR pl.ends_at > ?)
                ORDER BY pl.code LIMIT 1) AS unit_price,
              COALESCE((SELECT SUM(i.on_hand_quantity + i.oversell_limit -
                                         i.reserved_quantity - i.backordered_quantity)
                          FROM inventory_items i WHERE i.variant_id = v.id), 0) AS available_quantity
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
        WHERE v.id = ? AND p.status = 'published'`,
    )
    .bind(currency, now, now, variantId)
    .first<VariantAuthority>();
  if (!variant || variant.status !== "active") {
    throw new ApiError(
      422,
      "variant_unavailable",
      "The selected product variant is no longer available.",
      [{ path: ["variantId"], message: "Select an available variant." }],
    );
  }
  if (variant.unit_price === null) {
    throw new ApiError(
      422,
      "currency_unavailable",
      "The selected variant is not sellable in this cart currency.",
      [{ path: ["currency"], message: `No ${currency} price is available.` }],
    );
  }
  return variant;
}

function assertQuantity(quantity: number, available: number): void {
  if (quantity > MAX_CART_LINE_QUANTITY) {
    throw new ApiError(
      422,
      "quantity_limit_exceeded",
      "The requested quantity exceeds the per-line purchase limit.",
      [{ path: ["quantity"], maximum: MAX_CART_LINE_QUANTITY }],
    );
  }
  if (quantity > available) {
    throw new ApiError(
      422,
      "cart_quantity_unavailable",
      "The requested quantity is not currently available.",
      [{ path: ["quantity"], maximum: available }],
    );
  }
}

function priceAdjustment(
  variantId: string,
  expectedAmount: number,
  authoritativeAmount: number,
): CartAdjustment {
  return {
    code: "price_changed",
    key: `price_changed:${variantId}`,
    message: `The price changed from ${expectedAmount} to ${authoritativeAmount} minor units.`,
    requiresAcknowledgement: true,
    variantId,
  };
}

function upsertAdjustment(
  adjustments: CartAdjustment[],
  adjustment: CartAdjustment,
): CartAdjustment[] {
  return [...adjustments.filter((item) => item.key !== adjustment.key), adjustment];
}

async function lineRows(db: D1Database, cart: CartRow): Promise<LineRow[]> {
  const now = new Date().toISOString();
  const rows = await db
    .prepare(
      `SELECT cl.variant_id, cl.quantity, p.name AS product_name, v.title AS variant_name,
              v.weight_grams,
              (SELECT pr.amount
                 FROM prices pr
                 JOIN price_lists pl ON pl.id = pr.price_list_id
                WHERE pr.variant_id = v.id AND pl.currency = ? AND pl.status = 'active'
                  AND (pl.starts_at IS NULL OR pl.starts_at <= ?)
                  AND (pl.ends_at IS NULL OR pl.ends_at > ?)
                ORDER BY pl.code LIMIT 1) AS unit_price,
              COALESCE((SELECT SUM(i.on_hand_quantity + i.oversell_limit -
                                         i.reserved_quantity - i.backordered_quantity)
                          FROM inventory_items i WHERE i.variant_id = v.id), 0) AS available_quantity
         FROM cart_lines cl
         JOIN product_variants v ON v.id = cl.variant_id
         JOIN products p ON p.id = v.product_id
        WHERE cl.cart_id = ?
        ORDER BY cl.created_at, cl.id`,
    )
    .bind(cart.currency, now, now, cart.id)
    .all<LineRow>();
  return rows.results;
}

async function shippingQuotes(
  db: D1Database,
  cart: CartRow,
  subtotalAmount: number,
  totalWeightGrams: number,
): Promise<ShippingMethodQuote[]> {
  if (!cart.shipping_country) return [];
  const configuration = await loadRuntimeLaunchConfiguration(db);
  const rows = await db
    .prepare(
      `SELECT sm.id, sm.name, sm.calculation_type, sm.price_amount, sm.currency,
              sm.free_threshold_amount, sm.min_weight_grams, sm.max_weight_grams
         FROM shipping_methods sm
         JOIN shipping_zones sz ON sz.id = sm.zone_id
         JOIN shipping_zone_countries szc ON szc.zone_id = sz.id
        WHERE sz.status = 'active' AND sm.status = 'active' AND szc.country_code = ?
        ORDER BY sm.created_at, sm.id`,
    )
    .bind(cart.shipping_country)
    .all<ShippingMethodRow>();
  return quoteShippingMethods({
    currency: cart.currency,
    methods: rows.results
      .filter((row) => !configuration || configuration.shippingMethodIds.includes(row.id))
      .map((row) => ({
        calculationType: row.calculation_type,
        currency: row.currency,
        freeThresholdAmount: row.free_threshold_amount,
        id: row.id,
        maxWeightGrams: row.max_weight_grams,
        minWeightGrams: row.min_weight_grams,
        name: row.name,
        priceAmount: row.price_amount,
      })),
    subtotalAmount,
    totalWeightGrams,
  });
}

export async function quoteCart(
  db: D1Database,
  cart: CartRow,
  taxMode: ApiEnvironment["Bindings"]["TAX_MODE"],
): Promise<Cart> {
  const rows = await lineRows(db, cart);
  const context = parsePricingContext(cart.pricing_context_json);
  let pending = [...context.pendingAdjustments];
  const dynamic: CartAdjustment[] = [];
  let contextChanged = false;
  for (const row of rows) {
    if (row.unit_price === null) {
      dynamic.push({
        code: "product_changed",
        key: `product_changed:${row.variant_id}`,
        message: "This item is no longer sellable in the selected currency.",
        requiresAcknowledgement: false,
        variantId: row.variant_id,
      });
      continue;
    }
    const previous = context.priceSnapshots[row.variant_id];
    if (previous !== undefined && previous !== row.unit_price) {
      pending = upsertAdjustment(
        pending,
        priceAdjustment(row.variant_id, previous, row.unit_price),
      );
      context.priceSnapshots[row.variant_id] = row.unit_price;
      contextChanged = true;
    }
    if (row.quantity > row.available_quantity) {
      dynamic.push({
        code: "availability_changed",
        key: `availability_changed:${row.variant_id}`,
        message: `Only ${row.available_quantity} units are currently available.`,
        requiresAcknowledgement: false,
        variantId: row.variant_id,
      });
    }
  }
  if (contextChanged) {
    context.pendingAdjustments = pending;
    await db
      .prepare("UPDATE carts SET pricing_context_json = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(context), new Date().toISOString(), cart.id)
      .run();
  }
  const subtotal = rows.reduce((sum, row) => sum + (row.unit_price ?? 0) * row.quantity, 0);
  const totalWeight = rows.reduce((sum, row) => sum + row.weight_grams * row.quantity, 0);
  const methods = await shippingQuotes(db, cart, subtotal, totalWeight);
  const selected = methods.find((method) => method.id === cart.shipping_method_id) ?? null;
  if (cart.shipping_method_id && !selected) {
    dynamic.push({
      code: "destination_changed",
      key: "destination_changed:shipping_method",
      message: "The selected shipping method is unavailable for this destination.",
      requiresAcknowledgement: false,
    });
  }
  const tax = await configuredTaxPort(taxMode).quote({
    currency: cart.currency,
    destinationCountry: cart.shipping_country,
    taxableAmount: subtotal,
  });
  const totals = calculatePricing({
    currency: cart.currency,
    discount: createMoney(0, cart.currency),
    lines: rows
      .filter((row) => row.unit_price !== null)
      .map((row) => ({
        quantity: row.quantity,
        unitPrice: createMoney(row.unit_price!, cart.currency),
      })),
    shipping: createMoney(selected?.amount ?? 0, cart.currency),
    tax: createMoney(tax.amount, tax.currency),
  });
  return {
    adjustments: [...pending, ...dynamic],
    canCheckout: rows.length > 0 && pending.length === 0 && dynamic.length === 0,
    currency: cart.currency,
    expiresAt: cart.expires_at,
    id: cart.id,
    lines: rows.map((row) => ({
      availableQuantity: row.available_quantity,
      lineTotal: {
        amount: (row.unit_price ?? 0) * row.quantity,
        currency: cart.currency,
      },
      productName: row.product_name,
      quantity: row.quantity,
      unitPrice: { amount: row.unit_price ?? 0, currency: cart.currency },
      variantId: row.variant_id,
      variantName: row.variant_name,
    })),
    selectedShippingMethodId: selected?.id ?? null,
    shippingAddress: cart.shipping_address_json
      ? (JSON.parse(cart.shipping_address_json) as Cart["shippingAddress"])
      : null,
    shippingMethods: methods,
    totals,
  };
}

export async function createCart(
  context: CartContext,
  input: CreateCartRequest,
): Promise<{ cart: Cart; token: string }> {
  const configuration = await loadRuntimeLaunchConfiguration(context.env.DB);
  if (configuration && !configuration.sellableCurrencies.includes(input.currency)) {
    throw new ApiError(422, "currency_unavailable", "This currency is not enabled for checkout.");
  }
  const token = opaqueToken();
  const id = publicId("cart");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString();
  const pricingContext: PricingContext = { pendingAdjustments: [], priceSnapshots: {} };
  await context.env.DB.prepare(
    `INSERT INTO carts
      (id, public_token_hash, currency, pricing_context_json, promotion_context_json,
       shipping_country, shipping_address_json, shipping_method_id, status, expires_at,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', NULL, NULL, NULL, 'active', ?, ?, ?)`,
  )
    .bind(
      id,
      await sha256(token),
      input.currency,
      JSON.stringify(pricingContext),
      expiresAt,
      createdAt.toISOString(),
      createdAt.toISOString(),
    )
    .run();
  const cart = await context.env.DB.prepare(
    `SELECT id, currency, pricing_context_json, shipping_country, shipping_address_json,
            shipping_method_id, status, expires_at FROM carts WHERE id = ?`,
  )
    .bind(id)
    .first<CartRow>();
  return { cart: await quoteCart(context.env.DB, cart!, context.env.TAX_MODE), token };
}

export async function addCartLine(
  context: CartContext,
  cart: CartRow,
  input: AddCartLineRequest,
): Promise<Cart> {
  if (input.expectedUnitPrice && input.expectedUnitPrice.currency !== cart.currency) {
    throw new ApiError(
      422,
      "currency_mismatch",
      "The expected price currency does not match the cart.",
      [{ path: ["expectedUnitPrice", "currency"], expected: cart.currency }],
    );
  }
  const authority = await authoritativeVariant(context.env.DB, input.variantId, cart.currency);
  assertQuantity(input.quantity, authority.available_quantity);
  const pricingContext = parsePricingContext(cart.pricing_context_json);
  pricingContext.priceSnapshots[input.variantId] = authority.unit_price!;
  if (input.expectedUnitPrice && input.expectedUnitPrice.amount !== authority.unit_price) {
    pricingContext.pendingAdjustments = upsertAdjustment(
      pricingContext.pendingAdjustments,
      priceAdjustment(input.variantId, input.expectedUnitPrice.amount, authority.unit_price!),
    );
  }
  if (input.releaseId) pricingContext.releaseId = input.releaseId;
  const updatedAt = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO cart_lines (id, cart_id, variant_id, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cart_id, variant_id)
       DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at`,
    ).bind(publicId("line"), cart.id, input.variantId, input.quantity, updatedAt, updatedAt),
    context.env.DB.prepare(
      "UPDATE carts SET pricing_context_json = ?, updated_at = ? WHERE id = ?",
    ).bind(JSON.stringify(pricingContext), updatedAt, cart.id),
  ]);
  return quoteCart(
    context.env.DB,
    {
      ...cart,
      pricing_context_json: JSON.stringify(pricingContext),
    },
    context.env.TAX_MODE,
  );
}

export async function updateCartLine(
  context: CartContext,
  cart: CartRow,
  variantId: string,
  input: UpdateCartLineRequest,
): Promise<Cart> {
  const existing = await context.env.DB.prepare(
    "SELECT id FROM cart_lines WHERE cart_id = ? AND variant_id = ?",
  )
    .bind(cart.id, variantId)
    .first();
  if (!existing) throw new ApiError(404, "cart_line_not_found", "The cart line was not found.");
  const authority = await authoritativeVariant(context.env.DB, variantId, cart.currency);
  assertQuantity(input.quantity, authority.available_quantity);
  await context.env.DB.prepare(
    "UPDATE cart_lines SET quantity = ?, updated_at = ? WHERE cart_id = ? AND variant_id = ?",
  )
    .bind(input.quantity, new Date().toISOString(), cart.id, variantId)
    .run();
  return quoteCart(context.env.DB, cart, context.env.TAX_MODE);
}

export async function removeCartLine(
  context: CartContext,
  cart: CartRow,
  variantId: string,
): Promise<Cart> {
  const removed = await context.env.DB.prepare(
    "DELETE FROM cart_lines WHERE cart_id = ? AND variant_id = ?",
  )
    .bind(cart.id, variantId)
    .run();
  if (removed.meta.changes === 0) {
    throw new ApiError(404, "cart_line_not_found", "The cart line was not found.");
  }
  const pricingContext = parsePricingContext(cart.pricing_context_json);
  delete pricingContext.priceSnapshots[variantId];
  pricingContext.pendingAdjustments = pricingContext.pendingAdjustments.filter(
    (item) => item.variantId !== variantId,
  );
  await context.env.DB.prepare(
    "UPDATE carts SET pricing_context_json = ?, updated_at = ? WHERE id = ?",
  )
    .bind(JSON.stringify(pricingContext), new Date().toISOString(), cart.id)
    .run();
  return quoteCart(
    context.env.DB,
    {
      ...cart,
      pricing_context_json: JSON.stringify(pricingContext),
    },
    context.env.TAX_MODE,
  );
}

export async function acknowledgeAdjustments(
  context: CartContext,
  cart: CartRow,
  codes: string[],
): Promise<Cart> {
  const pricingContext = parsePricingContext(cart.pricing_context_json);
  const known = new Set(pricingContext.pendingAdjustments.map((item) => item.key));
  if (codes.some((code) => !known.has(code))) {
    throw new ApiError(
      422,
      "cart_adjustment_not_found",
      "One or more cart adjustments are no longer pending.",
      [{ path: ["codes"] }],
    );
  }
  pricingContext.pendingAdjustments = pricingContext.pendingAdjustments.filter(
    (item) => !codes.includes(item.key),
  );
  await context.env.DB.prepare(
    "UPDATE carts SET pricing_context_json = ?, updated_at = ? WHERE id = ?",
  )
    .bind(JSON.stringify(pricingContext), new Date().toISOString(), cart.id)
    .run();
  return quoteCart(
    context.env.DB,
    {
      ...cart,
      pricing_context_json: JSON.stringify(pricingContext),
    },
    context.env.TAX_MODE,
  );
}

export async function setCartShipping(
  context: CartContext,
  cart: CartRow,
  input: ShippingQuoteRequest,
): Promise<Cart> {
  const configuration = await loadRuntimeLaunchConfiguration(context.env.DB);
  if (
    configuration &&
    !configuration.shippingCountries.includes(input.shippingAddress.countryCode)
  ) {
    throw new ApiError(
      422,
      "shipping_destination_unavailable",
      "Shipping is not enabled for this country.",
      [{ path: ["shippingAddress", "countryCode"] }],
    );
  }
  const zone = await context.env.DB.prepare(
    `SELECT sz.id
       FROM shipping_zones sz
       JOIN shipping_zone_countries szc ON szc.zone_id = sz.id
      WHERE sz.status = 'active' AND szc.country_code = ? LIMIT 1`,
  )
    .bind(input.shippingAddress.countryCode)
    .first();
  if (!zone) {
    throw new ApiError(
      422,
      "shipping_destination_unavailable",
      "Shipping is not available for this country.",
      [{ path: ["shippingAddress", "countryCode"] }],
    );
  }
  const updated = {
    ...cart,
    shipping_address_json: JSON.stringify(input.shippingAddress),
    shipping_country: input.shippingAddress.countryCode,
    shipping_method_id: input.shippingMethodId ?? null,
  };
  const quote = await quoteCart(context.env.DB, updated, context.env.TAX_MODE);
  if (
    input.shippingMethodId &&
    !quote.shippingMethods.some((method) => method.id === input.shippingMethodId)
  ) {
    throw new ApiError(
      422,
      "shipping_method_unavailable",
      "The selected shipping method is unavailable.",
      [{ path: ["shippingMethodId"] }],
    );
  }
  await context.env.DB.prepare(
    `UPDATE carts
        SET shipping_country = ?, shipping_address_json = ?, shipping_method_id = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(
      input.shippingAddress.countryCode,
      JSON.stringify(input.shippingAddress),
      input.shippingMethodId ?? null,
      new Date().toISOString(),
      cart.id,
    )
    .run();
  return quote;
}
