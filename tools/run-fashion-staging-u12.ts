type EnvironmentValues = Record<string, string | undefined>;
export type FashionStagingU12Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type FashionStagingU12Action = "acquire" | "cleanup" | "failure" | "reconcile" | "register";

export interface FashionStagingU12Config {
  action: FashionStagingU12Action;
  apiOrigin: string;
  artifactDigest: string;
  catalogReleaseId: string;
  commitSha: string;
  experienceSnapshotId: string;
  failure?: string;
  owner: string;
  resourceId?: string;
  resourceType?: "cart" | "checkout_attempt" | "order" | "reservation" | "reservation_group";
  runId: string;
  seedManifestDigest: string;
  token: string;
  variantId: string;
  warehouseId: string;
}

function required(environment: EnvironmentValues, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function identifier(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value)) {
    throw new Error(`${name} must be a stable identifier`);
  }
  return value;
}

function digest(environment: EnvironmentValues, name: string, length: 40 | 64): string {
  const value = required(environment, name);
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(value)) {
    throw new Error(`${name} must be a ${length}-character lowercase hexadecimal digest`);
  }
  return value;
}

function exactOrigin(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) {
    throw new Error(`${name} must be one exact credential-free HTTPS origin`);
  }
  return value;
}

export function loadFashionStagingU12Config(
  action: FashionStagingU12Action,
  environment: EnvironmentValues = process.env,
): FashionStagingU12Config {
  const token = required(environment, "FASHION_U12_ACCEPTANCE_TOKEN");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error("FASHION_U12_ACCEPTANCE_TOKEN must be an opaque service credential");
  }
  const config: FashionStagingU12Config = {
    action,
    apiOrigin: exactOrigin(environment, "FASHION_U12_API_ORIGIN"),
    artifactDigest: digest(environment, "FASHION_U12_ARTIFACT_DIGEST", 64),
    catalogReleaseId: identifier(environment, "FASHION_U12_CATALOG_RELEASE_ID"),
    commitSha: digest(environment, "FASHION_U12_COMMIT_SHA", 40),
    experienceSnapshotId: identifier(environment, "FASHION_U12_SNAPSHOT_ID"),
    owner: identifier(environment, "FASHION_U12_OWNER"),
    runId: identifier(environment, "FASHION_U12_RUN_ID"),
    seedManifestDigest: digest(environment, "FASHION_U12_SEED_MANIFEST_DIGEST", 64),
    token,
    variantId: identifier(environment, "FASHION_U12_VARIANT_ID"),
    warehouseId: identifier(environment, "FASHION_U12_WAREHOUSE_ID"),
  };
  if (action === "register") {
    const resourceType = required(environment, "FASHION_U12_RESOURCE_TYPE");
    if (!/^(cart|checkout_attempt|order|reservation|reservation_group)$/.test(resourceType)) {
      throw new Error("FASHION_U12_RESOURCE_TYPE is invalid");
    }
    config.resourceType = resourceType as NonNullable<FashionStagingU12Config["resourceType"]>;
    config.resourceId = identifier(environment, "FASHION_U12_RESOURCE_ID");
  }
  if (action === "failure") {
    const failure = required(environment, "FASHION_U12_FAILURE").replace(/[\r\n]+/g, " ");
    if (failure.length > 500) throw new Error("FASHION_U12_FAILURE is too long");
    config.failure = failure;
  }
  return config;
}

async function responseData(response: Response, action: FashionStagingU12Action): Promise<unknown> {
  if (!response.ok)
    throw new Error(`Fashion staging U12 ${action} failed with HTTP ${response.status}`);
  if (response.status === 204) return { accepted: true };
  const payload = (await response.json()) as { data?: unknown };
  if (!("data" in payload)) throw new Error(`Fashion staging U12 ${action} returned no data`);
  return payload.data;
}

export async function runFashionStagingU12(
  config: FashionStagingU12Config,
  fetcher: FashionStagingU12Fetch = fetch,
): Promise<unknown> {
  const runPath = `/internal/testing/fashion-staging/runs/${config.runId}`;
  const request: { body: Record<string, unknown>; path: string } = (() => {
    switch (config.action) {
      case "acquire":
        return {
          body: {
            artifactDigest: config.artifactDigest,
            catalogReleaseId: config.catalogReleaseId,
            commitSha: config.commitSha,
            experienceSnapshotId: config.experienceSnapshotId,
            owner: config.owner,
            runId: config.runId,
            seedManifestDigest: config.seedManifestDigest,
            variantId: config.variantId,
            warehouseId: config.warehouseId,
          },
          path: "/internal/testing/fashion-staging/runs",
        };
      case "cleanup":
        return { body: { owner: config.owner }, path: `${runPath}/cleanup` };
      case "failure":
        return {
          body: { failure: config.failure, owner: config.owner },
          path: `${runPath}/failure`,
        };
      case "reconcile":
        return { body: { owner: config.owner }, path: `${runPath}/reconcile` };
      case "register":
        return {
          body: {
            owner: config.owner,
            resourceId: config.resourceId,
            resourceType: config.resourceType,
          },
          path: `${runPath}/resources`,
        };
    }
  })();
  const response = await fetcher(`${config.apiOrigin}${request.path}`, {
    body: JSON.stringify(request.body),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "X-Request-Id": `fashion-u12-${config.action}-${config.runId}`,
    },
    method: "POST",
  });
  return responseData(response, config.action);
}

function actionFromArguments(arguments_: string[]): FashionStagingU12Action {
  const value = arguments_.find((argument) => argument.startsWith("--action="))?.slice(9);
  if (!value || !/^(acquire|cleanup|failure|reconcile|register)$/.test(value)) {
    throw new Error("Use --action=acquire|cleanup|failure|reconcile|register");
  }
  return value as FashionStagingU12Action;
}

if (import.meta.main) {
  const action = actionFromArguments(process.argv.slice(2));
  console.log(JSON.stringify(await runFashionStagingU12(loadFashionStagingU12Config(action))));
}
