import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseJsonc } from "./lib/jsonc";

type JsonRecord = Record<string, unknown>;
type EnvironmentName = "staging" | "production";

interface WranglerConfig extends JsonRecord {
  d1_databases?: unknown;
  name?: string;
  env?: Partial<Record<EnvironmentName, JsonRecord>>;
}

export interface EnvironmentSnapshot {
  adminHostname: string;
  environment: EnvironmentName;
  applicationNames: string[];
  resourceIdentifiers: string[];
  endpointValues: string[];
  apiVariables: Record<string, string>;
  remoteDatabaseIdentities: string[];
}

export interface FashionEnvironmentProfile {
  checkoutProtection: {
    rateLimit: {
      binding: string;
      limit: number;
      namespaceId: string;
      period: number;
    };
    turnstile: {
      hostnames: string[];
      required: boolean;
      siteKey: string;
      testMode: boolean;
    };
  };
  deploymentProfile: string;
  runtimeEnvironment: string;
  workers: {
    admin: string;
    api: string;
    preview: string;
  };
  databaseIdentity: string;
  storageIdentifiers: string[];
  serviceCredentialRef: string;
  paymentTargets: {
    cancelUrl: string;
    successUrl: string;
    webhookUrl: string;
  };
  lifecycle: {
    resourceProvisioning: string;
    ordinaryRuns: string;
    credentialReplacement: string;
  };
  origins: {
    admin: string;
    api: string;
    apiAdmin: string;
    preview: string;
    previewHandoff: string;
  };
  serviceBindings: {
    ADMIN_API: {
      service: string;
      intent: string;
    };
    PREVIEW_AUTH: {
      service: string;
      intent: string;
    };
    COMMERCE_API: {
      service: string;
      intent: string;
    };
  };
}

const ROOT = resolve(import.meta.dir, "..");
const CONFIG_PATHS = [
  "apps/storefront/wrangler.jsonc",
  "apps/admin/wrangler.jsonc",
  "apps/api/wrangler.jsonc",
] as const;

const RESOURCE_KEYS = new Set([
  "database_id",
  "preview_database_id",
  "database_name",
  "bucket_name",
  "preview_bucket_name",
  "namespace_id",
  "queue",
  "dead_letter_queue",
  "dataset",
  "service",
]);

const ENDPOINT_VARIABLES = new Set([
  "ADMIN_ORIGIN",
  "PUBLIC_ORIGIN",
  "PREVIEW_ORIGIN",
  "MEDIA_PUBLIC_ORIGIN",
  "STOREFRONT_ORIGIN",
  "PAYMENT_CANCEL_URL",
  "PAYMENT_SUCCESS_URL",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_HOSTNAMES",
  "EMAIL_FROM",
]);

const ID_VARIABLES = new Set([
  "ADMIN_ORIGIN",
  "D1_DATABASE_ID",
  "RESOURCE_NAMESPACE",
  "SERVICE_CREDENTIAL_REF",
]);

const REQUIRED_IDENTITY_VARIABLES = [
  "ADMIN_ORIGIN",
  "D1_DATABASE_ID",
  "SERVICE_CREDENTIAL_REF",
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectResources(value: unknown, parentKey = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectResources(entry, parentKey));
  }
  if (!isRecord(value)) return [];

  const result: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" &&
      (RESOURCE_KEYS.has(key) || (key === "name" && parentKey === "workflows"))
    ) {
      result.push(entry);
    }
    if (key !== "vars") result.push(...collectResources(entry, key));
  }
  return result;
}

function stringVariables(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function jsoncConfig(root: string, relativePath: string): Promise<JsonRecord> {
  const value = parseJsonc(await readFile(resolve(root, relativePath), "utf8"));
  assert(isRecord(value), `${relativePath} must contain one configuration object`);
  return value;
}

function namedResources(value: unknown, key: string): string[] {
  if (!isRecord(value) || !Array.isArray(value[key])) return [];
  return value[key].flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const name = entry.bucket_name ?? entry.service;
    return typeof name === "string" ? [name] : [];
  });
}

