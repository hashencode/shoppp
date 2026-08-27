import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");
const fullValidationWorkflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/full-validation.yml",
);
const previewWorkflowPath = resolve(import.meta.dir, "../.github/workflows/preview-storefront.yml");
const fashionPreparationWorkflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/prepare-fashion-staging-u12.yml",
);
const fashionU8PreparationWorkflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/prepare-fashion-staging-u8.yml",
);
const fashionU8AcceptanceWorkflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/accept-fashion-staging-u8.yml",
);
const fashionPurchaseJourneyPath = resolve(
  import.meta.dir,
  "../e2e/fashion-store-purchase.spec.ts",
);
const paymentRecoveryJourneyPath = resolve(import.meta.dir, "../e2e/payment-recovery.spec.ts");
const publicationJourneyPath = resolve(import.meta.dir, "../e2e/publication.spec.ts");
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
const releaseRunbookPath = resolve(import.meta.dir, "../docs/runbooks/release.md");

function expectExternalActionsPinnedToFullShas(contents: string): void {
  const references = contents.match(/^\s+(?:-\s+)?uses:\s+[^\s#]+/gm) ?? [];
  for (const reference of references) {
    const action = reference.match(/uses:\s+([^\s#]+)/)?.[1];
    expect(action).toBeDefined();
    if (action!.startsWith("./")) continue;
    expect(action).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
  }
}

describe("hosted full validation workflow", () => {
  test("allows the complete release gate to finish without weakening it", async () => {
    const workflow = await readFile(fullValidationWorkflowPath, "utf8");

    expect(workflow).toContain("timeout-minutes: 60");
    expect(workflow).toContain(
      'bun run release:validate -- --release-id "$RELEASE_ID" --write-attestation',
    );
  });
});

describe("production promotion workflow", () => {
  test("runs credential-free dispatch preflight before reusable hosted validation", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const preflight = workflow.slice(
      workflow.indexOf("  preflight:"),
      workflow.indexOf("  validate:"),
    );
    const validation = workflow.slice(
      workflow.indexOf("  validate:"),
      workflow.indexOf("  deploy-staging:"),
    );

    expect(workflow).toContain("source_sha:");
    expect(workflow).toContain("source_ref:");
    expect(workflow).toMatch(/^permissions:\n {2}actions: none\n {2}contents: none$/m);
    expect(preflight).toContain("permissions:\n      contents: read");
    expect(preflight).not.toContain("environment:");
    expect(preflight).not.toMatch(/secrets\.|CLOUDFLARE|BUILD_MANIFEST_TOKEN/);
    expect(preflight).toContain("Check out protected deployment authority");
    expect(preflight).toContain("ref: ${{ github.event.repository.default_branch }}");
    expect(preflight).toContain("RELEASE_OPERATORS");
    expect(preflight).toContain("bun tools/ci-trusted-source-preflight.ts --mode deploy");
    expect(validation).toContain(
      "secrets:\n      BUILD_MANIFEST_TOKEN: ${{ secrets.BUILD_MANIFEST_TOKEN }}",
    );
    expect(validation).not.toContain("secrets: inherit");
    expect(validation).toContain("needs: preflight");
    expect(validation).toContain("uses: ./.github/workflows/full-validation.yml");
    expect(validation).toContain("source_sha: ${{ needs.preflight.outputs.source_sha }}");
    expect(validation).toContain("release_id: ${{ inputs.release_id }}");
    expect(validation).not.toContain("secrets: inherit");
  });

  test("verifies deployment evidence with protected code before deployment credentials exist", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const verification = workflow.slice(
      workflow.indexOf("  verify-deployment-inputs:"),
      workflow.indexOf("  record-validation-failure:"),
    );
    const staging = workflow.slice(
      workflow.indexOf("  deploy-staging:"),
      workflow.indexOf("  prove-staging:"),
    );
    const stagingSetup = staging.slice(
      0,
      staging.indexOf("Capture exact staging Worker and D1 baseline"),
    );
    const production = workflow.slice(workflow.indexOf("  promote-production:"));
    const productionSetup = production.slice(
      0,
      production.indexOf("Verify recent production backup before migration"),
    );

    expect(verification).toContain("needs: validate");
    expect(verification).not.toContain("environment:");
    expect(verification).not.toMatch(/secrets\.|CLOUDFLARE|BUILD_MANIFEST_TOKEN/);
    expect(verification).toContain("ref: ${{ github.sha }}");
    expect(verification).toContain("name: ${{ needs.validate.outputs.artifact_name }}");
    expect(verification).toContain("bun tools/release-validate.ts --verify-attestation");

    expect(staging).toContain("needs: [validate, verify-deployment-inputs]");
    expect(stagingSetup).not.toMatch(/secrets\.|CLOUDFLARE|BUILD_MANIFEST_TOKEN/);
    expect(productionSetup).not.toMatch(/secrets\.|CLOUDFLARE|BUILD_MANIFEST_TOKEN/);
    expect(staging).toMatch(
      /Export test D1 before staging migration[\s\S]*CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/,
    );
    expect(production).toMatch(
      /Verify recent production backup before migration[\s\S]*CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/,
    );
  });

  test("reports validation failure only after trusted preflight", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const failureReport = workflow.slice(
      workflow.indexOf("  record-validation-failure:"),
      workflow.indexOf("  deploy-staging:"),
    );

    expect(failureReport).toContain("needs: [preflight, validate]");
    expect(failureReport).toContain(
      "always() && needs.preflight.result == 'success' && needs.validate.result == 'failure'",
    );
    expect(failureReport).toContain("environment: staging");
    expect(failureReport).toContain("BUILD_MANIFEST_TOKEN: ${{ secrets.BUILD_MANIFEST_TOKEN }}");
    expect(failureReport).toContain('"failureCode":"candidate_validation_failed"');
    expect(failureReport).toContain("Idempotency-Key: catalog-build-$RELEASE_ID-validation-failed");
  });

  test("verifies same-run source and digests before staging mutation", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const staging = workflow.slice(
      workflow.indexOf("  deploy-staging:"),
      workflow.indexOf("  prove-staging:"),
    );
    const verification = staging.indexOf("Verify exact validated deployment inputs");
    const firstRemoteRead = staging.indexOf("Export test D1 before staging migration");
    const firstMutation = staging.indexOf("Upload saved staging versions before migration");

    expect(staging).toContain("needs: [validate, verify-deployment-inputs]");
    expect(staging).toContain("ref: ${{ needs.validate.outputs.source_sha }}");
    expect(staging).toContain("name: ${{ needs.validate.outputs.artifact_name }}");
    expect(staging).toContain("RELEASE_EXPECTED_TREE: ${{ needs.validate.outputs.source_tree }}");
    expect(staging).toContain(
      "EXPECTED_REPORT_DIGEST: ${{ needs.validate.outputs.report_digest }}",
    );
    expect(staging).toContain(
      "EXPECTED_ATTESTATION_DIGEST: ${{ needs.validate.outputs.attestation_digest }}",
    );
    expect(staging).toContain(
      "EXPECTED_DEPLOYABLE_DIGEST: ${{ needs.validate.outputs.deployable_digest }}",
    );
    expect(staging).toContain("bun tools/release-validate.ts --verify-attestation");
    expect(verification).toBeGreaterThan(0);
    expect(firstRemoteRead).toBeGreaterThan(verification);
    expect(firstMutation).toBeGreaterThan(firstRemoteRead);
    expect(staging).toContain("failure() && steps.validated-inputs.outcome == 'success'");
    expect(staging).not.toContain("bun run build");
  });

  test("pins every maintained deployment action to a full commit SHA", async () => {
    expectExternalActionsPinnedToFullShas(await readFile(workflowPath, "utf8"));
  });

  test("documents distinct credential ownership, rotation, and emergency revocation", async () => {
    const runbook = await readFile(releaseRunbookPath, "utf8");

    expect(runbook).toContain("GitHub-first release authority");
    expect(runbook).toContain("staging read credential owner");
    expect(runbook).toContain("staging deployment credential owner");
    expect(runbook).toContain("production deployment credential owner");
    expect(runbook).toMatch(/Emergency\s+revocation/);
    expect(runbook).toContain("same caller run and attempt");
  });

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
    const rehearsalInput = workflow.slice(
      workflow.indexOf("      rehearse_staging_rollback:"),
      workflow.indexOf("      production_confirmation:"),
    );

    expect(workflow).toContain("promote_production:");
    expect(workflow).toContain("rehearse_staging_rollback:");
    expect(rehearsalInput).toContain("default: false");
    expect(workflow).toContain("inputs.rehearse_staging_rollback && inputs.promote_production");
    expect(workflow).toContain('test "$PRODUCTION_CONFIRMATION" = "PROMOTE $RELEASE_ID"');
    expect(workflow).toContain(
      '[[ "$PRODUCTION_BACKUP_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$ ]]',
    );
  });

  test("runs release p95 only through the protected CI-GH staging rehearsal entry", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const proof = workflow.slice(
      workflow.indexOf("  prove-staging:"),
      workflow.indexOf("  restore-staging-baseline:"),
    );

    expect(proof).toContain("CI_GH_VALIDATED_SOURCE_SHA: ${{ needs.validate.outputs.source_sha }}");
    expect(proof).toContain("CI_GH_STAGING_REHEARSAL: ${{ inputs.rehearse_staging_rollback }}");
    expect(proof).toContain("CI_GH_PRODUCTION_PROMOTION: ${{ inputs.promote_production }}");
    expect(proof).toContain("bun tools/verify-release-staging-latency.ts");
    expect(proof).not.toContain("bun run test:staging-latency");
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

  test("requires independent human password-login evidence only for production promotion", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const machineProof = workflow.indexOf("Prove service-principal admin access");
    const humanApproval = workflow.indexOf("Record real-human password-login proof");
    const productionApproval = workflow.indexOf("Record explicit production approval");
    const humanApprovalJob = workflow.slice(
      workflow.indexOf("  approve-human-access:"),
      workflow.indexOf("  approve-production:"),
    );
    const humanEvidenceInput = workflow.slice(
      workflow.indexOf("      human_access_evidence_id:"),
      workflow.indexOf("\n\nconcurrency:"),
    );

    expect(machineProof).toBeGreaterThan(0);
    expect(humanApproval).toBeGreaterThan(machineProof);
    expect(productionApproval).toBeGreaterThan(humanApproval);
    expect(workflow).toContain("environment: staging-human-access");
    expect(workflow).toContain("human_access_evidence_id:");
    expect(humanEvidenceInput).toContain("required: false");
    expect(humanApprovalJob).toContain("if: ${{ inputs.promote_production }}");
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

  test("rehearses an exact no-migration staging rollback from a captured baseline", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const deployment = workflow.slice(
      workflow.indexOf("  deploy-staging:"),
      workflow.indexOf("  prove-staging:"),
    );
    const rollback = workflow.slice(
      workflow.indexOf("  restore-staging-baseline:"),
      workflow.indexOf("  approve-human-access:"),
    );
    const proof = workflow.slice(
      workflow.indexOf("  prove-staging:"),
      workflow.indexOf("  restore-staging-baseline:"),
    );
    const rollbackJobEnv = rollback.slice(
      rollback.indexOf("    env:"),
      rollback.indexOf("    steps:"),
    );
    const baselineValidation = rollback.slice(
      rollback.indexOf("Validate captured staging baseline identity before restoration"),
      rollback.indexOf("Restore exact captured staging Worker versions"),
    );
    const capture = deployment.indexOf("Capture exact staging Worker and D1 baseline");
    const firstMutation = deployment.indexOf("Upload saved staging versions before migration");

    expect(capture).toBeGreaterThan(0);
    expect(firstMutation).toBeGreaterThan(capture);
    expect(deployment).toContain("bun tools/staging-rollback-baseline.ts capture");
    expect(deployment).toContain("Preserve the exact staging rollback baseline");
    expect(deployment).toContain("List pending test D1 migrations and refuse unsafe rehearsal");
    expect(deployment).toContain("staging-rollback-baseline.ts check-migrations");
    expect(deployment).toContain(
      "baseline_artifact_id: ${{ steps.staging-baseline.outputs.artifact-id }}",
    );

    expect(rollback).toContain("needs: [validate, deploy-staging, prove-staging]");
    expect(rollback).toContain("always() && inputs.rehearse_staging_rollback");
    expect(rollback).toContain("needs.deploy-staging.outputs.baseline_artifact_id != ''");
    expect(rollback).toContain("Validate captured staging baseline identity before restoration");
    expect(rollback).toContain("bun tools/staging-rollback-baseline.ts validate");
    expect(rollbackJobEnv).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(baselineValidation).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(rollback.match(/^\s+CLOUDFLARE_API_TOKEN:/gm)).toHaveLength(4);
    expect(rollback.indexOf("staging-rollback-baseline.ts validate")).toBeLessThan(
      rollback.indexOf('bunx wrangler versions deploy "$version_id@100%"'),
    );
    expect(rollback).toContain('bunx wrangler versions deploy "$version_id@100%"');
    expect(rollback).toContain("for component in api admin storefront; do");
    expect(rollback).toContain('(cd "apps/$component"');
    expect(rollback).toContain("for attempt in 1 2 3; do");
    expect(rollback).toContain("worker-restore-outcomes.txt");
    expect(rollback).toContain("Restore rehearsal Catalog Release lifecycle");
    expect(rollback).toContain("build_correlation_id = substr");
    expect(rollback).toContain("release-lifecycle-restore.txt");
    expect(rollback.indexOf("Restore rehearsal Catalog Release lifecycle")).toBeLessThan(
      rollback.indexOf("Reconcile run-scoped staging proof data"),
    );
    expect(rollback).toContain("Reconcile run-scoped staging proof data");
    expect(rollback).toContain("staging-rollback-baseline.ts reconcile");
    expect(rollback.match(/--buyer-email="\$E2E_BUYER_EMAIL"/g)).toHaveLength(2);
    expect(rollback).toContain(
      "if: ${{ always() && steps.baseline-validation.outcome == 'success' }}",
    );
    expect(rollback).toContain("Verify restored staging Worker and D1 baseline");
    expect(rollback).toContain("bun tools/staging-rollback-baseline.ts verify");
    expect(rollback).toContain('curl --fail --silent --show-error "$API_URL/health"');
    expect(proof).toContain("if: ${{ !inputs.rehearse_staging_rollback }}");
    expect(proof).toContain("Activate staging proof Catalog Release");
    expect(proof).toContain("'staging-proof:' || build_correlation_id");
    expect(proof.indexOf("Activate staging proof Catalog Release")).toBeLessThan(
      proof.indexOf("Verify public and protected deployment boundaries"),
    );
    expect(proof).toContain("E2E_BUYER_EMAIL: release-buyer+${{ github.run_id }}");
    expect(proof).toContain("DELETE FROM admin_invitations");
    expect(
      rollback.indexOf("Record proven catalog deployment after restored safe state"),
    ).toBeGreaterThan(rollback.indexOf("Verify restored staging Worker and D1 baseline"));
    expect(rollback).toContain("steps.worker-restoration.outcome == 'success'");
    expect(rollback).toContain("steps.release-lifecycle-restoration.outcome == 'success'");
    expect(rollback).toContain("steps.d1-reconciliation.outcome == 'success'");
    expect(rollback).toContain("steps.restored-state.outcome == 'success'");
    expect(deployment).toContain("!inputs.rehearse_staging_rollback");
    expect(proof).toContain("failure() && !inputs.rehearse_staging_rollback");
    expect(rollback).toContain("Record one failed rehearsal outcome after restoration attempts");
    expect(rollback).toContain("failure_code=staging_restoration_failed");
    expect(rollback).toContain("failure_code=staging_deployment_failed");
    expect(rollback).toContain("failure_code=staging_proof_failed");
    expect(rollback).toContain("$failure_code");
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
    const [workflow, paymentRecovery, publication] = await Promise.all([
      readFile(workflowPath, "utf8"),
      readFile(paymentRecoveryJourneyPath, "utf8"),
      readFile(publicationJourneyPath, "utf8"),
    ]);

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
    expect(paymentRecovery).toContain('name: "Payment status is unavailable"');
    expect(paymentRecovery).toContain(
      "This return cannot be matched to a secure checkout session.",
    );
    expect(publication).toContain('requiredEnvironment("RELEASE_ID")');
    expect(publication).not.toContain('requiredEnvironment("E2E_LAST_KNOWN_GOOD_RELEASE_ID")');
    expect(workflow).toContain('jq -e --arg release "$E2E_LAST_KNOWN_GOOD_RELEASE_ID"');
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
  test("requires a fresh governed readiness artifact before any deployment mutation", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");
    const inputValidation = workflow.indexOf("Validate governed Preview dispatch inputs");
    const download = workflow.indexOf("Download the governed Fashion readiness snapshot");
    const readiness = workflow.indexOf("Verify fresh pre-deployment readiness before any mutation");
    const upload = workflow.indexOf("Upload immutable files to the private preview bucket");
    const deploy = workflow.indexOf("Deploy the isolated preview access Worker");

    expect(workflow).toContain("readiness_commit_sha:");
    expect(workflow).toContain("readiness_run_id:");
    expect(workflow).toContain("readiness_digest:");
    expect(workflow).toContain("name: fashion-u12-readiness-${{ inputs.readiness_commit_sha }}");
    expect(workflow).toContain("run-id: ${{ inputs.readiness_run_id }}");
    expect(workflow).toContain("bun tools/verify-fashion-staging-readiness.ts");
    expect(workflow).toContain('[[ "$READINESS_COMMIT_SHA" =~ ^[a-f0-9]{40}$ ]]');
    expect(workflow).toContain('[[ "$READINESS_RUN_ID" =~ ^[1-9][0-9]*$ ]]');
    expect(workflow).toContain('[[ "$READINESS_DIGEST" =~ ^[a-f0-9]{64}$ ]]');
    expect(workflow).toContain('--arg commit "$READINESS_COMMIT_SHA"');
    expect(workflow).toContain('--arg run "$READINESS_RUN_ID"');
    expect(workflow).toContain(".commitSha == $commit");
    expect(workflow).toContain(".github.operatorGate.runId == $run");
    expect(workflow).toContain("      - self-hosted\n      - fashion-staging-preview");
    expect(workflow).not.toContain("runs-on: ubuntu-latest");
    expect(inputValidation).toBeGreaterThan(0);
    expect(download).toBeGreaterThan(inputValidation);
    expect(readiness).toBeGreaterThan(download);
    expect(readiness).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(readiness);
    expect(deploy).toBeGreaterThan(readiness);
  });

  test("uses the authoritative build manifest and preserves its exact Catalog identity", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");
    const reportStart = workflow.indexOf("Report the exact preview artifact to the authority");
    const reportEnd = workflow.indexOf("\n      - name:", reportStart);
    const report = workflow.slice(reportStart, reportEnd === -1 ? undefined : reportEnd);
    const acceptance = workflow.slice(
      workflow.indexOf("Reconcile an explicitly selected abandoned Fashion U12 run"),
    );

    expect(workflow).toContain("build_id:");
    expect(workflow).toContain("snapshot_id:");
    expect(workflow).toContain("$PREVIEW_API_URL/build/storefront-experiences/builds/$BUILD_ID");
    expect(workflow).toContain(".snapshot.id == $snapshot");
    expect(workflow).toContain(
      '(.inputIdentity | type == "object") and .catalogRelease.releaseId == .inputIdentity.catalogReleaseId',
    );
    expect(workflow).toContain("CATALOG_RELEASE_ID=\"$(jq -er '.catalogRelease.releaseId'");
    expect(workflow).toContain('"--catalog-release-id=$CATALOG_RELEASE_ID"');
    expect(workflow).not.toContain('if [[ -n "$CATALOG_RELEASE_ID" ]]');
    expect(workflow).toContain(
      "$PREVIEW_API_URL/build/storefront-experiences/builds/$BUILD_ID/status",
    );
    expect(workflow).toContain("Idempotency-Key: preview-build-result-$BUILD_ID");
    expect(workflow).toContain('"status":"deployed"');
    expect(workflow).toContain('"status":"failed"');
    expect(workflow).toContain("upload_preview_object() {");
    expect(workflow).toContain("for ATTEMPT in 1 2 3; do");
    expect(workflow).toContain('if test "$ATTEMPT" = 3; then');
    expect(report).toContain("$PREVIEW_API_URL/admin/storefront-experiences/builds/$BUILD_ID");
    expect(report).toContain("FASHION_U13_SERVICE_TOKEN: ${{ secrets.FASHION_U13_SERVICE_TOKEN }}");
    expect(report).toContain('select(.data.status == "deployed")');
    expect(report).toContain('--arg snapshot "$SNAPSHOT_ID"');
    expect(report).toContain("printf 'digest=%s\\n'");
    expect(report).toContain("printf 'prefix=%s\\n'");
    expect(acceptance).toContain("FASHION_U12_ARTIFACT_DIGEST: ${{ steps.report.outputs.digest }}");
    expect(acceptance).not.toContain(
      "FASHION_U12_ARTIFACT_DIGEST: ${{ steps.artifact.outputs.digest }}",
    );
    expect(acceptance).toContain("FASHION_U12_COMMIT_SHA: ${{ inputs.readiness_commit_sha }}");
    expect(acceptance).not.toContain("FASHION_U12_COMMIT_SHA: ${{ github.sha }}");
  });

  test("computes Preview expiry portably across hosted and ephemeral runners", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");

    expect(workflow).toContain("new Date(Date.now() + 24 * 60 * 60 * 1000)");
    expect(workflow).not.toContain("date -u -d '+24 hours'");
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

  test("serializes Fashion acceptance and gates accepted reporting on deployed U13", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");
    const deployed = workflow.indexOf("Report the exact preview artifact to the authority");
    const u13 = workflow.indexOf("Run deployed Fashion U13 acceptance");
    const accepted = workflow.indexOf("Report Fashion preview accepted");
    const secretReference = "FASHION_U13_SERVICE_TOKEN: ${{ secrets.FASHION_U13_SERVICE_TOKEN }}";
    const u13StepEnd = workflow.indexOf("\n      - name:", u13);
    const u13Step = workflow.slice(u13, u13StepEnd === -1 ? undefined : u13StepEnd);

    const namedStep = (name: string) => {
      const start = workflow.indexOf(`      - name: ${name}`);
      expect(start).toBeGreaterThan(0);
      const end = workflow.indexOf("\n      - name:", start);
      return workflow.slice(start, end === -1 ? undefined : end);
    };
    const installStart = workflow.indexOf("      - run: bun install --frozen-lockfile");
    expect(installStart).toBeGreaterThan(0);
    const install = workflow.slice(installStart, workflow.indexOf("\n      - name:", installStart));

    expect(workflow).toContain("group: fashion-staging-preview");
    expect(workflow).toContain("environment: fashion-staging");
    expect(workflow.split(secretReference)).toHaveLength(5);
    expect(u13Step).toContain(secretReference);
    expect(
      namedStep("Run no-interception Fashion archetype and sandbox purchase journey"),
    ).toContain(secretReference);
    expect(namedStep("Prove the fresh-session sellable postcondition")).toContain(secretReference);
    expect(install).not.toContain(secretReference);
    for (const step of [
      "Build and verify isolated static preview",
      "Upload immutable files to the private preview bucket",
      "Deploy the isolated preview access Worker",
    ]) {
      expect(namedStep(step)).not.toContain(secretReference);
    }
    expect(workflow).toContain("FASHION_U13_PRODUCT_ID: ${{ vars.FASHION_U13_PRODUCT_ID }}");
    expect(workflow).toContain("FASHION_U13_VARIANT_ID: ${{ vars.FASHION_U13_VARIANT_ID }}");
    expect(deployed).toBeGreaterThan(0);
    expect(u13).toBeGreaterThan(deployed);
    expect(accepted).toBeGreaterThan(u13);
    expect(workflow).toContain("bun tools/run-fashion-staging-u13.ts");
  });

  test("locks, cleans, recovers, and fresh-session verifies the complete Fashion U12 journey", async () => {
    const workflow = await readFile(previewWorkflowPath, "utf8");
    const journeySpec = await readFile(fashionPurchaseJourneyPath, "utf8");
    const isolation = workflow.indexOf(
      "Verify Fashion staging isolation and sandbox provider profile",
    );
    const upload = workflow.indexOf("Upload immutable files to the private preview bucket");
    const acquire = workflow.indexOf("Acquire Fashion U12 acceptance lock and inventory baseline");
    const journey = workflow.indexOf(
      "Run no-interception Fashion archetype and sandbox purchase journey",
    );
    const cleanup = workflow.indexOf(
      "Restore the Fashion U12 baseline and retain paid-order evidence",
    );
    const postcondition = workflow.indexOf("Prove the fresh-session sellable postcondition");
    const postCleanup = workflow.indexOf("Clean the fresh-session postcondition run");
    const verdict = workflow.indexOf("Enforce the complete Fashion U12 verdict");
    const metadataStart = workflow.indexOf("      - name: Preserve private build metadata");
    const metadata = workflow.slice(metadataStart);

    expect(isolation).toBeGreaterThan(0);
    expect(upload).toBeGreaterThan(isolation);
    expect(acquire).toBeGreaterThan(upload);
    expect(journey).toBeGreaterThan(acquire);
    expect(cleanup).toBeGreaterThan(journey);
    expect(postcondition).toBeGreaterThan(cleanup);
    expect(postCleanup).toBeGreaterThan(postcondition);
    expect(verdict).toBeGreaterThan(postCleanup);
    expect(workflow).toContain("recovery_run_id:");
    expect(workflow).toContain("--action=reconcile");
    expect(workflow).toContain("--action=failure");
    expect(workflow.match(/--action=cleanup/g)?.length).toBe(2);
    expect(workflow).toContain("FASHION_U12_PHASE: journey");
    expect(workflow).toContain("FASHION_U12_PHASE: postcondition");
    expect(journeySpec).toContain("/internal/testing/fashion-staging/runs/");
    expect(journeySpec).toContain("/settle");
    expect(journeySpec).toContain('page.route("**/api/checkout/sessions"');
    expect(journeySpec).not.toContain("checkoutResponse.json()");
    expect(journeySpec).not.toContain("I am an AI agent");
    expect(journeySpec).not.toContain("cardNumber");
    expect(workflow).not.toContain("E2E_STRIPE_TEST_CARD");
    expect(workflow).toContain("FASHION_U12_STRIPE_SECRET_KEY");
    expect(workflow).toContain("sk_test_");
    expect(workflow).toContain("FASHION_U12_TURNSTILE_SECRET");
    expect(workflow).toContain("FASHION_U12_EMAIL_MODE");
    expect(workflow).toContain("playwright-report/");
    expect(workflow).toContain("test-results/");
    expect(metadataStart).toBeGreaterThan(verdict);
    expect(metadata).toContain("continue-on-error: true");
    expect(metadata).toContain("timeout-minutes: 2");
  });
});

