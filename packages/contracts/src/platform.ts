import * as z from "zod";

import { countryCodeSchema, currencyCodeSchema, isoDateTimeSchema, publicIdSchema } from "./common";

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
    shippingMethodIds: z.array(publicIdSchema).min(1),
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

/** Fixed denominator for the automatic setup checks; manual tasks are excluded. */
export const SETUP_GUIDE_CHECKS = [
  { id: "configuration_saved", step: "contacts" },
  { id: "contact_details", step: "contacts" },
  { id: "sellable_sku", step: "products" },
  { id: "sellable_currencies", step: "products" },
  { id: "shipping_countries", step: "shipping" },
  { id: "shipping_methods", step: "shipping" },
  { id: "shipping_country_methods", step: "shipping" },
  { id: "payment_configuration", step: "payment" },
  { id: "policy_configuration", step: "storefront" },
  { id: "oversell_policy", step: "review" },
  { id: "reservation_ttl", step: "review" },
  { id: "turnstile_configuration", step: "review" },
  { id: "backup_configuration", step: "review" },
] as const;

export const setupGuideCheckSchema = z
  .object({
    id: z.enum(SETUP_GUIDE_CHECKS.map((check) => check.id)),
    step: z.enum(["contacts", "products", "shipping", "payment", "storefront", "review"]),
    status: z.enum(["passed", "needs_action", "unavailable", "restricted"]),
    reasons: z.array(
      z
        .object({
          // Open reason codes allow older clients to show a truthful generic fallback.
          code: z.string().min(1),
          countries: z.array(countryCodeSchema).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const setupGuideSummarySchema = z
  .object({
    checkedAt: isoDateTimeSchema,
    environment: z.enum(["development", "staging", "production"]),
    configuration: z
      .object({
        updatedAt: isoDateTimeSchema.nullable(),
        defaultCurrency: currencyCodeSchema,
      })
      .strict()
      .nullable(),
    checks: z.array(setupGuideCheckSchema).length(SETUP_GUIDE_CHECKS.length),
  })
  .strict()
  .superRefine((value, context) => {
    for (const expected of SETUP_GUIDE_CHECKS) {
      const matches = value.checks.filter((check) => check.id === expected.id);
      if (matches.length !== 1 || matches[0]?.step !== expected.step) {
        context.addIssue({
          code: "custom",
          message: "Every setup check must occur once in its assigned step.",
          path: ["checks"],
        });
      }
    }
  });

export type SetupGuideCheck = z.infer<typeof setupGuideCheckSchema>;
export type SetupGuideSummary = z.infer<typeof setupGuideSummarySchema>;
