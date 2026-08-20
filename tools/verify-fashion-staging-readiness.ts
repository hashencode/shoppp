import { readFile } from "node:fs/promises";

const ACCOUNT_ID = "449e7f42fe4c4e55d5c674e2e7c57c8d";
const API_ORIGIN = "https://shoppp-api-fashion-staging.hashencode.workers.dev";
const PREVIEW_ORIGIN = "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";
const API_WORKER = "shoppp-api-fashion-staging";
const PREVIEW_WORKER = "shoppp-storefront-fashion-preview";
const D1_ID = "eb1ca4ef-3121-4d02-b20e-e619eac1cecc";
const D1_NAME = "shoppp-fashion-staging";

const REQUIRED_API_BINDINGS = ["CHECKOUT_RATE_LIMITER", "DB", "MEDIA", "PREVIEW_ARTIFACTS"];
const REQUIRED_API_SECRETS = [
  "FASHION_ACCEPTANCE_TOKEN",
  "PREVIEW_BUILD_CALLBACK_TOKEN",
  "PREVIEW_SERVICE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TURNSTILE_SECRET",
];
const REQUIRED_PREVIEW_BINDINGS = ["COMMERCE_API", "PREVIEW_ARTIFACTS", "PREVIEW_AUTH"];
const REQUIRED_PREVIEW_SECRETS = ["PREVIEW_AUTH_TOKEN"];
const REQUIRED_GITHUB_SECRETS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "FASHION_U12_ACCEPTANCE_TOKEN",
  "FASHION_U12_ADMIN_SERVICE_TOKEN",
  "FASHION_U12_GITHUB_ADMIN_TOKEN",
  "FASHION_U13_SERVICE_TOKEN",
  "PREVIEW_BUILD_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_TEST_CARD",
  "TURNSTILE_SECRET",
];
const REQUIRED_STRIPE_EVENTS = [
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
];
const REQUIRED_SCHEMA_TABLES = [
  "fashion_staging_acceptance_resources",
  "fashion_staging_acceptance_runs",
];

interface WorkerSnapshot {
  bindings: string[];
  name: string;
  rateLimits?: { limit: number; name: string; namespaceId: string; period: number }[];
  secrets: string[];
  variables?: Record<string, string>;
}

export interface FashionStagingReadinessSnapshot {
  capturedAt: string;
  commitSha: string;
  environment: string;
  cloudflare: {
    accountId: string;
    apiWorker: WorkerSnapshot;
    previewWorker: WorkerSnapshot;
    d1: {
      backup: {
        artifactName: string;
        createdAt: string;
        databaseId: string;
        runId: string;
        restoreVerifiedAt: string;
        sha256: string;
      };
      id: string;
      name: string;
      pendingMigrations: string[];
      schemaTables: string[];
    };
    r2Buckets: { name: string; publicAccess: boolean }[];
  };
  github: {
    environment: string;
    operatorGate: {
      actor: string;
      authorityBaselineSha: string;
      authorityScope: string;
      authorizationMode: string;
      concurrencyGroup: string;
      eventName: string;
      ref: string;
      runAttempt: number;
      runId: string;
      workflow: string;
    };
    secrets: string[];
    variables: Record<string, string>;
  };
  providers: {
    emailMode: string;
    stripe: {
      accountId: string;
      enabledEvents: string[];
      livemode: boolean;
      webhookEnabled: boolean;
      webhookUrl: string;
    };
    turnstile: {
      hostname: string;
      secretConfigured: boolean;
      siteKey: string;
      testMode: boolean;
    };
  };
  seed: {
    buildId: string;
    buildStatus: string;
    canonicalCatalogDigest: string;
    catalogReleaseId: string;
    experienceSnapshotId: string;
    products: {
      availableVariantCount: number;
      id: string;
      variantCount: number;
    }[];
    seedManifestDigest: string;
    selectedVariantId: string;
    warehouseId: string;
  };
}

export interface FashionStagingReadinessResult {
  buildId: string;
  catalogReleaseId: string;
  environment: "fashion-staging";
  experienceSnapshotId: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function missing(actual: string[], required: string[]): string[] {
  const present = new Set(actual);
  return required.filter((name) => !present.has(name));
}

function requireNames(actual: string[], required: string[], label: string): void {
  const absent = missing(actual, required);
  assert(absent.length === 0, `${label}: ${absent.join(", ")}`);
}

function exactOrigin(value: string, label: string): URL {
  const url = new URL(value);
  assert(
    url.protocol === "https:" && url.origin === value && !url.username && !url.password,
    `${label} must be one exact credential-free HTTPS origin`,
  );
  return url;
}

function stableIdentifier(value: string, label: string): void {
  assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value), `${label} is not a stable identifier`);
}

