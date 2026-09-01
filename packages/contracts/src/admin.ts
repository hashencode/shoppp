import * as z from "zod";

import {
  currencyCodeSchema,
  isoDateTimeSchema,
  orderReferenceSchema,
  pricingTotalsSchema,
} from "./common";
import { guestOrderLineSchema, shippingAddressSchema } from "./checkout";
import {
  blockDefinitionSchema,
  experienceResourceBindingSchema,
  sectionDefinitionSchema,
  storefrontIdentifierSchema,
  storefrontSemverSchema,
  storefrontThemeDescriptorSchema,
  themeOverrideSchema,
  themePresetSchema,
} from "./storefront-experience";

export const ADMIN_PERMISSION_KEYS = [
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "inventory.read",
  "inventory.adjust",
  "orders.read",
  "orders.fulfill",
  "orders.cancel",
  "orders.refund",
  "reporting.read",
  "reporting.export",
  "audit.read",
  "settings.read",
  "settings.write",
  "privacy.manage",
  "operations.replay",
  "operations.jobs.read",
  "iam.users.read",
  "iam.users.write",
  "iam.roles.read",
  "iam.roles.write",
  "themes.read",
  "themes.write",
  "themes.approve",
  "themes.preview",
] as const;

export const adminPermissionSchema = z.enum(ADMIN_PERMISSION_KEYS);

export const adminPermissionCategorySchema = z.enum([
  "catalog",
  "inventory",
  "orders",
  "reporting",
  "audit",
  "settings",
  "privacy",
  "operations",
  "iam",
  "themes",
]);

export const ADMIN_PERMISSION_CATALOG = [
  {
    category: "catalog",
    description: "View products and catalog content.",
    key: "catalog.read",
    label: "View catalog",
  },
  {
    category: "catalog",
    description: "Create and edit catalog content.",
    key: "catalog.write",
    label: "Edit catalog",
  },
  {
    category: "catalog",
    description: "Publish catalog content.",
    key: "catalog.publish",
    label: "Publish catalog",
  },
  {
    category: "inventory",
    description: "View inventory levels and history.",
    key: "inventory.read",
    label: "View inventory",
  },
  {
    category: "inventory",
    description: "Adjust inventory levels.",
    key: "inventory.adjust",
    label: "Adjust inventory",
  },
  {
    category: "orders",
    description: "View orders and their timelines.",
    key: "orders.read",
    label: "View orders",
  },
  {
    category: "orders",
    description: "Advance order fulfillment.",
    key: "orders.fulfill",
    label: "Fulfill orders",
  },
  {
    category: "orders",
    description: "Cancel eligible orders.",
    key: "orders.cancel",
    label: "Cancel orders",
  },
  {
    category: "orders",
    description: "Refund eligible order payments.",
    key: "orders.refund",
    label: "Refund orders",
  },
  {
    category: "reporting",
    description: "View operational reports.",
    key: "reporting.read",
    label: "View reports",
  },
  {
    category: "reporting",
    description: "Export operational reports.",
    key: "reporting.export",
    label: "Export reports",
  },
  {
    category: "audit",
    description: "View the application audit trail.",
    key: "audit.read",
    label: "View audit trail",
  },
  {
    category: "settings",
    description: "View application settings.",
    key: "settings.read",
    label: "View settings",
  },
  {
    category: "settings",
    description: "Change application settings.",
    key: "settings.write",
    label: "Edit settings",
  },
  {
    category: "privacy",
    description: "Run privacy-management operations.",
    key: "privacy.manage",
    label: "Manage privacy",
  },
  {
    category: "operations",
    description: "Replay failed operational jobs.",
    key: "operations.replay",
    label: "Replay jobs",
  },
  {
    category: "operations",
    description: "View operational job status.",
    key: "operations.jobs.read",
    label: "View jobs",
  },
  {
    category: "iam",
    description: "View human administrator accounts and invitations.",
    key: "iam.users.read",
    label: "View users",
  },
  {
    category: "iam",
    description: "Invite, assign, enable, and disable human administrators.",
    key: "iam.users.write",
    label: "Manage users",
  },
  {
    category: "iam",
    description: "View roles and effective permission sets.",
    key: "iam.roles.read",
    label: "View roles",
  },
  {
    category: "iam",
    description: "Create, edit, and archive roles.",
    key: "iam.roles.write",
    label: "Manage roles",
  },
  {
    category: "themes",
    description: "View storefront themes and experience drafts.",
    key: "themes.read",
    label: "View themes",
  },
  {
    category: "themes",
    description: "Create and edit storefront experience drafts.",
    key: "themes.write",
    label: "Edit themes",
  },
  {
    category: "themes",
    description: "Approve storefront experience snapshots and migrations.",
    key: "themes.approve",
    label: "Approve themes",
  },
  {
    category: "themes",
    description: "Create and access private storefront previews.",
    key: "themes.preview",
    label: "Preview themes",
  },
] as const satisfies readonly {
  category: z.infer<typeof adminPermissionCategorySchema>;
  description: string;
  key: z.infer<typeof adminPermissionSchema>;
  label: string;
}[];