describe("governed Fashion staging preparation workflow", () => {
  test("backs up and locally restores exact D1 before migrations or seed mutation", async () => {
    const workflow = await readFile(fashionPreparationWorkflowPath, "utf8");
    const exportD1 = workflow.indexOf("Export exact Fashion D1 before migrations");
    const restore = workflow.indexOf(
      "Restore exported Fashion D1 into a disposable local database",
    );
    const preserve = workflow.indexOf("Preserve verified Fashion D1 backup before migration");
    const listMigrations = workflow.indexOf(
      "List pending Fashion D1 migrations after verified backup",
    );
    const migrate = workflow.indexOf("Apply pending Fashion D1 migrations after verified backup");
    const seed = workflow.indexOf("Apply collision-checked three-archetype seed");

    expect(workflow).not.toContain("confirmation:");
    expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"');
    expect(workflow).toContain("Verify standing FS-U12 execution authority");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("bun tools/verify-fashion-u12-standing-authority.ts");
    expect(workflow).toContain(
      '--baseline="79fbee07f60245b036b5a4d42858227502947a5c" --head="$GITHUB_SHA"',
    );
    expect(workflow).toContain("runner:");
    expect(workflow).toContain("default: ubuntu-latest");
    expect(workflow).toContain("- fashion-staging-preparation");
    expect(workflow).toContain("runs-on: ${{ inputs.runner }}");
    expect(workflow).not.toContain("GITHUB_REF_PROTECTED");
    expect(workflow).toContain("group: fashion-staging-preview");
    expect(workflow.indexOf("Verify standing FS-U12 execution authority")).toBeLessThan(
      workflow.indexOf("bun install --frozen-lockfile"),
    );
    expect(workflow).toContain(
      '--authority-baseline-sha="79fbee07f60245b036b5a4d42858227502947a5c"',
    );
    expect(workflow).toContain("shoppp-fashion-staging --env fashion-staging --remote");
    expect(workflow).toContain('sqlite3 "$RESTORE_DB"');
    expect(workflow).toContain("PRAGMA foreign_key_check;");
    expect(workflow).toContain("PRAGMA integrity_check;");
    expect(workflow).not.toContain("PRAGMA foreign_keys=OFF");
    expect(workflow).toContain("FASHION_U12_MIGRATIONS:");
    expect(workflow).toContain("0021_fashion_shipping_method_public_id.sql");
    expect(workflow).toContain("SELECT name, applied_at FROM d1_migrations ORDER BY name");
    expect(workflow).toContain("all(.[]; .applied_at != null)");
    expect(workflow).not.toContain("d1 migrations list");
    expect(exportD1).toBeGreaterThan(0);
    expect(restore).toBeGreaterThan(exportD1);
    expect(preserve).toBeGreaterThan(restore);
    expect(listMigrations).toBeGreaterThan(preserve);
    expect(migrate).toBeGreaterThan(listMigrations);
    expect(seed).toBeGreaterThan(migrate);
  });

  test("fails closed on credentials and collisions, then produces approved immutable readiness", async () => {
    const workflow = await readFile(fashionPreparationWorkflowPath, "utf8");
    const credentialGate = workflow.indexOf(
      "Verify required Worker and protected-environment credentials before mutation",
    );
    const collisionGate = workflow.indexOf("Reject seed identity collisions");
    const seed = workflow.indexOf("Apply collision-checked three-archetype seed");
    const immutable = workflow.indexOf(
      "Create validated approved immutable snapshot and building build",
    );
    const readiness = workflow.indexOf("Capture and verify fresh deployment-readiness evidence");

    expect(workflow).toContain("FASHION_U12_ADMIN_SERVICE_TOKEN");
    expect(workflow).toContain("FASHION_U12_GITHUB_ADMIN_TOKEN");
    expect(workflow).toContain("STRIPE_WEBHOOK_SECRET");
    expect(workflow).toContain("Rotate and synchronize the Fashion API Stripe sandbox credentials");
    expect(workflow).toContain("wrangler secret put STRIPE_SECRET_KEY --env fashion-staging");
    expect(workflow).toContain("wrangler secret put STRIPE_WEBHOOK_SECRET --env fashion-staging");
    expect(workflow).toContain("https://api.stripe.com/v1/webhook_endpoints/$webhook_id");
    expect(workflow).toContain("wrangler secret list --env fashion-staging --format json");
    expect(workflow).toContain("wrangler secret list --config wrangler.preview.jsonc");
    expect(workflow).toContain("--env fashion-staging --format json");
    expect(workflow).toContain('--command "$PREFLIGHT_SQL"');
    expect(workflow).toContain('--command "$VERIFY_SQL"');
    expect(workflow).not.toContain("--file=../../artifacts/fashion-u12/preflight.sql");
    expect(workflow).not.toContain("--file=../../artifacts/fashion-u12/verify.sql");
    expect(workflow).not.toContain("wrangler secret list --env fashion-staging --json");
    expect(workflow).not.toContain("environment: staging\n");
    expect(workflow).not.toContain("environment: production\n");
    expect(credentialGate).toBeGreaterThan(0);
    expect(collisionGate).toBeGreaterThan(credentialGate);
    expect(seed).toBeGreaterThan(collisionGate);
    expect(immutable).toBeGreaterThan(seed);
    expect(readiness).toBeGreaterThan(immutable);
    expect(workflow).toContain("/snapshots/$SNAPSHOT_ID/build");
    expect(workflow).toContain(
      "Idempotency-Key: fashion-u12-build-$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT",
    );
    expect(workflow).toContain("manualDispatch:true");
    expect(workflow).toContain("bun tools/verify-fashion-staging-readiness.ts");
  });
});

