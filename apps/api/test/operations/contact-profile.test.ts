import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import type { ContactSettings, LaunchConfiguration } from "@shoppp/contracts";

import { createApp } from "../../src/http/app";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const app = createApp({
  testIdentityVerifier: async () => ({
    email: "contact-admin@example.test",
    principalKind: "human" as const,
    subject: "contact-admin",
  }),
});

function request(path: string, init: RequestInit = {}): Request {
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

async function read(): Promise<ContactSettings> {
  const response = await app.fetch(request("/admin/settings/contact"), env);
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: ContactSettings }).data;
}

async function save(
  current: ContactSettings,
  overrides: Record<string, unknown> = {},
  key = crypto.randomUUID(),
) {
  return app.fetch(
    request("/admin/settings/contact", {
      method: "PUT",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({
        profile: current.profile,
        supportEmail: current.supportEmail,
        privacyContactEmail: current.privacyContactEmail,
        expectedLaunchVersion: current.launchVersion,
        expectedProfileVersion: current.profileVersion,
        reason: "Operator confirmed contact details",
        ...overrides,
      }),
    }),
    env,
  );
}

describe("contact settings", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
      env.DB.prepare(
        "DELETE FROM settings WHERE key IN ('contact_profile', 'launch_configuration', 'contact_write_guard')",
      ),
      env.DB.prepare("DELETE FROM admin_identities"),
      env.DB.prepare(
        "DELETE FROM admin_role_permissions WHERE role_id = 'role_analyst' AND permission_key = 'settings.read'",
      ),
    ]);
    await seedHumanAdmin(env.DB, {
      id: "contact-admin",
      subject: "contact-admin",
      email: "contact-admin@example.test",
      roleId: ADMIN_ROLE_IDS.admin,
    });
  });

  test("keeps environment email private until explicit save and audits an online-only profile", async () => {
    const initial = await read();
    expect(initial.profileVersion).toBeNull();
    expect(initial.publicContact.supportEmail).toBeNull();
    const response = await save(initial, {
      supportEmail: "help@example.com",
      profile: { ...initial.profile, publishSupportEmail: true },
    });
    expect(response.status).toBe(200);
    const saved = await read();
    expect(saved.publicContact).toMatchObject({
      supportEmail: "help@example.com",
      locations: [],
      socials: [],
    });
    expect(saved.profileVersion).toBeTruthy();
    expect(
      await env.DB.prepare(
        "SELECT action, reason FROM audit_events WHERE action = 'settings.contact.update'",
      ).first(),
    ).toEqual({
      action: "settings.contact.update",
      reason: "Contact settings updated",
    });
    const launch = await app.fetch(request("/admin/settings/launch"), env);
    expect((await launch.json()) as { data: { configuration: LaunchConfiguration } }).toMatchObject(
      {
        data: { configuration: { supportEmail: "help@example.com" } },
      },
    );
  });

  test("preserves ordered locations and socials while filtering hidden entries", async () => {
    const initial = await read();
    const location = (id: string, name: string, visible: boolean) => ({
      id,
      name,
      city: "New York",
      address: "123 Main Street, New York, NY 10001",
      phone: "+12125550123",
      email: "place@example.com",
      mapUrl: "https://maps.example.com/place",
      visible,
    });
    const response = await save(initial, {
      profile: {
        ...initial.profile,
        locations: [
          location("20d1180b-89c3-40da-acf2-5aa12f4fddae", "First", true),
          location("7a843e4a-165c-48d8-bb71-d410e6a943c9", "Second", true),
          location("868a7c45-c7f2-45eb-a235-c70f2a7ad85b", "Hidden", false),
        ],
        socials: [
          {
            id: "09b4b33b-4522-45ab-8541-3f25b7fffc1b",
            platform: "instagram",
            url: "https://instagram.com/shoppp",
            visible: true,
          },
        ],
      },
    });
    expect(response.status).toBe(200);
    const saved = await read();
    expect(saved.publicContact.locations.map(({ name }) => name)).toEqual(["First", "Second"]);
    expect(saved.publicContact.socials).toMatchObject([
      { platform: "instagram", label: "Instagram" },
    ]);
  });

  test("rejects invalid URLs before persistence and stale versions before either source changes", async () => {
    const initial = await read();
    const invalid = await save(initial, {
      profile: {
        ...initial.profile,
        socials: [
          {
            id: crypto.randomUUID(),
            platform: "instagram",
            url: "http://example.com",
            visible: true,
          },
        ],
      },
    });
    expect(invalid.status).toBe(422);
    const first = await save(initial, { supportEmail: "new@example.com" });
    expect(first.status).toBe(200);
    const stale = await save(initial, { supportEmail: "stale@example.com" });
    expect(stale.status).toBe(409);
    expect((await read()).supportEmail).toBe("new@example.com");
    expect(
      (
        await env.DB.prepare(
          "SELECT count(*) AS count FROM audit_events WHERE action = 'settings.contact.update'",
        ).first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("reflects legacy launch email edits without replacing profile fields", async () => {
    const initial = await read();
    expect(
      (await save(initial, { profile: { ...initial.profile, publishSupportEmail: true } })).status,
    ).toBe(200);
    const beforeLegacy = await read();
    const launchResponse = await app.fetch(request("/admin/settings/launch"), env);
    const launch = (
      (await launchResponse.json()) as { data: { configuration: LaunchConfiguration } }
    ).data;
    const legacy = await app.fetch(
      request("/admin/settings/launch", {
        method: "PUT",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          configuration: { ...launch.configuration, supportEmail: "legacy@example.com" },
          confirm: true,
          reason: "Legacy launch editor updated support email",
        }),
      }),
      env,
    );
    expect(legacy.status).toBe(200);
    const stale = await save(beforeLegacy, { supportEmail: "stale@example.com" });
    expect(stale.status).toBe(409);
    const after = await read();
    expect(after.supportEmail).toBe("legacy@example.com");
    expect(after.publicContact.supportEmail).toBe("legacy@example.com");
    expect(after.profile.publishSupportEmail).toBe(true);
  });

  test("preserves stored free-text service hours as an explicit legacy value", async () => {
    await env.DB.prepare(
      "INSERT INTO settings (key, value_json, updated_at) VALUES ('contact_profile', ?, ?)",
    )
      .bind(
        JSON.stringify({
          version: crypto.randomUUID(),
          profile: {
            publishSupportEmail: false,
            publishPrivacyEmail: false,
            publicPhone: null,
            serviceHours: "Monday to Friday, 9–5",
            timeZone: "America/New_York",
            locations: [],
            socials: [],
          },
        }),
        new Date().toISOString(),
      )
      .run();

    expect((await read()).profile.serviceHours).toEqual({
      kind: "legacy",
      text: "Monday to Friday, 9–5",
    });
  });

  test("commercial settings save preserves contact emails changed after its form loaded", async () => {
    const initial = await read();
    const first = await save(initial, { supportEmail: "first@example.com" });
    expect(first.status).toBe(200);
    const launchResponse = await app.fetch(request("/admin/settings/launch"), env);
    const staleLaunch = (
      (await launchResponse.json()) as {
        data: { configuration: LaunchConfiguration };
      }
    ).data.configuration;

    const contact = await read();
    expect(
      (
        await save(contact, {
          supportEmail: "latest@example.com",
          privacyContactEmail: "privacy-latest@example.com",
        })
      ).status,
    ).toBe(200);
    const commercial = await app.fetch(
      request("/admin/settings/launch", {
        method: "PUT",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          configuration: { ...staleLaunch, orderNumberPrefix: "NEW" },
          confirm: true,
          preserveContactEmails: true,
          reason: "Updated commercial configuration",
        }),
      }),
      env,
    );
    expect(commercial.status).toBe(200);
    expect(
      ((await commercial.json()) as { data: { configuration: LaunchConfiguration } }).data
        .configuration,
    ).toMatchObject({
      orderNumberPrefix: "NEW",
      supportEmail: "latest@example.com",
      privacyContactEmail: "privacy-latest@example.com",
    });
    expect(await read()).toMatchObject({
      supportEmail: "latest@example.com",
      privacyContactEmail: "privacy-latest@example.com",
    });
  });

  test("denies writes without settings.write", async () => {
    const initial = await read();
    await env.DB.prepare(
      "INSERT INTO admin_role_permissions (role_id, permission_key, created_at) VALUES (?, 'settings.read', ?)",
    )
      .bind(ADMIN_ROLE_IDS.analyst, new Date().toISOString())
      .run();
    await env.DB.prepare("UPDATE admin_identities SET role_id = ? WHERE id = 'contact-admin'")
      .bind(ADMIN_ROLE_IDS.analyst)
      .run();
    const denied = await save(initial);
    expect(denied.status).toBe(403);
    expect((await read()).profileVersion).toBeNull();
  });
});