function digest(value: string, label: string): void {
  assert(/^[a-f0-9]{64}$/.test(value), `${label} must be one SHA-256 digest`);
}

export function assertFashionStagingReadiness(
  snapshot: FashionStagingReadinessSnapshot,
  now = new Date(),
): FashionStagingReadinessResult {
  assert(
    snapshot.environment === "fashion-staging",
    "Readiness environment must be fashion-staging",
  );
  assert(/^[a-f0-9]{40}$/.test(snapshot.commitSha), "Readiness commit SHA is invalid");
  const snapshotCapturedAt = Date.parse(snapshot.capturedAt);
  assert(
    Number.isFinite(snapshotCapturedAt) &&
      now.getTime() >= snapshotCapturedAt &&
      now.getTime() - snapshotCapturedAt <= 24 * 60 * 60 * 1_000,
    "Fashion readiness snapshot must be newer than 24 hours",
  );
  assert(snapshot.cloudflare.accountId === ACCOUNT_ID, "Cloudflare account identity is incorrect");
  assert(
    snapshot.cloudflare.apiWorker.name === API_WORKER,
    "Fashion API Worker identity is incorrect",
  );
  assert(
    snapshot.cloudflare.previewWorker.name === PREVIEW_WORKER,
    "Fashion Preview Worker identity is incorrect",
  );
  requireNames(
    snapshot.cloudflare.apiWorker.bindings,
    REQUIRED_API_BINDINGS,
    "API Worker is missing required bindings",
  );
  requireNames(
    snapshot.cloudflare.apiWorker.secrets,
    REQUIRED_API_SECRETS,
    "API Worker is missing required secrets",
  );
  const checkoutLimit = snapshot.cloudflare.apiWorker.rateLimits?.find(
    ({ name }) => name === "CHECKOUT_RATE_LIMITER",
  );
  assert(
    checkoutLimit?.namespaceId === "14001" &&
      checkoutLimit.limit === 10 &&
      checkoutLimit.period === 60,
    "Fashion API Worker checkout rate limit is not the dedicated 10/minute profile",
  );
  const workerVariables = snapshot.cloudflare.apiWorker.variables ?? {};
  assert(
    workerVariables.ENVIRONMENT === "staging" &&
      workerVariables.RESOURCE_NAMESPACE === "shoppp-fashion-staging",
    "Fashion API Worker runtime namespace is incorrect",
  );
  assert(
    workerVariables.TURNSTILE_REQUIRED === "true" &&
      workerVariables.TURNSTILE_TEST_MODE === "true" &&
      workerVariables.TURNSTILE_SITE_KEY === "1x00000000000000000000AA" &&
      workerVariables.TURNSTILE_HOSTNAMES === new URL(PREVIEW_ORIGIN).hostname,
    "Fashion API Worker Turnstile profile is incorrect",
  );
  assert(
    workerVariables.PAYMENT_CANCEL_URL === `${PREVIEW_ORIGIN}/checkout/complete?return=canceled` &&
      workerVariables.PAYMENT_SUCCESS_URL ===
        `${PREVIEW_ORIGIN}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    "Fashion API Worker payment return targets are incorrect",
  );
  requireNames(
    snapshot.cloudflare.previewWorker.bindings,
    REQUIRED_PREVIEW_BINDINGS,
    "Preview Worker is missing required bindings",
  );
  requireNames(
    snapshot.cloudflare.previewWorker.secrets,
    REQUIRED_PREVIEW_SECRETS,
    "Preview Worker is missing required secrets",
  );

  const { d1 } = snapshot.cloudflare;
  assert(d1.id === D1_ID && d1.name === D1_NAME, "Fashion D1 identity is incorrect");
  assert(
    d1.pendingMigrations.length === 0,
    `Fashion D1 has pending D1 migrations: ${d1.pendingMigrations.join(", ")}`,
  );
  requireNames(d1.schemaTables, REQUIRED_SCHEMA_TABLES, "Fashion D1 is missing schema tables");
  assert(d1.backup.databaseId === D1_ID, "Fashion D1 backup targets the wrong database");
  digest(d1.backup.sha256, "Fashion D1 backup digest");
  assert(
    /^fashion-u12-d1-backup-[a-f0-9]{40}$/.test(d1.backup.artifactName),
    "Fashion D1 backup artifact name is outside its namespace",
  );
  stableIdentifier(d1.backup.runId, "Fashion D1 backup run ID");
  const createdAt = Date.parse(d1.backup.createdAt);
  const restoreVerifiedAt = Date.parse(d1.backup.restoreVerifiedAt);
  assert(
    Number.isFinite(createdAt) &&
      Number.isFinite(restoreVerifiedAt) &&
      restoreVerifiedAt >= createdAt &&
      now.getTime() - restoreVerifiedAt <= 24 * 60 * 60 * 1_000,
    "Fashion D1 backup and restore proof must be newer than 24 hours",
  );

  const buckets = new Map(snapshot.cloudflare.r2Buckets.map((bucket) => [bucket.name, bucket]));
  assert(
    buckets.get("shoppp-fashion-staging-media")?.publicAccess === true,
    "Fashion media bucket public access does not match its declared origin",
  );
  assert(
    buckets.get("shoppp-fashion-staging-preview-artifacts")?.publicAccess === false,
    "Fashion preview artifact bucket must remain private",
  );

  assert(
    snapshot.github.environment === "fashion-staging",
    "GitHub environment is not Fashion staging",
  );
  const { operatorGate } = snapshot.github;
  assert(
    operatorGate.authorizationMode === "single-operator-standing-scope",
    "Fashion single-operator authorization mode is incorrect",
  );
  assert(
    operatorGate.eventName === "workflow_dispatch",
    "Fashion single-operator gate requires a manual workflow dispatch",
  );
  assert(
    operatorGate.authorityBaselineSha === "79fbee07f60245b036b5a4d42858227502947a5c",
    "Fashion standing authority baseline is incorrect",
  );
  assert(operatorGate.authorityScope === "FS-U12", "Fashion standing authority scope is incorrect");
  assert(
    operatorGate.ref === "refs/heads/main",
    "Fashion single-operator gate requires the exact default branch ref",
  );
  assert(
    operatorGate.concurrencyGroup === "fashion-staging-preview",
    "Fashion single-operator gate must use the governed concurrency group",
  );
  assert(
    operatorGate.workflow === "Prepare governed Fashion staging U12 inputs",
    "Fashion single-operator gate used the wrong workflow",
  );
  stableIdentifier(operatorGate.actor, "Fashion single-operator actor");
  stableIdentifier(operatorGate.runId, "Fashion single-operator run ID");
  assert(
    Number.isSafeInteger(operatorGate.runAttempt) && operatorGate.runAttempt >= 1,
    "Fashion single-operator run attempt is invalid",
  );
  requireNames(
    snapshot.github.secrets,
    REQUIRED_GITHUB_SECRETS,
    "GitHub environment is missing required secrets",
  );

  const variables = snapshot.github.variables;
  assert(variables.PREVIEW_API_URL === API_ORIGIN, "PREVIEW_API_URL must target the Fashion API");
  assert(
    variables.PREVIEW_ORIGIN === PREVIEW_ORIGIN,
    "PREVIEW_ORIGIN must target the private Worker",
  );
  exactOrigin(variables.PREVIEW_HANDOFF_ORIGIN ?? "", "PREVIEW_HANDOFF_ORIGIN");
  assert(variables.FASHION_U13_CURRENCY === "USD", "Fashion acceptance currency must be USD");
  assert(
    new Set(["sandbox", "suppressed"]).has(variables.FASHION_U12_EMAIL_MODE ?? ""),
    "Fashion email mode must be sandbox or suppressed",
  );

  const stripe = snapshot.providers.stripe;
  assert(!stripe.livemode, "Fashion Stripe must be in sandbox mode");
  assert(
    /^acct_[A-Za-z0-9_]+$/.test(stripe.accountId),
    "Fashion Stripe account identity is invalid",
  );
  assert(stripe.webhookEnabled, "Fashion Stripe webhook must be enabled");
  assert(
    stripe.webhookUrl === `${API_ORIGIN}/webhooks/stripe`,
    "Fashion Stripe webhook must target the Fashion API",
  );
  const missingEvents = missing(stripe.enabledEvents, REQUIRED_STRIPE_EVENTS);
  assert(
    missingEvents.length === 0,
    `Fashion Stripe webhook is missing required events: ${missingEvents.join(", ")}`,
  );

  const turnstile = snapshot.providers.turnstile;
  assert(turnstile.testMode, "Fashion Turnstile must use test mode");
  assert(turnstile.secretConfigured, "Fashion Turnstile server secret is not configured");
  assert(
    turnstile.hostname === new URL(PREVIEW_ORIGIN).hostname,
    "Fashion Turnstile hostname must match the private Preview origin",
  );
  assert(
    turnstile.siteKey.length >= 20 && turnstile.siteKey === variables.TURNSTILE_SITE_KEY,
    "Fashion Turnstile site key is missing or mismatched",
  );
  assert(
    snapshot.providers.emailMode === variables.FASHION_U12_EMAIL_MODE,
    "Fashion email provider mode does not match the protected environment",
  );

  const seed = snapshot.seed;
  stableIdentifier(seed.catalogReleaseId, "Catalog Release ID");
  stableIdentifier(seed.experienceSnapshotId, "Experience Snapshot ID");
  stableIdentifier(seed.buildId, "Preview build ID");
  stableIdentifier(seed.selectedVariantId, "Selected variant ID");
  stableIdentifier(seed.warehouseId, "Warehouse ID");
  digest(seed.canonicalCatalogDigest, "Canonical Catalog digest");
  digest(seed.seedManifestDigest, "Seed manifest digest");
  assert(seed.buildStatus === "building", "Fashion immutable build must be in building state");
  assert(
    seed.products.length === 3 && new Set(seed.products.map(({ id }) => id)).size === 3,
    "Fashion seed must contain exactly three distinct product archetypes",
  );
  const single = seed.products.find(
    ({ availableVariantCount, variantCount }) => variantCount === 1 && availableVariantCount === 1,
  );
  const multiple = seed.products.find(
    ({ availableVariantCount, variantCount }) => variantCount > 1 && availableVariantCount > 0,
  );
  const unavailable = seed.products.find(
    ({ availableVariantCount, variantCount }) => variantCount > 0 && availableVariantCount === 0,
  );
  assert(single && multiple && unavailable, "Fashion seed does not prove all three archetypes");
  assert(
    variables.FASHION_U12_SINGLE_VARIANT_PRODUCT_ID === single.id &&
      variables.FASHION_U13_PRODUCT_ID === single.id,
    "Fashion single-variant variables must match the seed",
  );
  assert(
    variables.FASHION_U12_MULTI_VARIANT_PRODUCT_ID === multiple.id,
    "FASHION_U12_MULTI_VARIANT_PRODUCT_ID must match the seed",
  );
  assert(
    variables.FASHION_U12_UNAVAILABLE_PRODUCT_ID === unavailable.id,
    "FASHION_U12_UNAVAILABLE_PRODUCT_ID must match the seed",
  );
  assert(
    variables.FASHION_U12_WAREHOUSE_ID === seed.warehouseId,
    "FASHION_U12_WAREHOUSE_ID must match the seed",
  );
  assert(
    variables.FASHION_U13_VARIANT_ID === seed.selectedVariantId,
    "FASHION_U13_VARIANT_ID must match the seed",
  );
  const optionValues = JSON.parse(variables.FASHION_U12_OPTION_VALUES ?? "null") as unknown;
  assert(
    Array.isArray(optionValues) &&
      optionValues.length >= 2 &&
      optionValues.every((value) => typeof value === "string" && value.length > 0),
    "FASHION_U12_OPTION_VALUES must select the multi-variant product",
  );

  return {
    buildId: seed.buildId,
    catalogReleaseId: seed.catalogReleaseId,
    environment: "fashion-staging",
    experienceSnapshotId: seed.experienceSnapshotId,
  };
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .slice(2)
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`Use --${name}=<path>`);
  return value;
}

if (import.meta.main) {
  const snapshot = JSON.parse(
    await readFile(argument("snapshot"), "utf8"),
  ) as FashionStagingReadinessSnapshot;
  console.log(JSON.stringify(assertFashionStagingReadiness(snapshot)));
}
