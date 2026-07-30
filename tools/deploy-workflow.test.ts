import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const workflowPath = resolve(import.meta.dir, "../.github/workflows/deploy.yml");
const previewWorkflowPath = resolve(import.meta.dir, "../.github/workflows/preview-storefront.yml");
const storefrontPlaywrightPath = resolve(
  import.meta.dir,
  "../apps/storefront/playwright.config.ts",
);
const fashionPlaywrightPath = resolve(
  import.meta.dir,
  "../apps/storefront/playwright.fashion.config.ts",
);
const decorPlaywrightPath = resolve(
  import.meta.dir,
  "../apps/storefront/playwright.decor.config.ts",
);
const architecturePath = resolve(
  import.meta.dir,
  "../docs/architecture/storefront-theme-platform.md",
);
const fidelityRunbookPath = resolve(import.meta.dir, "../docs/runbooks/storefront-preview.md");

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
    const [production, fashion, decor] = await Promise.all([
      readFile(storefrontPlaywrightPath, "utf8"),
      readFile(fashionPlaywrightPath, "utf8"),
      readFile(decorPlaywrightPath, "utf8"),
    ]);
    const productionIgnore = production.match(/testIgnore:\s*\[([\s\S]*?)\],/)?.[1];

    expect(productionIgnore).toContain('"decor-theme.spec.ts"');
    expect(productionIgnore).toContain('"fashion-theme.spec.ts"');
    expect(fashion).toContain('testMatch: "fashion-theme.spec.ts"');
    expect(decor).toContain('testMatch: "decor-theme.spec.ts"');
  });

  test("keeps fidelity evidence scoped to home and requires explicit review", async () => {
    const [fashion, decor, architecture, runbook] = await Promise.all([
      readFile(fashionPlaywrightPath, "utf8"),
      readFile(decorPlaywrightPath, "utf8"),
      readFile(architecturePath, "utf8"),
      readFile(fidelityRunbookPath, "utf8"),
    ]);

    expect(fashion).toContain("width: 768");
    expect(decor).toContain("width: 768");
    expect(architecture).toContain("reference-fidelity scope is the home template only");
    expect(runbook).toMatch(/does not activate a\s+production theme/);
    expect(runbook).toContain("Do not create `approval.json`");
  });
});
