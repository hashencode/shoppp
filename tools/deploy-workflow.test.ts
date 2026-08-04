import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");

describe("production promotion workflow", () => {
  test("defaults to staging-only and requires explicit release confirmation", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("promote_production:");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain('test "$PRODUCTION_CONFIRMATION" = "PROMOTE $RELEASE_ID"');
    expect(workflow).toContain(
      '[[ "$PRODUCTION_BACKUP_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$ ]]',
    );
  });

  test("verifies a recent ready production backup before migration", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const backupVerification = workflow.indexOf("Verify recent production backup before migration");
    const migration = workflow.indexOf("Apply production D1 migrations after approved backup");

    expect(backupVerification).toBeGreaterThan(0);
    expect(migration).toBeGreaterThan(backupVerification);
    expect(workflow).toContain("environment = 'production'");
    expect(workflow).toContain("status = 'ready'");
    expect(workflow).toContain("datetime(completed_at) >= datetime('now', '-24 hours')");
    expect(workflow).toContain(
      "RELEASE_BACKUP_ID: ${{ needs.approve-production.outputs.backup_id }}",
    );
  });

  test("backs up and verifies the test D1 around explicit staging migrations", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const backup = workflow.indexOf("Export test D1 before staging migration");
    const list = workflow.indexOf("List pending test D1 migrations");
    const upload = workflow.indexOf("Upload saved staging versions before migration");
    const adminPreflight = workflow.indexOf("Verify test protected administrator before migration");
    const migration = workflow.indexOf("Apply test D1 migrations");
    const verification = workflow.indexOf("Verify test D1 integrity and protected administrator");

    expect(backup).toBeGreaterThan(0);
    expect(list).toBeGreaterThan(backup);
    expect(upload).toBeGreaterThan(list);
    expect(adminPreflight).toBeGreaterThan(upload);
    expect(migration).toBeGreaterThan(adminPreflight);
    expect(verification).toBeGreaterThan(migration);
    expect(workflow).toContain("wrangler d1 export shoppp-staging --env staging --remote");
    expect(workflow).toContain("wrangler d1 migrations list shoppp-staging --env staging --remote");
    expect(workflow).toContain(
      "wrangler d1 migrations apply shoppp-staging --env staging --remote",
    );
  });

  test("uses only the named production D1 and verifies it after migrations", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const list = workflow.indexOf("List pending production D1 migrations");
    const upload = workflow.indexOf("Upload production-bound saved versions before migration");
    const adminPreflight = workflow.indexOf(
      "Verify two production protected administrators before migration",
    );
    const migration = workflow.indexOf("Apply production D1 migrations after approved backup");
    const verification = workflow.indexOf(
      "Verify production D1 integrity and protected administrator",
    );

    expect(list).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(0);
    expect(list).toBeGreaterThan(upload);
    expect(adminPreflight).toBeGreaterThan(list);
    expect(migration).toBeGreaterThan(adminPreflight);
    expect(verification).toBeGreaterThan(migration);
    expect(workflow).toContain(
      "wrangler d1 migrations list shoppp-production --env production --remote",
    );
    expect(workflow).toContain(
      "wrangler d1 migrations apply shoppp-production --env production --remote",
    );
    expect(workflow).not.toContain("shoppp-development");
  });

  test("requires independent human IdP and MFA evidence after machine proof", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const machineProof = workflow.indexOf("Prove service-principal admin access");
    const humanApproval = workflow.indexOf("Record real-human IdP and MFA proof");
    const productionApproval = workflow.indexOf("Record explicit production approval");

    expect(machineProof).toBeGreaterThan(0);
    expect(humanApproval).toBeGreaterThan(machineProof);
    expect(productionApproval).toBeGreaterThan(humanApproval);
    expect(workflow).toContain("environment: staging-human-access");
    expect(workflow).toContain("human_access_evidence_id:");
    expect(workflow).toContain(
      "RELEASE_HUMAN_ACCESS_EVIDENCE_ID: ${{ needs.approve-production.outputs.human_access_evidence_id }}",
    );
    expect(workflow).toContain(
      "RELEASE_HUMAN_ACCESS_APPROVED_BY: ${{ needs.approve-production.outputs.human_access_approved_by }}",
    );
    expect(workflow).not.toContain("storageState");
  });

  test("checks administrators before migration and verifies dynamic IAM after migration", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow.match(/PRAGMA foreign_key_check/g)?.length).toBe(2);
    expect(workflow.match(/enabled_protected_admins/g)?.length).toBeGreaterThanOrEqual(8);
    expect(workflow).toContain("FROM sqlite_master WHERE type = 'table' AND name = 'admin_roles'");
    expect(workflow).toContain("WHERE enabled = 1 AND role = 'admin'");
    expect(workflow).toContain("identity.principal_kind = 'human'");
    expect(workflow).toContain("identity.enabled = 1");
    expect(workflow).toContain("role.enabled = 1");
    expect(workflow).toContain("role.protected = 1");
    expect(workflow).toContain(
      "any(.[]?.results[]?; ((.enabled_protected_admins // 0) | tonumber) > 1)",
    );
  });

  test("proves the pre-IAM API rollback can still read an authenticated session", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const rollback = workflow.indexOf("Demonstrate last-known-good rollback");
    const sessionProof = workflow.indexOf('"$ADMIN_E2E_BASE_URL/api/admin/session"', rollback);
    const restore = workflow.indexOf("Restore the validated staging versions");

    expect(rollback).toBeGreaterThan(0);
    expect(sessionProof).toBeGreaterThan(rollback);
    expect(restore).toBeGreaterThan(sessionProof);
  });

  test("prepares isolated and auditable staging journey fixtures", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("Prepare representative last-unit inventory");
    expect(workflow).toContain(
      "$ADMIN_E2E_BASE_URL/api/admin/inventory/$PROOF_INVENTORY_VARIANT/$PROOF_INVENTORY_WAREHOUSE/adjustments",
    );
    expect(workflow).toContain("Staging release last-unit fixture");
    expect(workflow).toContain('STAGING_CHECKOUT_CONCURRENCY: "4"');
    expect(workflow).toContain(
      "E2E_EXHAUSTED_NOTIFICATION_ID: proof-notification-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(workflow).toContain(
      "E2E_FAILED_CATALOG_RELEASE_ID: proof-catalog-failure-${{ github.run_id }}-${{ github.run_attempt }}",
    );
    expect(workflow).toContain("Remove transient staging proof fixtures");
    expect(workflow).toContain("INSERT OR IGNORE INTO admin_invitations");
    expect(workflow).toContain("'inv_$E2E_ADMIN_ACCESS_PROOF_ID'");
    expect(workflow).toContain("Record failed staging proof");
    expect(workflow).toContain('"failureCode":"staging_proof_failed"');
  });
});