function checkoutRateLimit(
  value: JsonRecord,
): FashionEnvironmentProfile["checkoutProtection"]["rateLimit"] {
  const limits = Array.isArray(value.ratelimits) ? value.ratelimits.filter(isRecord) : [];
  const selected = limits.find((entry) => entry.name === "CHECKOUT_RATE_LIMITER");
  const simple = selected && isRecord(selected.simple) ? selected.simple : undefined;
  return {
    binding: typeof selected?.name === "string" ? selected.name : "",
    limit: typeof simple?.limit === "number" ? simple.limit : Number.NaN,
    namespaceId: typeof selected?.namespace_id === "string" ? selected.namespace_id : "",
    period: typeof simple?.period === "number" ? simple.period : Number.NaN,
  };
}

export async function loadFashionEnvironmentProfile(
  root = ROOT,
): Promise<FashionEnvironmentProfile> {
  const [admin, api, storefront] = await Promise.all([
    jsoncConfig(root, "apps/admin/wrangler.jsonc"),
    jsoncConfig(root, "apps/api/wrangler.jsonc"),
    jsoncConfig(root, "apps/storefront/wrangler.preview.jsonc"),
  ]);
  const adminEnvironment =
    isRecord(admin.env) && isRecord(admin.env["fashion-staging"])
      ? admin.env["fashion-staging"]
      : undefined;
  const apiEnvironment =
    isRecord(api.env) && isRecord(api.env["fashion-staging"])
      ? api.env["fashion-staging"]
      : undefined;
  const previewEnvironment =
    isRecord(storefront.env) && isRecord(storefront.env["fashion-staging"])
      ? storefront.env["fashion-staging"]
      : undefined;
  assert(isRecord(adminEnvironment), "Fashion Admin deployment profile is missing");
  assert(isRecord(apiEnvironment), "Fashion API deployment profile is missing");
  assert(isRecord(previewEnvironment), "Fashion Preview deployment profile is missing");
  const databases = Array.isArray(apiEnvironment.d1_databases)
    ? apiEnvironment.d1_databases.filter(isRecord)
    : [];
  assert(databases.length === 1, "Fashion profile must bind exactly one D1 database");
  const databaseId = databases[0]!.database_id;
  const databaseName = databases[0]!.database_name;
  assert(
    typeof databaseId === "string" && typeof databaseName === "string",
    "Fashion D1 profile must define its ID and name",
  );
  const apiVariables = stringVariables(apiEnvironment.vars);
  const previewVariables = stringVariables(previewEnvironment.vars);
  const previewOrigin = apiVariables.PREVIEW_ORIGIN ?? "";
  const publicOrigin = apiVariables.PUBLIC_ORIGIN ?? "";
  const services = Array.isArray(previewEnvironment.services)
    ? previewEnvironment.services.filter(isRecord)
    : [];
  const service = (binding: string) => {
    const match = services.find((entry) => entry.binding === binding)?.service;
    assert(typeof match === "string", `Fashion profile must define ${binding}`);
    return match;
  };
  const adminServices = Array.isArray(adminEnvironment.services)
    ? adminEnvironment.services.filter(isRecord)
    : [];
  const adminApi = adminServices.find((entry) => entry.binding === "API")?.service;
  assert(typeof adminApi === "string", "Fashion Admin profile must define API");
  const adminHostname = stringVariables(adminEnvironment.vars).ADMIN_HOSTNAME ?? "";
  const adminOrigin = adminHostname ? `https://${adminHostname}` : "";
  assert(typeof adminEnvironment.name === "string", "Fashion Admin Worker identity is missing");
  assert(typeof apiEnvironment.name === "string", "Fashion API Worker identity is missing");
  assert(typeof previewEnvironment.name === "string", "Fashion Preview Worker identity is missing");
  return {
    checkoutProtection: {
      rateLimit: checkoutRateLimit(apiEnvironment),
      turnstile: {
        hostnames: (apiVariables.TURNSTILE_HOSTNAMES ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        required: apiVariables.TURNSTILE_REQUIRED === "true",
        siteKey: apiVariables.TURNSTILE_SITE_KEY ?? "",
        testMode: apiVariables.TURNSTILE_TEST_MODE === "true",
      },
    },
    databaseIdentity: `${databaseId}::${databaseName}`,
    deploymentProfile: "fashion-staging",
    lifecycle: {
      credentialReplacement: "security-event-or-operator",
      ordinaryRuns: "verify-and-reuse",
      resourceProvisioning: "explicit-once",
    },
    origins: {
      admin: adminOrigin,
      api: publicOrigin,
      apiAdmin: apiVariables.ADMIN_ORIGIN ?? "",
      preview: previewOrigin,
      previewHandoff: previewVariables.PREVIEW_HANDOFF_ORIGIN ?? "",
    },
    runtimeEnvironment: apiVariables.ENVIRONMENT ?? "",
    paymentTargets: {
      cancelUrl: apiVariables.PAYMENT_CANCEL_URL ?? "",
      successUrl: apiVariables.PAYMENT_SUCCESS_URL ?? "",
      webhookUrl: publicOrigin ? `${publicOrigin}/webhooks/stripe` : "",
    },
    serviceBindings: {
      ADMIN_API: { intent: "admin-api", service: adminApi },
      COMMERCE_API: { intent: "commerce-api", service: service("COMMERCE_API") },
      PREVIEW_AUTH: { intent: "preview-authorization", service: service("PREVIEW_AUTH") },
    },
    serviceCredentialRef: apiVariables.SERVICE_CREDENTIAL_REF ?? "",
    storageIdentifiers: unique([
      ...namedResources(apiEnvironment, "r2_buckets"),
      ...namedResources(previewEnvironment, "r2_buckets"),
    ]),
    workers: {
      admin: adminEnvironment.name,
      api: apiEnvironment.name,
      preview: previewEnvironment.name,
    },
  };
}

function remoteDatabaseIdentities(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.d1_databases)) return [];
  return value.d1_databases.flatMap((database) => {
    if (!isRecord(database)) return [];
    const id = database.database_id;
    const name = database.database_name;
    return typeof id === "string" && typeof name === "string" ? [`${id}::${name}`] : [];
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function startsWith(value: string | undefined, prefix: string | undefined): boolean {
  return Boolean(value && prefix && value.startsWith(prefix));
}

function exactHttpsOrigin(value: string, label: string): URL {
  const origin = new URL(value);
  assert(
    origin.protocol === "https:" && origin.origin === value,
    `${label} must be one exact HTTPS origin`,
  );
  return origin;
}

export async function loadSnapshots(root = ROOT): Promise<EnvironmentSnapshot[]> {
  const configs = await Promise.all(
    CONFIG_PATHS.map(async (relativePath) => {
      const source = await readFile(resolve(root, relativePath), "utf8");
      return {
        relativePath,
        config: parseJsonc<WranglerConfig>(source),
      };
    }),
  );

  return (["staging", "production"] as const).map((environment) => {
    const applicationNames: string[] = [];
    let adminHostname = "";
    let apiVariables: Record<string, string> = {};
    const resources: string[] = [];
    const databases: string[] = [];

    for (const { relativePath, config } of configs) {
      const selected = config.env?.[environment];
      assert(selected, `${relativePath} is missing env.${environment}`);
      assert(
        typeof selected.name === "string" && selected.name.length > 0,
        `${relativePath} env.${environment} needs an explicit Worker name`,
      );
      applicationNames.push(selected.name);
      resources.push(...collectResources(selected));

      if (relativePath === "apps/api/wrangler.jsonc") {
        apiVariables = stringVariables(selected.vars);
        databases.push(...remoteDatabaseIdentities(selected));
        if (environment === "staging") {
          databases.push(...remoteDatabaseIdentities(config));
        }
      }
      if (relativePath === "apps/admin/wrangler.jsonc") {
        adminHostname = stringVariables(selected.vars).ADMIN_HOSTNAME ?? "";
      }
    }

    const endpointValues = Object.entries(apiVariables)
      .filter(([key]) => ENDPOINT_VARIABLES.has(key))
      .map(([, value]) => value);
    return {
      adminHostname,
      environment,
      applicationNames: unique(applicationNames),
      resourceIdentifiers: unique(resources),
      endpointValues: unique(endpointValues),
      apiVariables,
      remoteDatabaseIdentities: unique(databases),
    };
  });
}

function looksPlaceholder(value: string): boolean {
  return (
    value.includes(".invalid") ||
    value.includes("replace-with-") ||
    /^0{8,}/.test(value.replaceAll("-", "")) ||
    /(?:development|staging|production)-audience$/.test(value) ||
    /(?:test|staging|production)-admin-(?:access-application|idp-assignment)$/.test(value)
  );
}

export function verifySnapshots(
  snapshots: EnvironmentSnapshot[],
  options: { strictEnvironment?: EnvironmentName | "all" } = {},
): void {
  const staging = snapshots.find((snapshot) => snapshot.environment === "staging");
  const production = snapshots.find((snapshot) => snapshot.environment === "production");
  assert(staging, "staging snapshot is missing");
  assert(production, "production snapshot is missing");

  for (const snapshot of snapshots) {
    assert(
      snapshot.applicationNames.length === 3,
      `${snapshot.environment} must name all three apps`,
    );
    assert(Boolean(snapshot.adminHostname), `${snapshot.environment} must define ADMIN_HOSTNAME`);
    const adminOrigin = snapshot.apiVariables.ADMIN_ORIGIN;
    assert(adminOrigin, `${snapshot.environment} must define ADMIN_ORIGIN`);
    assert(
      new URL(adminOrigin).hostname === snapshot.adminHostname,
      `${snapshot.environment} ADMIN_HOSTNAME must match the API ADMIN_ORIGIN`,
    );
    assert(
      new Set(snapshot.applicationNames).size === snapshot.applicationNames.length,
      `${snapshot.environment} app names must be unique`,
    );
    assert(
      snapshot.apiVariables.ENVIRONMENT === snapshot.environment,
      `${snapshot.environment} API ENVIRONMENT does not match its deployment`,
    );
    assert(
      snapshot.apiVariables.TURNSTILE_REQUIRED === "true",
      `${snapshot.environment} must fail closed with Turnstile enabled`,
    );
    for (const variable of REQUIRED_IDENTITY_VARIABLES) {
      assert(
        Boolean(snapshot.apiVariables[variable]),
        `${snapshot.environment} must define ${variable}`,
      );
    }
    assert(
      snapshot.remoteDatabaseIdentities.length === 1,
      `${snapshot.environment} must define exactly one remote D1 database identity`,
    );
    const [databaseId, databaseName] = snapshot.remoteDatabaseIdentities[0]!.split("::");
    const expectedDatabaseName =
      snapshot.environment === "staging" ? "shoppp-staging" : "shoppp-production";
    assert(
      databaseName === expectedDatabaseName,
      `${snapshot.environment} must bind only ${expectedDatabaseName}`,
    );
    assert(
      databaseId === snapshot.apiVariables.D1_DATABASE_ID,
      `${snapshot.environment} D1_DATABASE_ID must match its bound remote D1`,
    );
    if (snapshot.environment === "production") {
      assert(
        snapshot.apiVariables.TURNSTILE_TEST_MODE !== "true",
        "production cannot enable Turnstile test mode",
      );
    }
  }

  assert(
    new Set([...staging.remoteDatabaseIdentities, ...production.remoteDatabaseIdentities]).size ===
      2,
    "test and production must define exactly two shared remote D1 database identities",
  );

  const stagingResources = new Set([
    staging.adminHostname,
    ...staging.applicationNames,
    ...staging.resourceIdentifiers,
    ...staging.endpointValues,
    ...Object.entries(staging.apiVariables)
      .filter(([key]) => ID_VARIABLES.has(key))
      .map(([, value]) => value),
  ]);
  const productionResources = new Set([
    production.adminHostname,
    ...production.applicationNames,
    ...production.resourceIdentifiers,
    ...production.endpointValues,
    ...Object.entries(production.apiVariables)
      .filter(([key]) => ID_VARIABLES.has(key))
      .map(([, value]) => value),
  ]);
  const crossover = [...stagingResources].filter((value) => productionResources.has(value));
  assert(
    crossover.length === 0,
    `staging and production share deployment resources: ${crossover.join(", ")}`,
  );

  for (const value of stagingResources) {
    assert(!/production/i.test(value), `staging references a production resource: ${value}`);
  }
  for (const value of productionResources) {
    assert(!/staging/i.test(value), `production references a staging resource: ${value}`);
  }

  assert(
    startsWith(staging.apiVariables.PAYMENT_SUCCESS_URL, staging.apiVariables.STOREFRONT_ORIGIN),
    "staging payment success target crosses storefront origin",
  );
  assert(
    startsWith(staging.apiVariables.PAYMENT_CANCEL_URL, staging.apiVariables.STOREFRONT_ORIGIN),
    "staging payment cancel target crosses storefront origin",
  );
  assert(
    startsWith(
      production.apiVariables.PAYMENT_SUCCESS_URL,
      production.apiVariables.STOREFRONT_ORIGIN,
    ),
    "production payment success target crosses storefront origin",
  );
  assert(
    startsWith(
      production.apiVariables.PAYMENT_CANCEL_URL,
      production.apiVariables.STOREFRONT_ORIGIN,
    ),
    "production payment cancel target crosses storefront origin",
  );

  if (options.strictEnvironment) {
    const strictSnapshots =
      options.strictEnvironment === "all"
        ? snapshots
        : snapshots.filter((snapshot) => snapshot.environment === options.strictEnvironment);
    const strictValues = strictSnapshots.flatMap((snapshot) => [
      ...snapshot.applicationNames,
      ...snapshot.resourceIdentifiers,
      ...snapshot.endpointValues,
      ...Object.entries(snapshot.apiVariables)
        .filter(([key]) => ID_VARIABLES.has(key))
        .map(([, value]) => value),
    ]);
    const placeholders = strictValues.filter(looksPlaceholder);
    assert(
      placeholders.length === 0,
      `strict release validation rejects placeholder resources: ${unique(placeholders).join(", ")}`,
    );
  }
}

export function verifyFashionEnvironmentProfile(
  snapshots: EnvironmentSnapshot[],
  profile: FashionEnvironmentProfile,
): void {
  verifySnapshots(snapshots);

  assert(
    profile.deploymentProfile === "fashion-staging",
    "Fashion deployment profile must be fashion-staging, not a legacy or production target",
  );
  assert(profile.runtimeEnvironment === "staging", "Fashion API runtime must remain staging");
  const adminOrigin = exactHttpsOrigin(profile.origins.admin, "Fashion Admin origin");
  const apiAdminOrigin = exactHttpsOrigin(profile.origins.apiAdmin, "Fashion API Admin origin");
  const previewOrigin = exactHttpsOrigin(profile.origins.preview, "Fashion Preview origin");
  const previewHandoffOrigin = exactHttpsOrigin(
    profile.origins.previewHandoff,
    "Fashion Preview handoff origin",
  );
  const apiOrigin = exactHttpsOrigin(profile.origins.api, "Fashion API origin");
  assert(
    apiAdminOrigin.origin === adminOrigin.origin,
    "Fashion API ADMIN_ORIGIN must target the dedicated Fashion Admin",
  );
  assert(
    previewHandoffOrigin.origin === adminOrigin.origin,
    "Fashion Preview handoff must target the dedicated Fashion Admin",
  );
  assert(profile.checkoutProtection.turnstile.required, "Fashion checkout must require Turnstile");
  assert(
    profile.checkoutProtection.turnstile.testMode,
    "Fashion staging must use the Turnstile test profile",
  );
  assert(
    profile.checkoutProtection.turnstile.siteKey.length >= 20 &&
      !looksPlaceholder(profile.checkoutProtection.turnstile.siteKey),
    "Fashion checkout must define a non-placeholder Turnstile site key",
  );
  assert(
    profile.checkoutProtection.turnstile.hostnames.length === 1 &&
      profile.checkoutProtection.turnstile.hostnames[0] === previewOrigin.hostname,
    "Fashion Turnstile hostname must match the private Preview origin",
  );
  assert(
    profile.checkoutProtection.rateLimit.binding === "CHECKOUT_RATE_LIMITER" &&
      Boolean(profile.checkoutProtection.rateLimit.namespaceId) &&
      profile.checkoutProtection.rateLimit.limit === 10 &&
      profile.checkoutProtection.rateLimit.period === 60,
    "Fashion checkout must define its dedicated 10-per-minute rate limiter",
  );
  assert(
    profile.paymentTargets.successUrl ===
      `${previewOrigin.origin}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    "Fashion payment success target must use the private Preview origin",
  );
  assert(
    profile.paymentTargets.cancelUrl ===
      `${previewOrigin.origin}/checkout/complete?return=canceled`,
    "Fashion payment cancel target must use the private Preview origin",
  );
  assert(
    profile.paymentTargets.webhookUrl === `${apiOrigin.origin}/webhooks/stripe`,
    "Fashion Stripe webhook must use the dedicated API origin",
  );
  assert(
    profile.lifecycle?.resourceProvisioning === "explicit-once",
    "Fashion resource provisioning must be an explicit one-time operation",
  );
  assert(
    profile.lifecycle?.ordinaryRuns === "verify-and-reuse",
    "Fashion ordinary runs must only verify and reuse provisioned resources",
  );
  assert(
    profile.lifecycle?.credentialReplacement === "security-event-or-operator",
    "Fashion credential replacement must require a security event or operator action",
  );

  const adminWorker = profile.workers?.admin;
  const apiWorker = profile.workers?.api;
  const previewWorker = profile.workers?.preview;
  assert(Boolean(adminWorker), "Fashion profile must define its Admin Worker identity");
  assert(Boolean(apiWorker), "Fashion profile must define its API Worker identity");
  assert(Boolean(previewWorker), "Fashion profile must define its private Preview Worker identity");
  assert(
    new Set([adminWorker, apiWorker, previewWorker]).size === 3,
    "Fashion Admin, API, and Preview Workers must be distinct and dedicated",
  );
  assert(Boolean(profile.databaseIdentity), "Fashion profile must define its D1 identity");
  const databaseParts = profile.databaseIdentity.split("::");
  assert(
    databaseParts.length === 2 && databaseParts.every(Boolean),
    "Fashion D1 identity must include both database ID and name",
  );
  assert(
    Array.isArray(profile.storageIdentifiers) && profile.storageIdentifiers.length > 0,
    "Fashion profile must define at least one storage identity",
  );
  assert(profile.storageIdentifiers.every(Boolean), "Fashion storage identities must not be empty");
  assert(
    new Set(profile.storageIdentifiers).size === profile.storageIdentifiers.length,
    "Fashion storage identities must be unique",
  );
  assert(
    Boolean(profile.serviceCredentialRef),
    "Fashion profile must define its service credential reference",
  );

  const adminApi = profile.serviceBindings?.ADMIN_API;
  const previewAuth = profile.serviceBindings?.PREVIEW_AUTH;
  const commerceApi = profile.serviceBindings?.COMMERCE_API;
  assert(isRecord(adminApi), "Fashion profile must define ADMIN_API");
  assert(isRecord(previewAuth), "Fashion profile must define PREVIEW_AUTH");
  assert(isRecord(commerceApi), "Fashion profile must define COMMERCE_API");
  assert(adminApi.intent === "admin-api", "ADMIN_API must have admin-api intent");
  assert(adminApi.service === apiWorker, "ADMIN_API must target the dedicated Fashion API Worker");
  assert(
    previewAuth.intent === "preview-authorization",
    "PREVIEW_AUTH must have preview-authorization intent",
  );
  assert(commerceApi.intent === "commerce-api", "COMMERCE_API must have commerce-api intent");
  assert(
    previewAuth.service === apiWorker,
    "PREVIEW_AUTH must target the dedicated Fashion API Worker",
  );
  assert(
    commerceApi.service === apiWorker,
    "COMMERCE_API must target the dedicated Fashion API Worker",
  );

  const existingIdentities = new Set(
    snapshots.flatMap((snapshot) => [
      ...snapshot.applicationNames,
      ...snapshot.resourceIdentifiers,
      ...snapshot.endpointValues,
      ...snapshot.remoteDatabaseIdentities,
      ...Object.entries(snapshot.apiVariables)
        .filter(([key]) => ID_VARIABLES.has(key))
        .map(([, value]) => value),
    ]),
  );
  const fashionIdentities = [
    adminWorker,
    apiWorker,
    previewWorker,
    profile.databaseIdentity,
    ...databaseParts,
    ...profile.storageIdentifiers,
    profile.serviceCredentialRef,
    profile.checkoutProtection.rateLimit.namespaceId,
    ...Object.values(profile.origins),
  ];
  const crossover = unique(
    fashionIdentities.filter((identity) => existingIdentities.has(identity)),
  );
  assert(
    crossover.length === 0,
    `Fashion profile reuses an existing deployment identity: ${crossover.join(", ")}`,
  );
}

export async function verifyEnvironmentIsolation(
  options: {
    root?: string;
    strictEnvironment?: EnvironmentName | "all";
  } = {},
): Promise<EnvironmentSnapshot[]> {
  const snapshots = await loadSnapshots(options.root);
  verifySnapshots(snapshots, options);
  verifyFashionEnvironmentProfile(
    snapshots,
    await loadFashionEnvironmentProfile(options.root ?? ROOT),
  );
  return snapshots;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      strict: { type: "boolean", default: false },
    },
  });
  const snapshots = await verifyEnvironmentIsolation({
    ...(values.strict ? { strictEnvironment: "all" as const } : {}),
  });
  console.log(
    `Environment isolation verified for ${snapshots.map((entry) => entry.environment).join(" and ")} plus fashion-staging${values.strict ? " (strict)" : ""}.`,
  );
}
