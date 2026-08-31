import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import * as z from "zod";

import {
  acknowledgeCartAdjustmentsSchema,
  addCartLineRequestSchema,
  adminAccountActivationRequestSchema,
  adminInvitationListQuerySchema,
  adminListQuerySchema,
  adminPasswordChangeRequestSchema,
  adminPasswordLoginRequestSchema,
  adminPasswordResetConfirmRequestSchema,
  adminPasswordResetRequestSchema,
  adminUserListQuerySchema,
  approveStorefrontExperienceDraftRequestSchema,
  approveStorefrontExperienceMigrationRequestSchema,
  auditQuerySchema,
  cancelOrderRequestSchema,
  catalogBuildResultSchema,
  createCartRequestSchema,
  createInventoryReservationRequestSchema,
  createPrivacyRequestSchema,
  createStorefrontExperienceBuildRequestSchema,
  createStorefrontExperienceDraftRequestSchema,
  createStorefrontExperienceSuccessorRequestSchema,
  createStorefrontPreviewGrantRequestSchema,
  checkoutRequestSchema,
  commerceFunnelEventSchema,
  createAdminInvitationRequestSchema,
  createAdminRoleRequestSchema,
  fulfillmentTransitionRequestSchema,
  inventoryAdjustmentRequestSchema,
  reportExportRequestSchema,
  reportingQuerySchema,
  replayNotificationJobRequestSchema,
  resendAdminInvitationRequestSchema,
  revokeAdminInvitationRequestSchema,
  refundRequestSchema,
  shippingQuoteRequestSchema,
  publicRuntimeConfigurationSchema,
  redeemStorefrontPreviewGrantRequestSchema,
  revokeStorefrontPreviewAccessRequestSchema,
  resolveStorefrontExperienceDraftRequestSchema,
  publicIdSchema,
  updateCartLineRequestSchema,
  updateAdminRoleRequestSchema,
  updateAdminUserRequestSchema,
  updateStorefrontExperienceDraftRequestSchema,
  updateLaunchConfigurationRequestSchema,
  upsertShippingZoneRequestSchema,
  validateStorefrontExperienceDraftRequestSchema,
  storefrontExperienceBuildResultSchema,
  storefrontExperienceMigrationDryRunRequestSchema,
  storefrontResourceKindSchema,
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
import { getLiveProduct, getLiveProductById } from "../catalog/public";
import { productDraftSchema, publicationSchema } from "../catalog/schemas";
import { transitionOrderFulfillment } from "../fulfillment/transitions";
import { listAuditEvents } from "../iam/audit";
import { createAdminRole, getAdminRole, listAdminRoles, updateAdminRole } from "../iam/admin-roles";
import { getAdminUser, listAdminUsers, updateAdminUser } from "../iam/admin-users";
import {
  createAdminInvitation,
  listAdminInvitations,
  resendAdminInvitation,
  revokeAdminInvitation,
} from "../iam/invitations";
import { requirePermission } from "../iam/permissions";
import {
  activateAdminAccount,
  changePassword,
  confirmPasswordReset,
  loginWithPassword,
  logoutPasswordSession,
  requestPasswordReset,
} from "../iam/password-auth";
import { adjustInventory, getInventoryHistory, listInventory } from "../inventory/adjustments";
import { createCartReservation } from "../inventory/reservations";
import { uploadCatalogMedia } from "../media/uploads";
import { listCatalogMedia } from "../media/library";
import {
  getCanonicalDeployedCatalogRelease,
  listStorefrontCatalogResources,
  listStorefrontCatalogReleases,
} from "../storefront-experience/catalog-resources";
import { adminAuthentication, type TestIdentityVerifier } from "../middleware/auth";
import { adminOriginProtection, isAllowedAdminBrowserOrigin } from "../middleware/admin-origin";
import { idempotency } from "../middleware/idempotency";
import { parseJson } from "../middleware/validation";
import { getGuestOrderAccess } from "../orders/guest-access";
import { cancelOrder } from "../orders/cancel";
import { getOrderDetail, listOrders } from "../orders/queries";
import { PaymentProviderError, type PaymentProvider } from "../payments/port";
import { createHostedCheckout } from "../payments/session";
import {
  createStripePaymentProvider,
  type StripeTestSettlementProvider,
} from "../payments/stripe-adapter";
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
import {
  assertManualFashionPreparationNamespace,
  defaultExperienceBuildTrigger,
  getStorefrontExperienceBuild,
  getStorefrontExperienceBuildManifest,
  getStorefrontExperienceBuildManifestByBuild,
  getLatestDeployedStorefrontExperiencePreview,
  manualFashionPreparationBuildTrigger,
  recordStorefrontExperienceBuildResult,
  triggerStorefrontExperienceBuild,
  type ExperienceBuildTrigger,
} from "../storefront-experience/build";
import {
  authorizeStorefrontPreviewSession,
  createStorefrontPreviewGrant,
  redeemStorefrontPreviewGrant,
  requirePreviewServiceCredential,
  revokeStorefrontPreviewAccess,
} from "../storefront-experience/preview";
import {
  approveStorefrontExperienceDraft,
  approveStorefrontExperienceMigration,
  createStorefrontExperienceDraft,
  createStorefrontExperienceSuccessor,
  createStorefrontExperiencePreviewSnapshot,
  dryRunStorefrontExperienceMigration,
  getStorefrontExperienceDraft,
  getStorefrontExperienceSnapshot,
  listStorefrontExperienceDrafts,
  listStorefrontThemes,
  updateStorefrontExperienceDraft,
  validateStorefrontExperienceDraft,
  type StorefrontExperienceServiceOptions,
} from "../storefront-experience/service";
import {
  acquireFashionStagingAcceptance,
  cleanupFashionStagingAcceptance,
  reconcileAbandonedFashionStagingAcceptance,
  recordFashionStagingJourneyFailure,
  registerFashionStagingResource,
  settleFashionStagingTestPayment,
  startFashionStagingAcceptance,
} from "../testing/fashion-staging";
import {
  consumeFashionStagingOperatorRun,
  createFashionStagingOperatorRun,
  getFashionStagingOperatorRun,
  getFashionStagingOperatorRunForDraft,
  rejectFashionStagingOperatorRun,
  supersedeFashionStagingOperatorRun,
} from "../testing/fashion-staging-operator";
import type { ApiEnvironment } from "./context";
import { ApiError, errorEnvelope } from "./errors";
import { assertEnvironmentIsolation } from "./environment";

export interface CreateAppOptions {
  readonly testIdentityVerifier?: TestIdentityVerifier;
  readonly analyticsRateLimiter?: RateLimiter;
  readonly buildManifestToken?: string;
  readonly buildTrigger?: BuildTrigger;
  readonly experienceBuildTrigger?: ExperienceBuildTrigger;
  readonly fashionTestSettlementProvider?: StripeTestSettlementProvider;
  readonly storefrontExperienceServiceOptions?: StorefrontExperienceServiceOptions;
  readonly previewTokenSecret?: string;
  readonly paymentProvider?: PaymentProvider;
  readonly checkoutRateLimiter?: RateLimiter;
  readonly exposePasswordResetToken?: boolean;
  readonly passwordResetSecret?: string;
  readonly turnstileRequired?: boolean;
  readonly turnstileVerifier?: TurnstileVerifier;
}

function requireAdminBrowserOrigin(context: Context<ApiEnvironment>): void {
  if (
    !isAllowedAdminBrowserOrigin(
      context.env,
      context.req.header("Origin"),
      context.req.header("Sec-Fetch-Site"),
    )
  ) {
    throw new ApiError(403, "admin_origin_denied", "The admin request origin is not allowed.");
  }
}

function passwordResetSecret(context: Context<ApiEnvironment>, options: CreateAppOptions): string {
  const secret = options.passwordResetSecret ?? context.env.AUTH_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(
      500,
      "admin_auth_not_configured",
      "Administrator authentication is not configured.",
    );
  }
  return secret;
}

