import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { storefrontExperienceDraftInputSchema, themePackageSchema } from "@shoppp/contracts";

import fashionFixture from "../../../storefront/fixtures/experience/fashion.json";
import { fashionManifest } from "../../../storefront/app/themes/fashion/manifest";
import { fashionPreset } from "../../../storefront/app/themes/fashion/presets/editorial";
import { createApp } from "../../src/http/app";
import { cleanupExpiredStorefrontPreviews } from "../../src/storefront-experience/cleanup";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

async function seedOperator(role = "admin", subject = "theme-admin"): Promise<void> {
  const roleId = role === "admin" ? ADMIN_ROLE_IDS.admin : ADMIN_ROLE_IDS.support;
  await seedHumanAdmin(env.DB, {
    displayName: subject,
    email: `${subject}@example.test`,
    id: `admin-${subject}`,
    roleId,
    subject,
  });
}

function appFor(subject = "theme-admin") {
  return createApp({
    testIdentityVerifier: async () => ({
      email: `${subject}@example.test`,
      principalKind: "human",
      subject,
    }),
  });
}

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

function writeRequest(
  path: string,
  body: unknown,
  idempotencyKey: string,
  method = "POST",
): Request {
  return request(path, {
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": idempotencyKey },
    method,
  });
}

const draftInput = storefrontExperienceDraftInputSchema.parse({
  bindings: fashionFixture.bindings,
  experienceId: "experience-api-fixture",
  overrides: [],
  presetId: "editorial",
  themeId: "fashion",
  themeVersion: "1.0.0",
});

async function createDraft(
  app: ReturnType<typeof appFor>,
  idempotencyKey: string,
  input: typeof draftInput = draftInput,
) {
  const response = await app.fetch(
    writeRequest(
      "/admin/storefront-experiences/drafts",
      { draft: input, reason: "Create a fixture-backed theme draft" },
      idempotencyKey,
    ),
    env,
  );
  const body = await response.json<{
    data: { id: string; validation: unknown; version: number };
  }>();
  return { body, response };
}

async function validateDraft(
  app: ReturnType<typeof appFor>,
  draftId: string,
  version: number,
  key: string,
) {
  return app.fetch(
    writeRequest(
      `/admin/storefront-experiences/drafts/${draftId}/validate`,
      { expectedVersion: version, reason: "Validate the exact draft version" },
      key,
    ),
    env,
  );
}

