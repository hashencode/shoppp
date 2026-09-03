import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import {
  setupGuideSummarySchema,
  type LaunchConfiguration,
  type SetupGuideSummary,
} from "@shoppp/contracts";
import type { ApiBindings } from "../../src/http/context";
import { createApp } from "../../src/http/app";
import { seedHumanAdmin } from "../fixtures/admin-iam";

const testIdentityVerifier = async () => ({
  email: "setup-admin@example.test",
  principalKind: "human" as const,
  subject: "setup-admin",
});
function request(): Request {
  return new Request("https://api.example.test/admin/settings/setup-guide", {
    headers: { "X-Test-Admin-Identity": "test-token" },
  });
}
describe("store setup guide", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM settings WHERE key = 'launch_configuration'").run();
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_analyst' AND permission_key = 'settings.read'",
    ).run();
    await seedHumanAdmin(env.DB, {
      id: "setup-admin",
      email: "setup-admin@example.test",
      subject: "setup-admin",
    });
  });
  test("reports unsaved defaults truthfully without exposing configuration credentials", async () => {
    const response = await createApp({ testIdentityVerifier }).fetch(request(), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        configuration: { updatedAt: null, defaultCurrency: "USD" },
        checks: expect.arrayContaining([
          {
            id: "configuration_saved",
            step: "contacts",
            status: "needs_action",
            reasons: [{ code: "configuration_not_saved" }],
          },
        ]),
      },
    });
    expect(JSON.stringify(body)).not.toContain("supportEmail");
  });
  async function summary(bindings: Partial<ApiBindings> = {}): Promise<SetupGuideSummary> {
    const app = createApp({ testIdentityVerifier });
    const response = await app.fetch(request(), { ...env, ...bindings });
    const body = (await response.json()) as { data: unknown };
    expect(response.status).toBe(200);
    return setupGuideSummarySchema.parse(body.data);
  }
  async function save(overrides: Partial<LaunchConfiguration> = {}): Promise<void> {
    const response = await createApp({ testIdentityVerifier }).fetch(
      new Request("https://api.example.test/admin/settings/launch", {
        headers: { "X-Test-Admin-Identity": "test-token" },
      }),
      env,
    );
    const body = (await response.json()) as { data: { configuration: LaunchConfiguration } };
    await env.DB.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES ('launch_configuration', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
    )
      .bind(
        JSON.stringify({ ...body.data.configuration, ...overrides }),
        "2026-09-03T00:00:00.000Z",
      )
      .run();
  }
  function faultyDatabase(pattern: RegExp, queries: string[] = []): D1Database {
    return new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare")
          return (query: string) => {
            queries.push(query);
            if (pattern.test(query)) throw new Error("Injected domain outage");
            return target.prepare(query);
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  test("gates the endpoint and skips forbidden catalog and inventory queries", async () => {
    await env.DB.prepare(
      "UPDATE admin_identities SET role_id = 'role_analyst' WHERE id = 'setup-admin'",
    ).run();
    const denied = await createApp({ testIdentityVerifier }).fetch(request(), env);
    expect(denied.status).toBe(403);
    await env.DB.prepare(
      "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES ('role_analyst', 'settings.read', '2026-09-03T00:00:00.000Z')",
    ).run();
    await env.DB.prepare(
      "DELETE FROM admin_role_permissions WHERE role_id = 'role_analyst' AND permission_key IN ('catalog.read', 'inventory.read')",
    ).run();
    const queries: string[] = [];
    const data = await summary({
      ...env,
      DB: faultyDatabase(/product_variants|price_lists|inventory_items/, queries),
    });
    for (const id of ["sellable_sku", "sellable_currencies", "oversell_policy"]) {
      expect(data.checks.find((check) => check.id === id)?.status).toBe("restricted");
    }
    expect(queries.some((sql) => /product_variants|price_lists|inventory_items/.test(sql))).toBe(
      false,
    );
    expect(data.checks).toHaveLength(13);
  });
  test("isolates a catalog outage and never replaces unreadable configuration with defaults", async () => {
    const partial = await summary({ ...env, DB: faultyDatabase(/FROM product_variants/) });
    expect(partial.checks.find((check) => check.id === "sellable_sku")?.status).toBe("unavailable");
    expect(partial.checks.find((check) => check.id === "contact_details")?.status).toBe("passed");
    expect(partial.checks.find((check) => check.id === "configuration_saved")?.status).toBe(
      "needs_action",
    );
    const failed = await summary({
      ...env,
      DB: faultyDatabase(/SELECT value_json, updated_at FROM settings/),
    });
    expect(failed.configuration).toBeNull();
    expect(failed.checks).toHaveLength(13);
    expect(failed.checks.every((check) => check.status === "unavailable")).toBe(true);
  });
  test("uses runtime payment facts and retains all production runtime issue categories", async () => {
    await save({
      providerConfigured: true,
      webhookConfigured: true,
      paymentMode: "test",
      reservationTtlMinutes: 20,
    });
    const data = await summary({
      ...env,
      ENVIRONMENT: "production",
      RESOURCE_NAMESPACE: "shoppp-production",
      TURNSTILE_REQUIRED: "true",
      STRIPE_SECRET_KEY: "invalid",
      STRIPE_WEBHOOK_SECRET: "invalid",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET: "",
    });
    expect(data.checks.find((check) => check.id === "configuration_saved")?.status).toBe("passed");
    expect(data.checks.flatMap((check) => check.reasons.map((reason) => reason.code))).toEqual(
      expect.arrayContaining([
        "payment_provider_missing",
        "payment_webhook_missing",
        "production_payment_mode_not_live",
        "legal_approval_missing",
        "placeholder_policy_url",
        "reservation_ttl_mismatch",
        "turnstile_site_key_missing",
        "turnstile_secret_missing",
        "backup_export_missing",
      ]),
    );
    const valid = await summary({
      ...env,
      STRIPE_SECRET_KEY: "sk_test_fixture",
      STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    });
    expect(valid.checks.find((check) => check.id === "payment_configuration")?.status).toBe(
      "passed",
    );
    expect(JSON.stringify(valid)).not.toMatch(
      /sk_test_fixture|whsec_fixture|providerConfigured|webhookConfigured/,
    );
  });
  test("requires a selected active method in each enabled country's own zone", async () => {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO shipping_zones (id, name, status, created_at, updated_at) VALUES ('setup-us', 'US', 'active', '2026-09-03', '2026-09-03'), ('setup-ca', 'CA', 'active', '2026-09-03', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT OR IGNORE INTO shipping_zone_countries (zone_id, country_code) VALUES ('setup-us', 'US'), ('setup-ca', 'CA')",
      ),
      env.DB.prepare(
        "INSERT OR IGNORE INTO shipping_methods (id, zone_id, name, calculation_type, price_amount, currency, status, created_at, updated_at) VALUES ('ship_01J00000000000000000000001', 'setup-us', 'US Ground', 'flat', 500, 'USD', 'active', '2026-09-03', '2026-09-03'), ('ship_01J00000000000000000000002', 'setup-ca', 'CA Ground', 'flat', 500, 'USD', 'active', '2026-09-03', '2026-09-03')",
      ),
    ]);
    await save({
      shippingCountries: ["US", "CA"],
      shippingMethodIds: ["ship_01J00000000000000000000001"],
    });
    const missing = await summary();
    expect(missing.checks.find((check) => check.id === "shipping_countries")?.status).toBe(
      "passed",
    );
    expect(missing.checks.find((check) => check.id === "shipping_methods")?.status).toBe("passed");
    expect(
      missing.checks.find((check) => check.id === "shipping_country_methods")?.reasons,
    ).toEqual([{ code: "shipping_country_method_missing", countries: ["CA"] }]);
    await save({
      shippingCountries: ["US", "CA"],
      shippingMethodIds: ["ship_01J00000000000000000000001", "ship_01J00000000000000000000002"],
    });
    expect(
      (await summary()).checks.find((check) => check.id === "shipping_country_methods")?.status,
    ).toBe("passed");
  });
  test("uses public catalog eligibility, current currency prices and available inventory", async () => {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO products (id, slug, name, status, created_at, updated_at) VALUES ('setup-product', 'setup-product', 'Setup fixture', 'published', '2026-09-03', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT INTO product_variants (id, product_id, sku, title, weight_grams, status, created_at, updated_at) VALUES ('setup-variant', 'setup-product', 'SETUP-SKU', 'Default', 100, 'active', '2026-09-03', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT INTO price_lists (id, code, currency, status, created_at, updated_at) VALUES ('setup-prices', 'setup-prices', 'USD', 'active', '2026-09-03', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT INTO prices (id, price_list_id, variant_id, amount, created_at, updated_at) VALUES ('setup-price', 'setup-prices', 'setup-variant', 1000, '2026-09-03', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT INTO warehouses (id, code, name, created_at) VALUES ('setup-warehouse', 'SETUP', 'Setup', '2026-09-03')",
      ),
      env.DB.prepare(
        "INSERT INTO inventory_items (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, backordered_quantity, oversell_limit, updated_at) VALUES ('setup-variant', 'setup-warehouse', 5, 1, 1, 0, '2026-09-03')",
      ),
    ]);
    const status = async () =>
      (await summary()).checks.find((check) => check.id === "sellable_sku")?.status;
    expect(await status()).toBe("passed");
    for (const [change, restore] of [
      [
        "UPDATE products SET status = 'draft' WHERE id = 'setup-product'",
        "UPDATE products SET status = 'published' WHERE id = 'setup-product'",
      ],
      [
        "UPDATE product_variants SET status = 'disabled' WHERE id = 'setup-variant'",
        "UPDATE product_variants SET status = 'active' WHERE id = 'setup-variant'",
      ],
      [
        "UPDATE price_lists SET ends_at = '2020-01-01' WHERE id = 'setup-prices'",
        "UPDATE price_lists SET ends_at = NULL WHERE id = 'setup-prices'",
      ],
      [
        "UPDATE price_lists SET starts_at = '2999-01-01' WHERE id = 'setup-prices'",
        "UPDATE price_lists SET starts_at = NULL WHERE id = 'setup-prices'",
      ],
      [
        "UPDATE inventory_items SET backordered_quantity = 4 WHERE variant_id = 'setup-variant'",
        "UPDATE inventory_items SET backordered_quantity = 1 WHERE variant_id = 'setup-variant'",
      ],
    ]) {
      await env.DB.prepare(change!).run();
      expect(await status()).toBe("needs_action");
      await env.DB.prepare(restore!).run();
    }
    await save({ defaultCurrency: "EUR", sellableCurrencies: ["EUR"] });
    expect(await status()).toBe("needs_action");
    expect((await summary()).configuration?.defaultCurrency).toBe("EUR");
    await env.DB.prepare("UPDATE price_lists SET currency = 'EUR' WHERE id = 'setup-prices'").run();
    expect(await status()).toBe("passed");
    await env.DB.prepare(
      "UPDATE inventory_items SET oversell_limit = 1 WHERE variant_id = 'setup-variant'",
    ).run();
    expect(
      (await summary()).checks.find((check) => check.id === "oversell_policy")?.reasons,
    ).toEqual([{ code: "oversell_policy_mismatch" }]);
  });
});
