import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import * as z from "zod";

import {
  acknowledgeCartAdjustmentsSchema,
  addCartLineRequestSchema,
  auditQuerySchema,
  cancelOrderRequestSchema,
  catalogBuildResultSchema,
  createCartRequestSchema,
  createInventoryReservationRequestSchema,
  createPrivacyRequestSchema,
  checkoutRequestSchema,
  commerceFunnelEventSchema,
  fulfillmentTransitionRequestSchema,
  inventoryAdjustmentRequestSchema,
  reportExportRequestSchema,
  reportingQuerySchema,
  replayNotificationJobRequestSchema,
  refundRequestSchema,
  shippingQuoteRequestSchema,
  publicRuntimeConfigurationSchema,
  publicIdSchema,
  updateCartLineRequestSchema,
  updateLaunchConfigurationRequestSchema,
  upsertShippingZoneRequestSchema,
} from "@shoppp/contracts";

import {
  acknowledgeAdjustments,
  addCartLine,
  createCart,
  quoteCart,
  removeCartLine,
  requireCart,
  setCartShipping,
  updateCartLine,
} from "../cart/service";
import { createProduct, getProduct, listProducts, updateProduct } from "../catalog/products";
import { getLiveProduct } from "../catalog/public";
import { productDraftSchema, publicationSchema } from "../catalog/schemas";
import { transitionOrderFulfillment } from "../fulfillment/transitions";
import { listAuditEvents } from "../iam/audit";
import { permissionsForRole, requirePermission } from "../iam/permissions";
import { adjustInventory, getInventoryHistory, listInventory } from "../inventory/adjustments";
import { createCartReservation } from "../inventory/reservations";
import { uploadCatalogMedia } from "../media/uploads";
import {
  adminAuthentication,
  defaultAccessVerifier,
  type AccessVerifier,
} from "../middleware/auth";
import { idempotency } from "../middleware/idempotency";
import { parseJson } from "../middleware/validation";
import { getGuestOrderAccess } from "../orders/guest-access";
import { cancelOrder } from "../orders/cancel";
import { getOrderDetail, listOrders } from "../orders/queries";
import { PaymentProviderError, type PaymentProvider } from "../payments/port";
import { createHostedCheckout } from "../payments/session";
import { createStripePaymentProvider } from "../payments/stripe-adapter";
import { processPaymentWebhook } from "../payments/webhook";
import {
  createPrivacyRequest,
  downloadPrivacyExport,
  listPrivacyRequests,
} from "../privacy/service";
import { refundOrder } from "../refunds/service";
import {
  listNotificationJobs,
  NotificationRecoveryError,
  replayNotificationJob,
} from "../recovery/notification-jobs";
import { createReportExport, downloadReportExport, getReportExport } from "../reporting/export";
import { getRevenueReport, listReportOrders } from "../reporting/order-metrics";
import type { RateLimiter } from "../security/rate-limit";
import { protectCheckoutSubmission } from "../security/public-submission";
import { safeRequestId } from "../security/redaction";
import type { TurnstileVerifier } from "../security/turnstile";
import { getOperationalHealth } from "../observability/health";
import { observeCommerceEvent, observeRequest } from "../observability/logger";
import { protectAnalyticsSubmission } from "../security/public-analytics";
import {
  getLaunchConfiguration,
  updateLaunchConfiguration,
} from "../settings/launch-configuration";
import { listShippingZones, upsertShippingZone } from "../shipping/settings";
import {
  createPreviewToken,
  defaultBuildTrigger,
  publishProduct,
  recordCatalogBuildResult,
  type BuildTrigger,
} from "../publishing/releases";
import type { ApiEnvironment } from "./context";
import { ApiError, errorEnvelope } from "./errors";
import { assertEnvironmentIsolation } from "./environment";

export interface CreateAppOptions {
  readonly accessVerifier?: AccessVerifier;
  readonly analyticsRateLimiter?: RateLimiter;
  readonly buildManifestToken?: string;
  readonly buildTrigger?: BuildTrigger;
  readonly previewTokenSecret?: string;
  readonly paymentProvider?: PaymentProvider;
  readonly checkoutRateLimiter?: RateLimiter;
  readonly turnstileRequired?: boolean;
  readonly turnstileVerifier?: TurnstileVerifier;
}

const notificationJobQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    query: z.string().trim().min(1).max(160).optional(),
    status: z.enum(["pending", "processing", "sent", "failed", "dead_letter"]).optional(),
    type: z
      .enum([
        "order_receipt",
        "payment_failed",
        "cancellation",
        "refund",
        "shipment",
        "payment_reconciliation",
      ])
      .optional(),
  })
  .strict();
