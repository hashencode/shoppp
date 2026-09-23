import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

function appFor(subject: string) {
  return createApp({
    testIdentityVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
      subject,
    }),
  });
}

function request(path: string, body?: unknown, idempotencyKey?: string): Request {
  return new Request(`https://api.example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      "X-Test-Admin-Identity": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    method: body === undefined ? "GET" : path.endsWith("/zones") ? "POST" : "PUT",
  });
}

const zoneInput = {
  confirm: true,
  reason: "Enable launch shipping service",
  zone: {
    countries: ["US", "CA"],
    methods: [
      {
        calculationType: "flat",
        currency: "USD",
        freeThresholdAmount: 10_000,
        maxWeightGrams: null,
        minWeightGrams: null,
        name: "Tracked ground",
        priceAmount: 900,
        status: "active",
      },
      {
        calculationType: "weight",
        currency: "USD",
        freeThresholdAmount: null,
        maxWeightGrams: 5_000,
        minWeightGrams: 1,
        name: "Light parcel",
        priceAmount: 500,
        status: "active",
      },
    ],
    name: "North America",
    status: "active",
  },
} as const;

describe("shipping settings", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE catalog_releases SET candidate_status = 'abandoned' WHERE purpose = 'private-preview' AND candidate_status = 'pending'",
      ),
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM shipping_methods"),
      env.DB.prepare("DELETE FROM shipping_zone_countries"),
      env.DB.prepare("DELETE FROM shipping_zones"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
    await seedHumanAdmin(env.DB, {
      email: "shipping-admin@example.test",
      id: "admin-shipping-admin",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "shipping-admin",
    });
  });

  test.each(["zone", "country", "method"] as const)(
    "returns the stable candidate lock response for a pending %s mutation",
    async (mutation) => {
      const app = appFor("shipping-admin");
      const createdResponse = await app.fetch(
        request(
          "/admin/settings/shipping/zones",
          zoneInput,
          `shipping-candidate-lock-seed-${mutation}`,
        ),
        env,
      );
      const created = await createdResponse.json<{
        data: { id: string; methods: Array<{ id: string }> };
      }>();
      expect(createdResponse.status).toBe(201);
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO catalog_releases
           (id, status, manifest_json, approved_at, purpose, environment, candidate_status,
            candidate_expires_at, created_at, updated_at)
         VALUES (?, 'approved', '{}', ?, 'private-preview', 'staging', 'pending',
                 '2099-09-23T00:00:00.000Z', ?, ?)`,
      )
        .bind(`release-shipping-lock-${mutation}`, now, now, now)
        .run();

      const response = await app.fetch(
        request(
          `/admin/settings/shipping/zones/${created.data.id}`,
          {
            ...zoneInput,
            reason: `Attempt ${mutation} mutation during candidate freeze`,
            zone: {
              ...zoneInput.zone,
              countries: mutation === "country" ? ["US"] : zoneInput.zone.countries,
              id: created.data.id,
              methods: zoneInput.zone.methods.map((method, index) => ({
                ...method,
                id: created.data.methods[index]!.id,
                priceAmount:
                  mutation === "method" && index === 0
                    ? method.priceAmount + 100
                    : method.priceAmount,
              })),
              name: mutation === "zone" ? "Frozen North America" : zoneInput.zone.name,
            },
          },
          `shipping-candidate-lock-${mutation}`,
        ),
        env,
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: {
          code: "catalog_candidate_sources_locked",
          message:
            "Catalog sources are frozen while a Preview candidate is being built. Retry shortly.",
        },
      });
    },
  );

  test("creates, lists, and atomically updates a reasoned shipping zone", async () => {
    const app = appFor("shipping-admin");
    const createdResponse = await app.fetch(
      request("/admin/settings/shipping/zones", zoneInput, "shipping-zone-create-0001"),
      env,
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json<{
      data: {
        id: string;
        methods: Array<{ id: string; name: string; status: string }>;
      };
    }>();
    expect(created.data.id).toMatch(/^zone_[A-Z0-9]{26}$/);
    expect(created.data.methods).toHaveLength(2);

    const listed = await app.fetch(request("/admin/settings/shipping"), env);
    expect(await listed.json()).toMatchObject({
      data: [
        {
          countries: ["CA", "US"],
          id: created.data.id,
          methods: expect.arrayContaining([
            expect.objectContaining({ name: "Tracked ground", priceAmount: 900 }),
          ]),
          status: "active",
        },
      ],
    });

    const retainedMethod = created.data.methods[0]!;
    const updatedResponse = await app.fetch(
      request(
        `/admin/settings/shipping/zones/${created.data.id}`,
        {
          ...zoneInput,
          reason: "Disable Canada and update ground rate",
          zone: {
            ...zoneInput.zone,
            countries: ["US"],
            id: created.data.id,
            methods: [
              {
                ...zoneInput.zone.methods[0],
                id: retainedMethod.id,
                priceAmount: 1_100,
              },
            ],
          },
        },
        "shipping-zone-update-0001",
      ),
      env,
    );
    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({
      data: {
        countries: ["US"],
        methods: expect.arrayContaining([
          expect.objectContaining({
            id: retainedMethod.id,
            priceAmount: 1_100,
            status: "active",
          }),
          expect.objectContaining({ status: "disabled" }),
        ]),
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT action, reason FROM audit_events WHERE target_id = ? ORDER BY created_at DESC LIMIT 1",
      )
        .bind(created.data.id)
        .first(),
    ).toEqual({
      action: "shipping.zone.update",
      reason: "Disable Canada and update ground rate",
    });
  });

  test("rejects overlapping active countries and operators without settings permission", async () => {
    const app = appFor("shipping-admin");
    expect(
      (
        await app.fetch(
          request("/admin/settings/shipping/zones", zoneInput, "shipping-zone-create-0002"),
          env,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await app.fetch(
          request(
            "/admin/settings/shipping/zones",
            {
              ...zoneInput,
              reason: "Conflicting active zone",
              zone: { ...zoneInput.zone, countries: ["US"], name: "Duplicate US" },
            },
            "shipping-zone-create-0003",
          ),
          env,
        )
      ).status,
    ).toBe(409);

    await seedHumanAdmin(env.DB, {
      email: "shipping-support@example.test",
      id: "admin-shipping-support",
      roleId: ADMIN_ROLE_IDS.support,
      subject: "shipping-support",
    });
    expect(
      (await appFor("shipping-support").fetch(request("/admin/settings/shipping"), env)).status,
    ).toBe(403);
  });

  test("serializes concurrent active-country assignments at the database boundary", async () => {
    const app = appFor("shipping-admin");
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        app.fetch(
          request(
            "/admin/settings/shipping/zones",
            {
              ...zoneInput,
              reason: `Concurrent zone assignment ${index}`,
              zone: {
                ...zoneInput.zone,
                countries: ["GB"],
                name: `Concurrent zone ${index}`,
              },
            },
            `shipping-zone-concurrent-${String(index).padStart(4, "0")}`,
          ),
          env,
        ),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(7);
    expect(
      (
        await env.DB.prepare(
          `SELECT COUNT(*) AS count
             FROM shipping_zone_countries szc
             JOIN shipping_zones sz ON sz.id = szc.zone_id
            WHERE szc.country_code = 'GB' AND sz.status = 'active'`,
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });
});