const adminIdSchema = z.string().trim().min(1).max(128);
const adminRoleKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(64);
const adminDisplayNameSchema = z.string().trim().min(1).max(160);
const adminEmailSchema = z.email().max(254);
const mutationVersionSchema = z.int().positive();
export const adminPasswordSchema = z.string().min(12).max(128);
export const adminAuthErrorCodeSchema = z.enum([
  "account_activation_conflict",
  "account_activation_failed",
  "account_activation_invalid",
  "admin_auth_not_configured",
  "admin_login_required",
  "admin_login_throttled",
  "admin_session_invalid",
  "current_password_invalid",
  "human_password_required",
  "identity_not_enabled",
  "invalid_admin_credentials",
  "password_change_conflict",
  "password_reset_token_invalid",
  "protected_admin_password_reset_denied",
  "service_credential_invalid",
]);

export const adminPrincipalKindSchema = z.enum(["human", "service"]);
export const adminEnvironmentSchema = z.enum(["test", "production"]);
export const adminUserStatusSchema = z.enum(["active", "disabled"]);
export const adminInvitationStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);
export const notificationJobStatusSchema = z.enum([
  "pending",
  "processing",
  "sent",
  "failed",
  "dead_letter",
]);

export const adminRoleSummarySchema = z
  .object({
    enabled: z.boolean(),
    id: adminIdSchema,
    key: adminRoleKeySchema,
    name: z.string().trim().min(1).max(120),
    protected: z.boolean(),
    system: z.boolean(),
    version: mutationVersionSchema,
  })
  .strict()
  .refine((value) => !value.protected || value.system, {
    message: "Protected roles must also be system roles.",
    path: ["system"],
  });

const adminSessionBaseSchema = z.object({
  displayName: adminDisplayNameSchema,
  environment: adminEnvironmentSchema,
  identityId: adminIdSchema,
  permissions: z.array(adminPermissionSchema).max(ADMIN_PERMISSION_KEYS.length),
  role: adminRoleSummarySchema,
});

export const humanAdminSessionSchema = adminSessionBaseSchema
  .extend({
    email: adminEmailSchema,
    principalKind: z.literal("human"),
  })
  .strict();

export const serviceAdminSessionSchema = adminSessionBaseSchema
  .extend({
    principalKind: z.literal("service"),
    serviceName: z.string().trim().min(1).max(160),
  })
  .strict();

export const adminSessionSchema = z.discriminatedUnion("principalKind", [
  humanAdminSessionSchema,
  serviceAdminSessionSchema,
]);

export const adminPasswordLoginRequestSchema = z
  .object({
    email: adminEmailSchema,
    password: adminPasswordSchema,
  })
  .strict();

export const adminPasswordChangeRequestSchema = z
  .object({
    currentPassword: adminPasswordSchema,
    newPassword: adminPasswordSchema,
  })
  .strict()
  .refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
    message: "The new password must be different.",
    path: ["newPassword"],
  });

export const adminPasswordResetRequestSchema = z.object({ email: adminEmailSchema }).strict();

export const adminPasswordResetConfirmRequestSchema = z
  .object({
    newPassword: adminPasswordSchema,
    token: z.string().trim().min(32).max(2048),
  })
  .strict();

export const adminAccountActivationRequestSchema = z
  .object({
    password: adminPasswordSchema,
    token: z.string().trim().min(32).max(2048),
  })
  .strict();

export const adminUserSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    displayName: adminDisplayNameSchema,
    email: adminEmailSchema,
    id: adminIdSchema,
    role: adminRoleSummarySchema,
    status: adminUserStatusSchema,
    updatedAt: isoDateTimeSchema,
    version: mutationVersionSchema,
  })
  .strict();

