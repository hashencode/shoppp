import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");
const ciWorkflowPath = resolve(import.meta.dir, "../.github/workflows/ci.yml");
const previewWorkflowPath = resolve(import.meta.dir, "../.github/workflows/preview-storefront.yml");
const fashionPreparationWorkflowPath = resolve(
  import.meta.dir,
  "../.github/workflows/prepare-fashion-staging-u12.yml",
);
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

describe("continuous integration workflow", () => {
  test("allows the complete release gate to finish without weakening it", async () => {
    const workflow = await readFile(ciWorkflowPath, "utf8");

    expect(workflow).toContain("timeout-minutes: 45");
    expect(workflow).toContain('bun run release:validate -- --release-id "ci-${GITHUB_SHA}"');
  });
});

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
    expect(workflow).toContain("runs-on: [self-hosted, fashion-staging-preview]");
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
    expect(workflow.split(secretReference)).toHaveLength(4);
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
    expect(workflow).toContain("FASHION_U12_STRIPE_SECRET_KEY");
    expect(workflow).toContain("sk_test_");
    expect(workflow).toContain("FASHION_U12_TURNSTILE_SECRET");
    expect(workflow).toContain("FASHION_U12_EMAIL_MODE");
    expect(workflow).toContain("playwright-report/");
    expect(workflow).toContain("test-results/");
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

    expect(workflow).toContain('test "$CONFIRMATION" = "PREPARE FASHION U12 $GITHUB_SHA"');
    expect(workflow).toContain('test "$GITHUB_REF" = "refs/heads/main"');
    expect(workflow).toContain("runner:");
    expect(workflow).toContain("default: ubuntu-latest");
    expect(workflow).toContain("- fashion-staging-preparation");
    expect(workflow).toContain("runs-on: ${{ inputs.runner }}");
    expect(workflow).not.toContain("GITHUB_REF_PROTECTED");
    expect(workflow).toContain("group: fashion-staging-preview");
    expect(workflow).toContain("FASHION_U12_CONFIRMATION: ${{ inputs.confirmation }}");
    expect(workflow).toContain('--confirmation="$FASHION_U12_CONFIRMATION"');
    expect(workflow).toContain("shoppp-fashion-staging --env fashion-staging --remote");
    expect(workflow).toContain('sqlite3 "$RESTORE_DB"');
    expect(workflow).toContain("PRAGMA foreign_key_check;");
    expect(workflow).toContain("PRAGMA integrity_check;");
    expect(workflow).not.toContain("PRAGMA foreign_keys=OFF");
    expect(workflow).toContain("FASHION_U12_MIGRATIONS:");
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
    expect(workflow).toContain("wrangler secret list --env fashion-staging --format json");
    expect(workflow).toContain("wrangler secret list --config wrangler.preview.jsonc");
    expect(workflow).toContain("--env fashion-staging --format json");
    expect(workflow).toContain('--command "$PREFLIGHT_SQL"');
    expect(workflow).toContain('--command "$VERIFY_SQL"');
    expect(workflow).not.toContain("--file=../../artifacts/fashion-u12/preflight.sql");
    expect(workflow).not.toContain("--file=../../artifacts/fashion-u12/verify.sql");
    expect(workflow).not.toContain("wrangler secret list --env fashion-staging --json");
    expect(workflow).not.toContain("wrangler secret put");
    expect(workflow).not.toContain("environment: staging\n");
    expect(workflow).not.toContain("environment: production\n");
    expect(credentialGate).toBeGreaterThan(0);
    expect(collisionGate).toBeGreaterThan(credentialGate);
    expect(seed).toBeGreaterThan(collisionGate);
    expect(immutable).toBeGreaterThan(seed);
    expect(readiness).toBeGreaterThan(immutable);
    expect(workflow).toContain("/snapshots/$SNAPSHOT_ID/build");
    expect(workflow).toContain("manualDispatch:true");
    expect(workflow).toContain("bun tools/verify-fashion-staging-readiness.ts");
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
