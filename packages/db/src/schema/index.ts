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
    backorderedQuantity: integer("backordered_quantity").notNull().default(0),
    oversellLimit: integer("oversell_limit").notNull().default(0),
    version: integer("version").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.variantId, table.warehouseId] }),
    check("inventory_on_hand_nonnegative", sql`${table.onHandQuantity} >= 0`),
    check("inventory_reserved_nonnegative", sql`${table.reservedQuantity} >= 0`),
    check("inventory_backordered_nonnegative", sql`${table.backorderedQuantity} >= 0`),
    check(
      "inventory_conserved",
      sql`${table.reservedQuantity} + ${table.backorderedQuantity} <= ${table.onHandQuantity} + ${table.oversellLimit}`,
    ),
  ],
);

export const inventoryReservations = sqliteTable(
  "inventory_reservations",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id"),
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

export const inventoryReservationGroups = sqliteTable(
  "inventory_reservation_groups",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id").references(() => carts.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").unique(),
    status: text("status", {
      enum: ["active", "confirmed", "expired", "released"],
    }).notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("inventory_reservation_groups_expiry_idx").on(table.status, table.expiresAt, table.id),
  ],
);

export const inventoryReservationEvents = sqliteTable(
  "inventory_reservation_events",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => inventoryReservationGroups.id, { onDelete: "restrict" }),
    reservationId: text("reservation_id")
      .notNull()
      .references(() => inventoryReservations.id, { onDelete: "restrict" }),
    eventType: text("event_type", {
      enum: ["created", "confirmed", "expired", "released"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("inventory_reservation_events_type_unique").on(
      table.reservationId,
      table.eventType,
    ),
    index("inventory_reservation_events_group_idx").on(table.groupId, table.createdAt, table.id),
  ],
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
  reservationGroupId: text("reservation_group_id"),
  provider: text("provider").notNull(),
  providerSessionId: text("provider_session_id").unique(),
  providerPaymentId: text("provider_payment_id"),
  environment: text("environment", {
    enum: ["development", "staging", "production"],
  })
    .notNull()
    .default("development"),
  testMode: integer("test_mode", { mode: "boolean" }).notNull().default(false),
  providerSessionUrl: text("provider_session_url"),
  providerStatus: text("provider_status"),
  lastProviderEventCreatedAt: text("last_provider_event_created_at"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  currency: text("currency").notNull(),
  subtotalAmount: integer("subtotal_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  shippingAmount: integer("shipping_amount").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  grandTotalAmount: integer("grand_total_amount").notNull(),
  shippingAddressJson: text("shipping_address_json").notNull(),
  email: text("email"),
  snapshotJson: text("snapshot_json"),
  guestAccessTokenHash: text("guest_access_token_hash"),
  guestAccessExpiresAt: text("guest_access_expires_at"),
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

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    publicReference: text("public_reference").notNull().unique(),
    guestAccessTokenHash: text("guest_access_token_hash").notNull().unique(),
    guestAccessExpiresAt: text("guest_access_expires_at"),
    checkoutAttemptId: text("checkout_attempt_id")
      .notNull()
      .unique()
      .references(() => checkoutAttempts.id, { onDelete: "restrict" }),
    providerPaymentId: text("provider_payment_id"),
    environment: text("environment", {
      enum: ["development", "staging", "production"],
    })
      .notNull()
      .default("development"),
    testMode: integer("test_mode", { mode: "boolean" }).notNull().default(false),
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
  },
  (table) => [
    index("orders_reporting_idx").on(
      table.environment,
      table.testMode,
      table.currency,
      table.createdAt,
      table.id,
    ),
  ],
);

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
    processingAttemptCount: integer("processing_attempt_count").notNull().default(0),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_unique").on(table.provider, table.providerEventId),
    index("payment_events_order_idx").on(table.orderId, table.receivedAt),
  ],
);

export const refunds = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    providerRefundId: text("provider_refund_id").unique(),
    idempotencyKey: text("idempotency_key").unique(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["pending", "succeeded", "failed", "canceled"] }).notNull(),
    providerStatus: text("provider_status"),
    requestedBy: text("requested_by"),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (table) => [index("refunds_order_created_idx").on(table.orderId, table.createdAt, table.id)],
);

export const fulfillmentEvents = sqliteTable(
  "fulfillment_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("fulfillment_events_transition_unique").on(table.orderId, table.toStatus),
    index("fulfillment_events_order_idx").on(table.orderId, table.createdAt),
  ],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorId: text("actor_id"),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("order_events_transition_unique").on(table.orderId, table.toStatus),
    index("order_events_order_idx").on(table.orderId, table.createdAt, table.id),
  ],
);