function adminSessionData(context: Context<ApiEnvironment>) {
  const principal = context.get("principal");
  return {
    displayName: principal.displayName,
    environment:
      context.env.ENVIRONMENT === "production" ? ("production" as const) : ("test" as const),
    identityId: principal.id,
    permissions: principal.permissions,
    principalKind: principal.principalKind,
    role: principal.role,
    ...(principal.principalKind === "human"
      ? { email: principal.email }
      : { serviceName: principal.serviceName }),
  };
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
        "admin_invitation",
        "admin_password_reset",
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
const storefrontPreviewContextQuerySchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160).optional(),
    draftVersion: z.coerce.number().int().positive(),
  })
  .strict();
const stableIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/);
const fashionAcceptanceAcquireSchema = z
  .object({
    artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
    catalogReleaseId: stableIdentifierSchema,
    commitSha: z.string().regex(/^[a-f0-9]{40}$/),
    experienceSnapshotId: stableIdentifierSchema,
    leaseMinutes: z.number().int().min(5).max(240).optional(),
    minimumSellableQuantity: z.number().int().positive().optional(),
    owner: stableIdentifierSchema,
    runId: stableIdentifierSchema,
    seedManifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    variantId: stableIdentifierSchema,
    warehouseId: stableIdentifierSchema,
  })
  .strict();