const reportOrderQuerySchema = reportingQuerySchema
  .extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    query: z.string().trim().max(160).optional(),
  })
  .strict();

function validatedQuery<Schema extends z.ZodType>(
  context: Context<ApiEnvironment>,
  schema: Schema,
): z.infer<Schema> {
  const parsed = schema.safeParse(context.req.query());
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_failed",
      "Request validation failed.",
      parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map(String),
      })),
    );
  }
  return parsed.data;
}

function requireBuildCredential(
  context: Context<ApiEnvironment>,
  configuredToken: string | undefined,
): void {
  if (!configuredToken || configuredToken.length < 32) {
    throw new ApiError(
      500,
      "build_manifest_not_configured",
      "The build manifest credential is not configured.",
    );
  }
  if (context.req.header("authorization") !== `Bearer ${configuredToken}`) {
    throw new ApiError(401, "build_manifest_unauthorized", "Build credential required.");
  }
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ApiEnvironment>();

  app.use("*", async (context, next) => {
    const startedAt = Date.now();
    const requestId = safeRequestId(context.req.header("x-request-id"));
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
    assertEnvironmentIsolation({
      environment: context.env.ENVIRONMENT,
      publicOrigin: context.env.PUBLIC_ORIGIN,
      resourceNamespace: context.env.RESOURCE_NAMESPACE,
    });
    try {
      await next();
      observeRequest(context, {
        durationMs: Date.now() - startedAt,
        status: context.res.status,
      });
    } catch (error) {
      observeRequest(context, {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error : new Error("Unknown request failure"),
        status: error instanceof ApiError ? error.status : 500,
      });
      throw error;
    }
  });
  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "internal_error", "An unexpected error occurred.");
    return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
  });
  app.notFound((context) =>
    context.json(
      errorEnvelope(
        new ApiError(404, "not_found", "The requested resource was not found."),
        context.get("requestId"),
      ),
      404,
    ),
  );

  app.get("/health", (context) =>
    context.json({ data: { status: "ok" }, meta: { requestId: context.get("requestId") } }),
  );
  const publicCors = cors({
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "X-Request-Id",
      "X-Turnstile-Token",
    ],
    allowMethods: ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
    credentials: false,
    origin: (origin, context) => (origin === context.env.STOREFRONT_ORIGIN ? origin : ""),
  });
  app.use("/cart", publicCors);
  app.use("/cart/*", publicCors);
  app.use("/catalog/*", publicCors);
  app.use("/checkout/*", publicCors);
  app.use("/platform/*", publicCors);
  app.use(
    "/checkout/sessions",
    protectCheckoutSubmission({
      ...(options.checkoutRateLimiter ? { rateLimiter: options.checkoutRateLimiter } : {}),
      ...(options.turnstileRequired === undefined
        ? {}
        : { turnstileRequired: options.turnstileRequired }),
      ...(options.turnstileVerifier ? { turnstileVerifier: options.turnstileVerifier } : {}),
    }),
  );
  app.use("/orders/*", publicCors);
  app.get("/platform/config", (context) => {
    const required = context.env.TURNSTILE_REQUIRED === "true";
    const configuration = publicRuntimeConfigurationSchema.parse({
      turnstile: {
        required,
        siteKey: required ? context.env.TURNSTILE_SITE_KEY?.trim() || null : null,
      },
    });
    context.header("Cache-Control", "no-store");
    return context.json({
      data: configuration,
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/platform/events",
    protectAnalyticsSubmission({
      ...(options.analyticsRateLimiter ? { rateLimiter: options.analyticsRateLimiter } : {}),
    }),
    async (context) => {
      const input = await parseJson(context, commerceFunnelEventSchema);
      observeCommerceEvent(context, input);
      context.header("Cache-Control", "no-store");
      return context.body(null, 204);
    },
  );
  app.get("/catalog/products/:slug/live", async (context) => {
    const currency = (context.req.query("currency") ?? "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ApiError(422, "validation_failed", "Request validation failed.", [
        { path: ["currency"], message: "Use a three-letter currency code." },
      ]);
    }
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await getLiveProduct(
        context.env.DB,
        context.req.param("slug"),
        currency,
        context.env.MEDIA_PUBLIC_ORIGIN,
      ),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/cart", idempotency("cart.create"), async (context) => {
    const input = await parseJson(context, createCartRequestSchema);
    const cart = await createCart(context, input);
    observeCommerceEvent(context, { event: "cart_created" });
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: cart, meta: { requestId: context.get("requestId") } }, 201);
  });
  app.get("/cart", async (context) => {
    const cart = await requireCart(context);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await quoteCart(context.env.DB, cart, context.env.TAX_MODE),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/cart/lines", idempotency("cart.lines.add"), async (context) => {
    const cart = await requireCart(context);
    const input = await parseJson(context, addCartLineRequestSchema);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await addCartLine(context, cart, input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.patch("/cart/lines/:variantId", idempotency("cart.lines.update"), async (context) => {
    const cart = await requireCart(context);
    const input = await parseJson(context, updateCartLineRequestSchema);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await updateCartLine(context, cart, context.req.param("variantId"), input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.delete("/cart/lines/:variantId", idempotency("cart.lines.delete"), async (context) => {
    const cart = await requireCart(context);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await removeCartLine(context, cart, context.req.param("variantId")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/cart/adjustments/acknowledge",
    idempotency("cart.adjustments.acknowledge"),
    async (context) => {
      const cart = await requireCart(context);
      const input = await parseJson(context, acknowledgeCartAdjustmentsSchema);
      context.header("Cache-Control", "private, no-store");
      return context.json({
        data: await acknowledgeAdjustments(context, cart, input.codes),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.put("/cart/shipping", idempotency("cart.shipping.quote"), async (context) => {
    const cart = await requireCart(context);
    const input = await parseJson(context, shippingQuoteRequestSchema);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await setCartShipping(context, cart, input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/cart/reservations", idempotency("inventory.reservations.create"), async (context) => {
    const cart = await requireCart(context);
    await parseJson(context, createInventoryReservationRequestSchema);
    context.header("Cache-Control", "private, no-store");
    return context.json(
      {
        data: await createCartReservation(context, cart),
        meta: { requestId: context.get("requestId") },
      },
      201,
    );
  });
  app.post("/checkout/sessions", idempotency("checkout.sessions.create"), async (context) => {
    const cart = await requireCart(context);
    const input = await parseJson(context, checkoutRequestSchema);
    context.header("Cache-Control", "private, no-store");
    try {
      const session = await createHostedCheckout(
        context,
        cart,
        input,
        options.paymentProvider ?? createStripePaymentProvider(context.env),
      );
      observeCommerceEvent(context, { event: "checkout_started" });
      return context.json(
        {
          data: session,
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error;
      const apiError = new ApiError(error.retryable ? 503 : 422, error.code, error.message);
      return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
    }
  });
  app.get("/orders/:token", async (context) => {
    const access = await getGuestOrderAccess(context.env.DB, context.req.param("token"));
    if (!access) {
      throw new ApiError(
        404,
        "order_access_not_found",
        "The order access link is invalid or expired.",
      );
    }
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    return context.json(
      { data: access, meta: { requestId: context.get("requestId") } },
      access.status === "pending" ? 202 : 200,
    );
  });
  app.post("/webhooks/stripe", async (context) =>
    context.json(
      await processPaymentWebhook(
        context,
        options.paymentProvider ?? createStripePaymentProvider(context.env),
      ),
    ),
  );
  app.get("/build/catalog/releases/:id", async (context) => {
    const expectedToken = options.buildManifestToken ?? context.env.BUILD_MANIFEST_TOKEN;
    requireBuildCredential(context, expectedToken);
    const release = await context.env.DB.prepare(
      `SELECT manifest_json
         FROM catalog_releases
        WHERE id = ? AND status IN ('approved', 'building', 'deployed')`,
    )
      .bind(context.req.param("id"))
      .first<{ manifest_json: string }>();
    if (!release) {
      throw new ApiError(404, "catalog_release_not_found", "The catalog release was not found.");
    }
    context.header("Cache-Control", "private, no-store");
    return context.json(JSON.parse(release.manifest_json));
  });
  app.post(
    "/build/catalog/releases/:id/status",
    async (context, next) => {
      requireBuildCredential(
        context,
        options.buildManifestToken ?? context.env.BUILD_MANIFEST_TOKEN,
      );
      await next();
    },
    idempotency("catalog.build.result"),
    async (context) => {
      const result = await parseJson(context, catalogBuildResultSchema);
      context.header("Cache-Control", "private, no-store");
      return context.json({
        data: await recordCatalogBuildResult(context, context.req.param("id"), result),
        meta: { requestId: context.get("requestId") },
      });
    },
  );

  app.use("/admin/*", async (context, next) => {
    context.header("Cache-Control", "private, no-store");
    await next();
  });
  app.use("/admin/*", adminAuthentication(options.accessVerifier ?? defaultAccessVerifier));
  app.get("/admin/session", (context) => {
    const principal = context.get("principal");
    return context.json({
      data: {
        displayName: principal.displayName,
        email: principal.email,
        permissions: permissionsForRole(principal.role),
        role: principal.role,
      },
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/settings/launch", async (context) => {
    await requirePermission(context, "settings.read", { type: "setting" });
    return context.json({
      data: await getLaunchConfiguration(context),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/settings/shipping", async (context) => {
    await requirePermission(context, "settings.read", { type: "shipping_zone" });
    return context.json({
      data: await listShippingZones(context.env.DB),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.put(
    "/admin/settings/shipping/zones/:id",
    async (context, next) => {
      await requirePermission(context, "settings.write", {
        id: context.req.param("id"),
        type: "shipping_zone",
      });
      await next();
    },
    idempotency("shipping.zone.upsert"),
    async (context) => {
      const input = await parseJson(context, upsertShippingZoneRequestSchema);
      const zoneId = publicIdSchema.safeParse(context.req.param("id"));
      if (!zoneId.success) {
        throw new ApiError(422, "shipping_zone_id_invalid", "The shipping zone ID is invalid.");
      }
      if (input.zone.id && input.zone.id !== zoneId.data) {
        throw new ApiError(
          422,
          "shipping_zone_id_mismatch",
          "The shipping zone path and payload identifiers must match.",
        );
      }
      return context.json({
        data: await upsertShippingZone(context, {
          ...input,
          zone: { ...input.zone, id: zoneId.data },
        }),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/settings/shipping/zones",
    async (context, next) => {
      await requirePermission(context, "settings.write", { type: "shipping_zone" });
      await next();
    },
    idempotency("shipping.zone.upsert"),
    async (context) => {
      const input = await parseJson(context, upsertShippingZoneRequestSchema);
      if (input.zone.id) {
        throw new ApiError(
          422,
          "shipping_zone_id_unexpected",
          "Create requests must not provide a shipping zone identifier.",
        );
      }
      return context.json(
        {
          data: await upsertShippingZone(context, input),
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    },
  );
  app.put(
    "/admin/settings/launch",
    async (context, next) => {
      await requirePermission(context, "settings.write", {
        id: "launch_configuration",
        type: "setting",
      });
      await next();
    },
    idempotency("settings.launch.update"),
    async (context) => {
      const input = await parseJson(context, updateLaunchConfigurationRequestSchema);
      return context.json({
        data: await updateLaunchConfiguration(context, input),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.get("/admin/audit", async (context) => {
    await requirePermission(context, "audit.read", { type: "audit_event" });
    const input = validatedQuery(context, auditQuerySchema);
    const result = await listAuditEvents(context.env.DB, input);
    return context.json({
      data: result.data,
      meta: { nextCursor: result.nextCursor, requestId: context.get("requestId") },
    });
  });
  app.get("/admin/operations/health", async (context) => {
    await requirePermission(context, "settings.read", { type: "operational_health" });
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await getOperationalHealth(context.env),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/privacy/requests", async (context) => {
    await requirePermission(context, "privacy.manage", { type: "privacy_request" });
    return context.json({
      data: await listPrivacyRequests(context.env.DB),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/admin/privacy/requests",
    async (context, next) => {
      await requirePermission(context, "privacy.manage", { type: "privacy_request" });
      await next();
    },
    idempotency("privacy.requests.create"),
    async (context) => {
      const input = await parseJson(context, createPrivacyRequestSchema);
      return context.json(
        {
          data: await createPrivacyRequest(context, input),
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    },
  );
  app.get("/admin/privacy/requests/:id/download", async (context) => {
    await requirePermission(context, "privacy.manage", {
      id: context.req.param("id"),
      type: "privacy_request",
    });
    return downloadPrivacyExport(context, context.req.param("id"));
  });
  app.get("/admin/catalog/products", async (context) => {
    await requirePermission(context, "catalog.read", { type: "product" });
    return context.json(await listProducts(context));
  });
  app.get("/admin/catalog/products/:id", async (context) => {
    await requirePermission(context, "catalog.read", {
      id: context.req.param("id"),
      type: "product",
    });
    return context.json({
      data: await getProduct(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/catalog/products", async (context) => {
    await requirePermission(context, "catalog.write", { type: "product" });
    const input = await parseJson(context, productDraftSchema);
    return context.json(
      {
        data: await createProduct(context, input),
        meta: { requestId: context.get("requestId") },
      },
      201,
    );
  });
  app.put("/admin/catalog/products/:id", async (context) => {
    const productId = context.req.param("id");
    await requirePermission(context, "catalog.write", { id: productId, type: "product" });
    const input = await parseJson(context, productDraftSchema);
    return context.json({
      data: await updateProduct(context, productId, input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.put("/admin/media/*", async (context) =>
    context.json(
      {
        data: await uploadCatalogMedia(context),
        meta: { requestId: context.get("requestId") },
      },
      201,
    ),
  );
  app.post("/admin/catalog/products/:id/preview", async (context) => {
    const productId = context.req.param("id");
    await requirePermission(context, "catalog.read", { id: productId, type: "product" });
    await getProduct(context.env.DB, productId);
    const secret = options.previewTokenSecret ?? context.env.PREVIEW_TOKEN_SECRET;
    if (!secret || secret.length < 32) {
      throw new ApiError(
        500,
        "preview_token_not_configured",
        "The preview token secret is not configured.",
      );
    }
    return context.json({
      data: await createPreviewToken(productId, secret),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/admin/catalog/products/:id/publish",
    idempotency("catalog.publish"),
    async (context) => {
      const productId = context.req.param("id");
      await requirePermission(context, "catalog.publish", { id: productId, type: "product" });
      const input = await parseJson(context, publicationSchema);
      return context.json(
        {
          data: await publishProduct(
            context,
            productId,
            options.buildTrigger ?? defaultBuildTrigger(context.env),
            input.reason,
          ),
          meta: { requestId: context.get("requestId") },
        },
        202,
      );
    },
  );
  app.get("/admin/inventory", async (context) => {
    await requirePermission(context, "inventory.read", { type: "inventory_item" });
    return context.json(await listInventory(context));
  });
  app.get("/admin/inventory/:variantId/:warehouseId", async (context) => {
    const variantId = context.req.param("variantId");
    const warehouseId = context.req.param("warehouseId");
    await requirePermission(context, "inventory.read", {
      id: variantId,
      type: "inventory_item",
    });
    return context.json(await getInventoryHistory(context, variantId, warehouseId));
  });
  app.post(
    "/admin/inventory/:variantId/:warehouseId/adjustments",
    idempotency("inventory.adjust"),
    async (context) => {
      const variantId = context.req.param("variantId");
      const warehouseId = context.req.param("warehouseId");
      await requirePermission(context, "inventory.adjust", {
        id: variantId,
        type: "inventory_item",
      });
      const input = await parseJson(context, inventoryAdjustmentRequestSchema);
      return context.json(await adjustInventory(context, variantId, warehouseId, input), 201);
    },
  );
  app.get("/admin/orders", async (context) => {
    await requirePermission(context, "orders.read", { type: "order" });
    return context.json(await listOrders(context));
  });
  app.get("/admin/reporting/revenue", async (context) => {
    await requirePermission(context, "reporting.read", { type: "commerce_report" });
    const input = validatedQuery(context, reportingQuerySchema);
    try {
      return context.json({
        data: await getRevenueReport(context.env.DB, context.env.ENVIRONMENT, input),
        meta: { requestId: context.get("requestId") },
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("reporting_")) throw error;
      throw new ApiError(422, error.message, "The reporting window is invalid.");
    }
  });
  app.get("/admin/reporting/orders", async (context) => {
    await requirePermission(context, "reporting.read", { type: "commerce_report" });
    const input = validatedQuery(context, reportOrderQuerySchema);
    try {
      const result = await listReportOrders(context.env.DB, context.env.ENVIRONMENT, {
        currency: input.currency,
        endDate: input.endDate,
        page: input.page,
        pageSize: input.pageSize,
        ...(input.query ? { query: input.query } : {}),
        startDate: input.startDate,
        timeZone: input.timeZone,
      });
      return context.json({
        data: result.data,
        meta: {
          currency: input.currency,
          endDate: input.endDate,
          page: result.page,
          pageSize: result.pageSize,
          requestId: context.get("requestId"),
          startDate: input.startDate,
          timeZone: input.timeZone,
          total: result.total,
        },
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("reporting_")) throw error;
      throw new ApiError(422, error.message, "The reporting window is invalid.");
    }
  });
  app.post(
    "/admin/reporting/exports",
    async (context, next) => {
      await requirePermission(context, "reporting.export", { type: "report_export" });
      await next();
    },
    idempotency("reporting.export"),
    async (context) => {
      const input = await parseJson(context, reportExportRequestSchema);
      try {
        return context.json(
          {
            data: await createReportExport(context, input),
            meta: { requestId: context.get("requestId") },
          },
          202,
        );
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("reporting_")) throw error;
        throw new ApiError(422, error.message, "The reporting window is invalid.");
      }
    },
  );
  app.get("/admin/reporting/exports/:id", async (context) => {
    await requirePermission(context, "reporting.export", {
      id: context.req.param("id"),
      type: "report_export",
    });
    return context.json({
      data: await getReportExport(context, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/reporting/exports/:id/download", async (context) => {
    await requirePermission(context, "reporting.export", {
      id: context.req.param("id"),
      type: "report_export",
    });
    return downloadReportExport(context, context.req.param("id"));
  });
  app.get("/admin/orders/:reference", async (context) => {
    const reference = context.req.param("reference");
    await requirePermission(context, "orders.read", { id: reference, type: "order" });
    return context.json({
      data: await getOrderDetail(context, reference),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post(
    "/admin/orders/:reference/fulfillment",
    async (context, next) => {
      const reference = context.req.param("reference");
      await requirePermission(context, "orders.fulfill", { id: reference, type: "order" });
      await next();
    },
    idempotency("orders.fulfillment"),
    async (context) => {
      const reference = context.req.param("reference");
      const input = await parseJson(context, fulfillmentTransitionRequestSchema);
      return context.json({
        data: await transitionOrderFulfillment(context, reference, input),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/orders/:reference/refunds",
    async (context, next) => {
      const reference = context.req.param("reference");
      await requirePermission(context, "orders.refund", { id: reference, type: "order" });
      await next();
    },
    idempotency("orders.refund"),
    async (context) => {
      const reference = context.req.param("reference");
      const input = await parseJson(context, refundRequestSchema);
      try {
        return context.json({
          data: await refundOrder(
            context,
            reference,
            input,
            options.paymentProvider ?? createStripePaymentProvider(context.env),
          ),
          meta: { requestId: context.get("requestId") },
        });
      } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        const apiError = new ApiError(error.retryable ? 503 : 422, error.code, error.message);
        return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
      }
    },
  );
  app.post(
    "/admin/orders/:reference/cancel",
    async (context, next) => {
      const reference = context.req.param("reference");
      await requirePermission(context, "orders.cancel", { id: reference, type: "order" });
      await next();
    },
    idempotency("orders.cancel"),
    async (context) => {
      const reference = context.req.param("reference");
      const input = await parseJson(context, cancelOrderRequestSchema);
      try {
        return context.json({
          data: await cancelOrder(
            context,
            reference,
            input,
            options.paymentProvider ?? createStripePaymentProvider(context.env),
          ),
          meta: { requestId: context.get("requestId") },
        });
      } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        const apiError = new ApiError(error.retryable ? 503 : 422, error.code, error.message);
        return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
      }
    },
  );
  app.get("/admin/operations/jobs", async (context) => {
    await requirePermission(context, "operations.jobs.read", {
      type: "notification_job",
    });
    const parsed = notificationJobQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation_failed",
        "Request validation failed.",
        parsed.error.issues.map((issue) => ({
          message: issue.message,
          path: issue.path.map(String),
        })),
      );
    }
    const result = await listNotificationJobs(context.env.DB, {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      ...(parsed.data.query ? { query: parsed.data.query } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    });
    return context.json({
      data: result.data,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        requestId: context.get("requestId"),
        total: result.total,
      },
    });
  });
  app.post(
    "/admin/operations/jobs/:id/replay",
    async (context, next) => {
      await requirePermission(context, "operations.replay", {
        id: context.req.param("id"),
        type: "notification_job",
      });
      await next();
    },
    idempotency("operations.notifications.replay"),
    async (context) => {
      const input = await parseJson(context, replayNotificationJobRequestSchema);
      try {
        await replayNotificationJob(context.env.DB, context.req.param("id"), {
          actorId: context.get("principal").id,
          reason: input.reason,
          requestId: context.get("requestId"),
        });
      } catch (error) {
        if (!(error instanceof NotificationRecoveryError)) throw error;
        throw new ApiError(409, error.code, error.message);
      }
      const result = await listNotificationJobs(context.env.DB, {
        page: 1,
        pageSize: 1,
        query: context.req.param("id"),
      });
      return context.json({
        data: result.data[0],
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  return app;
}
