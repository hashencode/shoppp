import type {
  LaunchConfiguration,
  LaunchConfigurationStatus,
  UpdateLaunchConfigurationRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";

const SETTING_KEY = "launch_configuration";

function stripeProviderConfigured(value: string | undefined): boolean {
  return value?.startsWith("sk_") === true;
}

function stripeWebhookConfigured(value: string | undefined): boolean {
  return value?.startsWith("whsec_") === true;
}

function defaultConfiguration(context: Context<ApiEnvironment>): LaunchConfiguration {
  const storefrontOrigin = context.env.STOREFRONT_ORIGIN.replace(/\/$/, "");
  const production = context.env.ENVIRONMENT === "production";
  return {
    defaultCurrency: "USD",
    legalApproved: false,
    orderNumberPrefix: "ORD",
    oversellPolicy: "deny",
    paymentMode: production ? "live" : "test",
    paymentProvider: "stripe",
    policies: {
      contact: `${storefrontOrigin}/policies/contact`,
      cookies: `${storefrontOrigin}/policies/cookies`,
      privacy: `${storefrontOrigin}/policies/privacy`,
      returns: `${storefrontOrigin}/policies/returns`,
      shipping: `${storefrontOrigin}/policies/shipping`,
      terms: `${storefrontOrigin}/policies/terms`,
    },
    privacyContactEmail: context.env.EMAIL_FROM,
    providerConfigured: stripeProviderConfigured(context.env.STRIPE_SECRET_KEY),
    reservationTtlMinutes: Number(context.env.RESERVATION_TTL_MINUTES ?? "30"),
    sellableCurrencies: ["USD"],
    shippingCountries: ["US"],
    shippingMethodIds: ["ship_01J00000000000000000000000"],
    supportEmail: context.env.EMAIL_FROM,
    taxMode: "zero",
    webhookConfigured: stripeWebhookConfigured(context.env.STRIPE_WEBHOOK_SECRET),
  };
}

export function runtimeReadiness(
  configuration: LaunchConfiguration,
  environment: ApiEnvironment["Bindings"]["ENVIRONMENT"],
  turnstileRequired: string | undefined,
  turnstileSiteKey: string | undefined,
  turnstileSecret: string | undefined,
  backupConfigured: boolean,
): LaunchConfigurationStatus["issues"] {
  const issues: LaunchConfigurationStatus["issues"] = [];
  if (!configuration.legalApproved) {
    issues.push({
      code: "legal_approval_missing",
      message: "Legal approval for the published policies is required.",
    });
  }
  if (!configuration.providerConfigured) {
    issues.push({
      code: "payment_provider_missing",
      message: "The payment provider credential is not configured.",
    });
  }
  if (!configuration.webhookConfigured) {
    issues.push({
      code: "payment_webhook_missing",
      message: "The payment webhook credential is not configured.",
    });
  }
  if (environment === "production" && configuration.paymentMode !== "live") {
    issues.push({
      code: "production_payment_mode_not_live",
      message: "Production must use the live payment provider mode.",
    });
  }
  if (
    environment === "production" &&
    Object.values(configuration.policies).some((url) => new URL(url).hostname.endsWith(".invalid"))
  ) {
    issues.push({
      code: "placeholder_policy_url",
      message: "Production policy links cannot use placeholder domains.",
    });
  }
  if (turnstileRequired === "true" && !turnstileSecret) {
    issues.push({
      code: "turnstile_secret_missing",
      message: "Turnstile is required but its server-side secret is not configured.",
    });
  }
  if (turnstileRequired === "true" && !turnstileSiteKey) {
    issues.push({
      code: "turnstile_site_key_missing",
      message: "Turnstile is required but its environment-specific public site key is missing.",
    });
  }
  if (!backupConfigured) {
    issues.push({
      code: "backup_export_missing",
      message: "The scheduled D1 export credential or target binding is not configured.",
    });
  }
  return issues;
}

export async function currencyReadiness(
  db: D1Database,
  configuration: LaunchConfiguration,
): Promise<LaunchConfigurationStatus["issues"]> {
  const issues: LaunchConfigurationStatus["issues"] = [];
  const currencies = await db
    .prepare(
      `SELECT DISTINCT currency FROM price_lists
      WHERE status = 'active' AND currency IN (SELECT value FROM json_each(?))
      ORDER BY currency`,
    )
    .bind(JSON.stringify(configuration.sellableCurrencies))
    .all<{ currency: string }>();
  const activeCurrencies = new Set(currencies.results.map(({ currency }) => currency));
  if (configuration.sellableCurrencies.some((currency) => !activeCurrencies.has(currency))) {
    issues.push({
      code: "sellable_currency_unavailable",
      message: "Every sellable currency must have an active price list.",
    });
  }
  return issues;
}

export async function shippingReadiness(
  db: D1Database,
  configuration: LaunchConfiguration,
): Promise<LaunchConfigurationStatus["issues"]> {
  const issues: LaunchConfigurationStatus["issues"] = [];
  const [countries, methods] = await Promise.all([
    db
      .prepare(
        `SELECT DISTINCT szc.country_code FROM shipping_zone_countries szc
          JOIN shipping_zones sz ON sz.id = szc.zone_id
          WHERE sz.status = 'active' AND szc.country_code IN (SELECT value FROM json_each(?))
          ORDER BY szc.country_code`,
      )
      .bind(JSON.stringify(configuration.shippingCountries))
      .all<{ country_code: string }>(),
    db
      .prepare(
        `SELECT sm.id FROM shipping_methods sm JOIN shipping_zones sz ON sz.id = sm.zone_id
          WHERE sm.status = 'active' AND sz.status = 'active'
            AND sm.id IN (SELECT value FROM json_each(?)) ORDER BY sm.id`,
      )
      .bind(JSON.stringify(configuration.shippingMethodIds))
      .all<{ id: string }>(),
  ]);
  const activeCountries = new Set(countries.results.map(({ country_code }) => country_code));
  if (configuration.shippingCountries.some((country) => !activeCountries.has(country))) {
    issues.push({
      code: "shipping_country_unavailable",
      message: "Every enabled country must belong to an active shipping zone.",
    });
  }
  const activeMethods = new Set(methods.results.map(({ id }) => id));
  if (configuration.shippingMethodIds.some((method) => !activeMethods.has(method))) {
    issues.push({
      code: "shipping_method_unavailable",
      message: "Every enabled shipping method must exist in an active shipping zone.",
    });
  }
  return issues;
}

export async function oversellReadiness(
  db: D1Database,
  configuration: LaunchConfiguration,
): Promise<LaunchConfigurationStatus["issues"]> {
  const issues: LaunchConfigurationStatus["issues"] = [];
  const oversell = await db
    .prepare("SELECT 1 AS found FROM inventory_items WHERE oversell_limit > 0 LIMIT 1")
    .first<{ found: number }>();
  if (configuration.oversellPolicy === "deny" && oversell !== null) {
    issues.push({
      code: "oversell_policy_mismatch",
      message: "Inventory oversell limits must be zero when the launch policy denies oversell.",
    });
  }
  return issues;
}

export function reservationReadiness(
  configuration: LaunchConfiguration,
  configuredReservationTtl: string | undefined,
): LaunchConfigurationStatus["issues"] {
  const issues: LaunchConfigurationStatus["issues"] = [];
  if (
    configuredReservationTtl &&
    Number(configuredReservationTtl) !== configuration.reservationTtlMinutes
  ) {
    issues.push({
      code: "reservation_ttl_mismatch",
      message: "The launch reservation duration must match the Worker runtime value.",
    });
  }
  return issues;
}

export async function readLaunchConfiguration(
  context: Context<ApiEnvironment>,
): Promise<Pick<LaunchConfigurationStatus, "configuration" | "updatedAt">> {
  const row = await context.env.DB.prepare(
    "SELECT value_json, updated_at FROM settings WHERE key = ?",
  )
    .bind(SETTING_KEY)
    .first<{ updated_at: string; value_json: string }>();
  const storedConfiguration = row
    ? (JSON.parse(row.value_json) as LaunchConfiguration)
    : defaultConfiguration(context);
  const configuration = {
    ...storedConfiguration,
    providerConfigured: stripeProviderConfigured(context.env.STRIPE_SECRET_KEY),
    webhookConfigured: stripeWebhookConfigured(context.env.STRIPE_WEBHOOK_SECRET),
  };
  return { configuration, updatedAt: row?.updated_at ?? null };
}

export async function getLaunchConfiguration(
  context: Context<ApiEnvironment>,
): Promise<LaunchConfigurationStatus> {
  const { configuration, updatedAt } = await readLaunchConfiguration(context);
  const runtime = runtimeReadiness(
    configuration,
    context.env.ENVIRONMENT,
    context.env.TURNSTILE_REQUIRED,
    context.env.TURNSTILE_SITE_KEY,
    context.env.TURNSTILE_SECRET,
    Boolean(
      context.env.CLOUDFLARE_ACCOUNT_ID &&
      context.env.D1_DATABASE_ID &&
      context.env.D1_REST_API_TOKEN &&
      context.env.BACKUP_BUCKET,
    ),
  );
  const [currencies, shipping, oversell] = await Promise.all([
    currencyReadiness(context.env.DB, configuration),
    shippingReadiness(context.env.DB, configuration),
    oversellReadiness(context.env.DB, configuration),
  ]);
  const issues = [
    ...runtime,
    ...currencies,
    ...shipping,
    ...oversell,
    ...reservationReadiness(configuration, context.env.RESERVATION_TTL_MINUTES),
  ];
  return {
    configuration,
    environment: context.env.ENVIRONMENT,
    issues,
    ready: issues.length === 0,
    updatedAt,
  };
}

export async function updateLaunchConfiguration(
  context: Context<ApiEnvironment>,
  input: UpdateLaunchConfigurationRequest,
): Promise<LaunchConfigurationStatus> {
  const principal = context.get("principal");
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO settings (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  )
    .bind(SETTING_KEY, JSON.stringify(input.configuration), now)
    .run();
  await recordAuditEvent(context.env.DB, {
    action: "settings.launch.update",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: {
      defaultCurrency: input.configuration.defaultCurrency,
      legalApproved: input.configuration.legalApproved,
      paymentMode: input.configuration.paymentMode,
      sellableCurrencies: input.configuration.sellableCurrencies,
      shippingCountries: input.configuration.shippingCountries,
    },
    reason: input.reason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: SETTING_KEY,
    targetType: "setting",
  });
  return getLaunchConfiguration(context);
}
