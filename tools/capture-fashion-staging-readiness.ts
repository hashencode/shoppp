import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { FashionStagingReadinessSnapshot } from "./verify-fashion-staging-readiness";

type JsonObject = Record<string, unknown>;

const ACCOUNT_ID = "449e7f42fe4c4e55d5c674e2e7c57c8d";
const D1_ID = "eb1ca4ef-3121-4d02-b20e-e619eac1cecc";
const API_WORKER = "shoppp-api-fashion-staging";
const PREVIEW_WORKER = "shoppp-storefront-fashion-preview";
const PREVIEW_ORIGIN = "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to capture readiness`);
  return value;
}

async function jsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .slice(2)
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`Use --${name}=<value>`);
  return value;
}

async function apiJson(
  url: string,
  token: string,
  vendor: "cloudflare" | "github",
): Promise<JsonObject> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(vendor === "github"
        ? { "User-Agent": "shoppp-fashion-u12-readiness", "X-GitHub-Api-Version": "2022-11-28" }
        : {}),
    },
  });
  if (!response.ok)
    throw new Error(`${vendor} readiness query failed with HTTP ${response.status}`);
  return (await response.json()) as JsonObject;
}

function objects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (!value || typeof value !== "object") return [];
  const object = value as JsonObject;
  return [object, ...Object.values(object).flatMap(objects)];
}

export function pendingFashionMigrationNames(value: unknown): string[] {
  return [
    ...new Set(
      objects(value)
        .filter(
          (entry) =>
            typeof entry.name === "string" &&
            entry.name.endsWith(".sql") &&
            (entry.applied_at === null || entry.applied === false || entry.status === "pending"),
        )
        .map(({ name }) => name as string),
    ),
  ].sort();
}

function resultRows(value: unknown): JsonObject[] {
  return objects(value)
    .filter((entry) => Array.isArray(entry.results))
    .flatMap((entry) => entry.results as JsonObject[]);
}

function bindingProfile(settings: JsonObject): {
  bindings: string[];
  rateLimits: { limit: number; name: string; namespaceId: string; period: number }[];
  secrets: string[];
  variables: Record<string, string>;
} {
  const result = settings.result as JsonObject | undefined;
  const bindings = Array.isArray(result?.bindings) ? (result.bindings as JsonObject[]) : [];
  return {
    bindings: bindings
      .filter(({ type }) => type !== "secret_text")
      .map(({ name }) => String(name))
      .sort(),
    secrets: bindings
      .filter(({ type }) => type === "secret_text")
      .map(({ name }) => String(name))
      .sort(),
    rateLimits: bindings
      .filter(({ type }) => type === "ratelimit")
      .map((binding) => {
        const simple = (binding.simple ?? {}) as JsonObject;
        return {
          limit: number(simple.limit, `${String(binding.name)} limit`),
          name: String(binding.name),
          namespaceId: String(binding.namespace_id),
          period: number(simple.period, `${String(binding.name)} period`),
        };
      }),
    variables: Object.fromEntries(
      bindings
        .filter(({ type }) => type === "plain_text")
        .map(({ name, text }) => [String(name), String(text)]),
    ),
  };
}

function names(value: JsonObject, key: "secrets" | "variables"): string[] {
  const entries = Array.isArray(value[key]) ? (value[key] as JsonObject[]) : [];
  return entries.map(({ name }) => String(name)).sort();
}

function variables(value: JsonObject): Record<string, string> {
  const entries = Array.isArray(value.variables) ? (value.variables as JsonObject[]) : [];
  return Object.fromEntries(entries.map(({ name, value }) => [String(name), String(value)]));
}

