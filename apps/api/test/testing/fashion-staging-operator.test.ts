import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { createApp } from "../../src/http/app";
import {
  approveFashionStagingOperatorRun,
  consumeFashionStagingOperatorRun,
  createFashionStagingOperatorRun,
  getFashionStagingOperatorRun,
  moveFashionStagingOperatorRunToSuccessor,
  rejectFashionStagingOperatorRun,
} from "../../src/testing/fashion-staging-operator";
import { ADMIN_ROLE_IDS, seedHumanAdmin } from "../fixtures/admin-iam";

const now = new Date("2026-08-28T08:00:00.000Z");
const expiresAt = "2026-08-28T20:00:00.000Z";

async function seedDraft(id: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO storefront_experience_drafts
       (id, experience_id, theme_id, theme_version, configuration_schema_version,
        preset_id, bindings_json, overrides_json, version, created_by, updated_by,
        created_at, updated_at)
     VALUES (?, 'fashion-u8', 'fashion-store', '1.0.0', 1, 'source-parity', '[]', '[]',
             1, 'admin-fashion-u8-existing', 'admin-fashion-u8-existing', ?, ?)`,
  )
    .bind(id, now.toISOString(), now.toISOString())
    .run();
}

async function seedU12Lineage(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO storefront_experience_drafts
         (id, experience_id, theme_id, theme_version, configuration_schema_version,
          preset_id, bindings_json, overrides_json, version, created_by, updated_by,
          created_at, updated_at)
       VALUES ('draft-fashion-u12-lineage', 'fashion-u12', 'fashion-store', '1.0.0', 1,
               'source-parity', '[]', '[]', 1, 'admin-fashion-u8-existing',
               'admin-fashion-u8-existing', ?, ?)`,
    ).bind(now.toISOString(), now.toISOString()),
    env.DB.prepare(
      `INSERT OR IGNORE INTO storefront_experience_validations
         (id, draft_id, draft_version, catalog_release_id, status, issues_json,
          resolved_templates_json, validated_by, created_at)
       VALUES ('validation-fashion-u12-lineage', 'draft-fashion-u12-lineage', 1, NULL,
               'valid', '[]', '[]', 'admin-fashion-u8-existing', ?)`,
    ).bind(now.toISOString()),
    env.DB.prepare(
      `INSERT OR IGNORE INTO storefront_experience_snapshots
         (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
          source_validation_id, migration_id, kind, theme_id, theme_version,
          configuration_schema_version, snapshot_json, created_by, approved_by, approved_at,
          created_at, content_digest)
       VALUES ('snapshot-approved-u12', 'fashion-u12-lineage-approved', 'fashion-u12',
               'draft-fashion-u12-lineage', 1, 'validation-fashion-u12-lineage', NULL,
               'approved', 'fashion-store', '1.0.0', 1, '{}',
               'admin-fashion-u8-existing', 'admin-fashion-u8-existing', ?, ?, ?)`,
    ).bind(now.toISOString(), now.toISOString(), "0".repeat(64)),
    env.DB.prepare(
      `INSERT OR IGNORE INTO catalog_releases
         (id, status, manifest_json, approved_at, deployed_at, created_at, updated_at)
       VALUES ('fashion-staging-u12-release', 'deployed', '{}', ?, ?, ?, ?)`,
    ).bind(now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString()),
  ]);
  await env.DB.prepare(
    "UPDATE catalog_releases SET status = 'deployed', deployed_at = ? WHERE id = ?",
  )
    .bind(now.toISOString(), "fashion-staging-u12-release")
    .run();
}

