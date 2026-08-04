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

interface EnvironmentSnapshot {
  adminHostname: string;
  environment: EnvironmentName;
  applicationNames: string[];
  resourceIdentifiers: string[];
  endpointValues: string[];
  apiVariables: Record<string, string>;
  remoteDatabaseIdentities: string[];
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
  "ADMIN_TUNNEL_HOSTNAME",
  "PUBLIC_ORIGIN",
  "MEDIA_PUBLIC_ORIGIN",
  "STOREFRONT_ORIGIN",
  "PAYMENT_CANCEL_URL",
  "PAYMENT_SUCCESS_URL",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_HOSTNAMES",
  "EMAIL_FROM",
]);

const ID_VARIABLES = new Set([
  "ACCESS_APPLICATION_ID",
  "ACCESS_AUDIENCE",
  "ADMIN_ORIGIN",
  "D1_DATABASE_ID",
  "IDP_ASSIGNMENT_ID",
  "RESOURCE_NAMESPACE",
  "SERVICE_CREDENTIAL_REF",
]);

const REQUIRED_IDENTITY_VARIABLES = [
  "ACCESS_APPLICATION_ID",
  "ACCESS_AUDIENCE",
  "ADMIN_ORIGIN",
  "D1_DATABASE_ID",
  "IDP_ASSIGNMENT_ID",
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
    /(?:development|staging|production)-audience$/.test(value)
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
    ]);
    const placeholders = strictValues.filter(looksPlaceholder);
    assert(
      placeholders.length === 0,
      `strict release validation rejects placeholder resources: ${unique(placeholders).join(", ")}`,
    );
  }
}

export async function verifyEnvironmentIsolation(
  options: {
    root?: string;
    strictEnvironment?: EnvironmentName | "all";
  } = {},
): Promise<EnvironmentSnapshot[]> {
  const snapshots = await loadSnapshots(options.root);
  verifySnapshots(snapshots, options);
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
    `Environment isolation verified for ${snapshots.map((entry) => entry.environment).join(" and ")}${values.strict ? " (strict)" : ""}.`,
  );
}
