import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, test } from "vitest";

import { seedLaunchFixture } from "../../../../packages/db/seed/apply";
import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "Cf-Access-Jwt-Assertion": "privacy-admin-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

const app = createApp({
  accessVerifier: async () => ({
    email: "privacy-admin@example.test",
    principalKind: "human",
    subject: "privacy-admin",
  }),
});

beforeAll(async () => {
  await seedLaunchFixture(env.DB);
  await seedHumanAdmin(env.DB, {
    displayName: "Privacy Admin",
    email: "privacy-admin@example.test",
    id: "admin-privacy",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "privacy-admin",
  });
});

describe("privacy request operations", () => {
  test("exports only the verified subject's scoped commerce data to expiring R2", async () => {
    const response = await app.fetch(
      request("/admin/privacy/requests", {
        body: JSON.stringify({
          confirm: true,
          email: "shopper@example.test",
          reason: "Verified subject access request",
          type: "access",
        }),
        headers: { "Idempotency-Key": "privacy-access-fixture-0001" },
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: { decision: string; expiresAt: string; id: string; subjectReference: string };
    };
    expect(body.data).toMatchObject({
      decision: "export_created",
      expiresAt: expect.any(String),
      subjectReference: expect.stringMatching(/^[a-f0-9]{12}$/),
    });

    const download = await app.fetch(
      request(`/admin/privacy/requests/${body.data.id}/download`),
      env,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("Cache-Control")).toBe("private, no-store");
    const exported = (await download.json()) as {
      orders: Array<{
        addresses: Array<{ line1: string }>;
        lines: Array<{ product_name: string }>;
        order: { email: string; public_reference: string };
      }>;
      subject: { email: string };
    };
    expect(exported.subject.email).toBe("shopper@example.test");
    expect(exported.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          addresses: expect.arrayContaining([
            expect.objectContaining({ line1: "100 Market Street" }),
          ]),
          lines: expect.arrayContaining([
            expect.objectContaining({ product_name: "Fixture Product 0001" }),
          ]),
          order: expect.objectContaining({
            email: "shopper@example.test",
            public_reference: "ORD-FIXTURE1",
          }),
        }),
      ]),
    );
  });

  test("correction and deletion preserve immutable finance and append retention decisions", async () => {
    const original = await env.DB.prepare(
      "SELECT email, grand_total_amount FROM orders WHERE id = 'ord_fixture_0001'",
    ).first();
    for (const [type, correction] of [
      ["correction", { field: "email", requestedValue: "corrected-shopper@example.test" }],
      ["deletion", undefined],
    ] as const) {
      const response = await app.fetch(
        request("/admin/privacy/requests", {
          body: JSON.stringify({
            confirm: true,
            ...(correction ? { correction } : {}),
            email: "shopper@example.test",
            reason: `Verified ${type} request`,
            type,
          }),
          headers: { "Idempotency-Key": `privacy-${type}-fixture-0001` },
          method: "POST",
        }),
        env,
      );
      expect(response.status).toBe(201);
      expect((await response.json()) as { data: { decision: string } }).toMatchObject({
        data: { decision: "retained_immutable_financial_records" },
      });
    }
    expect(
      await env.DB.prepare(
        "SELECT email, grand_total_amount FROM orders WHERE id = 'ord_fixture_0001'",
      ).first(),
    ).toEqual(original);
    const events = await env.DB.prepare(
      `SELECT metadata_json FROM privacy_request_events
        WHERE event_type = 'retention_decision_recorded'
        ORDER BY created_at DESC`,
    ).all<{ metadata_json: string }>();
    expect(events.results.map(({ metadata_json }) => JSON.parse(metadata_json))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          correctionField: "email",
          decision: "retained_immutable_financial_records",
        }),
      ]),
    );
    expect(JSON.stringify(events.results)).not.toContain("corrected-shopper@example.test");
    const event = await env.DB.prepare(
      "SELECT id FROM privacy_request_events ORDER BY created_at DESC LIMIT 1",
    ).first<{ id: string }>();
    await expect(
      env.DB.prepare("DELETE FROM privacy_request_events WHERE id = ?").bind(event!.id).run(),
    ).rejects.toThrow("immutable_privacy_request_event");
  });
});