async function seedApprovalEvidence(
  draftId: string,
  snapshotId = "snapshot-approved-u8",
  auditId = "audit-snapshot-approved-u8",
  suffix = "2",
): Promise<void> {
  const validationId = `validation-fashion-u8-successor-${suffix}`;
  await env.DB.prepare(
    `INSERT INTO storefront_experience_validations
       (id, draft_id, draft_version, catalog_release_id, status, issues_json,
        resolved_templates_json, validated_by, created_at)
     VALUES (?, ?, 1, NULL, 'valid', '[]', '[]',
             'admin-fashion-u8-existing', ?)`,
  )
    .bind(validationId, draftId, now.toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO storefront_experience_snapshots
       (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
        source_validation_id, migration_id, kind, theme_id, theme_version,
        configuration_schema_version, snapshot_json, created_by, approved_by, approved_at,
        created_at, content_digest)
     VALUES (?, ?, 'fashion-u8', ?, 1,
             ?, NULL, 'approved', 'fashion-store', '1.0.0',
             1, '{}', 'admin-fashion-u8-existing', 'admin-fashion-u8-existing', ?, ?, ?)`,
  )
    .bind(
      snapshotId,
      `fashion-u8-successor-${suffix}-approved`,
      draftId,
      validationId,
      now.toISOString(),
      now.toISOString(),
      "7".repeat(64),
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO audit_events
       (id, actor_type, actor_id, action, target_type, target_id, result, metadata_json, created_at)
     VALUES (?, 'admin', 'admin-fashion-u8-existing',
             'storefront_experience.approve', 'storefront_experience_snapshot',
             ?, 'succeeded', '{}', ?)`,
  )
    .bind(auditId, snapshotId, now.toISOString())
    .run();
}