const fashionAcceptanceOwnerSchema = z.object({ owner: stableIdentifierSchema }).strict();
const fashionAcceptanceResourceSchema = fashionAcceptanceOwnerSchema
  .extend({
    resourceId: stableIdentifierSchema,
    resourceType: z.enum(["cart", "checkout_attempt", "order", "reservation", "reservation_group"]),
  })
  .strict();
const fashionAcceptanceFailureSchema = fashionAcceptanceOwnerSchema
  .extend({ failure: z.string().trim().min(1).max(500) })
  .strict();
const fashionAcceptanceSettlementSchema = fashionAcceptanceOwnerSchema
  .extend({ checkoutAttemptId: stableIdentifierSchema })
  .strict();
const fashionOperatorRunSchema = z
  .object({
    candidateSha: z.string().regex(/^[a-f0-9]{40}$/),
    catalogReleaseId: stableIdentifierSchema,
    contractTestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.string().datetime({ offset: false }),
    harnessManifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    harnessSha: z.string().regex(/^[a-f0-9]{40}$/),
    repository: z.literal("hashencode/shoppp"),
    runId: stableIdentifierSchema,
    runManifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sourceDraftId: stableIdentifierSchema,
    u12ReadinessDigest: z.string().regex(/^[a-f0-9]{64}$/),
    u12SnapshotId: stableIdentifierSchema,
    workflowRunAttempt: z.number().int().positive(),
    workflowRunId: z.string().regex(/^[1-9][0-9]*$/),
  })
  .strict();
const fashionOperatorRunConsumeSchema = z
  .object({
    approvalAuditId: stableIdentifierSchema,
    successorSnapshotId: stableIdentifierSchema,
  })
  .strict();
const fashionOperatorRunRejectSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();
const fashionOperatorRunSupersedeSchema = fashionOperatorRunRejectSchema
  .extend({ replacementHarnessSha: z.string().regex(/^[a-f0-9]{40}$/) })
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

function requireFashionAcceptanceCredential(context: Context<ApiEnvironment>): void {
  const token = context.env.FASHION_ACCEPTANCE_TOKEN;
  if (
    context.env.ENVIRONMENT !== "staging" ||
    context.env.RESOURCE_NAMESPACE !== "shoppp-fashion-staging" ||
    !token ||
    token.length < 32
  ) {
    throw new ApiError(
      404,
      "fashion_staging_acceptance_unavailable",
      "Fashion staging acceptance is unavailable.",
    );
  }
  if (context.req.header("authorization") !== `Bearer ${token}`) {
    throw new ApiError(
      401,
      "fashion_staging_acceptance_unauthorized",
      "Fashion staging acceptance credential required.",
    );
  }
}

