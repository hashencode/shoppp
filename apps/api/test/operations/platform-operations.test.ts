import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { LaunchConfiguration } from "@shoppp/contracts";

import { createApp } from "../../src/http/app";
import { recordAuditEvent } from "../../src/iam/audit";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

function adminRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      "X-Test-Admin-Identity": "test-token",
      "Content-Type": "application/json",
      Origin: "https://admin.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...init.headers,
    },
  });
}

const testIdentityVerifier = async () => ({
  email: "platform-admin@example.test",
  principalKind: "human" as const,
  subject: "platform-admin",
});

async function seedAdmin(): Promise<void> {
  await seedHumanAdmin(env.DB, {
    displayName: "Platform Admin",
    email: "platform-admin@example.test",
    id: "admin-platform",
    roleId: ADMIN_ROLE_IDS.admin,
    subject: "platform-admin",
  });
}

describe("launch controls, audit, and operational health", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare("DELETE FROM settings WHERE key = 'launch_configuration'"),
      env.DB.prepare("DELETE FROM admin_identities"),
    ]);
    await seedAdmin();
  });

  test("reports incomplete launch gates and persists a confirmed, audited configuration", async () => {
    const app = createApp({ testIdentityVerifier });
    const initial = await app.fetch(adminRequest("/admin/settings/launch"), env);
    const initialBody = (await initial.json()) as {
      data: { configuration: LaunchConfiguration; issues: { code: string }[]; ready: boolean };
    };
    expect(initial.status).toBe(200);
    expect(initial.headers.get("Cache-Control")).toBe("private, no-store");
    expect(initialBody.data.ready).toBe(false);
    expect(initialBody.data.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "legal_approval_missing",
        "payment_provider_missing",
        "payment_webhook_missing",
      ]),
    );

    const configuration: LaunchConfiguration = {
      ...initialBody.data.configuration,
      legalApproved: true,
      providerConfigured: true,
      webhookConfigured: true,
    };
    const updated = await app.fetch(
      adminRequest("/admin/settings/launch", {
        body: JSON.stringify({
          configuration,
          confirm: true,
          reason: "Approved staging launch configuration",
        }),
        headers: { "Idempotency-Key": "settings-launch-update-0001" },
        method: "PUT",
      }),
      env,
    );
    expect(updated.status).toBe(200);
    expect(
      (await updated.json()) as { data: { issues: { code: string }[]; ready: boolean } },
    ).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          { code: "payment_provider_missing", message: expect.any(String) },
          { code: "payment_webhook_missing", message: expect.any(String) },
        ]),
        ready: false,
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT action, reason FROM audit_events WHERE action = 'settings.launch.update'",
      ).first(),
    ).toEqual({
      action: "settings.launch.update",
      reason: "Approved staging launch configuration",
    });
  });

  test("reports Stripe credentials configured only when runtime values match provider contracts", async () => {
    const app = createApp({ testIdentityVerifier });
    const invalid = await app.fetch(adminRequest("/admin/settings/launch"), {
      ...env,
      STRIPE_SECRET_KEY: "secret://stripe/key",
      STRIPE_WEBHOOK_SECRET: "secret://stripe/webhook",
    });
    const invalidBody = (await invalid.json()) as {
      data: { configuration: LaunchConfiguration; issues: { code: string }[] };
    };
    expect(invalidBody.data.configuration).toMatchObject({
      providerConfigured: false,
      webhookConfigured: false,
    });
    expect(invalidBody.data.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["payment_provider_missing", "payment_webhook_missing"]),
    );

    const valid = await app.fetch(adminRequest("/admin/settings/launch"), {
      ...env,
      STRIPE_SECRET_KEY: "sk_test_runtime_fixture",
      STRIPE_WEBHOOK_SECRET: "whsec_runtime_fixture",
    });
    expect(await valid.json()).toMatchObject({
      data: {
        configuration: { providerConfigured: true, webhookConfigured: true },
      },
    });
  });

  test("rejects internally inconsistent or incomplete launch configuration", async () => {
    const app = createApp({ testIdentityVerifier });
    const initial = await app.fetch(adminRequest("/admin/settings/launch"), env);
    const initialBody = (await initial.json()) as {
      data: { configuration: LaunchConfiguration };
    };
    const response = await app.fetch(
      adminRequest("/admin/settings/launch", {
        body: JSON.stringify({
          configuration: {
            ...initialBody.data.configuration,
            defaultCurrency: "EUR",
            shippingMethodIds: [],
          },
          confirm: true,
          reason: "Invalid configuration proof",
        }),
        headers: { "Idempotency-Key": "settings-launch-invalid-0001" },
        method: "PUT",
      }),
      env,
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "validation_failed" },
    });
  });

  test("rejects launch configuration that references a malformed shipping method ID", async () => {
    const app = createApp({ testIdentityVerifier });
    const initial = await app.fetch(adminRequest("/admin/settings/launch"), env);
    const initialBody = (await initial.json()) as {
      data: { configuration: LaunchConfiguration };
    };
    const response = await app.fetch(
      adminRequest("/admin/settings/launch", {
        body: JSON.stringify({
          configuration: {
            ...initialBody.data.configuration,
            shippingMethodIds: ["ship_staging_us"],
          },
          confirm: true,
          reason: "Reject malformed shipping method identifier",
        }),
        headers: { "Idempotency-Key": "settings-launch-invalid-shipping-id-0001" },
        method: "PUT",
      }),
      env,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "validation_failed",
        details: expect.arrayContaining([
          expect.objectContaining({ path: ["configuration", "shippingMethodIds", 0] }),
        ]),
      },
    });
  });

  test("redacts stored metadata and provides stable cursor audit browsing", async () => {
    await recordAuditEvent(env.DB, {
      action: "privacy.test",
      actorId: "admin-platform",
      actorType: "admin",
      id: "audit-platform-1",
      metadata: { email: "shopper@example.test", safe: "visible" },
      result: "succeeded",
      targetType: "privacy_request",
    });
    await recordAuditEvent(env.DB, {
      action: "privacy.test",
      actorId: "admin-platform",
      actorType: "admin",
      id: "audit-platform-2",
      metadata: { safe: "second" },
      result: "succeeded",
      targetType: "privacy_request",
    });
    const app = createApp({ testIdentityVerifier });
    const first = await app.fetch(adminRequest("/admin/audit?action=privacy.test&pageSize=1"), env);
    const firstBody = (await first.json()) as {
      data: { metadata: Record<string, unknown> }[];
      meta: { nextCursor: string };
    };
    expect(first.status).toBe(200);
    expect(JSON.stringify(firstBody)).not.toContain("shopper@example.test");
    expect(firstBody.meta.nextCursor).toBeTruthy();

    const second = await app.fetch(
      adminRequest(
        `/admin/audit?action=privacy.test&pageSize=1&cursor=${encodeURIComponent(firstBody.meta.nextCursor)}`,
      ),
      env,
    );
    expect(second.status).toBe(200);
    expect((await second.json()) as { data: unknown[] }).toMatchObject({
      data: [expect.any(Object)],
    });
  });

  test("exposes bounded health signals and never logs query-string personal data", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = createApp({ testIdentityVerifier });
    const response = await app.fetch(
      adminRequest("/admin/operations/health?email=shopper@example.test"),
      env,
    );
    expect(response.status).toBe(200);
    expect(
      (await response.json()) as { data: { failures: unknown; status: string } },
    ).toMatchObject({
      data: {
        failures: {
          catalogBuilds: expect.any(Number),
          deadLetterJobs: expect.any(Number),
          paymentEvents: expect.any(Number),
          reportExports: expect.any(Number),
        },
        status: expect.stringMatching(/^(ok|degraded)$/),
      },
    });
    const output = info.mock.calls.flat().join(" ");
    expect(output).toContain("/admin/operations/health");
    expect(output).not.toContain("shopper@example.test");
    info.mockRestore();
  });
});