export const adminInvitationSchema = z
  .object({
    acceptedAt: isoDateTimeSchema.nullable(),
    acceptedIdentityId: adminIdSchema.nullable(),
    createdAt: isoDateTimeSchema,
    delivery: z
      .object({
        attemptCount: z.int().nonnegative(),
        lastErrorCode: z.string().nullable(),
        status: notificationJobStatusSchema,
      })
      .strict()
      .nullable(),
    displayName: adminDisplayNameSchema.nullable(),
    email: adminEmailSchema,
    expiresAt: isoDateTimeSchema,
    id: adminIdSchema,
    revokedAt: isoDateTimeSchema.nullable(),
    role: adminRoleSummarySchema,
    status: adminInvitationStatusSchema,
    updatedAt: isoDateTimeSchema,
    version: mutationVersionSchema,
  })
  .strict();

export const adminRoleSchema = adminRoleSummarySchema
  .safeExtend({
    description: z.string().trim().max(500).nullable(),
    permissions: z.array(adminPermissionSchema).max(ADMIN_PERMISSION_KEYS.length),
  })
  .strict();

export const adminListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(160).optional(),
  })
  .strict();

export const adminUserListQuerySchema = adminListQuerySchema
  .extend({
    status: adminUserStatusSchema.optional(),
  })
  .strict();

export const adminInvitationListQuerySchema = adminListQuerySchema
  .extend({
    status: adminInvitationStatusSchema.optional(),
  })
  .strict();

const adminPaginatedResultFields = {
  page: z.int().min(1),
  pageSize: z.int().min(1).max(100),
  total: z.int().nonnegative(),
};

export const adminUserListSchema = z
  .object({
    ...adminPaginatedResultFields,
    items: z.array(adminUserSchema),
  })
  .strict();

export const adminInvitationListSchema = z
  .object({
    ...adminPaginatedResultFields,
    items: z.array(adminInvitationSchema),
  })
  .strict();

export const adminRoleListSchema = z
  .object({
    ...adminPaginatedResultFields,
    items: z.array(adminRoleSchema),
  })
  .strict();

export const createAdminInvitationRequestSchema = z
  .object({
    displayName: adminDisplayNameSchema.optional(),
    email: adminEmailSchema,
    idempotencyKey: z.string().trim().min(8).max(128),
    roleId: adminIdSchema,
  })
  .strict();

export const resendAdminInvitationRequestSchema = z
  .object({
    expectedVersion: mutationVersionSchema,
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

export const revokeAdminInvitationRequestSchema = z
  .object({
    expectedVersion: mutationVersionSchema,
  })
  .strict();

export const updateAdminUserRequestSchema = z
  .object({
    displayName: adminDisplayNameSchema.optional(),
    enabled: z.boolean().optional(),
    expectedVersion: mutationVersionSchema,
    roleId: adminIdSchema.optional(),
  })
  .strict()
  .refine(
    ({ displayName, enabled, roleId }) =>
      displayName !== undefined || enabled !== undefined || roleId !== undefined,
    { message: "At least one user field must change." },
  );

export const createAdminRoleRequestSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    key: adminRoleKeySchema,
    name: z.string().trim().min(1).max(120),
    permissions: z.array(adminPermissionSchema).max(ADMIN_PERMISSION_KEYS.length),
  })
  .strict();

export const updateAdminRoleRequestSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    expectedVersion: mutationVersionSchema,
    name: z.string().trim().min(1).max(120).optional(),
    permissions: z.array(adminPermissionSchema).max(ADMIN_PERMISSION_KEYS.length).optional(),
  })
  .strict();

export const paymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "paid",
  "failed",
  "canceled",
  "partially_refunded",
  "refunded",
]);
export const orderStatusSchema = z.enum([
  "checkout_pending",
  "confirmed",
  "processing",
  "completed",
  "canceled",
]);
export const fulfillmentStatusSchema = z.enum([
  "unfulfilled",
  "picking",
  "packed",
  "shipped",
  "delivered",
  "canceled",
]);
export const adminOrderSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    currency: currencyCodeSchema,
    email: z.email().optional(),
    fulfillmentStatus: fulfillmentStatusSchema,
    grandTotal: z.int().nonnegative(),
    orderStatus: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    publicReference: orderReferenceSchema,
  })
  .strict();

