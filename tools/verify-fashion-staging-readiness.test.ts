import { describe, expect, test } from "bun:test";

import {
  assertFashionStagingReadiness,
  type FashionStagingReadinessSnapshot,
} from "./verify-fashion-staging-readiness";

function snapshot(): FashionStagingReadinessSnapshot {
  const now = Date.now();
  return {
    capturedAt: new Date(now).toISOString(),
    commitSha: "d".repeat(40),
    environment: "fashion-staging",
    cloudflare: {
      accountId: "449e7f42fe4c4e55d5c674e2e7c57c8d",
      apiWorker: {
        bindings: ["CHECKOUT_RATE_LIMITER", "DB", "MEDIA", "PREVIEW_ARTIFACTS"],
        name: "shoppp-api-fashion-staging",
        rateLimits: [
          { limit: 10, name: "CHECKOUT_RATE_LIMITER", namespaceId: "14001", period: 60 },
        ],
        secrets: [
          "FASHION_ACCEPTANCE_TOKEN",
          "PREVIEW_BUILD_CALLBACK_TOKEN",
          "PREVIEW_SERVICE_TOKEN",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "TURNSTILE_SECRET",
        ],
        variables: {
          ENVIRONMENT: "staging",
          PAYMENT_CANCEL_URL:
            "https://shoppp-storefront-fashion-preview.hashencode.workers.dev/checkout/complete?return=canceled",
          PAYMENT_SUCCESS_URL:
            "https://shoppp-storefront-fashion-preview.hashencode.workers.dev/checkout/complete?session_id={CHECKOUT_SESSION_ID}",
          RESOURCE_NAMESPACE: "shoppp-fashion-staging",
          TURNSTILE_HOSTNAMES: "shoppp-storefront-fashion-preview.hashencode.workers.dev",
          TURNSTILE_REQUIRED: "true",
          TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
          TURNSTILE_TEST_MODE: "true",
        },
      },
      previewWorker: {
        bindings: ["COMMERCE_API", "PREVIEW_ARTIFACTS", "PREVIEW_AUTH"],
        name: "shoppp-storefront-fashion-preview",
        secrets: ["PREVIEW_AUTH_TOKEN"],
      },
      d1: {
        backup: {
          artifactName: `fashion-u12-d1-backup-${"d".repeat(40)}`,
          createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
          databaseId: "eb1ca4ef-3121-4d02-b20e-e619eac1cecc",
          runId: "123456789",
          restoreVerifiedAt: new Date(now - 15 * 60 * 1000).toISOString(),
          sha256: "a".repeat(64),
        },
        id: "eb1ca4ef-3121-4d02-b20e-e619eac1cecc",
        name: "shoppp-fashion-staging",
        pendingMigrations: [],
        schemaTables: ["fashion_staging_acceptance_resources", "fashion_staging_acceptance_runs"],
      },
      r2Buckets: [
        { name: "shoppp-fashion-staging-media", publicAccess: true },
        { name: "shoppp-fashion-staging-preview-artifacts", publicAccess: false },
      ],
    },
    github: {
      environment: "fashion-staging",
      operatorGate: {
        actor: "studio",
        authorityBaselineSha: "79fbee07f60245b036b5a4d42858227502947a5c",
        authorityScope: "FS-U12",
        authorizationMode: "single-operator-standing-scope",
        concurrencyGroup: "fashion-staging-preview",
        eventName: "workflow_dispatch",
        ref: "refs/heads/main",
        runAttempt: 1,
        runId: "123456789",
        workflow: "Prepare governed Fashion staging U12 inputs",
      },
      secrets: [
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "FASHION_U12_ACCEPTANCE_TOKEN",
        "FASHION_U12_ADMIN_SERVICE_TOKEN",
        "FASHION_U12_GITHUB_ADMIN_TOKEN",
        "FASHION_U13_SERVICE_TOKEN",
        "PREVIEW_BUILD_TOKEN",
        "STRIPE_SECRET_KEY",
        "TURNSTILE_SECRET",
      ],
      variables: {
        FASHION_U12_EMAIL_MODE: "suppressed",
        FASHION_U12_MULTI_VARIANT_PRODUCT_ID: "prod_fashion_u12_multi",
        FASHION_U12_OPTION_VALUES: '["Gold","S"]',
        FASHION_U12_PRODUCT_NAME: "Atlas Carry-on",
        FASHION_U12_PRODUCT_SLUG: "atlas-carry-on",
        FASHION_U12_SINGLE_VARIANT_PRODUCT_ID: "prod_fashion_u12_single",
        FASHION_U12_UNAVAILABLE_PRODUCT_ID: "prod_fashion_u12_unavailable",
        FASHION_U12_WAREHOUSE_ID: "warehouse_fashion_staging",
        FASHION_U13_CURRENCY: "USD",
        FASHION_U13_PRODUCT_ID: "prod_fashion_u12_single",
        FASHION_U13_VARIANT_ID: "var_fashion_u12_single",
        PREVIEW_API_URL: "https://shoppp-api-fashion-staging.hashencode.workers.dev",
        PREVIEW_HANDOFF_ORIGIN: "https://shoppp-admin-staging.hashencode.workers.dev",
        PREVIEW_ORIGIN: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
        TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      },
    },
    providers: {
      emailMode: "suppressed",
      stripe: {
        accountId: "acct_test_fashion_u12",
        enabledEvents: [
          "checkout.session.async_payment_failed",
          "checkout.session.async_payment_succeeded",
          "checkout.session.completed",
          "checkout.session.expired",
        ],
        livemode: false,
        webhookEnabled: true,
        webhookUrl: "https://shoppp-api-fashion-staging.hashencode.workers.dev/webhooks/stripe",
      },
      turnstile: {
        hostname: "shoppp-storefront-fashion-preview.hashencode.workers.dev",
        secretConfigured: true,
        siteKey: "1x00000000000000000000AA",
        testMode: true,
      },
    },
    seed: {
      buildId: "preview-build-fashion-u12-1",
      buildStatus: "building",
      canonicalCatalogDigest: "b".repeat(64),
      catalogReleaseId: "fashion-u12-release-2026-08-18",
      experienceSnapshotId: "snapshot-fashion-u12-1",
      products: [
        { availableVariantCount: 1, id: "prod_fashion_u12_single", variantCount: 1 },
        { availableVariantCount: 2, id: "prod_fashion_u12_multi", variantCount: 2 },
        { availableVariantCount: 0, id: "prod_fashion_u12_unavailable", variantCount: 1 },
      ],
      selectedVariantId: "var_fashion_u12_single",
      seedManifestDigest: "c".repeat(64),
      warehouseId: "warehouse_fashion_staging",
    },
  };
}

