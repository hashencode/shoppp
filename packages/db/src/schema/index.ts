import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["draft", "scheduled", "published", "archived"] }).notNull(),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    publishedAt: text("published_at"),
    scheduledAt: text("scheduled_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("products_slug_unique").on(table.slug)],
);

export const productMedia = sqliteTable(
  "product_media",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id"),
    r2Key: text("r2_key").notNull().unique(),
    altText: text("alt_text").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("product_media_product_idx").on(table.productId, table.position),
    check("product_media_width_positive", sql`${table.width} > 0`),
    check("product_media_height_positive", sql`${table.height} > 0`),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    optionValuesJson: text("option_values_json").notNull().default("{}"),
    weightGrams: integer("weight_grams").notNull(),
    lengthMm: integer("length_mm").notNull().default(0),
    widthMm: integer("width_mm").notNull().default(0),
    heightMm: integer("height_mm").notNull().default(0),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_variants_sku_unique").on(table.sku),
    index("product_variants_product_idx").on(table.productId, table.status),
    check("product_variants_weight_nonnegative", sql`${table.weightGrams} >= 0`),
  ],
);

export const priceLists = sqliteTable(
  "price_lists",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("price_lists_code_unique").on(table.code)],
);

export const prices = sqliteTable(
  "prices",
  {
    id: text("id").primaryKey(),
    priceListId: text("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "restrict" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("prices_list_variant_unique").on(table.priceListId, table.variantId),
    check("prices_amount_nonnegative", sql`${table.amount} >= 0`),
  ],
);

export const warehouses = sqliteTable("warehouses", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    onHandQuantity: integer("on_hand_quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    oversellLimit: integer("oversell_limit").notNull().default(0),
    version: integer("version").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.variantId, table.warehouseId] }),
    check("inventory_on_hand_nonnegative", sql`${table.onHandQuantity} >= 0`),
    check("inventory_reserved_nonnegative", sql`${table.reservedQuantity} >= 0`),
    check(
      "inventory_conserved",
      sql`${table.reservedQuantity} <= ${table.onHandQuantity} + ${table.oversellLimit}`,
    ),
  ],
);

export const inventoryReservations = sqliteTable(
  "inventory_reservations",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id"),
    checkoutAttemptId: text("checkout_attempt_id"),
    variantId: text("variant_id").notNull(),
    warehouseId: text("warehouse_id").notNull(),
    quantity: integer("quantity").notNull(),
    status: text("status", {
      enum: ["active", "confirmed", "expired", "released"],
    }).notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("inventory_reservations_expiry_idx").on(table.status, table.expiresAt),
    check("reservation_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const carts = sqliteTable(
  "carts",
  {
    id: text("id").primaryKey(),
    publicTokenHash: text("public_token_hash").notNull().unique(),
    currency: text("currency").notNull(),
    pricingContextJson: text("pricing_context_json").notNull().default("{}"),
    promotionContextJson: text("promotion_context_json").notNull().default("{}"),
    shippingCountry: text("shipping_country"),
    shippingAddressJson: text("shipping_address_json"),
    shippingMethodId: text("shipping_method_id"),
    status: text("status", { enum: ["active", "converted", "expired"] }).notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [index("carts_status_expiry_idx").on(table.status, table.expiresAt)],
);

export const cartLines = sqliteTable(
  "cart_lines",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cart_lines_cart_variant_unique").on(table.cartId, table.variantId),
    index("cart_lines_cart_idx").on(table.cartId, table.createdAt),
    check("cart_lines_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const shippingZones = sqliteTable("shipping_zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "disabled"] }).notNull(),
  ...timestamps,
});

