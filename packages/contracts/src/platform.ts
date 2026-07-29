import * as z from "zod";

import { countryCodeSchema, currencyCodeSchema, isoDateTimeSchema } from "./common";

const policyLinksSchema = z
  .object({
    contact: z.url(),
    cookies: z.url(),
    privacy: z.url(),
    returns: z.url(),
    shipping: z.url(),
    terms: z.url(),
  })
  .strict();

export const launchConfigurationSchema = z
  .object({
    defaultCurrency: currencyCodeSchema,
    legalApproved: z.boolean(),
    orderNumberPrefix: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9-]{1,11}$/),
    oversellPolicy: z.enum(["deny", "limited"]),
    paymentMode: z.enum(["test", "live"]),
    paymentProvider: z.literal("stripe"),
    policies: policyLinksSchema,
    privacyContactEmail: z.email(),
    providerConfigured: z.boolean(),
    reservationTtlMinutes: z.int().min(5).max(120),
    sellableCurrencies: z.array(currencyCodeSchema).min(1),
    shippingCountries: z.array(countryCodeSchema).min(1),
    shippingMethodIds: z.array(z.string().trim().min(1).max(80)).min(1),
    supportEmail: z.email(),
    taxMode: z.literal("zero"),
    webhookConfigured: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.sellableCurrencies.includes(value.defaultCurrency)) {
      context.addIssue({
        code: "custom",
        message: "The default currency must be sellable.",
        path: ["defaultCurrency"],
      });
    }
    if (new Set(value.sellableCurrencies).size !== value.sellableCurrencies.length) {
      context.addIssue({
        code: "custom",
        message: "Sellable currencies must be unique.",
        path: ["sellableCurrencies"],
      });
    }
    if (new Set(value.shippingCountries).size !== value.shippingCountries.length) {
      context.addIssue({
        code: "custom",
        message: "Shipping countries must be unique.",
        path: ["shippingCountries"],
      });
    }
    if (new Set(value.shippingMethodIds).size !== value.shippingMethodIds.length) {
      context.addIssue({
        code: "custom",
        message: "Shipping method identifiers must be unique.",
        path: ["shippingMethodIds"],
      });
    }
  });

export const updateLaunchConfigurationRequestSchema = z
  .object({
    configuration: launchConfigurationSchema,
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const launchReadinessIssueSchema = z
  .object({
    code: z.enum([
      "legal_approval_missing",
      "payment_provider_missing",
      "payment_webhook_missing",
      "production_payment_mode_not_live",
      "placeholder_policy_url",
      "sellable_currency_unavailable",
      "shipping_country_unavailable",
      "shipping_method_unavailable",
      "oversell_policy_mismatch",
      "reservation_ttl_mismatch",
      "turnstile_site_key_missing",
      "turnstile_secret_missing",
      "backup_export_missing",
    ]),
    message: z.string().min(1),
  })
  .strict();

export const publicRuntimeConfigurationSchema = z
  .object({
    turnstile: z
      .object({
        required: z.boolean(),
        siteKey: z.string().trim().min(1).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.turnstile.required && !value.turnstile.siteKey) {
      context.addIssue({
        code: "custom",
        message: "A Turnstile site key is required when the challenge is enabled.",
        path: ["turnstile", "siteKey"],
      });
    }
    if (!value.turnstile.required && value.turnstile.siteKey) {
      context.addIssue({
        code: "custom",
        message: "A disabled Turnstile challenge must not publish a site key.",
        path: ["turnstile", "siteKey"],
      });
    }
  });

export const commerceFunnelPageRouteSchema = z.enum([
  "home",
  "collection",
  "product",
  "cart",
  "checkout",
  "checkout_complete",
  "order_status",
  "policy",
  "content",
]);

export const commerceFunnelEventSchema = z
  .object({
    event: z.literal("page_view"),
    route: commerceFunnelPageRouteSchema,
  })
  .strict();

export const launchConfigurationStatusSchema = z
  .object({
    configuration: launchConfigurationSchema,
    environment: z.enum(["development", "staging", "production"]),
    issues: z.array(launchReadinessIssueSchema),
    ready: z.boolean(),
    updatedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const auditEventSchema = z
  .object({
    action: z.string().min(1),
    actorId: z.string().nullable(),
    actorType: z.enum(["shopper", "admin", "machine", "provider"]),
    createdAt: isoDateTimeSchema,
    id: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()),
    reason: z.string().nullable(),
    requestId: z.string().nullable(),
    result: z.enum(["allowed", "denied", "succeeded", "failed"]),
    targetId: z.string().nullable(),
    targetType: z.string().min(1),
  })
  .strict();

export const auditQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(160).optional(),
    actorId: z.string().trim().min(1).max(160).optional(),
    cursor: z.string().trim().min(1).max(500).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    result: z.enum(["allowed", "denied", "succeeded", "failed"]).optional(),
    targetType: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const operationalHealthSchema = z
  .object({
    checkedAt: isoDateTimeSchema,
    environment: z.enum(["development", "staging", "production"]),
    failures: z
      .object({
        catalogBuilds: z.int().nonnegative(),
        deadLetterJobs: z.int().nonnegative(),
        paymentEvents: z.int().nonnegative(),
        reportExports: z.int().nonnegative(),
      })
      .strict(),
    status: z.enum(["ok", "degraded"]),
  })
  .strict();

export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type CommerceFunnelEvent = z.infer<typeof commerceFunnelEventSchema>;
export type CommerceFunnelPageRoute = z.infer<typeof commerceFunnelPageRouteSchema>;
export type LaunchConfiguration = z.infer<typeof launchConfigurationSchema>;
export type LaunchConfigurationStatus = z.infer<typeof launchConfigurationStatusSchema>;
export type OperationalHealth = z.infer<typeof operationalHealthSchema>;
export type PublicRuntimeConfiguration = z.infer<typeof publicRuntimeConfigurationSchema>;
export type UpdateLaunchConfigurationRequest = z.infer<
  typeof updateLaunchConfigurationRequestSchema
>;