export const refundEvents = sqliteTable(
  "refund_events",
  {
    id: text("id").primaryKey(),
    refundId: text("refund_id")
      .notNull()
      .references(() => refunds.id, { onDelete: "restrict" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    providerRefundId: text("provider_refund_id"),
    reason: text("reason"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("refund_events_transition_unique").on(table.refundId, table.toStatus),
    index("refund_events_refund_idx").on(table.refundId, table.createdAt, table.id),
  ],
);

export const notificationJobs = sqliteTable(
  "notification_jobs",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "restrict" }),
    checkoutAttemptId: text("checkout_attempt_id").references(() => checkoutAttempts.id, {
      onDelete: "restrict",
    }),
    providerEventId: text("provider_event_id").references(() => paymentEvents.id, {
      onDelete: "restrict",
    }),
    kind: text("kind", { enum: ["notification", "provider_recovery"] })
      .notNull()
      .default("notification"),
    type: text("type").notNull(),
    deduplicationKey: text("deduplication_key").notNull().unique(),
    payloadJson: text("payload_json").notNull(),
    status: text("status", {
      enum: ["pending", "processing", "sent", "failed", "dead_letter"],
    }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    attemptCycleCount: integer("attempt_cycle_count").notNull().default(0),
    nextAttemptAt: text("next_attempt_at"),
    claimExpiresAt: text("claim_expires_at"),
    enqueuedAt: text("enqueued_at"),
    sentAt: text("sent_at"),
    providerMessageId: text("provider_message_id"),
    deadLetteredAt: text("dead_lettered_at"),
    replayCount: integer("replay_count").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    ...timestamps,
  },
  (table) => [
    index("notification_jobs_dispatch_idx").on(
      table.status,
      table.nextAttemptAt,
      table.enqueuedAt,
      table.createdAt,
    ),
    index("notification_jobs_checkout_attempt_idx").on(table.checkoutAttemptId, table.createdAt),
    index("notification_jobs_provider_event_idx").on(table.providerEventId, table.createdAt),
  ],
);

export const notificationAttempts = sqliteTable(
  "notification_attempts",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => notificationJobs.id, { onDelete: "restrict" }),
    attemptNumber: integer("attempt_number").notNull(),
    result: text("result", {
      enum: ["sent", "retryable_failure", "permanent_failure", "exhausted"],
    }).notNull(),
    errorCode: text("error_code"),
    providerMessageId: text("provider_message_id"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at").notNull(),
  },
  (table) => [
    uniqueIndex("notification_attempts_job_number_unique").on(table.jobId, table.attemptNumber),
    index("notification_attempts_job_idx").on(table.jobId, table.attemptNumber),
  ],
);

export const reportExports = sqliteTable(
  "report_exports",
  {
    id: text("id").primaryKey(),
    environment: text("environment", {
      enum: ["development", "staging", "production"],
    }).notNull(),
    currency: text("currency").notNull(),
    timeZone: text("time_zone").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    queryJson: text("query_json").notNull(),
    status: text("status", {
      enum: ["pending", "processing", "ready", "failed", "expired"],
    }).notNull(),
    rowCount: integer("row_count"),
    objectKey: text("object_key").unique(),
    errorCode: text("error_code"),
    requestedBy: text("requested_by").notNull(),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("report_exports_requester_idx").on(table.requestedBy, table.createdAt, table.id),
    index("report_exports_expiry_idx").on(table.status, table.expiresAt),
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

export const storefrontExperienceDrafts = sqliteTable(
  "storefront_experience_drafts",
  {
    id: text("id").primaryKey(),
    experienceId: text("experience_id").notNull(),
    themeId: text("theme_id").notNull(),
    themeVersion: text("theme_version").notNull(),
    configurationSchemaVersion: integer("configuration_schema_version").notNull(),
    presetId: text("preset_id").notNull(),
    bindingsJson: text("bindings_json").notNull(),
    overridesJson: text("overrides_json").notNull(),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    ...timestamps,
  },
  (table) => [
    index("storefront_experience_drafts_experience_idx").on(table.experienceId, table.updatedAt),
    check("storefront_experience_drafts_version_positive", sql`${table.version} > 0`),
    check(
      "storefront_experience_drafts_schema_positive",
      sql`${table.configurationSchemaVersion} > 0`,
    ),
  ],
);

export const storefrontExperienceValidations = sqliteTable(
  "storefront_experience_validations",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => storefrontExperienceDrafts.id, { onDelete: "restrict" }),
    draftVersion: integer("draft_version").notNull(),
    status: text("status", { enum: ["valid", "invalid"] }).notNull(),
    issuesJson: text("issues_json").notNull(),
    resolvedTemplatesJson: text("resolved_templates_json").notNull(),
    validatedBy: text("validated_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("storefront_experience_validations_draft_version_unique").on(
      table.draftId,
      table.draftVersion,
    ),
    check("storefront_experience_validations_version_positive", sql`${table.draftVersion} > 0`),
  ],
);