describe("governed Fashion U8 acceptance workflows", () => {
  test("prepares refresh before acceptance and never waits for Preview while holding its group", async () => {
    const [preparation, acceptance] = await Promise.all([
      readFile(fashionU8PreparationWorkflowPath, "utf8"),
      readFile(fashionU8AcceptanceWorkflowPath, "utf8"),
    ]);
    expect(preparation).toContain("group: fashion-staging-u8-preparation");
    expect(preparation).toContain("workflow_dispatch");
    expect(preparation).toContain("actions: write");
    expect(preparation).toContain("Create U8 refresh attestation");
    expect(preparation).toContain("Start append-only U8 preparation attempt");
    expect(preparation).toContain("Start append-only U8 build attempt");
    expect(preparation).toContain("Preserve append-only U8 preparation ledger");
    expect(preparation).toContain("harness_manifest_digest:");
    expect(preparation).toContain("Verify canonical reviewed U8 harness before package execution");
    expect(preparation).toContain("vars.FASHION_U8_HARNESS_MANIFEST_DIGEST");
    expect(preparation).toContain('test "$GITHUB_SHA" = "$HARNESS_SHA"');
    expect(preparation).toContain("verify-fashion-u8-standing-authority.ts");
    expect(preparation).toContain("Download exact historical U12 readiness evidence");
    expect(preparation).toContain("fashion-u12-readiness-${{ inputs.candidate_sha }}");
    expect(preparation).toContain("Verify historical readiness and frozen U8 lineage");
    expect(preparation).toContain(".seed.catalogReleaseId == $catalog");
    expect(preparation).toContain("/admin/storefront-experiences/builds/$U12_BUILD_ID");
    expect(preparation).toContain(".data.artifactDigest");
    expect(preparation).toContain("/admin/storefront-experiences/snapshots/$SUCCESSOR_SNAPSHOT_ID");
    expect(preparation).toContain("/snapshots/$SUCCESSOR_SNAPSHOT_ID/build");
    expect(preparation).toContain("newBuildId");
    expect(preparation).toContain("gh workflow run preview-storefront.yml");
    expect(preparation).toContain("refresh_run_id=$GITHUB_RUN_ID");
    expect(preparation).not.toContain("gh run watch");
    expect(preparation).toContain('.approvalAuditId == ("audit-" + .successorSnapshotId)');
    expect(preparation).toContain("run_manifest_base64:");
    expect(preparation).toContain("human_evidence_base64:");
    expect(preparation).toContain("Verify exact successful U12 readiness workflow provenance");
    expect(preparation).toContain("--connect-timeout 10 --max-time 60");
    expect(acceptance).toContain("Verify exact successful preparation workflow provenance");
    expect(acceptance).toContain("humanEvidenceDigest");
    expect(preparation).toContain("retention-days: 7");
    expect(preparation).not.toContain("group: fashion-staging-preview");
    expect(acceptance).toContain("group: fashion-staging-preview");
    expect(acceptance).not.toContain("workflow run preview-storefront.yml");
    expect(acceptance).not.toContain("actions: write");
    expect(acceptance).toContain(".buildId");
    expect(acceptance).toContain(".experienceVersion");
    expect(acceptance).not.toContain("vars.FASHION_U8_SUCCESSOR_BUILD_ID");
    expect(acceptance).not.toContain("vars.FASHION_U8_SUCCESSOR_EXPERIENCE_VERSION");
    expect(acceptance).not.toContain("vars.FASHION_U8_THEME_ARTIFACT_DIGEST");
  });

  test("lets Preview deploy a refresh successor without equating it to the historical seed build", async () => {
    const preview = await readFile(previewWorkflowPath, "utf8");
    expect(preview).toContain("refresh_run_id:");
    expect(preview).toContain("refresh_artifact_name:");
    expect(preview).toContain("refresh_digest:");
    expect(preview).toContain("harness_sha:");
    expect(preview).toContain("Download exact U8 refresh attestation");
    expect(preview).toContain("Verify U8 refresh attestation before deployment mutation");
    expect(preview).toContain("current-harness-manifest.json");
    expect(preview).toContain("'fashion-staging-u8'");
    expect(preview).toContain(".newBuildId == $build");
    expect(preview).toContain(".successorSnapshotId == $snapshot");
    expect(preview).toContain(".u12ReadinessDigest == $readiness");
    expect(preview).toContain(".harnessSha == $harness");
    expect(preview).toContain("inputs.refresh_run_id == ''");
    expect(preview).toContain("--snapshot=artifacts/readiness/readiness.json");
    expect(preview).not.toContain(
      ".seed.buildId == $build and .seed.experienceSnapshotId == $snapshot or",
    );
  });

  test("uses the protected U8 runner contract and always preserves cleanup evidence", async () => {
    const acceptance = await readFile(fashionU8AcceptanceWorkflowPath, "utf8");
    expect(acceptance).toContain(
      "runs-on: [self-hosted, fashion-staging-preview, fashion-staging-u8]",
    );
    expect(acceptance).toContain("environment: fashion-staging");
    expect(acceptance).toContain("timeout-minutes: 30");
    expect(acceptance).toContain("permissions:\n  contents: read");
    expect(acceptance).toContain("if: ${{ always() }}");
    expect(acceptance).toContain("retention-days: 7");
    expect(acceptance).toContain("bun tools/run-fashion-staging-u8.ts");
    expect(acceptance).toContain("Start append-only U8 machine attempt");
    expect(acceptance).toContain("Preserve append-only U8 machine ledger");
    expect(acceptance).toContain("current-harness-manifest.json");
    expect(acceptance).toContain("FASHION_U12_ACCEPTANCE_TOKEN");
    expect(acceptance).toContain("FASHION_U8_ADMIN_SERVICE_TOKEN");
    expect(acceptance).toContain("artifacts/fashion-u8/terminal-report.json");
    expect(acceptance).toContain("artifacts/fashion-u8/deployed-build.json");
    expect(acceptance).toContain("successorArtifactDigest:$build[0].data.artifactDigest");
    expect(acceptance).not.toContain("vars.FASHION_U8_SUCCESSOR_ARTIFACT_DIGEST");
    expect(acceptance).toContain(".passed == true and .cleanup.passed == true");
    expect(acceptance).not.toContain("remote-proof-not-run");
    expect(acceptance).not.toContain("pull_request:");
    expect(acceptance).not.toMatch(/API_E2E_BASE_URL|\/catalog\/products\/\$\{?\w*slug/i);
  });
});

describe("storefront theme browser matrix", () => {
  test("keeps theme-only assertions out of the production fallback suite", async () => {
    const [production, fashionStore] = await Promise.all([
      readFile(storefrontPlaywrightPath, "utf8"),
      readFile(fashionStorePlaywrightPath, "utf8"),
    ]);
    const productionIgnore = production.match(/testIgnore:\s*\[([\s\S]*?)\],/)?.[1];

    expect(productionIgnore).toContain('"decor-theme.spec.ts"');
    expect(productionIgnore).toContain('"decor-motion.spec.ts"');
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
