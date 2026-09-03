import {
  launchConfigurationSchema,
  SETUP_GUIDE_CHECKS,
  type AdminPermission,
  type SetupGuideCheck,
  type SetupGuideSummary,
} from "@shoppp/contracts";
import type { Context } from "hono";

import { hasSellableSku } from "../catalog/public";
import type { ApiEnvironment } from "../http/context";
import { hasPermission } from "../iam/permissions";
import {
  currencyReadiness,
  oversellReadiness,
  readLaunchConfiguration,
  reservationReadiness,
  runtimeReadiness,
  shippingReadiness,
} from "./launch-configuration";

type CheckId = SetupGuideCheck["id"];
type Reasons = SetupGuideCheck["reasons"];

export async function getSetupGuide(context: Context<ApiEnvironment>): Promise<SetupGuideSummary> {
  const checkedAt = new Date().toISOString();
  const checks: SetupGuideCheck[] = SETUP_GUIDE_CHECKS.map((check) => ({
    ...check,
    status: "unavailable",
    reasons: [{ code: "configuration_unavailable" }],
  }));
  const summary: SetupGuideSummary = {
    checkedAt,
    environment: context.env.ENVIRONMENT,
    configuration: null,
    checks,
  };
  let configuration;
  let updatedAt;
  try {
    const stored = await readLaunchConfiguration(context);
    configuration = launchConfigurationSchema.parse(stored.configuration);
    updatedAt = stored.updatedAt;
  } catch {
    // A failed read is never replaced by defaults or a previous request's context.
    return summary;
  }
  summary.configuration = { defaultCurrency: configuration.defaultCurrency, updatedAt };
  const permissions = context.get("principal").permissions;
  function set(id: CheckId, reasons: Reasons, status?: SetupGuideCheck["status"]): void {
    const check = checks.find((item) => item.id === id)!;
    check.status = status ?? (reasons.length ? "needs_action" : "passed");
    check.reasons = reasons;
  }
  async function domain(
    ids: CheckId[],
    required: AdminPermission[],
    run: () => Promise<void>,
  ): Promise<void> {
    if (required.some((permission) => !hasPermission(permissions, permission))) {
      ids.forEach((id) => set(id, [{ code: "permission_denied" }], "restricted"));
      return;
    }
    try {
      await run();
    } catch {
      ids.forEach((id) => set(id, [{ code: "check_failed" }], "unavailable"));
    }
  }
  set("configuration_saved", updatedAt ? [] : [{ code: "configuration_not_saved" }]);
  set("contact_details", []); // Both emails passed the same schema used when saving.
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
  const runtimeGroups: Partial<Record<CheckId, string[]>> = {
    payment_configuration: [
      "payment_provider_missing",
      "payment_webhook_missing",
      "production_payment_mode_not_live",
    ],
    policy_configuration: ["legal_approval_missing", "placeholder_policy_url"],
    turnstile_configuration: ["turnstile_site_key_missing", "turnstile_secret_missing"],
    backup_configuration: ["backup_export_missing"],
  };
  for (const [id, codes] of Object.entries(runtimeGroups)) {
    set(
      id as CheckId,
      runtime.filter((issue) => codes.includes(issue.code)).map(({ code }) => ({ code })),
    );
  }
  // Keep future legacy runtime issues visible even before they receive a dedicated group.
  const knownCodes = Object.values(runtimeGroups).flat();
  const unknown = runtime.filter((issue) => !knownCodes.includes(issue.code));
  if (unknown.length) {
    const check = checks.find((item) => item.id === "backup_configuration")!;
    set(check.id, [...check.reasons, ...unknown.map(({ code }) => ({ code }))]);
  }
  set(
    "reservation_ttl",
    reservationReadiness(configuration, context.env.RESERVATION_TTL_MINUTES).map(({ code }) => ({
      code,
    })),
  );
  const db = context.env.DB;
  await Promise.all([
    domain(["sellable_sku"], ["catalog.read", "inventory.read"], async () => {
      set(
        "sellable_sku",
        (await hasSellableSku(db, configuration.defaultCurrency, checkedAt))
          ? []
          : [{ code: "no_sellable_sku" }],
      );
    }),
    domain(["sellable_currencies"], ["catalog.read"], async () => {
      set(
        "sellable_currencies",
        (await currencyReadiness(db, configuration)).map(({ code }) => ({ code })),
      );
    }),
    domain(["oversell_policy"], ["inventory.read"], async () => {
      set(
        "oversell_policy",
        (await oversellReadiness(db, configuration)).map(({ code }) => ({ code })),
      );
    }),
    domain(["shipping_countries", "shipping_methods"], ["settings.read"], async () => {
      const issues = await shippingReadiness(db, configuration);
      set(
        "shipping_countries",
        issues
          .filter(({ code }) => code === "shipping_country_unavailable")
          .map(({ code }) => ({ code })),
      );
      set(
        "shipping_methods",
        issues
          .filter(({ code }) => code === "shipping_method_unavailable")
          .map(({ code }) => ({ code })),
      );
    }),
    domain(["shipping_country_methods"], ["settings.read"], async () => {
      const matches = await db
        .prepare(
          `SELECT DISTINCT szc.country_code
        FROM shipping_zone_countries szc
        JOIN shipping_zones sz ON sz.id = szc.zone_id
        JOIN shipping_methods sm ON sm.zone_id = sz.id
        WHERE sz.status = 'active' AND sm.status = 'active'
          AND sm.id IN (SELECT value FROM json_each(?))`,
        )
        .bind(JSON.stringify(configuration.shippingMethodIds))
        .all<{ country_code: string }>();
      const covered = new Set(matches.results.map((row) => row.country_code));
      const countries = configuration.shippingCountries.filter((country) => !covered.has(country));
      set(
        "shipping_country_methods",
        countries.length ? [{ code: "shipping_country_method_missing", countries }] : [],
      );
    }),
  ]);
  return summary;
}