export const shippingZoneCountries = sqliteTable(
  "shipping_zone_countries",
  {
    zoneId: text("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
  },
  (table) => [primaryKey({ columns: [table.zoneId, table.countryCode] })],
);

export const shippingMethods = sqliteTable(
  "shipping_methods",
  {
    id: text("id").primaryKey(),
    zoneId: text("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    calculationType: text("calculation_type", { enum: ["flat", "weight"] }).notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull(),
    freeThresholdAmount: integer("free_threshold_amount"),
    minWeightGrams: integer("min_weight_grams"),
    maxWeightGrams: integer("max_weight_grams"),
    status: text("status", { enum: ["active", "disabled"] }).notNull(),
    ...timestamps,
  },
  (table) => [index("shipping_methods_zone_idx").on(table.zoneId, table.status)],
);

export const checkoutAttempts = sqliteTable("checkout_attempts", {
  id: text("id").primaryKey(),
  cartId: text("cart_id")
    .notNull()
    .references(() => carts.id, { onDelete: "restrict" }),
  reservationId: text("reservation_id"),
  provider: text("provider").notNull(),
  providerSessionId: text("provider_session_id").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  currency: text("currency").notNull(),
  subtotalAmount: integer("subtotal_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  shippingAmount: integer("shipping_amount").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  grandTotalAmount: integer("grand_total_amount").notNull(),
  shippingAddressJson: text("shipping_address_json").notNull(),
  status: text("status", {
    enum: ["validating", "payment_pending", "completed", "failed", "expired"],
  }).notNull(),
  ...timestamps,
});

export const catalogReleases = sqliteTable(
  "catalog_releases",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: ["approved", "building", "deployed", "failed"] }).notNull(),
    manifestJson: text("manifest_json").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at").notNull(),
    deployedAt: text("deployed_at"),
    failureCode: text("failure_code"),
    buildCorrelationId: text("build_correlation_id"),
    productId: text("product_id").references(() => products.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("catalog_releases_build_correlation_idx").on(table.buildCorrelationId),
    index("catalog_releases_product_idx").on(table.productId, table.createdAt),
  ],
);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  publicReference: text("public_reference").notNull().unique(),
  guestAccessTokenHash: text("guest_access_token_hash").notNull().unique(),
  checkoutAttemptId: text("checkout_attempt_id")
    .notNull()
    .unique()
    .references(() => checkoutAttempts.id, { onDelete: "restrict" }),
  email: text("email").notNull(),
  currency: text("currency").notNull(),
  subtotalAmount: integer("subtotal_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  shippingAmount: integer("shipping_amount").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  grandTotalAmount: integer("grand_total_amount").notNull(),
  paymentStatus: text("payment_status").notNull(),
  orderStatus: text("order_status").notNull(),
  fulfillmentStatus: text("fulfillment_status").notNull(),
  ...timestamps,
});

export const orderLines = sqliteTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  productId: text("product_id").notNull(),
  variantId: text("variant_id").notNull(),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  optionValuesJson: text("option_values_json").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceAmount: integer("unit_price_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  lineTotalAmount: integer("line_total_amount").notNull(),
  currency: text("currency").notNull(),
});

export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
    checkoutAttemptId: text("checkout_attempt_id").references(() => checkoutAttempts.id, {
      onDelete: "restrict",
    }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    providerCreatedAt: text("provider_created_at"),
    receivedAt: text("received_at").notNull(),
    processedAt: text("processed_at"),
    result: text("result", { enum: ["applied", "ignored", "failed"] }),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_unique").on(table.provider, table.providerEventId),
    index("payment_events_order_idx").on(table.orderId, table.receivedAt),
  ],
);

export const idempotencyClaims = sqliteTable(
  "idempotency_claims",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBodyJson: text("response_body_json"),
    state: text("state", { enum: ["processing", "completed", "failed"] }).notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idempotency_scope_key_unique").on(table.scope, table.key),
    index("idempotency_expiry_idx").on(table.state, table.expiresAt),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    result: text("result").notNull(),
    reason: text("reason"),
    requestId: text("request_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("audit_target_idx").on(table.targetType, table.targetId, table.createdAt)],
);