export const orderTimelineEntrySchema = z
  .object({
    actor: z.string().nullable().optional(),
    amount: z.int().nonnegative().optional(),
    createdAt: isoDateTimeSchema,
    id: z.string().min(1),
    kind: z.enum(["payment", "order", "fulfillment", "refund", "notification", "audit"]),
    label: z.string().min(1),
    reason: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .strict();

export const adminOrderDetailSchema = z
  .object({
    allowedActions: z
      .object({
        cancel: z.boolean(),
        fulfill: z.array(z.enum(["picking", "packed", "shipped", "delivered"])),
        refundMaximum: z.int().nonnegative(),
      })
      .strict(),
    facts: z
      .object({
        createdAt: isoDateTimeSchema,
        currency: currencyCodeSchema,
        email: z.email(),
        fulfillmentStatus: fulfillmentStatusSchema,
        lines: z.array(guestOrderLineSchema).min(1),
        orderStatus: orderStatusSchema,
        paymentStatus: paymentStatusSchema,
        publicReference: orderReferenceSchema,
        shippingAddress: shippingAddressSchema,
        totals: pricingTotalsSchema,
      })
      .strict(),
    timeline: z.array(orderTimelineEntrySchema),
  })
  .strict();

export const fulfillmentTransitionRequestSchema = z
  .object({
    carrier: z.string().trim().min(1).max(120).optional(),
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
    toStatus: z.enum(["picking", "packed", "shipped", "delivered"]),
    trackingNumber: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.toStatus === "shipped" && (!value.carrier || !value.trackingNumber)) {
      context.addIssue({
        code: "custom",
        message: "Carrier and tracking number are required to ship an order.",
        path: ["trackingNumber"],
      });
    }
    if (value.toStatus !== "shipped" && (value.carrier || value.trackingNumber)) {
      context.addIssue({
        code: "custom",
        message: "Tracking details are only accepted for shipment.",
        path: ["trackingNumber"],
      });
    }
  });

export const refundRequestSchema = z
  .object({
    amount: z.int().positive(),
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const cancelOrderRequestSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const notificationAttemptSchema = z
  .object({
    attemptNumber: z.int().positive(),
    completedAt: isoDateTimeSchema,
    errorCode: z.string().nullable().optional(),
    id: z.string().min(1),
    providerMessageId: z.string().nullable().optional(),
    result: z.enum(["sent", "retryable_failure", "permanent_failure", "exhausted"]),
    startedAt: isoDateTimeSchema,
  })
  .strict();

export const notificationJobSchema = z
  .object({
    attemptCount: z.int().nonnegative(),
    attempts: z.array(notificationAttemptSchema),
    createdAt: isoDateTimeSchema,
    deadLetteredAt: isoDateTimeSchema.nullable().optional(),
    id: z.string().min(1),
    kind: z.enum(["notification", "provider_recovery"]),
    lastErrorCode: z.string().nullable().optional(),
    maxAttempts: z.int().positive(),
    nextAttemptAt: isoDateTimeSchema.nullable().optional(),
    orderReference: orderReferenceSchema.nullable().optional(),
    recipient: z.string().min(3),
    replayCount: z.int().nonnegative(),
    sentAt: isoDateTimeSchema.nullable().optional(),
    status: notificationJobStatusSchema,
    type: z.enum([
      "order_receipt",
      "payment_failed",
      "cancellation",
      "refund",
      "shipment",
      "payment_reconciliation",
      "admin_invitation",
      "admin_password_reset",
    ]),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const replayNotificationJobRequestSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

const experienceReasonSchema = z.string().trim().min(3).max(500);

export const fashionU8AcceptanceContextSchema = z
  .object({
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    runId: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  })
  .strict();

export const prepareFashionU8AcceptanceRunRequestSchema = z
  .object({
    candidateSha: z.string().regex(/^[a-f0-9]{40}$/),
    catalogReleaseId: z.string().trim().min(1).max(160),
    environment: z.literal("fashion-staging"),
    harnessSha: z.string().regex(/^[a-f0-9]{40}$/),
    manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
    repository: z.string().trim().min(3).max(320),
    runId: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
    sourceDraftId: z.string().trim().min(1).max(160),
    u12SnapshotId: z.string().trim().min(1).max(160),
    workflowRunId: z.string().trim().min(1).max(160),
  })
  .strict();

export const adminStorefrontThemeSchema = z
  .object({
    ...storefrontThemeDescriptorSchema.shape,
    componentRegistry: z
      .object({
        blocks: z.array(blockDefinitionSchema).max(60),
        sections: z.array(sectionDefinitionSchema).max(60),
      })
      .strict(),
    fixtureBindings: z.array(experienceResourceBindingSchema).max(100),
    presetDefinitions: z.array(themePresetSchema).min(1).max(20),
  })
  .strict();

export const storefrontExperienceDraftInputSchema = z
  .object({
    bindings: z.array(experienceResourceBindingSchema).max(100),
    experienceId: storefrontIdentifierSchema,
    overrides: z.array(themeOverrideSchema).max(10),
    presetId: storefrontIdentifierSchema,
    themeId: storefrontIdentifierSchema,
    themeVersion: storefrontSemverSchema,
  })
  .strict();

export const createStorefrontExperienceDraftRequestSchema = z
  .object({
    draft: storefrontExperienceDraftInputSchema,
    reason: experienceReasonSchema,
  })
  .strict();

export const updateStorefrontExperienceDraftRequestSchema = z
  .object({
    bindings: z.array(experienceResourceBindingSchema).max(100),
    expectedVersion: z.int().positive(),
    overrides: z.array(themeOverrideSchema).max(10),
    reason: experienceReasonSchema,
    u8Acceptance: fashionU8AcceptanceContextSchema.optional(),
  })
  .strict();

export const createStorefrontExperienceSuccessorRequestSchema =
  updateStorefrontExperienceDraftRequestSchema.omit({ expectedVersion: true }).extend({
    sourceVersion: z.int().positive(),
  });

export const validateStorefrontExperienceDraftRequestSchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160).optional(),
    expectedVersion: z.int().positive(),
    reason: experienceReasonSchema,
    u8Acceptance: fashionU8AcceptanceContextSchema.optional(),
  })
  .strict();

export const resolveStorefrontExperienceDraftRequestSchema =
  validateStorefrontExperienceDraftRequestSchema;

export const approveStorefrontExperienceDraftRequestSchema =
  validateStorefrontExperienceDraftRequestSchema.extend({
    confirm: z.literal(true),
  });

export const createStorefrontExperienceBuildRequestSchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160),
    manualDispatch: z.literal(true).optional(),
  })
  .strict();