export const storefrontExperienceMigrations = sqliteTable(
  "storefront_experience_migrations",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => storefrontExperienceDrafts.id, { onDelete: "restrict" }),
    draftVersion: integer("draft_version").notNull(),
    sourceThemeVersion: text("source_theme_version").notNull(),
    sourceConfigurationSchemaVersion: integer("source_configuration_schema_version").notNull(),
    targetThemeVersion: text("target_theme_version").notNull(),
    targetConfigurationSchemaVersion: integer("target_configuration_schema_version").notNull(),
    migratedOverridesJson: text("migrated_overrides_json").notNull(),
    conflictsJson: text("conflicts_json").notNull(),
    status: text("status", { enum: ["dry_run", "approved"] }).notNull(),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("storefront_experience_migrations_target_unique").on(
      table.draftId,
      table.draftVersion,
      table.targetThemeVersion,
      table.targetConfigurationSchemaVersion,
    ),
  ],
);

export const storefrontExperienceSnapshots = sqliteTable(
  "storefront_experience_snapshots",
  {
    id: text("id").primaryKey(),
    deduplicationKey: text("deduplication_key").notNull().unique(),
    experienceId: text("experience_id").notNull(),
    sourceDraftId: text("source_draft_id")
      .notNull()
      .references(() => storefrontExperienceDrafts.id, { onDelete: "restrict" }),
    sourceDraftVersion: integer("source_draft_version").notNull(),
    sourceValidationId: text("source_validation_id")
      .notNull()
      .references(() => storefrontExperienceValidations.id, { onDelete: "restrict" }),
    migrationId: text("migration_id").references(() => storefrontExperienceMigrations.id, {
      onDelete: "restrict",
    }),
    kind: text("kind", { enum: ["preview", "approved"] }).notNull(),
    themeId: text("theme_id").notNull(),
    themeVersion: text("theme_version").notNull(),
    configurationSchemaVersion: integer("configuration_schema_version").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("storefront_experience_snapshots_experience_idx").on(table.experienceId, table.createdAt),
  ],
);

export const storefrontPreviewBuilds = sqliteTable(
  "storefront_preview_builds",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => storefrontExperienceSnapshots.id, { onDelete: "restrict" }),
    attempt: integer("attempt").notNull(),
    status: text("status", {
      enum: ["pending", "building", "deployed", "failed", "expired"],
    }).notNull(),
    correlationId: text("correlation_id"),
    artifactDigest: text("artifact_digest"),
    artifactPrefix: text("artifact_prefix"),
    failureCode: text("failure_code"),
    expiresAt: text("expires_at"),
    completedAt: text("completed_at"),
    cleanedAt: text("cleaned_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("storefront_preview_builds_snapshot_attempt_unique").on(
      table.snapshotId,
      table.attempt,
    ),
    index("storefront_preview_builds_cleanup_idx").on(table.status, table.expiresAt),
  ],
);

export const storefrontPreviewGrants = sqliteTable(
  "storefront_preview_grants",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => storefrontExperienceSnapshots.id, { onDelete: "restrict" }),
    buildId: text("build_id")
      .notNull()
      .references(() => storefrontPreviewBuilds.id, { onDelete: "restrict" }),
    grantDigest: text("grant_digest").notNull().unique(),
    origin: text("origin").notNull(),
    expiresAt: text("expires_at").notNull(),
    redeemedAt: text("redeemed_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("storefront_preview_grants_expiry_idx").on(table.expiresAt, table.redeemedAt)],
);

export const storefrontPreviewSessions = sqliteTable(
  "storefront_preview_sessions",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => storefrontExperienceSnapshots.id, { onDelete: "restrict" }),
    buildId: text("build_id")
      .notNull()
      .references(() => storefrontPreviewBuilds.id, { onDelete: "restrict" }),
    sessionDigest: text("session_digest").notNull().unique(),
    origin: text("origin").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("storefront_preview_sessions_expiry_idx").on(table.expiresAt)],
);
