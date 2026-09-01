import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import type { Principal } from "../../src/iam/permissions";
import {
  authorizeFashionU8OperatorMutation,
  bindFashionU8Successor,
  consumeFashionU8AcceptanceRun,
  getFashionU8AcceptanceRun,
  prepareFashionU8AcceptanceRun,
} from "../../src/storefront-experience/u8-acceptance";
import { seedHumanAdmin } from "../fixtures/admin-iam";

const principal = {
  displayName: "Fashion operator",
  email: "fashion-operator@example.test",
  id: "admin-fashion-operator",
  permissions: ["themes.write", "themes.preview", "themes.approve"],
  principalKind: "human",
  role: {
    enabled: true,
    id: "role_admin",
    key: "admin",
    name: "Admin",
    protected: true,
    system: true,
    version: 1,
  },
  subject: "fashion-operator",
} as const satisfies Principal;

describe("Fashion U8 acceptance authority", () => {
  test("binds one named operator and successor, expires pending runs, and consumes approval once", async () => {
    await seedHumanAdmin(env.DB, {
      email: principal.email,
      id: principal.id,
      subject: principal.subject,
    });
    const at = "2026-09-01T00:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO storefront_experience_drafts
           (id, experience_id, theme_id, theme_version, configuration_schema_version,
            preset_id, bindings_json, overrides_json, version, created_by, updated_by,
            created_at, updated_at)
           VALUES ('draft-u8-source', 'experience-u8', 'fashion-store', '1.0.0', 1,
             'source-parity', '[]', '[]', 1, ?, ?, ?, ?)`,
      ).bind(principal.id, principal.id, at, at),
      env.DB.prepare(
        `INSERT INTO catalog_releases
           (id, status, manifest_json, approved_by, approved_at, deployed_at, created_at, updated_at)
           VALUES ('release-u8', 'deployed', '{}', ?, ?, ?, ?, ?)`,
      ).bind(principal.id, at, at, at, at),
      env.DB.prepare(
        `INSERT INTO storefront_experience_validations
           (id, draft_id, draft_version, catalog_release_id, status, issues_json,
            resolved_templates_json, validated_by, created_at)
           VALUES ('validation-u8-baseline', 'draft-u8-source', 1, 'release-u8', 'valid', '[]', '[]', ?, ?)`,
      ).bind(principal.id, at),
      env.DB.prepare(
        `INSERT INTO storefront_experience_snapshots
           (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
            source_validation_id, migration_id, kind, theme_id, theme_version,
            configuration_schema_version, snapshot_json, content_digest, created_by,
            approved_by, approved_at, created_at)
           VALUES ('snapshot-u12-approved', 'u8-baseline', 'experience-u8', 'draft-u8-source', 1,
             'validation-u8-baseline', NULL, 'approved', 'fashion-store', '1.0.0', 1,
             '{}', ?, ?, ?, ?, ?)`,
      ).bind("a".repeat(64), principal.id, principal.id, at, at),
    ]);

    const manifestDigest = "b".repeat(64);
    await expect(
      prepareFashionU8AcceptanceRun(
        env.DB,
        {
          candidateSha: "c".repeat(40),
          catalogReleaseId: "release-other",
          environment: "fashion-staging",
          harnessSha: "d".repeat(40),
          manifestDigest: "9".repeat(64),
          repository: "shoppp/shoppp",
          runId: "u8-wrong-baseline-test",
          sourceDraftId: "draft-u8-source",
          u12SnapshotId: "snapshot-u12-approved",
          workflowRunId: "12344",
        },
        new Date(at),
      ),
    ).rejects.toMatchObject({ code: "fashion_u8_acceptance_identity_invalid" });
    const prepared = await prepareFashionU8AcceptanceRun(
      env.DB,
      {
        candidateSha: "c".repeat(40),
        catalogReleaseId: "release-u8",
        environment: "fashion-staging",
        harnessSha: "d".repeat(40),
        manifestDigest,
        repository: "shoppp/shoppp",
        runId: "u8-authority-test",
        sourceDraftId: "draft-u8-source",
        u12SnapshotId: "snapshot-u12-approved",
        workflowRunId: "12345",
      },
      new Date(at),
    );
    expect(prepared.status).toBe("awaiting_operator");
    const context = { manifestDigest, runId: prepared.runId };
    const reason = `Fashion U8 ${prepared.runId} ${manifestDigest}`;
    await expect(
      authorizeFashionU8OperatorMutation(
        env.DB,
        principal,
        prepared.sourceDraftId,
        "Forged operator reason",
        context,
        new Date("2026-09-01T00:29:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "fashion_u8_acceptance_invalid" });
    const active = await authorizeFashionU8OperatorMutation(
      env.DB,
      principal,
      prepared.sourceDraftId,
      reason,
      context,
      new Date("2026-09-01T00:30:00.000Z"),
    );
    expect(active).toMatchObject({ operatorId: principal.id, status: "active" });
    await expect(
      authorizeFashionU8OperatorMutation(
        env.DB,
        { ...principal, id: "admin-other-operator", subject: "other-operator" },
        prepared.sourceDraftId,
        reason,
        context,
        new Date("2026-09-01T00:30:30.000Z"),
      ),
    ).rejects.toMatchObject({ code: "fashion_u8_acceptance_invalid" });
    await bindFashionU8Successor(
      env.DB,
      active!,
      prepared.sourceDraftId,
      "draft-u8-successor",
      new Date("2026-09-01T00:31:00.000Z"),
    );
    const successorRun = await authorizeFashionU8OperatorMutation(
      env.DB,
      principal,
      "draft-u8-successor",
      reason,
      context,
      new Date("2026-09-01T00:32:00.000Z"),
    );
    await consumeFashionU8AcceptanceRun(
      env.DB,
      successorRun!,
      principal.id,
      "draft-u8-successor",
      "snapshot-u8-successor",
      new Date("2026-09-01T00:33:00.000Z"),
    );
    await expect(
      authorizeFashionU8OperatorMutation(
        env.DB,
        principal,
        "draft-u8-successor",
        reason,
        context,
        new Date("2026-09-01T00:34:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "fashion_u8_acceptance_invalid" });
    await expect(getFashionU8AcceptanceRun(env.DB, context)).resolves.toMatchObject({
      approvalAuditId: "audit-snapshot-u8-successor",
      operatorId: principal.id,
      status: "consumed",
      successorDraftId: "draft-u8-successor",
      successorSnapshotId: "snapshot-u8-successor",
    });

    const expiring = await prepareFashionU8AcceptanceRun(
      env.DB,
      {
        candidateSha: "e".repeat(40),
        catalogReleaseId: "release-u8",
        environment: "fashion-staging",
        harnessSha: "f".repeat(40),
        manifestDigest: "1".repeat(64),
        repository: "shoppp/shoppp",
        runId: "u8-expiry-test",
        sourceDraftId: "draft-u8-source",
        u12SnapshotId: "snapshot-u12-approved",
        workflowRunId: "12346",
      },
      new Date(at),
    );
    await expect(
      getFashionU8AcceptanceRun(
        env.DB,
        { manifestDigest: expiring.manifestDigest, runId: expiring.runId },
        new Date("2026-09-01T03:00:00.000Z"),
      ),
    ).resolves.toMatchObject({ status: "expired" });

    for (const terminalStatus of ["canceled", "rejected"] as const) {
      const terminal = await prepareFashionU8AcceptanceRun(
        env.DB,
        {
          candidateSha: terminalStatus === "canceled" ? "2".repeat(40) : "3".repeat(40),
          catalogReleaseId: "release-u8",
          environment: "fashion-staging",
          harnessSha: terminalStatus === "canceled" ? "4".repeat(40) : "5".repeat(40),
          manifestDigest: terminalStatus === "canceled" ? "6".repeat(64) : "7".repeat(64),
          repository: "shoppp/shoppp",
          runId: `u8-${terminalStatus}-test`,
          sourceDraftId: "draft-u8-source",
          u12SnapshotId: "snapshot-u12-approved",
          workflowRunId: terminalStatus === "canceled" ? "12347" : "12348",
        },
        new Date(at),
      );
      await env.DB.prepare(
        "UPDATE fashion_u8_acceptance_runs SET status = ?, updated_at = ? WHERE run_id = ? AND manifest_digest = ?",
      )
        .bind(terminalStatus, at, terminal.runId, terminal.manifestDigest)
        .run();
      await expect(
        authorizeFashionU8OperatorMutation(
          env.DB,
          principal,
          terminal.sourceDraftId,
          `Fashion U8 ${terminal.runId} ${terminal.manifestDigest}`,
          { manifestDigest: terminal.manifestDigest, runId: terminal.runId },
          new Date("2026-09-01T00:30:00.000Z"),
        ),
      ).rejects.toMatchObject({ code: "fashion_u8_acceptance_invalid" });
    }

    await expect(
      getFashionU8AcceptanceRun(env.DB, {
        manifestDigest: "8".repeat(64),
        runId: "u8-unknown-test",
      }),
    ).rejects.toMatchObject({ code: "fashion_u8_acceptance_not_found" });
  });
});