export const storefrontExperienceMigrationDryRunRequestSchema = z
  .object({
    expectedVersion: z.int().positive(),
    reason: experienceReasonSchema,
    targetConfigurationSchemaVersion: z.int().positive(),
    targetThemeVersion: storefrontSemverSchema,
  })
  .strict();

export const approveStorefrontExperienceMigrationRequestSchema = z
  .object({
    confirm: z.literal(true),
    expectedVersion: z.int().positive(),
    migrationId: storefrontIdentifierSchema,
    reason: experienceReasonSchema,
  })
  .strict();

export const storefrontExperienceBuildResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
      artifactPrefix: z
        .string()
        .regex(/^snapshots\/[a-z][a-z0-9-]{2,99}\/(?:[A-Za-z0-9_-]{1,160}\/)?[a-f0-9]{64}$/),
      expiresAt: isoDateTimeSchema,
      status: z.literal("deployed"),
    })
    .strict(),
  z
    .object({
      failureCode: storefrontIdentifierSchema,
      status: z.literal("failed"),
    })
    .strict(),
]);

export const createStorefrontPreviewGrantRequestSchema = z
  .object({
    catalogReleaseId: z.string().trim().min(1).max(160).optional(),
    origin: z.url().refine((value) => new URL(value).protocol === "https:"),
    reason: experienceReasonSchema,
  })
  .strict();

export const revokeStorefrontPreviewAccessRequestSchema = z
  .object({ reason: experienceReasonSchema })
  .strict();

export const redeemStorefrontPreviewGrantRequestSchema = z
  .object({
    grant: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    origin: z.url().refine((value) => new URL(value).protocol === "https:"),
  })
  .strict();

export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type FashionU8AcceptanceContext = z.infer<typeof fashionU8AcceptanceContextSchema>;
export type PrepareFashionU8AcceptanceRunRequest = z.infer<
  typeof prepareFashionU8AcceptanceRunRequestSchema