function number(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not numeric`);
  return parsed;
}

if (import.meta.main) {
  const inputDirectory = resolve(argument("input-dir"));
  const output = resolve(argument("output"));
  const commitSha = argument("commit-sha");
  const confirmation = argument("confirmation");
  const repository = argument("repository");
  const cloudflareToken = required("CLOUDFLARE_API_TOKEN");
  const githubToken = required("GH_TOKEN");
  const cloudflare = (path: string) =>
    apiJson(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${path}`,
      cloudflareToken,
      "cloudflare",
    );
  const github = (path: string) =>
    apiJson(`https://api.github.com/repos/${repository}${path}`, githubToken, "github");

  const [
    apiSettings,
    previewSettings,
    mediaDomain,
    previewDomain,
    githubEnvironment,
    githubSecrets,
    githubVariables,
    backup,
    buildEnvelope,
    catalogRelease,
    migrations,
    schemaTablesRaw,
    seedReceipt,
    seedVerificationRaw,
    snapshotEnvelope,
    stripeAccount,
    stripeWebhooks,
  ] = await Promise.all([
    cloudflare(`/workers/scripts/${API_WORKER}/settings`),
    cloudflare(`/workers/scripts/${PREVIEW_WORKER}/settings`),
    cloudflare("/r2/buckets/shoppp-fashion-staging-media/domains/managed"),
    cloudflare("/r2/buckets/shoppp-fashion-staging-preview-artifacts/domains/managed"),
    github("/environments/fashion-staging"),
    github("/environments/fashion-staging/secrets?per_page=100"),
    github("/environments/fashion-staging/variables?per_page=100"),
    jsonFile<JsonObject>(resolve(inputDirectory, "backup-receipt.json")),
    jsonFile<{ data: JsonObject }>(resolve(inputDirectory, "build.json")),
    jsonFile<{ products: Array<{ id: string; variants: unknown[] }> }>(
      resolve(inputDirectory, "catalog-release.json"),
    ),
    jsonFile<unknown>(resolve(inputDirectory, "migrations-after.json")),
    jsonFile<unknown>(resolve(inputDirectory, "schema-tables.json")),
    jsonFile<JsonObject>(resolve(inputDirectory, "seed-receipt.json")),
    jsonFile<unknown>(resolve(inputDirectory, "seed-verification.json")),
    jsonFile<{ data: JsonObject }>(resolve(inputDirectory, "snapshot.json")),
    jsonFile<JsonObject>(resolve(inputDirectory, "stripe-account.json")),
    jsonFile<JsonObject>(resolve(inputDirectory, "stripe-webhooks.json")),
  ]);
  const workerApi = bindingProfile(apiSettings);
  const workerPreview = bindingProfile(previewSettings);
  const protectedVariables = variables(githubVariables);
  const verification = resultRows(seedVerificationRaw)[0];
  if (!verification) throw new Error("Fashion seed verification returned no row");
  const stripeEndpoints = Array.isArray(stripeWebhooks.data)
    ? (stripeWebhooks.data as JsonObject[])
    : [];
  const webhookUrl = "https://shoppp-api-fashion-staging.hashencode.workers.dev/webhooks/stripe";
  const webhook = stripeEndpoints.find(({ url }) => url === webhookUrl);
  if (!webhook) throw new Error("The exact Fashion Stripe webhook was not returned");
  const build = buildEnvelope.data;
  const immutableSnapshot = snapshotEnvelope.data;
  const productsById = new Map(catalogRelease.products.map((product) => [product.id, product]));
  const singleId = protectedVariables.FASHION_U12_SINGLE_VARIANT_PRODUCT_ID ?? "";
  const multiId = protectedVariables.FASHION_U12_MULTI_VARIANT_PRODUCT_ID ?? "";
  const unavailableId = protectedVariables.FASHION_U12_UNAVAILABLE_PRODUCT_ID ?? "";
  const product = (id: string, available: number) => ({
    availableVariantCount: available,
    id,
    variantCount: productsById.get(id)?.variants.length ?? 0,
  });
  const schemaTables = resultRows(schemaTablesRaw).map(({ name }) => String(name));
  const managedEnabled = (response: JsonObject) =>
    Boolean((response.result as JsonObject | undefined)?.enabled);

  const readiness: FashionStagingReadinessSnapshot = {
    capturedAt: new Date().toISOString(),
    commitSha,
    environment: "fashion-staging",
    cloudflare: {
      accountId: ACCOUNT_ID,
      apiWorker: { ...workerApi, name: API_WORKER },
      previewWorker: { ...workerPreview, name: PREVIEW_WORKER },
      d1: {
        backup: {
          artifactName: String(backup.artifactName),
          createdAt: String(backup.createdAt),
          databaseId: String(backup.databaseId),
          restoreVerifiedAt: String(backup.restoreVerifiedAt),
          runId: String(backup.runId),
          sha256: String(backup.sha256),
        },
        id: D1_ID,
        name: "shoppp-fashion-staging",
        pendingMigrations: pendingFashionMigrationNames(migrations),
        schemaTables,
      },
      r2Buckets: [
        { name: "shoppp-fashion-staging-media", publicAccess: managedEnabled(mediaDomain) },
        {
          name: "shoppp-fashion-staging-preview-artifacts",
          publicAccess: managedEnabled(previewDomain),
        },
      ],
    },
    github: {
      environment: String(githubEnvironment.name),
      operatorGate: {
        actor: required("GITHUB_ACTOR"),
        authorizationMode: "single-operator-exact-sha",
        concurrencyGroup: "fashion-staging-preview",
        confirmation,
        eventName: required("GITHUB_EVENT_NAME"),
        ref: required("GITHUB_REF"),
        runAttempt: number(required("GITHUB_RUN_ATTEMPT"), "GitHub run attempt"),
        runId: required("GITHUB_RUN_ID"),
        workflow: required("GITHUB_WORKFLOW"),
      },
      secrets: names(githubSecrets, "secrets"),
      variables: protectedVariables,
    },
    providers: {
      emailMode: protectedVariables.FASHION_U12_EMAIL_MODE ?? "",
      stripe: {
        accountId: String(stripeAccount.id),
        enabledEvents: Array.isArray(webhook.enabled_events)
          ? webhook.enabled_events.map(String)
          : [],
        livemode: stripeAccount.livemode === true,
        webhookEnabled: webhook.status === "enabled",
        webhookUrl: String(webhook.url),
      },
      turnstile: {
        hostname: new URL(PREVIEW_ORIGIN).hostname,
        secretConfigured: workerApi.secrets.includes("TURNSTILE_SECRET"),
        siteKey: protectedVariables.TURNSTILE_SITE_KEY ?? "",
        testMode: protectedVariables.TURNSTILE_SITE_KEY === "1x00000000000000000000AA",
      },
    },
    seed: {
      buildId: String(build.id),
      buildStatus: String(build.status),
      canonicalCatalogDigest: String(seedReceipt.canonicalCatalogDigest),
      catalogReleaseId: String(seedReceipt.catalogReleaseId),
      experienceSnapshotId: String(immutableSnapshot.id),
      products: [
        product(singleId, number(verification.single_available_count, "single availability")),
        product(multiId, number(verification.multi_available_count, "multi availability")),
        product(
          unavailableId,
          number(verification.unavailable_sellable_count, "unavailable availability"),
        ),
      ],
      seedManifestDigest: String(seedReceipt.seedManifestDigest),
      selectedVariantId: protectedVariables.FASHION_U13_VARIANT_ID ?? "",
      warehouseId: protectedVariables.FASHION_U12_WAREHOUSE_ID ?? "",
    },
  };
  await writeFile(output, `${JSON.stringify(readiness, null, 2)}\n`);
  console.log(JSON.stringify({ output }));
}
