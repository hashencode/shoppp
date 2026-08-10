import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");
const previewWorkflowPath = resolve(import.meta.dir, "../.github/workflows/preview-storefront.yml");
const storefrontPlaywrightPath = resolve(
  import.meta.dir,
  "../apps/storefront/playwright.config.ts",
);
const storefrontPackagePath = resolve(import.meta.dir, "../apps/storefront/package.json");
const fashionStorePlaywrightPath = resolve(
  import.meta.dir,
  "../apps/storefront/playwright.fashion-store.config.ts",
);
const architecturePath = resolve(
  import.meta.dir,
  "../docs/architecture/storefront-theme-platform.md",
);
const sourcePortRunbookPath = resolve(
  import.meta.dir,
  "../docs/runbooks/source-equivalent-html-template-port.md",
);
const fidelityReferencePath = resolve(
  import.meta.dir,
  "../docs/reference/source-equivalence-acceptance-system.md",
);
const promotionRunbookPath = resolve(
  import.meta.dir,
  "../docs/runbooks/storefront-theme-promotion.md",
);

describe("production promotion workflow", () => {
  test("does not forward Playwright worker flags into the Fashion Store evidence verifier", async () => {
    const packageJson = JSON.parse(await readFile(storefrontPackagePath, "utf8")) as {
      scripts: Record<string, string>;
    };

    const stages = packageJson.scripts["test:themes"]?.split("&&").map((stage) => stage.trim());
    expect(stages).toContain("bun run test:fashion-store");
    expect(stages).not.toContainEqual(expect.stringMatching(/test:fashion-store\s+--/));
    expect(stages).toContain("bun run test:perf:fashion-store -- --workers=1");
  });

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
    expect(workflow).toContain('evidence_source="environment-review"');
    expect(workflow).toContain('evidence_source="workflow-dispatch-actor"');
    expect(workflow).toContain("WORKFLOW_ACTOR: ${{ github.actor }}");
    expect(workflow).toContain("evidenceSource: $evidenceSource");
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

describe("source-equivalence documentation authority", () => {
  test("keeps one normative runbook and one operational reference", async () => {
    const [runbook, reference] = await Promise.all([
      readFile(sourcePortRunbookPath, "utf8"),
      readFile(fidelityReferencePath, "utf8"),
    ]);

    expect(runbook).toContain("single normative reconstruction workflow");
    expect(reference).toMatch(/It is not a\s+second reconstruction workflow/);
    expect(reference).not.toContain("## Human checkpoints");
    expect(reference).not.toContain("## Post-port metrics");
  });
});

describe("private storefront preview workflow", () => {
  test("uses exact build and snapshot identities with authenticated idempotent callbacks", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");

    expect(workflow).toContain("build_id:");
    expect(workflow).toContain("snapshot_id:");
    expect(workflow).toContain(
      "$PREVIEW_API_URL/build/storefront-experiences/snapshots/$SNAPSHOT_ID",
    );
    expect(workflow).toContain(
      "$PREVIEW_API_URL/build/storefront-experiences/builds/$BUILD_ID/status",
    );
    expect(workflow).toContain("Idempotency-Key: preview-build-result-$BUILD_ID");
    expect(workflow).toContain('"status":"deployed"');
    expect(workflow).toContain('"status":"failed"');
  });

  test("validates exact origins and configures a separate Admin handoff origin", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");

    expect(workflow).toContain(
      'for (const name of ["PREVIEW_API_URL", "PREVIEW_HANDOFF_ORIGIN", "PREVIEW_ORIGIN"])',
    );
    expect(workflow).toContain('url.protocol !== "https:" || url.origin !== value');
    expect(workflow).toContain('--var "PREVIEW_HANDOFF_ORIGIN:$PREVIEW_HANDOFF_ORIGIN"');
    expect(workflow).not.toMatch(/grant_[A-Za-z0-9_-]{16,}/);
  });
});

describe("storefront theme browser matrix", () => {
  test("keeps theme-only assertions out of the production fallback suite", async () => {
    const [production, fashionStore] = await Promise.all([
      readFile(storefrontPlaywrightPath, "utf8"),
      readFile(fashionStorePlaywrightPath, "utf8"),
    ]);
    const productionIgnore = production.match(/testIgnore:\s*\[([\s\S]*?)\],/)?.[1];

    expect(productionIgnore).toContain('"fashion-store-*.spec.ts"');
    expect(productionIgnore).toContain('"theme-behavior-contract.spec.ts"');
    expect(fashionStore).toContain('"fashion-store-*.spec.ts"');
    expect(fashionStore).not.toContain('testMatch: ["*.spec.ts"');
    expect(fashionStore).toContain("check-bundle-budget.ts");
  });

  test("keeps Fashion Store fidelity evidence scoped to home and requires explicit review", async () => {
    const [fashionStore, architecture, reference] = await Promise.all([
      readFile(fashionStorePlaywrightPath, "utf8"),
      readFile(architecturePath, "utf8"),
      readFile(fidelityReferencePath, "utf8"),
    ]);

    expect(fashionStore).toContain("themeViewports.tablet");
    expect(architecture).toContain("reference-fidelity scope is the home template only");
    expect(reference).toMatch(/does not activate a\s+production theme/);
    expect(reference).toContain("Never create `approval.json`");
  });

  test("keeps Fashion Store promotion separate from parity evidence", async () => {
    const [architecture, runbook] = await Promise.all([
      readFile(architecturePath, "utf8"),
      readFile(promotionRunbookPath, "utf8"),
    ]);

    expect(architecture).toContain("Fashion Store is an isolated experiment");
    expect(runbook).toContain("A green fidelity report is not a promotion instruction");
    expect(runbook).toContain("themeVersion: 2.0.0");
    expect(runbook).toContain("snapshot migration");
    expect(runbook).toContain("promotion-eligible");
    expect(runbook).toContain("abandon");
  });
});