describe("storefront experience API", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM storefront_preview_sessions"),
      env.DB.prepare("DELETE FROM storefront_preview_grants"),
      env.DB.prepare("DELETE FROM storefront_preview_builds"),
      env.DB.prepare("DELETE FROM idempotency_claims"),
      env.DB.prepare("DELETE FROM audit_events"),
    ]);
    await seedOperator();
  });

  test("lists the source-controlled theme catalog for authorized operators", async () => {
    const response = await appFor().fetch(request("/admin/storefront-experiences/themes"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [
        {
          fixtureBindings: expect.any(Array),
          id: "decor",
          presetDefinitions: expect.any(Array),
          themeVersion: "1.0.0",
        },
        {
          fixtureBindings: expect.any(Array),
          id: "fashion",
          presetDefinitions: expect.any(Array),
          themeVersion: "1.0.0",
        },
      ],
    });
  });

  test("creates, reads, updates, validates, and idempotently replays an optimistic draft", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-draft-create-0001");
    expect(created.response.status).toBe(201);
    expect(created.body.data).toMatchObject({ validation: null, version: 1 });

    const replay = await createDraft(app, "theme-draft-create-0001");
    expect(replay.response.status).toBe(201);
    expect(replay.body.data.id).toBe(created.body.data.id);

    const draftId = created.body.data.id;
    expect(
      await (await app.fetch(request("/admin/storefront-experiences/drafts"), env)).json(),
    ).toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: draftId })]),
    });
    const override = {
      operations: [
        { instanceId: "home-story", kind: "set-visibility", visible: false },
        {
          instanceId: "home-hero",
          kind: "set-setting",
          settingId: "heading",
          value: "A deliberate fixture edit.",
        },
        { instanceId: "home-hero", kind: "reset-setting", settingId: "heading" },
      ],
      presetId: "editorial",
      schemaVersion: 1,
      templateId: "fashion-home",
    };
    const updateBody = {
      bindings: fashionFixture.bindings,
      expectedVersion: 1,
      overrides: [override],
      reason: "Hide one optional section and retain preset reset intent",
    };
    const updated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        updateBody,
        "theme-draft-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      data: { id: draftId, overrides: [override], version: 2 },
    });
    const updateReplay = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        updateBody,
        "theme-draft-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updateReplay.status).toBe(200);
    expect(await updateReplay.json()).toMatchObject({ data: { version: 2 } });

    const stale = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        { ...updateBody, reason: "Attempt a stale conflicting update" },
        "theme-draft-update-stale-0001",
        "PUT",
      ),
      env,
    );
    expect(stale.status).toBe(409);

    const validation = await validateDraft(app, draftId, 2, "theme-draft-validate-0001");
    expect(validation.status).toBe(200);
    expect(await validation.json()).toMatchObject({
      data: { draftVersion: 2, issues: [], status: "valid" },
    });
    const read = await app.fetch(request(`/admin/storefront-experiences/drafts/${draftId}`), env);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      data: { id: draftId, validation: { draftVersion: 2, status: "valid" }, version: 2 },
    });
  });

  test("rejects unauthorized access, unavailable packages, unsafe settings, and missing capabilities", async () => {
    await seedOperator("support", "theme-support");
    expect(
      (await appFor("theme-support").fetch(request("/admin/storefront-experiences/themes"), env))
        .status,
    ).toBe(403);
    expect(
      (
        await appFor("theme-support").fetch(
          writeRequest(
            "/admin/storefront-experiences/drafts",
            {
              draft: draftInput,
              reason: "Attempt an unauthorized draft write",
            },
            "theme-unauthorized-write-0001",
          ),
          env,
        )
      ).status,
    ).toBe(403);

    const app = appFor();
    const unavailable = await app.fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: { ...draftInput, themeVersion: "9.0.0" },
          reason: "Attempt an unavailable theme package",
        },
        "theme-invalid-package-0001",
      ),
      env,
    );
    expect(unavailable.status).toBe(422);

    const unsafe = await app.fetch(
      writeRequest(
        "/admin/storefront-experiences/drafts",
        {
          draft: {
            ...draftInput,
            overrides: [
              {
                operations: [
                  {
                    instanceId: "home-hero",
                    kind: "set-setting",
                    settingId: "heading",
                    value: "<script>alert(1)</script>",
                  },
                ],
                presetId: "editorial",
                schemaVersion: 1,
                templateId: "fashion-home",
              },
            ],
          },
          reason: "Attempt unsafe arbitrary markup",
        },
        "theme-unsafe-schema-0001",
      ),
      env,
    );
    expect(unsafe.status).toBe(422);

    const wrongSettingType = await createDraft(app, "theme-setting-type-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [
            {
              instanceId: "home-hero",
              kind: "set-setting",
              settingId: "heading",
              value: 42,
            },
          ],
          presetId: "editorial",
          schemaVersion: 1,
          templateId: "fashion-home",
        },
      ],
    });
    expect(wrongSettingType.response.status).toBe(201);
    const wrongSettingValidation = await validateDraft(
      app,
      wrongSettingType.body.data.id,
      1,
      "theme-setting-type-validate-0001",
    );
    expect(await wrongSettingValidation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "resolved_template_invalid" }),
        ]),
        status: "invalid",
      },
    });

    const invalid = await createDraft(app, "theme-required-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [{ instanceId: "product-main", kind: "set-visibility", visible: false }],
          presetId: "editorial",
          schemaVersion: 1,
          templateId: "fashion-product",
        },
      ],
    });
    expect(invalid.response.status).toBe(201);
    const validation = await validateDraft(
      app,
      invalid.body.data.id,
      1,
      "theme-required-validate-0001",
    );
    expect(await validation.json()).toMatchObject({
      data: {
        issues: expect.arrayContaining([expect.objectContaining({ code: "override_invalid" })]),
        status: "invalid",
      },
    });
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${invalid.body.data.id}/preview`,
        { expectedVersion: 1, reason: "Attempt to preview an invalid draft" },
        "theme-required-preview-0001",
      ),
      env,
    );
    expect(preview.status).toBe(409);
    expect(
      (
        await appFor("theme-support").fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${invalid.body.data.id}/approve`,
            {
              confirm: true,
              expectedVersion: 1,
              reason: "Attempt an unauthorized approval",
            },
            "theme-unauthorized-approval-0001",
          ),
          env,
        )
      ).status,
    ).toBe(403);
  });

  test("binds validation to one version and resolves preview without approving production", async () => {
    const triggerCalls: unknown[] = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push(input);
        return { correlationId: "preview-build-correlation-1" };
      },
    });
    const created = await createDraft(app, "theme-preview-create-0001");
    const draftId = created.body.data.id;
    expect((await validateDraft(app, draftId, 1, "theme-preview-validate-0001")).status).toBe(200);
    const updated = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}`,
        {
          bindings: fashionFixture.bindings,
          expectedVersion: 1,
          overrides: [],
          reason: "Advance the draft after its first validation",
        },
        "theme-preview-update-0001",
        "PUT",
      ),
      env,
    );
    expect(updated.status).toBe(200);
    expect(
      (
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/preview`,
            { expectedVersion: 2, reason: "Reject stale validation" },
            "theme-preview-stale-0001",
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await app.fetch(
          writeRequest(
            `/admin/storefront-experiences/drafts/${draftId}/approve`,
            {
              confirm: true,
              expectedVersion: 2,
              reason: "Reject approval against stale validation",
            },
            "theme-approval-stale-0001",
          ),
          env,
        )
      ).status,
    ).toBe(409);
    await validateDraft(app, draftId, 2, "theme-preview-validate-0002");
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        { expectedVersion: 2, reason: "Resolve an isolated fixture preview" },
        "theme-preview-resolve-0001",
      ),
      env,
    );
    expect(preview.status).toBe(202);
    const value = await preview.json<{
      data: {
        build: { status: string };
        snapshot: { approvedAt: string | null; id: string; kind: string };
      };
    }>();
    expect(value.data).toMatchObject({
      build: { status: "building" },
      snapshot: { approvedAt: null, kind: "preview" },
    });
    expect(triggerCalls).toHaveLength(1);
    expect(
      await env.DB.prepare(
        "SELECT approved_at, kind FROM storefront_experience_snapshots WHERE id = ?",
      )
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ approved_at: null, kind: "preview" });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM catalog_releases WHERE id = ?")
        .bind(value.data.snapshot.id)
        .first(),
    ).toEqual({ count: 0 });
  });

  test("reconciles concurrent identical approvals into one immutable snapshot and audit", async () => {
    const app = appFor();
    const created = await createDraft(app, "theme-approval-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-approval-validate-0001");
    const approve = (key: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/approve`,
          { confirm: true, expectedVersion: 1, reason: "Approve a reproducible experience" },
          key,
        ),
        env,
      );
    const responses = await Promise.all([
      approve("theme-approval-concurrent-0001"),
      approve("theme-approval-concurrent-0002"),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    const snapshots = await Promise.all(
      responses.map((response) => response.json<{ data: { id: string; kind: string } }>()),
    );
    expect(new Set(snapshots.map(({ data }) => data.id)).size).toBe(1);
    const snapshotId = snapshots[0]!.data.id;
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE source_draft_id = ? AND kind = 'approved'",
        )
          .bind(draftId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'themes.experience.approve' AND target_id = ?",
        )
          .bind(snapshotId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    await expect(
      env.DB.prepare("UPDATE storefront_experience_snapshots SET snapshot_json = '{}' WHERE id = ?")
        .bind(snapshotId)
        .run(),
    ).rejects.toThrow("immutable_storefront_experience_snapshot");
  });

  test("dry-runs an explicit schema migration, reports stable-ID conflicts, and preserves older snapshots", async () => {
    const sourcePackage = themePackageSchema.parse({
      manifest: fashionManifest,
      presets: [fashionPreset],
    });
    const targetPackage = themePackageSchema.parse({
      manifest: {
        ...fashionManifest,
        configurationSchemaVersion: 2,
        themeVersion: "1.1.0",
      },
      presets: [fashionPreset],
    });
    const conflictingPackage = themePackageSchema.parse({
      manifest: {
        ...fashionManifest,
        configurationSchemaVersion: 2,
        themeVersion: "1.2.0",
      },
      presets: [
        {
          ...fashionPreset,
          templates: fashionPreset.templates.map((template) =>
            template.id === "fashion-home"
              ? {
                  ...template,
                  sections: template.sections.filter(({ id }) => id !== "home-story"),
                }
              : template,
          ),
        },
      ],
    });
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      storefrontExperienceServiceOptions: {
        migrations: [
          {
            fromConfigurationSchemaVersion: 1,
            migrate: (overrides) =>
              overrides.map((override) => ({ ...override, schemaVersion: 2 })),
            themeId: "fashion",
            toConfigurationSchemaVersion: 2,
          },
        ],
        packages: [sourcePackage, targetPackage, conflictingPackage],
      },
    });
    const created = await createDraft(app, "theme-migration-create-0001", {
      ...draftInput,
      overrides: [
        {
          operations: [
            {
              instanceId: "home-story",
              kind: "set-setting",
              settingId: "heading",
              value: "Merchant-authored story heading",
            },
          ],
          presetId: "editorial",
          schemaVersion: 1,
          templateId: "fashion-home",
        },
      ],
    });
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-migration-validate-0001");
    const originalApproval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Preserve the original version" },
        "theme-migration-original-approval-0001",
      ),
      env,
    );
    const original = await originalApproval.json<{ data: { id: string } }>();

    const dryRun = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Dry-run the compatible configuration migration",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.1.0",
        },
        "theme-migration-dry-run-0001",
      ),
      env,
    );
    expect(dryRun.status).toBe(200);
    const migration = await dryRun.json<{
      data: { conflicts: unknown[]; id: string; status: string };
    }>();
    expect(migration.data).toMatchObject({ conflicts: [], status: "dry_run" });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM storefront_experience_snapshots WHERE migration_id = ?",
        )
          .bind(migration.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);

    const migratedApproval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          migrationId: migration.data.id,
          reason: "Explicitly approve the compatible migration",
        },
        "theme-migration-approve-0001",
      ),
      env,
    );
    expect(migratedApproval.status).toBe(200);
    expect(await migratedApproval.json()).toMatchObject({
      data: {
        configurationSchemaVersion: 2,
        snapshot: {
          configurationSchemaVersion: 2,
          themeVersion: "1.1.0",
        },
        themeVersion: "1.1.0",
      },
    });
    expect(
      await env.DB.prepare(
        "SELECT id, theme_version FROM storefront_experience_snapshots WHERE id = ?",
      )
        .bind(original.data.id)
        .first(),
    ).toEqual({ id: original.data.id, theme_version: "1.0.0" });

    const conflict = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/migrations/dry-run`,
        {
          expectedVersion: 1,
          reason: "Detect a removed stable instance",
          targetConfigurationSchemaVersion: 2,
          targetThemeVersion: "1.2.0",
        },
        "theme-migration-conflict-0001",
      ),
      env,
    );
    expect(await conflict.json()).toMatchObject({
      data: {
        conflicts: expect.arrayContaining([
          expect.objectContaining({ code: "instance-removed", instanceId: "home-story" }),
        ]),
      },
    });
  });

  test("authenticates idempotent build callbacks, exposes retries, and retains the first valid artifact", async () => {
    const triggerCalls: Array<{ buildId: string; snapshotId: string }> = [];
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async (input) => {
        triggerCalls.push({ buildId: input.buildId, snapshotId: input.snapshotId });
        return { correlationId: `correlation-${triggerCalls.length}` };
      },
    });
    const created = await createDraft(app, "theme-build-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-build-validate-0001");
    const previewRequest = (key: string) =>
      app.fetch(
        writeRequest(
          `/admin/storefront-experiences/drafts/${draftId}/preview`,
          { expectedVersion: 1, reason: "Build the immutable fixture preview" },
          key,
        ),
        env,
      );
    const firstPreview = await previewRequest("theme-build-preview-0001");
    const first = await firstPreview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    expect(triggerCalls).toHaveLength(1);

    expect(
      (
        await app.fetch(
          request(`/build/storefront-experiences/snapshots/${first.data.snapshot.id}`),
          env,
        )
      ).status,
    ).toBe(401);
    const manifest = await app.fetch(
      request(`/build/storefront-experiences/snapshots/${first.data.snapshot.id}`, {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
        },
      }),
      env,
    );
    expect(manifest.status).toBe(200);
    expect(await manifest.json()).toMatchObject({
      environment: "preview",
      snapshot: {
        approvedAt: null,
        approvedBy: null,
        id: first.data.snapshot.id,
        kind: "preview",
      },
      themeId: "fashion",
    });

    const failed = await app.fetch(
      request(`/build/storefront-experiences/builds/${first.data.build.id}/status`, {
        body: JSON.stringify({ failureCode: "preview.build-failed", status: "failed" }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-build-result-failed-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({ data: { status: "failed" } });
    expect(
      await (
        await app.fetch(request(`/admin/storefront-experiences/builds/${first.data.build.id}`), env)
      ).json(),
    ).toMatchObject({
      data: {
        failureCode: "preview.build-failed",
        status: "failed",
      },
    });

    const retryPreview = await previewRequest("theme-build-preview-0002");
    const retry = await retryPreview.json<{
      data: { build: { attempt: number; id: string }; snapshot: { id: string } };
    }>();
    expect(retry.data.snapshot.id).toBe(first.data.snapshot.id);
    expect(retry.data.build.attempt).toBe(2);
    expect(triggerCalls).toHaveLength(2);

    const digest = "a".repeat(64);
    const deployedPayload = {
      artifactDigest: digest,
      artifactPrefix: `snapshots/${retry.data.snapshot.id}/${digest}`,
      expiresAt: "2099-07-30T00:00:00.000Z",
      status: "deployed",
    };
    const deployedRequest = () =>
      app.fetch(
        request(`/build/storefront-experiences/builds/${retry.data.build.id}/status`, {
          body: JSON.stringify(deployedPayload),
          headers: {
            Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
            "Content-Type": "application/json",
            "Idempotency-Key": "theme-build-result-deployed-0001",
          },
          method: "POST",
        }),
        env,
      );
    expect((await deployedRequest()).status).toBe(200);
    expect((await deployedRequest()).status).toBe(200);
    const conflictingResult = await app.fetch(
      request(`/build/storefront-experiences/builds/${retry.data.build.id}/status`, {
        body: JSON.stringify({
          ...deployedPayload,
          artifactDigest: "c".repeat(64),
          artifactPrefix: `snapshots/${retry.data.snapshot.id}/${"c".repeat(64)}`,
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-build-result-conflict-0001",
        },
        method: "POST",
      }),
      env,
    );
    expect(conflictingResult.status).toBe(409);
    expect(await conflictingResult.json()).toMatchObject({
      error: { code: "storefront_preview_build_result_conflict" },
    });
    const stable = await previewRequest("theme-build-preview-0003");
    expect(await stable.json()).toMatchObject({
      data: {
        build: {
          artifactDigest: digest,
          artifactPrefix: deployedPayload.artifactPrefix,
          status: "deployed",
        },
      },
    });
    expect(triggerCalls).toHaveLength(2);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
           FROM audit_events
          WHERE action = 'themes.preview.build.start' AND result = 'succeeded'`,
      ).first(),
    ).toEqual({ count: 2 });
  });

  test("stores only grant and session digests, rejects replay and wrong origin, and cleans expired artifacts", async () => {
    const app = createApp({
      testIdentityVerifier: async () => ({
        email: "theme-admin@example.test",
        principalKind: "human",
        subject: "theme-admin",
      }),
      experienceBuildTrigger: async () => ({ correlationId: "grant-build-correlation" }),
    });
    const created = await createDraft(app, "theme-grant-create-0001");
    const draftId = created.body.data.id;
    await validateDraft(app, draftId, 1, "theme-grant-validate-0001");
    const approval = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/approve`,
        {
          confirm: true,
          expectedVersion: 1,
          reason: "Retain approval while preview artifacts expire",
        },
        "theme-grant-approval-0001",
      ),
      env,
    );
    const approved = await approval.json<{ data: { id: string } }>();
    const preview = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${draftId}/preview`,
        { expectedVersion: 1, reason: "Prepare private grant fixture" },
        "theme-grant-preview-0001",
      ),
      env,
    );
    const previewValue = await preview.json<{
      data: { build: { id: string }; snapshot: { id: string } };
    }>();
    const digest = "b".repeat(64);
    const prefix = `snapshots/${previewValue.data.snapshot.id}/${digest}`;
    await app.fetch(
      request(`/build/storefront-experiences/builds/${previewValue.data.build.id}/status`, {
        body: JSON.stringify({
          artifactDigest: digest,
          artifactPrefix: prefix,
          expiresAt: "2099-07-30T00:00:00.000Z",
          status: "deployed",
        }),
        headers: {
          Authorization: `Bearer ${env.PREVIEW_BUILD_CALLBACK_TOKEN}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "theme-grant-build-result-0001",
        },
        method: "POST",
      }),
      env,
    );
    const grantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        {
          origin: env.PREVIEW_ORIGIN,
          reason: "Open one private operator preview",
        },
        "theme-preview-grant-create-0001",
      ),
      env,
    );
    expect(grantResponse.status).toBe(201);
    const grantValue = await grantResponse.json<{
      data: { grant: string; redeemUrl: string };
    }>();
    expect(grantValue.data.redeemUrl).toBe(`${env.PREVIEW_ORIGIN}/__preview/session`);
    const persistedGrant = await env.DB.prepare(
      "SELECT grant_digest FROM storefront_preview_grants WHERE snapshot_id = ?",
    )
      .bind(previewValue.data.snapshot.id)
      .first<{ grant_digest: string }>();
    expect(persistedGrant?.grant_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedGrant?.grant_digest).not.toContain(grantValue.data.grant);
    expect(
      (
        await env.DB.prepare(
          `SELECT
             (SELECT COUNT(*) FROM idempotency_claims WHERE response_body_json LIKE ?) +
             (SELECT COUNT(*) FROM audit_events WHERE metadata_json LIKE ? OR reason LIKE ?)
             AS count`,
        )
          .bind(
            `%${grantValue.data.grant}%`,
            `%${grantValue.data.grant}%`,
            `%${grantValue.data.grant}%`,
          )
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);

    const redeem = (grant: string, origin: string) =>
      app.fetch(
        request("/internal/preview/redeem", {
          body: JSON.stringify({ grant, origin }),
          headers: {
            Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
        env,
      );
    expect((await redeem(grantValue.data.grant, "https://wrong-preview.example.test")).status).toBe(
      403,
    );
    const redeemed = await redeem(grantValue.data.grant, env.PREVIEW_ORIGIN);
    expect(redeemed.status).toBe(200);
    const sessionValue = await redeemed.json<{
      data: { expiresAt: string; session: string };
    }>();
    expect((await redeem(grantValue.data.grant, env.PREVIEW_ORIGIN)).status).toBe(403);
    const expiringGrantResponse = await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/snapshots/${previewValue.data.snapshot.id}/grants`,
        {
          origin: env.PREVIEW_ORIGIN,
          reason: "Prove expired grant rejection",
        },
        "theme-preview-grant-expiry-0001",
      ),
      env,
    );
    const expiringGrant = await expiringGrantResponse.json<{
      data: { grant: string };
    }>();
    await env.DB.prepare(
      "UPDATE storefront_preview_grants SET expires_at = ? WHERE redeemed_at IS NULL",
    )
      .bind("2026-07-29T00:00:00.000Z")
      .run();
    expect((await redeem(expiringGrant.data.grant, env.PREVIEW_ORIGIN)).status).toBe(403);
    const persistedSession = await env.DB.prepare(
      "SELECT session_digest FROM storefront_preview_sessions WHERE snapshot_id = ?",
    )
      .bind(previewValue.data.snapshot.id)
      .first<{ session_digest: string }>();
    expect(persistedSession?.session_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedSession?.session_digest).not.toContain(sessionValue.data.session);

    const authorized = await app.fetch(
      request("/internal/preview/authorize", {
        headers: {
          Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
          Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
          "X-Preview-Origin": env.PREVIEW_ORIGIN,
        },
        method: "POST",
      }),
      env,
    );
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({
      artifactPrefix: prefix,
      authorized: true,
      origin: env.PREVIEW_ORIGIN,
    });
    expect(
      (
        await app.fetch(
          request("/internal/preview/authorize", {
            headers: {
              Authorization: `Bearer ${env.PREVIEW_SERVICE_TOKEN}`,
              Cookie: `__Host-shoppp-preview=${sessionValue.data.session}`,
              "X-Preview-Origin": "https://wrong-preview.example.test",
            },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect((await app.fetch(request("/preview/grants"), env)).status).toBe(404);

    await env.PREVIEW_ARTIFACTS.put(`${prefix}/index.html`, "fixture preview");
    await env.DB.prepare("UPDATE storefront_preview_builds SET expires_at = ? WHERE id = ?")
      .bind("2026-07-29T00:00:00.000Z", previewValue.data.build.id)
      .run();
    const cleanup = await cleanupExpiredStorefrontPreviews(
      env,
      new Date("2026-07-30T00:00:00.000Z"),
    );
    expect(cleanup).toMatchObject({ artifacts: 1, grants: 2, objects: 1, sessions: 1 });
    expect(await env.PREVIEW_ARTIFACTS.get(`${prefix}/index.html`)).toBeNull();
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_snapshots WHERE id = ?")
        .bind(previewValue.data.snapshot.id)
        .first(),
    ).toEqual({ id: previewValue.data.snapshot.id });
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_snapshots WHERE id = ?")
        .bind(approved.data.id)
        .first(),
    ).toEqual({ id: approved.data.id });
    expect(
      await env.DB.prepare("SELECT id FROM storefront_experience_drafts WHERE id = ?")
        .bind(draftId)
        .first(),
    ).toEqual({ id: draftId });
    expect(
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'themes.experience.approve' AND target_id = ?",
        )
          .bind(approved.data.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });

  test("keeps catalog releases and commerce records untouched", async () => {
    const before = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM catalog_releases) AS catalog_releases,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM carts) AS carts,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM payment_events) AS payment_events`,
    ).first();
    const app = appFor();
    const created = await createDraft(app, "theme-boundary-create-0001");
    await validateDraft(app, created.body.data.id, 1, "theme-boundary-validate-0001");
    await app.fetch(
      writeRequest(
        `/admin/storefront-experiences/drafts/${created.body.data.id}/approve`,
        { confirm: true, expectedVersion: 1, reason: "Approve presentation only" },
        "theme-boundary-approve-0001",
      ),
      env,
    );
    const after = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM catalog_releases) AS catalog_releases,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM carts) AS carts,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM payment_events) AS payment_events`,
    ).first();
    expect(after).toEqual(before);
  });
});