describe.sequential("Fashion U8 named-operator run authority", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM fashion_staging_operator_runs").run();
    await seedHumanAdmin(env.DB, {
      displayName: "Existing Fashion staging operator",
      email: "existing-fashion-operator@example.test",
      id: "admin-fashion-u8-existing",
      roleId: ADMIN_ROLE_IDS.admin,
      subject: "existing-fashion-operator",
    });
    await seedU12Lineage();
  });

  test("creates an awaiting_operator record without provisioning an identity or session", async () => {
    await seedDraft("draft-fashion-u8-source");
    const beforeIdentities = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_identities",
    ).first<{ count: number }>();

    const registration = {
      candidateSha: "a".repeat(40),
      catalogReleaseId: "fashion-staging-u12-release",
      contractTestDigest: "b".repeat(64),
      environment: "fashion-staging",
      expiresAt,
      harnessManifestDigest: "c".repeat(64),
      harnessSha: "d".repeat(40),
      repository: "hashencode/shoppp",
      runId: "fashion-u8-cloud-1",
      runManifestDigest: "e".repeat(64),
      sourceDraftId: "draft-fashion-u8-source",
      u12ReadinessDigest: "f".repeat(64),
      u12SnapshotId: "snapshot-approved-u12",
      workflowRunAttempt: 1,
      workflowRunId: "40000000001",
    } as const;
    const created = await createFashionStagingOperatorRun(env.DB, registration, now);

    expect(created).toMatchObject({
      allowedAction: "complete_run_bound_editor_path",
      runId: "fashion-u8-cloud-1",
      status: "awaiting_operator",
      workingDraftId: "draft-fashion-u8-source",
    });
    await expect(
      createFashionStagingOperatorRun(env.DB, { ...registration, workflowRunAttempt: 2 }, now),
    ).resolves.toMatchObject({ runId: "fashion-u8-cloud-1", workflowRunAttempt: 1 });
    await expect(
      createFashionStagingOperatorRun(
        env.DB,
        { ...registration, candidateSha: "9".repeat(40), workflowRunAttempt: 2 },
        now,
      ),
    ).rejects.toThrow(/different evidence/);
    const afterIdentities = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_identities",
    ).first<{ count: number }>();
    expect(afterIdentities).toEqual(beforeIdentities);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_sessions").first()).toEqual({
      count: 0,
    });
  });

  test("rejects missing U12 Snapshot and non-deployed Catalog lineage", async () => {
    await seedDraft("draft-fashion-u8-invalid-lineage");
    const registration = {
      candidateSha: "a".repeat(40),
      catalogReleaseId: "fashion-staging-u12-release",
      contractTestDigest: "b".repeat(64),
      environment: "fashion-staging" as const,
      expiresAt,
      harnessManifestDigest: "c".repeat(64),
      harnessSha: "d".repeat(40),
      repository: "hashencode/shoppp",
      runId: "fashion-u8-invalid-lineage",
      runManifestDigest: "e".repeat(64),
      sourceDraftId: "draft-fashion-u8-invalid-lineage",
      u12ReadinessDigest: "f".repeat(64),
      u12SnapshotId: "snapshot-missing-u12",
      workflowRunAttempt: 1,
      workflowRunId: "40000000009",
    } as const;
    await expect(createFashionStagingOperatorRun(env.DB, registration, now)).rejects.toThrow(
      /existing approved Snapshot/,
    );
    await env.DB.prepare(
      "UPDATE catalog_releases SET status = 'approved', deployed_at = NULL WHERE id = ?",
    )
      .bind("fashion-staging-u12-release")
      .run();
    await expect(
      createFashionStagingOperatorRun(
        env.DB,
        { ...registration, u12SnapshotId: "snapshot-approved-u12" },
        now,
      ),
    ).rejects.toThrow(/already be deployed/);
  });

  test("rejects a failed awaiting-operator run idempotently so a fresh harness can register", async () => {
    await seedDraft("draft-fashion-u8-rejected-preview");
    await createFashionStagingOperatorRun(
      env.DB,
      {
        candidateSha: "a".repeat(40),
        catalogReleaseId: "fashion-staging-u12-release",
        contractTestDigest: "b".repeat(64),
        environment: "fashion-staging",
        expiresAt,
        harnessManifestDigest: "c".repeat(64),
        harnessSha: "d".repeat(40),
        repository: "hashencode/shoppp",
        runId: "fashion-u8-rejected-preview",
        runManifestDigest: "e".repeat(64),
        sourceDraftId: "draft-fashion-u8-rejected-preview",
        u12ReadinessDigest: "f".repeat(64),
        u12SnapshotId: "snapshot-approved-u12",
        workflowRunAttempt: 1,
        workflowRunId: "40000000019",
      },
      now,
    );

    await expect(
      rejectFashionStagingOperatorRun(
        env.DB,
        "fashion-u8-rejected-preview",
        "Replace a failed preview hook boundary with the hosted successor",
        now,
      ),
    ).resolves.toMatchObject({ status: "rejected" });
    await expect(
      rejectFashionStagingOperatorRun(
        env.DB,
        "fashion-u8-rejected-preview",
        "Replace a failed preview hook boundary with the hosted successor",
        now,
      ),
    ).resolves.toMatchObject({ status: "rejected" });
  });

  test("enforces credentials and envelopes across the operator HTTP lifecycle", async () => {
    await seedDraft("draft-fashion-u8-http");
    const app = createApp();
    const token = "t".repeat(40);
    const apiEnv = {
      ...env,
      FASHION_ACCEPTANCE_TOKEN: token,
      RESOURCE_NAMESPACE: "shoppp-fashion-staging",
    };
    const url = "https://api.example.test/internal/testing/fashion-staging/operator-runs";
    const body = {
      candidateSha: "a".repeat(40),
      catalogReleaseId: "fashion-staging-u12-release",
      contractTestDigest: "b".repeat(64),
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      harnessManifestDigest: "c".repeat(64),
      harnessSha: "d".repeat(40),
      repository: "hashencode/shoppp",
      runId: "fashion-u8-http",
      runManifestDigest: "e".repeat(64),
      sourceDraftId: "draft-fashion-u8-http",
      u12ReadinessDigest: "f".repeat(64),
      u12SnapshotId: "snapshot-approved-u12",
      workflowRunAttempt: 1,
      workflowRunId: "40000000017",
    };
    const unauthorized = await app.fetch(
      new Request(url, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      apiEnv,
    );
    expect(unauthorized.status).toBe(401);
    const malformed = await app.fetch(
      new Request(url, {
        body: "{}",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      }),
      apiEnv,
    );
    expect(malformed.status).toBe(422);
    const created = await app.fetch(
      new Request(url, {
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      }),
      apiEnv,
    );
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    expect(await created.json()).toMatchObject({
      data: { runId: "fashion-u8-http", status: "awaiting_operator" },
      meta: { requestId: expect.any(String) },
    });
    const read = await app.fetch(
      new Request(`${url}/fashion-u8-http`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      apiEnv,
    );
    expect(read.status).toBe(200);
    expect(read.headers.get("cache-control")).toBe("private, no-store");

    await seedApprovalEvidence(
      "draft-fashion-u8-http",
      "snapshot-approved-u8-http",
      "audit-snapshot-approved-u8-http",
      "http",
    );
    await approveFashionStagingOperatorRun(env.DB, {
      approvalAuditId: "audit-snapshot-approved-u8-http",
      operatorIdentityId: "admin-fashion-u8-existing",
      snapshotContentDigest: "7".repeat(64),
      snapshotId: "snapshot-approved-u8-http",
      workingDraftId: "draft-fashion-u8-http",
    });
    const consumeRequest = () =>
      new Request(`${url}/fashion-u8-http/consume`, {
        body: JSON.stringify({
          approvalAuditId: "audit-snapshot-approved-u8-http",
          successorSnapshotId: "snapshot-approved-u8-http",
        }),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        method: "POST",
      });
    const consumed = await app.fetch(consumeRequest(), apiEnv);
    const retried = await app.fetch(consumeRequest(), apiEnv);
    expect([consumed.status, retried.status]).toEqual([200, 200]);
    expect(consumed.headers.get("cache-control")).toBe("private, no-store");
  });

  test("follows one conflict successor and records immutable approval evidence", async () => {
    await seedDraft("draft-fashion-u8-source-2");
    await seedDraft("draft-fashion-u8-successor-2");
    await createFashionStagingOperatorRun(
      env.DB,
      {
        candidateSha: "1".repeat(40),
        catalogReleaseId: "fashion-staging-u12-release",
        contractTestDigest: "2".repeat(64),
        environment: "fashion-staging",
        expiresAt,
        harnessManifestDigest: "3".repeat(64),
        harnessSha: "4".repeat(40),
        repository: "hashencode/shoppp",
        runId: "fashion-u8-cloud-2",
        runManifestDigest: "5".repeat(64),
        sourceDraftId: "draft-fashion-u8-source-2",
        u12ReadinessDigest: "6".repeat(64),
        u12SnapshotId: "snapshot-approved-u12",
        workflowRunAttempt: 1,
        workflowRunId: "40000000002",
      },
      now,
    );

    await moveFashionStagingOperatorRunToSuccessor(
      env.DB,
      "draft-fashion-u8-source-2",
      "draft-fashion-u8-successor-2",
      now,
    );
    await seedApprovalEvidence("draft-fashion-u8-successor-2");
    await approveFashionStagingOperatorRun(
      env.DB,
      {
        approvalAuditId: "audit-snapshot-approved-u8",
        operatorIdentityId: "admin-fashion-u8-existing",
        snapshotContentDigest: "7".repeat(64),
        snapshotId: "snapshot-approved-u8",
        workingDraftId: "draft-fashion-u8-successor-2",
      },
      now,
    );

    expect(await getFashionStagingOperatorRun(env.DB, "fashion-u8-cloud-2", now)).toMatchObject({
      approvalAuditId: "audit-snapshot-approved-u8",
      operatorIdentityId: "admin-fashion-u8-existing",
      status: "approved",
      successorSnapshotId: "snapshot-approved-u8",
      workingDraftId: "draft-fashion-u8-successor-2",
    });
    await expect(
      env.DB.prepare(
        "UPDATE fashion_staging_operator_runs SET status = 'rejected' WHERE run_id = ?",
      )
        .bind("fashion-u8-cloud-2")
        .run(),
    ).rejects.toThrow("immutable_fashion_staging_operator_approval");
    await expect(
      env.DB.prepare(
        "UPDATE fashion_staging_operator_runs SET status = 'consumed' WHERE run_id = ?",
      )
        .bind("fashion-u8-cloud-2")
        .run(),
    ).rejects.toThrow();
    const afterApprovalExpiry = new Date("2026-08-28T20:01:00.000Z");
    await expect(
      consumeFashionStagingOperatorRun(
        env.DB,
        "fashion-u8-cloud-2",
        "snapshot-approved-u8",
        "audit-snapshot-approved-u8",
        afterApprovalExpiry,
      ),
    ).rejects.toThrow(/missing, mismatched, or already consumed/);
    expect(
      await getFashionStagingOperatorRun(env.DB, "fashion-u8-cloud-2", afterApprovalExpiry),
    ).toMatchObject({ status: "expired" });
  });

  test("reconciles exact consumption retries and rejects another run's approval tuple", async () => {
    const createRun = async (suffix: string, draftId: string) => {
      await seedDraft(draftId);
      return createFashionStagingOperatorRun(
        env.DB,
        {
          candidateSha: suffix.repeat(40),
          catalogReleaseId: "fashion-staging-u12-release",
          contractTestDigest: "2".repeat(64),
          environment: "fashion-staging",
          expiresAt,
          harnessManifestDigest: "3".repeat(64),
          harnessSha: "4".repeat(40),
          repository: "hashencode/shoppp",
          runId: `fashion-u8-cross-run-${suffix}`,
          runManifestDigest: suffix.repeat(64),
          sourceDraftId: draftId,
          u12ReadinessDigest: "6".repeat(64),
          u12SnapshotId: "snapshot-approved-u12",
          workflowRunAttempt: 1,
          workflowRunId: suffix === "a" ? "40000000015" : "40000000016",
        },
        now,
      );
    };

    await createRun("a", "draft-fashion-u8-cross-run-a");
    await seedApprovalEvidence(
      "draft-fashion-u8-cross-run-a",
      "snapshot-approved-u8-a",
      "audit-snapshot-approved-u8-a",
      "a",
    );
    await approveFashionStagingOperatorRun(
      env.DB,
      {
        approvalAuditId: "audit-snapshot-approved-u8-a",
        operatorIdentityId: "admin-fashion-u8-existing",
        snapshotContentDigest: "7".repeat(64),
        snapshotId: "snapshot-approved-u8-a",
        workingDraftId: "draft-fashion-u8-cross-run-a",
      },
      now,
    );
    const firstConsumption = await consumeFashionStagingOperatorRun(
      env.DB,
      "fashion-u8-cross-run-a",
      "snapshot-approved-u8-a",
      "audit-snapshot-approved-u8-a",
      now,
    );
    const retriedConsumption = await consumeFashionStagingOperatorRun(
      env.DB,
      "fashion-u8-cross-run-a",
      "snapshot-approved-u8-a",
      "audit-snapshot-approved-u8-a",
      new Date(now.getTime() + 1_000),
    );
    expect(firstConsumption.status).toBe("consumed");
    expect(retriedConsumption).toEqual(firstConsumption);

    await createRun("b", "draft-fashion-u8-cross-run-b");
    await seedApprovalEvidence(
      "draft-fashion-u8-cross-run-b",
      "snapshot-approved-u8-b",
      "audit-snapshot-approved-u8-b",
      "b",
    );
    await approveFashionStagingOperatorRun(
      env.DB,
      {
        approvalAuditId: "audit-snapshot-approved-u8-b",
        operatorIdentityId: "admin-fashion-u8-existing",
        snapshotContentDigest: "7".repeat(64),
        snapshotId: "snapshot-approved-u8-b",
        workingDraftId: "draft-fashion-u8-cross-run-b",
      },
      now,
    );
    await expect(
      consumeFashionStagingOperatorRun(
        env.DB,
        "fashion-u8-cross-run-b",
        "snapshot-approved-u8-a",
        "audit-snapshot-approved-u8-a",
        now,
      ),
    ).rejects.toThrow(/missing, mismatched/);
    expect(await getFashionStagingOperatorRun(env.DB, "fashion-u8-cross-run-b", now)).toMatchObject(
      { status: "approved", successorSnapshotId: "snapshot-approved-u8-b" },
    );
  });

  test("fails closed after expiry and does not consume a cross-run approval", async () => {
    await seedDraft("draft-fashion-u8-expired");
    await createFashionStagingOperatorRun(
      env.DB,
      {
        candidateSha: "8".repeat(40),
        catalogReleaseId: "fashion-staging-u12-release",
        contractTestDigest: "9".repeat(64),
        environment: "fashion-staging",
        expiresAt: "2026-08-28T08:01:00.000Z",
        harnessManifestDigest: "a".repeat(64),
        harnessSha: "b".repeat(40),
        repository: "hashencode/shoppp",
        runId: "fashion-u8-cloud-expired",
        runManifestDigest: "c".repeat(64),
        sourceDraftId: "draft-fashion-u8-expired",
        u12ReadinessDigest: "d".repeat(64),
        u12SnapshotId: "snapshot-approved-u12",
        workflowRunAttempt: 1,
        workflowRunId: "40000000003",
      },
      now,
    );

    const afterExpiry = new Date("2026-08-28T08:02:00.000Z");
    await expect(
      approveFashionStagingOperatorRun(
        env.DB,
        {
          approvalAuditId: "audit-snapshot-wrong-run",
          operatorIdentityId: "admin-fashion-u8-existing",
          snapshotContentDigest: "e".repeat(64),
          snapshotId: "snapshot-wrong-run",
          workingDraftId: "draft-fashion-u8-expired",
        },
        afterExpiry,
      ),
    ).rejects.toThrow(/expired/);
    expect(
      await getFashionStagingOperatorRun(env.DB, "fashion-u8-cloud-expired", afterExpiry),
    ).toMatchObject({ status: "expired" });
  });
});