function previewSessionCredential(context: Context<ApiEnvironment>): string {
  const cookie = context.req.header("cookie") ?? "";
  const session = cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("__Host-shoppp-preview="))
    ?.slice("__Host-shoppp-preview=".length);
  if (!session || !/^[A-Za-z0-9_-]{32,256}$/.test(session)) {
    throw new ApiError(
      401,
      "storefront_preview_session_required",
      "A private preview session is required.",
    );
  }
  return session;
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
  app.post("/internal/testing/fashion-staging/runs", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceAcquireSchema);
    const acquired = await acquireFashionStagingAcceptance(context.env.DB, {
      artifactDigest: input.artifactDigest,
      catalogReleaseId: input.catalogReleaseId,
      commitSha: input.commitSha,
      environment: "fashion-staging",
      experienceSnapshotId: input.experienceSnapshotId,
      ...(input.leaseMinutes === undefined ? {} : { leaseMinutes: input.leaseMinutes }),
      ...(input.minimumSellableQuantity === undefined
        ? {}
        : { minimumSellableQuantity: input.minimumSellableQuantity }),
      owner: input.owner,
      runId: input.runId,
      seedManifestDigest: input.seedManifestDigest,
      variantId: input.variantId,
      warehouseId: input.warehouseId,
    });
    await startFashionStagingAcceptance(context.env.DB, input.runId, input.owner);
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: acquired, meta: { requestId: context.get("requestId") } }, 201);
  });
  app.post("/internal/testing/fashion-staging/runs/:id/resources", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceResourceSchema);
    await registerFashionStagingResource(
      context.env.DB,
      context.req.param("id"),
      input.owner,
      input.resourceType,
      input.resourceId,
    );
    context.header("Cache-Control", "private, no-store");
    return context.body(null, 204);
  });
  app.post("/internal/testing/fashion-staging/runs/:id/settle", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceSettlementSchema);
    try {
      const result = await settleFashionStagingTestPayment(
        context.env.DB,
        context.req.param("id"),
        input.owner,
        input.checkoutAttemptId,
        options.fashionTestSettlementProvider ?? createStripePaymentProvider(context.env),
      );
      context.header("Cache-Control", "private, no-store");
      return context.json({ data: result, meta: { requestId: context.get("requestId") } });
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error;
      const apiError = new ApiError(error.retryable ? 503 : 422, error.code, error.message);
      return context.json(errorEnvelope(apiError, context.get("requestId")), apiError.status);
    }
  });
  app.post("/internal/testing/fashion-staging/runs/:id/failure", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceFailureSchema);
    await recordFashionStagingJourneyFailure(
      context.env.DB,
      context.req.param("id"),
      input.owner,
      input.failure,
    );
    context.header("Cache-Control", "private, no-store");
    return context.body(null, 204);
  });
  app.post("/internal/testing/fashion-staging/runs/:id/cleanup", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceOwnerSchema);
    const result = await cleanupFashionStagingAcceptance(
      context.env.DB,
      context.req.param("id"),
      input.owner,
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
  app.post("/internal/testing/fashion-staging/runs/:id/reconcile", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionAcceptanceOwnerSchema);
    const result = await reconcileAbandonedFashionStagingAcceptance(
      context.env.DB,
      context.req.param("id"),
      input.owner,
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
  app.post("/internal/testing/fashion-staging/operator-runs", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionOperatorRunSchema);
    const result = await createFashionStagingOperatorRun(context.env.DB, {
      ...input,
      environment: "fashion-staging",
    });
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } }, 201);
  });
  app.get("/internal/testing/fashion-staging/operator-runs/:id", async (context) => {
    requireFashionAcceptanceCredential(context);
    const result = await getFashionStagingOperatorRun(context.env.DB, context.req.param("id"));
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
  app.post("/internal/testing/fashion-staging/operator-runs/:id/reject", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionOperatorRunRejectSchema);
    const result = await rejectFashionStagingOperatorRun(
      context.env.DB,
      context.req.param("id"),
      input.reason,
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
  app.post("/internal/testing/fashion-staging/operator-runs/:id/supersede", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionOperatorRunSupersedeSchema);
    const result = await supersedeFashionStagingOperatorRun(
      context.env.DB,
      context.req.param("id"),
      input.replacementHarnessSha,
      input.reason,
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
  app.post("/internal/testing/fashion-staging/operator-runs/:id/consume", async (context) => {
    requireFashionAcceptanceCredential(context);
    const input = await parseJson(context, fashionOperatorRunConsumeSchema);
    const result = await consumeFashionStagingOperatorRun(
      context.env.DB,
      context.req.param("id"),
      input.successorSnapshotId,
      input.approvalAuditId,
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({ data: result, meta: { requestId: context.get("requestId") } });
  });
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
  app.get("/catalog/products/by-id/:id/live", async (context) => {
    const currency = (context.req.query("currency") ?? "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ApiError(422, "validation_failed", "Request validation failed.", [
        { path: ["currency"], message: "Use a three-letter currency code." },
      ]);
    }
    const releaseId = context.req.header("x-preview-catalog-release");
    if (!releaseId) {
      throw new ApiError(
        422,
        "catalog_release_required",
        "A deployed Catalog Release is required for stable product lookup.",
      );
    }
    const release = await getCanonicalDeployedCatalogRelease(context.env.DB, releaseId, {
      allowStagingProof: context.env.ENVIRONMENT === "staging",
    });
    const releaseProduct = release.products.find(
      (product) => product.id === context.req.param("id") && product.status === "published",
    );
    if (!releaseProduct) {
      throw new ApiError(
        404,
        "product_not_in_release",
        "The product was not found in this Catalog Release.",
      );
    }
    const product = await getLiveProductById(
      context.env.DB,
      releaseProduct.id,
      currency,
      context.env.MEDIA_PUBLIC_ORIGIN,
    );
    const releaseVariantIds = new Set(
      releaseProduct.variants.filter(({ status }) => status === "active").map(({ id }) => id),
    );
    product.variants = product.variants.filter(({ id }) => releaseVariantIds.has(id));
    if (product.variants.length === 0) {
      throw new ApiError(
        422,
        "currency_unavailable",
        "This release product is not sellable in the requested currency.",
      );
    }
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: product,
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
    const authorizedReleaseId = context.req.header("x-preview-catalog-release");
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await addCartLine(context, cart, {
        ...input,
        ...(authorizedReleaseId ? { releaseId: authorizedReleaseId } : {}),
      }),
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
    const input = await parseJson(context, shippingQuoteRequestSchema);
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await setCartShipping(context, input),
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
  app.use("/build/storefront-experiences/*", async (context, next) => {
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    await next();
  });
  app.use("/internal/preview/*", async (context, next) => {
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    await next();
  });
  app.get("/build/storefront-experiences/snapshots/:id", async (context) => {
    requireBuildCredential(
      context,
      options.buildManifestToken ?? context.env.PREVIEW_BUILD_CALLBACK_TOKEN,
    );
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    return context.json(
      await getStorefrontExperienceBuildManifest(context, context.req.param("id")),
    );
  });
  app.get("/build/storefront-experiences/builds/:id", async (context) => {
    requireBuildCredential(
      context,
      options.buildManifestToken ?? context.env.PREVIEW_BUILD_CALLBACK_TOKEN,
    );
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    return context.json(
      await getStorefrontExperienceBuildManifestByBuild(context, context.req.param("id")),
    );
  });
  app.post(
    "/build/storefront-experiences/builds/:id/status",
    async (context, next) => {
      requireBuildCredential(
        context,
        options.buildManifestToken ?? context.env.PREVIEW_BUILD_CALLBACK_TOKEN,
      );
      await next();
    },
    idempotency("storefront.preview.build.result"),
    async (context) => {
      const result = await parseJson(context, storefrontExperienceBuildResultSchema);
      context.header("Cache-Control", "private, no-store");
      context.header("Referrer-Policy", "no-referrer");
      return context.json({
        data: await recordStorefrontExperienceBuildResult(context, context.req.param("id"), result),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post("/internal/preview/redeem", async (context) => {
    requirePreviewServiceCredential(context, context.env.PREVIEW_SERVICE_TOKEN);
    const input = await parseJson(context, redeemStorefrontPreviewGrantRequestSchema);
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    return context.json({
      data: await redeemStorefrontPreviewGrant(context, input.grant, input.origin),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/internal/preview/authorize", async (context) => {
    requirePreviewServiceCredential(context, context.env.PREVIEW_SERVICE_TOKEN);
    const origin = context.req.header("x-preview-origin");
    if (!origin) {
      throw new ApiError(
        422,
        "storefront_preview_origin_required",
        "The private preview origin is required.",
      );
    }
    const session = previewSessionCredential(context);
    context.header("Cache-Control", "private, no-store");
    context.header("Referrer-Policy", "no-referrer");
    return context.json(await authorizeStorefrontPreviewSession(context, session, origin));
  });

  app.use("/admin/*", async (context, next) => {
    context.header("Cache-Control", "private, no-store");
    await next();
  });
  app.post("/admin/auth/login", async (context) => {
    requireAdminBrowserOrigin(context);
    const input = await parseJson(context, adminPasswordLoginRequestSchema);
    context.set("principal", await loginWithPassword(context, input));
    return context.json({
      data: adminSessionData(context),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/auth/activate", async (context) => {
    requireAdminBrowserOrigin(context);
    const input = await parseJson(context, adminAccountActivationRequestSchema);
    context.set(
      "principal",
      await activateAdminAccount(context, input, passwordResetSecret(context, options)),
    );
    return context.json({
      data: adminSessionData(context),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/auth/logout", async (context) => {
    requireAdminBrowserOrigin(context);
    await logoutPasswordSession(context);
    return context.body(null, 204);
  });
  app.post("/admin/auth/password-reset/request", async (context) => {
    requireAdminBrowserOrigin(context);
    const input = await parseJson(context, adminPasswordResetRequestSchema);
    const result = await requestPasswordReset(context, input, {
      exposeToken: options.exposePasswordResetToken === true,
      secret: passwordResetSecret(context, options),
    });
    return context.json(
      {
        data: options.exposePasswordResetToken === true ? result : {},
        meta: { requestId: context.get("requestId") },
      },
      202,
    );
  });
  app.post("/admin/auth/password-reset/confirm", async (context) => {
    requireAdminBrowserOrigin(context);
    const input = await parseJson(context, adminPasswordResetConfirmRequestSchema);
    await confirmPasswordReset(context, input);
    return context.body(null, 204);
  });
  app.use("/admin/*", adminAuthentication(options.testIdentityVerifier));
  app.use("/admin/*", adminOriginProtection());
  app.get("/admin/session", (context) => {
    return context.json({
      data: adminSessionData(context),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/auth/password/change", async (context) => {
    const input = await parseJson(context, adminPasswordChangeRequestSchema);
    await changePassword(context, input);
    return context.body(null, 204);
  });
  app.get("/admin/iam/users", async (context) => {
    await requirePermission(context, "iam.users.read", { type: "admin_identity" });
    const query = adminUserListQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiError(422, "validation_failed", "Invalid user query.");
    return context.json({
      data: await listAdminUsers(context.env.DB, query.data),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.patch("/admin/iam/users/:id", async (context) => {
    await requirePermission(context, "iam.users.write", {
      id: context.req.param("id"),
      type: "admin_identity",
    });
    const input = await parseJson(context, updateAdminUserRequestSchema);
    return context.json({
      data: await updateAdminUser(context, context.req.param("id"), input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/iam/users/:id", async (context) => {
    await requirePermission(context, "iam.users.read", {
      id: context.req.param("id"),
      type: "admin_identity",
    });
    return context.json({
      data: await getAdminUser(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/iam/invitations", async (context) => {
    await requirePermission(context, "iam.users.read", { type: "admin_invitation" });
    const query = adminInvitationListQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiError(422, "validation_failed", "Invalid invitation query.");
    return context.json({
      data: await listAdminInvitations(context.env.DB, query.data),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/iam/invitations", async (context) => {
    await requirePermission(context, "iam.users.write", { type: "admin_invitation" });
    const input = await parseJson(context, createAdminInvitationRequestSchema);
    const result = await createAdminInvitation(context, input);
    return context.json(
      {
        data: result.invitation,
        meta: { requestId: context.get("requestId"), reused: result.reused },
      },
      result.reused ? 200 : 201,
    );
  });
  app.post("/admin/iam/invitations/:id/resend", async (context) => {
    await requirePermission(context, "iam.users.write", {
      id: context.req.param("id"),
      type: "admin_invitation",
    });
    const input = await parseJson(context, resendAdminInvitationRequestSchema);
    return context.json({
      data: await resendAdminInvitation(context, context.req.param("id"), input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/iam/invitations/:id/revoke", async (context) => {
    await requirePermission(context, "iam.users.write", {
      id: context.req.param("id"),
      type: "admin_invitation",
    });
    const input = await parseJson(context, revokeAdminInvitationRequestSchema);
    return context.json({
      data: await revokeAdminInvitation(context, context.req.param("id"), input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/iam/roles", async (context) => {
    await requirePermission(context, "iam.roles.read", { type: "admin_role" });
    const query = adminListQuerySchema.safeParse(context.req.query());
    if (!query.success) throw new ApiError(422, "validation_failed", "Invalid role query.");
    return context.json({
      data: await listAdminRoles(context.env.DB, query.data),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/iam/roles", async (context) => {
    await requirePermission(context, "iam.roles.write", { type: "admin_role" });
    const input = await parseJson(context, createAdminRoleRequestSchema);
    return context.json(
      {
        data: await createAdminRole(context, input),
        meta: { requestId: context.get("requestId") },
      },
      201,
    );
  });
  app.patch("/admin/iam/roles/:id", async (context) => {
    await requirePermission(context, "iam.roles.write", {
      id: context.req.param("id"),
      type: "admin_role",
    });
    const input = await parseJson(context, updateAdminRoleRequestSchema);
    return context.json({
      data: await updateAdminRole(context, context.req.param("id"), input),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/iam/roles/:id", async (context) => {
    await requirePermission(context, "iam.roles.read", {
      id: context.req.param("id"),
      type: "admin_role",
    });
    return context.json({
      data: await getAdminRole(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/themes", async (context) => {
    await requirePermission(context, "themes.read", { type: "storefront_theme" });
    return context.json({
      data: listStorefrontThemes(),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/catalog-releases", async (context) => {
    await requirePermission(context, "themes.preview", { type: "storefront_catalog_release" });
    await requirePermission(context, "catalog.read", { type: "catalog_release" });
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await listStorefrontCatalogReleases(context.env),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/catalog-releases/:id/resources", async (context) => {
    await requirePermission(context, "themes.preview", {
      id: context.req.param("id"),
      type: "catalog_release",
    });
    await requirePermission(context, "catalog.read", {
      id: context.req.param("id"),
      type: "catalog_release",
    });
    const kind = storefrontResourceKindSchema.safeParse(context.req.query("kind"));
    if (!kind.success) {
      throw new ApiError(422, "storefront_resource_kind_invalid", "Select a valid resource kind.");
    }
    const page = Math.max(Number.parseInt(context.req.query("page") ?? "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(context.req.query("pageSize") ?? "20", 10) || 20, 1),
      100,
    );
    return context.json({
      ...(await listStorefrontCatalogResources(context.env.DB, context.req.param("id"), {
        kind: kind.data,
        page,
        pageSize,
        query: context.req.query("query") ?? "",
      })),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/media", async (context) => {
    await requirePermission(context, "themes.write", { type: "storefront_media" });
    await requirePermission(context, "catalog.read", { type: "media" });
    context.header("Cache-Control", "private, no-store");
    const page = Math.max(Number.parseInt(context.req.query("page") ?? "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(context.req.query("pageSize") ?? "24", 10) || 24, 1),
      100,
    );
    const result = await listCatalogMedia(context.env, {
      page,
      pageSize,
      query: context.req.query("query") ?? "",
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
    "/admin/storefront-experiences/drafts",
    async (context, next) => {
      await requirePermission(context, "themes.write", {
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.draft.create"),
    async (context) => {
      const input = await parseJson(context, createStorefrontExperienceDraftRequestSchema);
      return context.json(
        {
          data: await createStorefrontExperienceDraft(
            context,
            input,
            options.storefrontExperienceServiceOptions,
          ),
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    },
  );
  app.get("/admin/storefront-experiences/drafts", async (context) => {
    await requirePermission(context, "themes.read", {
      type: "storefront_experience_draft",
    });
    return context.json({
      data: await listStorefrontExperienceDrafts(context.env.DB),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/drafts/:id", async (context) => {
    await requirePermission(context, "themes.read", {
      id: context.req.param("id"),
      type: "storefront_experience_draft",
    });
    return context.json({
      data: await getStorefrontExperienceDraft(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/drafts/:id/operator-run", async (context) => {
    await requirePermission(context, "themes.read", {
      id: context.req.param("id"),
      type: "storefront_experience_draft",
    });
    context.header("Cache-Control", "private, no-store");
    return context.json({
      data: await getFashionStagingOperatorRunForDraft(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/drafts/:id/preview-context", async (context) => {
    const draftId = context.req.param("id");
    await requirePermission(context, "themes.preview", {
      id: draftId,
      type: "storefront_experience_draft",
    });
    const input = validatedQuery(context, storefrontPreviewContextQuerySchema);
    if (input.catalogReleaseId) {
      await requirePermission(context, "catalog.read", {
        id: input.catalogReleaseId,
        type: "catalog_release",
      });
    }
    return context.json({
      data: await getLatestDeployedStorefrontExperiencePreview(
        context.env.DB,
        draftId,
        input.draftVersion,
        input.catalogReleaseId,
      ),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.put(
    "/admin/storefront-experiences/drafts/:id",
    async (context, next) => {
      await requirePermission(context, "themes.write", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.draft.update"),
    async (context) => {
      const input = await parseJson(context, updateStorefrontExperienceDraftRequestSchema);
      return context.json({
        data: await updateStorefrontExperienceDraft(context, context.req.param("id"), input),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/successors",
    async (context, next) => {
      await requirePermission(context, "themes.write", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.draft.successor.create"),
    async (context) => {
      const input = await parseJson(context, createStorefrontExperienceSuccessorRequestSchema);
      return context.json(
        {
          data: await createStorefrontExperienceSuccessor(context, context.req.param("id"), input),
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/validate",
    async (context, next) => {
      await requirePermission(context, "themes.write", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.draft.validate"),
    async (context) => {
      const input = await parseJson(context, validateStorefrontExperienceDraftRequestSchema);
      if (input.catalogReleaseId) {
        await requirePermission(context, "catalog.read", {
          id: input.catalogReleaseId,
          type: "catalog_release",
        });
      }
      return context.json({
        data: await validateStorefrontExperienceDraft(
          context,
          context.req.param("id"),
          input.expectedVersion,
          input.reason,
          input.catalogReleaseId,
          options.storefrontExperienceServiceOptions,
        ),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/preview",
    async (context, next) => {
      await requirePermission(context, "themes.preview", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.preview.create"),
    async (context) => {
      const input = await parseJson(context, resolveStorefrontExperienceDraftRequestSchema);
      if (input.catalogReleaseId) {
        await requirePermission(context, "catalog.read", {
          id: input.catalogReleaseId,
          type: "catalog_release",
        });
      }
      const snapshot = await createStorefrontExperiencePreviewSnapshot(
        context,
        context.req.param("id"),
        input.expectedVersion,
        input.reason,
        input.catalogReleaseId,
        options.storefrontExperienceServiceOptions,
      );
      const operatorRun = await getFashionStagingOperatorRunForDraft(
        context.env.DB,
        context.req.param("id"),
      );
      if (
        operatorRun?.status === "awaiting_operator" &&
        input.catalogReleaseId !== operatorRun.catalogReleaseId
      ) {
        throw new ApiError(
          409,
          "fashion_u8_operator_catalog_release_mismatch",
          "The run-bound preview must use the Catalog Release frozen by the Fashion U8 operator run.",
        );
      }
      const build = await triggerStorefrontExperienceBuild(
        context,
        snapshot.id,
        operatorRun?.status === "awaiting_operator"
          ? manualFashionPreparationBuildTrigger(context.env)
          : (options.experienceBuildTrigger ?? defaultExperienceBuildTrigger(context.env)),
        input.catalogReleaseId,
      );
      return context.json(
        {
          data: { build, snapshot },
          meta: { requestId: context.get("requestId") },
        },
        202,
      );
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/approve",
    async (context, next) => {
      await requirePermission(context, "themes.approve", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.approve"),
    async (context) => {
      const input = await parseJson(context, approveStorefrontExperienceDraftRequestSchema);
      if (input.catalogReleaseId) {
        await requirePermission(context, "catalog.read", {
          id: input.catalogReleaseId,
          type: "catalog_release",
        });
      }
      return context.json({
        data: await approveStorefrontExperienceDraft(
          context,
          context.req.param("id"),
          input.expectedVersion,
          input.reason,
          input.catalogReleaseId,
          options.storefrontExperienceServiceOptions,
        ),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/storefront-experiences/snapshots/:id/build",
    async (context, next) => {
      await requirePermission(context, "themes.preview", {
        id: context.req.param("id"),
        type: "storefront_experience_snapshot",
      });
      await next();
    },
    idempotency("storefront.experience.snapshot.build"),
    async (context) => {
      const input = await parseJson(context, createStorefrontExperienceBuildRequestSchema);
      await requirePermission(context, "catalog.read", {
        id: input.catalogReleaseId,
        type: "catalog_release",
      });
      if (input.manualDispatch) assertManualFashionPreparationNamespace(context.env);
      const snapshot = await getStorefrontExperienceSnapshot(
        context.env.DB,
        context.req.param("id"),
      );
      if (snapshot.kind !== "approved") {
        throw new ApiError(
          409,
          "storefront_experience_snapshot_not_approved",
          "Only an approved immutable storefront experience snapshot can start this build.",
        );
      }
      return context.json(
        {
          data: await triggerStorefrontExperienceBuild(
            context,
            snapshot.id,
            input.manualDispatch
              ? manualFashionPreparationBuildTrigger(context.env)
              : (options.experienceBuildTrigger ?? defaultExperienceBuildTrigger(context.env)),
            input.catalogReleaseId,
          ),
          meta: { requestId: context.get("requestId") },
        },
        202,
      );
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/migrations/dry-run",
    async (context, next) => {
      await requirePermission(context, "themes.write", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.migration.dry-run"),
    async (context) => {
      const input = await parseJson(context, storefrontExperienceMigrationDryRunRequestSchema);
      return context.json({
        data: await dryRunStorefrontExperienceMigration(
          context,
          context.req.param("id"),
          input,
          options.storefrontExperienceServiceOptions,
        ),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
  app.post(
    "/admin/storefront-experiences/drafts/:id/migrations/approve",
    async (context, next) => {
      await requirePermission(context, "themes.approve", {
        id: context.req.param("id"),
        type: "storefront_experience_draft",
      });
      await next();
    },
    idempotency("storefront.experience.migration.approve"),
    async (context) => {
      const input = await parseJson(context, approveStorefrontExperienceMigrationRequestSchema);
      return context.json(
        {
          data: await approveStorefrontExperienceMigration(
            context,
            context.req.param("id"),
            input.migrationId,
            input.expectedVersion,
            input.reason,
            options.storefrontExperienceServiceOptions,
          ),
          meta: { requestId: context.get("requestId") },
        },
        201,
      );
    },
  );
  app.get("/admin/storefront-experiences/snapshots/:id", async (context) => {
    await requirePermission(context, "themes.read", {
      id: context.req.param("id"),
      type: "storefront_experience_snapshot",
    });
    return context.json({
      data: await getStorefrontExperienceSnapshot(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.get("/admin/storefront-experiences/builds/:id", async (context) => {
    await requirePermission(context, "themes.preview", {
      id: context.req.param("id"),
      type: "storefront_preview_build",
    });
    return context.json({
      data: await getStorefrontExperienceBuild(context.env.DB, context.req.param("id")),
      meta: { requestId: context.get("requestId") },
    });
  });
  app.post("/admin/storefront-experiences/snapshots/:id/grants", async (context) => {
    await requirePermission(context, "themes.preview", {
      id: context.req.param("id"),
      type: "storefront_experience_snapshot",
    });
    const input = await parseJson(context, createStorefrontPreviewGrantRequestSchema);
    if (input.catalogReleaseId) {
      await requirePermission(context, "catalog.read", {
        id: input.catalogReleaseId,
        type: "catalog_release",
      });
    }
    return context.json(
      {
        data: await createStorefrontPreviewGrant(
          context,
          context.req.param("id"),
          input.origin,
          input.reason,
          input.catalogReleaseId,
        ),
        meta: { requestId: context.get("requestId") },
      },
      201,
    );
  });
  app.post(
    "/admin/storefront-experiences/snapshots/:id/revoke",
    async (context, next) => {
      await requirePermission(context, "themes.preview", {
        id: context.req.param("id"),
        type: "storefront_experience_snapshot",
      });
      await next();
    },
    idempotency("storefront.preview.access.revoke"),
    async (context) => {
      const input = await parseJson(context, revokeStorefrontPreviewAccessRequestSchema);
      return context.json({
        data: await revokeStorefrontPreviewAccess(context, context.req.param("id"), input.reason),
        meta: { requestId: context.get("requestId") },
      });
    },
  );
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