describe("Fashion staging deployment readiness", () => {
  test("accepts one exact default-branch and immutable Fashion deployment profile", () => {
    expect(assertFashionStagingReadiness(snapshot())).toEqual({
      buildId: "preview-build-fashion-u12-1",
      catalogReleaseId: "fashion-u12-release-2026-08-18",
      environment: "fashion-staging",
      experienceSnapshotId: "snapshot-fashion-u12-1",
    });
  });

  test("rejects unapplied migrations or an unverified backup", () => {
    const pending = snapshot();
    pending.cloudflare.d1.pendingMigrations = ["0020_fashion_staging_acceptance.sql"];
    expect(() => assertFashionStagingReadiness(pending)).toThrow(/pending D1 migrations/);

    const stale = snapshot();
    stale.capturedAt = "2026-08-18T02:00:00.000Z";
    stale.cloudflare.d1.backup.restoreVerifiedAt = "2026-08-16T01:00:00.000Z";
    expect(() =>
      assertFashionStagingReadiness(stale, new Date("2026-08-18T02:00:00.000Z")),
    ).toThrow(/backup and restore proof must be newer than 24 hours/);
  });

  test("rejects missing Worker or protected-environment credentials", () => {
    const worker = snapshot();
    worker.cloudflare.apiWorker.secrets = worker.cloudflare.apiWorker.secrets.filter(
      (name) => name !== "STRIPE_WEBHOOK_SECRET",
    );
    expect(() => assertFashionStagingReadiness(worker)).toThrow(
      /API Worker is missing required secrets: STRIPE_WEBHOOK_SECRET/,
    );

    const github = snapshot();
    github.github.secrets = github.github.secrets.filter(
      (name) => name !== "FASHION_U12_ACCEPTANCE_TOKEN",
    );
    expect(() => assertFashionStagingReadiness(github)).toThrow(
      /GitHub environment is missing required secrets: FASHION_U12_ACCEPTANCE_TOKEN/,
    );

    const sharedRateLimit = snapshot();
    sharedRateLimit.cloudflare.apiWorker.rateLimits![0]!.namespaceId = "12001";
    expect(() => assertFashionStagingReadiness(sharedRateLimit)).toThrow(
      /checkout rate limit is not the dedicated 10\/minute profile/,
    );

    const disabledTurnstile = snapshot();
    disabledTurnstile.cloudflare.apiWorker.variables!.TURNSTILE_REQUIRED = "false";
    expect(() => assertFashionStagingReadiness(disabledTurnstile)).toThrow(
      /Worker Turnstile profile is incorrect/,
    );
  });

  test("rejects live Stripe, the wrong webhook, or an incomplete event set", () => {
    const live = snapshot();
    live.providers.stripe.livemode = true;
    expect(() => assertFashionStagingReadiness(live)).toThrow(/Stripe must be in sandbox mode/);

    const wrongOrigin = snapshot();
    wrongOrigin.providers.stripe.webhookUrl = "https://api.example.com/webhooks/stripe";
    expect(() => assertFashionStagingReadiness(wrongOrigin)).toThrow(
      /Stripe webhook must target the Fashion API/,
    );

    const missingEvent = snapshot();
    missingEvent.providers.stripe.enabledEvents.pop();
    expect(() => assertFashionStagingReadiness(missingEvent)).toThrow(
      /Stripe webhook is missing required events/,
    );
  });

  test("rejects missing, overlapping, or mutable archetype inputs", () => {
    const missing = snapshot();
    missing.seed.products.pop();
    expect(() => assertFashionStagingReadiness(missing)).toThrow(
      /exactly three distinct product archetypes/,
    );

    const overlap = snapshot();
    overlap.seed.products[2]!.id = overlap.seed.products[1]!.id;
    expect(() => assertFashionStagingReadiness(overlap)).toThrow(
      /exactly three distinct product archetypes/,
    );

    const deployed = snapshot();
    deployed.seed.buildStatus = "deployed";
    expect(() => assertFashionStagingReadiness(deployed)).toThrow(
      /immutable build must be in building state/,
    );
  });

  test("rejects an incomplete single-operator gate or mismatched variables", () => {
    const wrongRef = snapshot();
    wrongRef.github.operatorGate.ref = "refs/heads/codex/feat-fashion-store-functional-integration";
    expect(() => assertFashionStagingReadiness(wrongRef)).toThrow(
      /single-operator gate requires the exact default branch ref/,
    );

    const wrongBaseline = snapshot();
    wrongBaseline.github.operatorGate.authorityBaselineSha = "e".repeat(40);
    expect(() => assertFashionStagingReadiness(wrongBaseline)).toThrow(
      /standing authority baseline is incorrect/,
    );

    const wrongScope = snapshot();
    wrongScope.github.operatorGate.authorityScope = "FS-U8";
    expect(() => assertFashionStagingReadiness(wrongScope)).toThrow(
      /standing authority scope is incorrect/,
    );

    const wrongEvent = snapshot();
    wrongEvent.github.operatorGate.eventName = "push";
    expect(() => assertFashionStagingReadiness(wrongEvent)).toThrow(
      /requires a manual workflow dispatch/,
    );

    const wrongConcurrency = snapshot();
    wrongConcurrency.github.operatorGate.concurrencyGroup = "fashion-preview-other";
    expect(() => assertFashionStagingReadiness(wrongConcurrency)).toThrow(
      /must use the governed concurrency group/,
    );

    const wrongWorkflow = snapshot();
    wrongWorkflow.github.operatorGate.workflow = "Preview Storefront";
    expect(() => assertFashionStagingReadiness(wrongWorkflow)).toThrow(/used the wrong workflow/);

    const invalidAttempt = snapshot();
    invalidAttempt.github.operatorGate.runAttempt = 0;
    expect(() => assertFashionStagingReadiness(invalidAttempt)).toThrow(/run attempt is invalid/);

    const mismatched = snapshot();
    mismatched.github.variables.FASHION_U12_WAREHOUSE_ID = "other-warehouse";
    expect(() => assertFashionStagingReadiness(mismatched)).toThrow(
      /FASHION_U12_WAREHOUSE_ID must match the seed/,
    );
  });
});
