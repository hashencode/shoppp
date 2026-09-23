import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { setupGuideDestinationsSchema, setupGuideSummarySchema } from "@shoppp/contracts";
import { createApp } from "../../src/http/app";
import { seedHumanAdmin } from "../fixtures/admin-iam";

const identityVerifier = async () => ({
  email: "setup-admin@example.test",
  principalKind: "human" as const,
  subject: "setup-admin",
});

const request = () =>
  new Request("https://api.example.test/admin/settings/setup-guide/destinations", {
    headers: { "X-Test-Admin-Identity": "test-token" },
  });

describe("store setup guide deep-link index", () => {
  beforeEach(async () => {
    await seedHumanAdmin(env.DB, {
      id: "setup-admin",
      email: "setup-admin@example.test",
      subject: "setup-admin",
    });
  });

  test("returns permission-filtered direct editor destinations without cross-domain readiness", async () => {
    const response = await createApp({ testIdentityVerifier: identityVerifier }).fetch(
      request(),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json<{ data: unknown }>();
    const guide = setupGuideDestinationsSchema.parse(body.data);

    expect(guide.destinations).toEqual(
      expect.arrayContaining([
        { href: "/settings/identity?from=setup-guide", id: "identity" },
        { href: "/settings/policies?from=setup-guide", id: "policies" },
        { href: "/catalog/collections?from=setup-guide", id: "collections" },
        { href: "/content/pages?from=setup-guide", id: "pages" },
        { href: "/storefront/navigation?from=setup-guide", id: "navigation" },
        { href: "/storefront/themes?from=setup-guide", id: "themes" },
      ]),
    );
    expect(JSON.stringify(guide)).not.toMatch(/passed|needs_action|defaultCurrency|credential/);
  });

  test("omits destinations whose read permission is absent and runs no domain queries", async () => {
    await env.DB.prepare(
      "UPDATE admin_identities SET role_id = 'role_analyst' WHERE id = 'setup-admin'",
    ).run();
    await env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = 'role_analyst'").run();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_key, created_at) VALUES ('role_analyst', 'catalog.read', '2026-09-23T00:00:00.000Z')",
    ).run();
    const queries: string[] = [];
    const database = new Proxy(env.DB, {
      get(target, property) {
        if (property === "prepare")
          return (query: string) => {
            queries.push(query);
            return target.prepare(query);
          };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const response = await createApp({ testIdentityVerifier: identityVerifier }).fetch(request(), {
      ...env,
      DB: database,
    });
    const body = await response.json<{ data: unknown }>();
    const guide = setupGuideDestinationsSchema.parse(body.data);

    expect(guide.destinations).toEqual([
      { href: "/catalog/products?from=setup-guide", id: "products" },
      { href: "/catalog/collections?from=setup-guide", id: "collections" },
    ]);
    expect(queries.some((query) => /products|shipping_|settings\s/i.test(query))).toBe(false);
  });

  test("retains the legacy readiness response for an older Admin deployment or rollback", async () => {
    const response = await createApp({ testIdentityVerifier: identityVerifier }).fetch(
      new Request("https://api.example.test/admin/settings/setup-guide", {
        headers: { "X-Test-Admin-Identity": "test-token" },
      }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await response.json<{ data: unknown }>();
    expect(setupGuideSummarySchema.parse(body.data).checks).toHaveLength(13);
  });
});
