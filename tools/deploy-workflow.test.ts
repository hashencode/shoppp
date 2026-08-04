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

  test("requires independent human password-login evidence after machine proof", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const machineProof = workflow.indexOf("Prove service-principal admin access");
    const humanApproval = workflow.indexOf("Record real-human password-login proof");
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
    expect(workflow).toContain("JOIN admin_password_credentials credential");
    expect(workflow).toContain(
      "any(.[]?.results[]?; ((.credentialed_protected_admins // 0) | tonumber) > 0)",
    );
    expect(workflow).toContain(
      "any(.[]?.results[]?; ((.credentialed_protected_admins // 0) | tonumber) > 1)",
    );
  });

  test("provisions a hashed test service credential before machine proof", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const provision = workflow.indexOf("Provision hashed staging service credential");
    const prohibitedProvision = workflow.indexOf(
      "Provision hashed staging prohibited service credential",
    );
    const machineProof = workflow.indexOf("Prove service-principal admin access");

    expect(provision).toBeGreaterThan(0);
    expect(prohibitedProvision).toBeGreaterThan(provision);
    expect(machineProof).toBeGreaterThan(provision);
    expect(machineProof).toBeGreaterThan(prohibitedProvision);
    expect(workflow).toContain("bun run provision:admin-service --environment test");
    expect(workflow).toContain("E2E_ADMIN_SERVICE_TOKEN: ${{ secrets.ADMIN_SERVICE_TOKEN }}");
    expect(workflow).toContain(
      "E2E_PROHIBITED_ADMIN_SERVICE_SUBJECT: ${{ vars.PROHIBITED_ADMIN_SERVICE_SUBJECT }}",
    );
    expect(workflow).toContain(
      "ADMIN_SERVICE_TOKEN: ${{ secrets.PROHIBITED_ADMIN_SERVICE_TOKEN }}",
    );
    for (const forbidden of [
      ["CF", "ACCESS"].join("_"),
      ["Cf", "Access", "Jwt", "Assertion"].join("-"),
      ["ACCESS", "AUDIENCE"].join("_"),
      ["ACCESS", "ISSUER"].join("_"),
    ]) {
      expect(workflow).not.toContain(forbidden);
    }
  });

  test("keeps rollback artifacts without activating authentication-incompatible workers", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const rollback = workflow.indexOf("Verify last-known-good rollback artifacts remain available");
    const rollbackEnd = workflow.indexOf("Record proven catalog deployment", rollback);
    const rollbackStep = workflow.slice(rollback, rollbackEnd);

    expect(rollback).toBeGreaterThan(0);
    expect(rollbackEnd).toBeGreaterThan(rollback);
    expect(rollbackStep).toContain("for component in apps/api apps/admin apps/storefront; do");
    expect(rollbackStep).toContain("bunx wrangler versions list --env staging --json");
    expect(rollbackStep).toContain('--arg release "$E2E_LAST_KNOWN_GOOD_RELEASE_ID"');
    expect(rollbackStep).toContain('.annotations["workers/message"] == $release');
    expect(workflow).not.toContain("bunx wrangler rollback --env staging");
  });

  test("proves the deployed staging auth secret through the real password-reset route", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const authSecretProof = workflow.indexOf("Verify staging administrator auth secret");
    const machineProof = workflow.indexOf("Prove service-principal admin access");
    const authSecretStep = workflow.slice(authSecretProof, machineProof);

    expect(authSecretProof).toBeGreaterThan(0);
    expect(machineProof).toBeGreaterThan(authSecretProof);
    expect(authSecretStep).toContain("curl --fail --silent --show-error");
    expect(authSecretStep).toContain("--request POST");
    expect(authSecretStep).toContain('"Origin: $ADMIN_E2E_BASE_URL"');
    expect(authSecretStep).toContain('"Sec-Fetch-Site: same-origin"');
    expect(authSecretStep).toContain('"$ADMIN_E2E_BASE_URL/api/admin/auth/password-reset/request"');
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