>;
export type AdminAccountActivationRequest = z.infer<typeof adminAccountActivationRequestSchema>;
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
export type AdminEnvironment = z.infer<typeof adminEnvironmentSchema>;
export type AdminAuthErrorCode = z.infer<typeof adminAuthErrorCodeSchema>;
export type AdminInvitation = z.infer<typeof adminInvitationSchema>;
export type AdminInvitationStatus = z.infer<typeof adminInvitationStatusSchema>;
export type AdminPermission = z.infer<typeof adminPermissionSchema>;
export type AdminPermissionCategory = z.infer<typeof adminPermissionCategorySchema>;
export type AdminPasswordChangeRequest = z.infer<typeof adminPasswordChangeRequestSchema>;
export type AdminPasswordLoginRequest = z.infer<typeof adminPasswordLoginRequestSchema>;
export type AdminPasswordResetConfirmRequest = z.infer<
  typeof adminPasswordResetConfirmRequestSchema
>;
export type AdminPasswordResetRequest = z.infer<typeof adminPasswordResetRequestSchema>;
export type AdminPrincipalKind = z.infer<typeof adminPrincipalKindSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminRoleSummary = z.infer<typeof adminRoleSummarySchema>;
export type AdminSession = z.infer<typeof adminSessionSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
export type CreateAdminInvitationRequest = z.infer<typeof createAdminInvitationRequestSchema>;
export type CreateAdminRoleRequest = z.infer<typeof createAdminRoleRequestSchema>;
export type FulfillmentTransitionRequest = z.infer<typeof fulfillmentTransitionRequestSchema>;
export type NotificationAttempt = z.infer<typeof notificationAttemptSchema>;
export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type NotificationJobStatus = z.infer<typeof notificationJobStatusSchema>;
export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type ResendAdminInvitationRequest = z.infer<typeof resendAdminInvitationRequestSchema>;
export type ReplayNotificationJobRequest = z.infer<typeof replayNotificationJobRequestSchema>;
export type RevokeAdminInvitationRequest = z.infer<typeof revokeAdminInvitationRequestSchema>;
export type UpdateAdminRoleRequest = z.infer<typeof updateAdminRoleRequestSchema>;
export type UpdateAdminUserRequest = z.infer<typeof updateAdminUserRequestSchema>;
export type ApproveStorefrontExperienceDraftRequest = z.infer<
  typeof approveStorefrontExperienceDraftRequestSchema
>;
export type AdminStorefrontTheme = z.infer<typeof adminStorefrontThemeSchema>;
export type ApproveStorefrontExperienceMigrationRequest = z.infer<
  typeof approveStorefrontExperienceMigrationRequestSchema
>;
export type CreateStorefrontExperienceDraftRequest = z.infer<
  typeof createStorefrontExperienceDraftRequestSchema
>;
export type CreateStorefrontExperienceBuildRequest = z.infer<
  typeof createStorefrontExperienceBuildRequestSchema
>;
export type CreateStorefrontExperienceSuccessorRequest = z.infer<
  typeof createStorefrontExperienceSuccessorRequestSchema
>;
export type CreateStorefrontPreviewGrantRequest = z.infer<
  typeof createStorefrontPreviewGrantRequestSchema
>;
export type RedeemStorefrontPreviewGrantRequest = z.infer<
  typeof redeemStorefrontPreviewGrantRequestSchema
>;
export type RevokeStorefrontPreviewAccessRequest = z.infer<
  typeof revokeStorefrontPreviewAccessRequestSchema
>;
export type ResolveStorefrontExperienceDraftRequest = z.infer<
  typeof resolveStorefrontExperienceDraftRequestSchema
>;
export type StorefrontExperienceBuildResult = z.infer<typeof storefrontExperienceBuildResultSchema>;
export type StorefrontExperienceDraftInput = z.infer<typeof storefrontExperienceDraftInputSchema>;
export type StorefrontExperienceMigrationDryRunRequest = z.infer<
  typeof storefrontExperienceMigrationDryRunRequestSchema
>;
export type UpdateStorefrontExperienceDraftRequest = z.infer<
  typeof updateStorefrontExperienceDraftRequestSchema
>;
export type ValidateStorefrontExperienceDraftRequest = z.infer<
  typeof validateStorefrontExperienceDraftRequestSchema
>;
