import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  canonicalCatalogReleaseSchema,
  experienceSnapshotSchema,
  type CanonicalCatalogRelease,
} from "@shoppp/contracts";

import {
  applyFashionStoreHomeComposition,
  defaultFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";
import { fashionStorePreviewBuildInput } from "./prepare-theme-preview-fixture";
import { experienceBuildInputSchema, type ExperienceBuildInput } from "./prepare-experience";

type Environment = Record<string, string | undefined>;
type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type PreviewFixtureInput = Awaited<ReturnType<typeof fashionStorePreviewBuildInput>>;
type LiveBuildInput = Extract<
  ExperienceBuildInput,
  { environment: "preview"; presentationMode: "live" }
>;

export interface FashionStoreLiveDevelopmentConfig {
  readonly apiOrigin: string;
  readonly buildManifestToken: string | null;
  readonly port: number;
  readonly releaseId: string;
  readonly storefrontOrigin: string;
}

export interface FashionStoreLiveDevelopmentFiles {
  readonly experienceFile: string;
  readonly releaseFile: string;
}

const storefrontRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(storefrontRoot, "../..");
const generatedRoot = resolve(storefrontRoot, "fixtures/experience/.generated");
const apiOrigin = "https://shoppp-api-fashion-staging.hashencode.workers.dev";
const storefrontOrigin = "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";
const fashionStagingDatabase = "shoppp-fashion-staging";

export function resolveFashionStoreLiveDevelopmentConfig(
  environment: Environment,
  catalogVersion: string,
): FashionStoreLiveDevelopmentConfig {
  const buildManifestToken =
    environment.BUILD_MANIFEST_TOKEN?.trim() ||
    environment.NUXT_CATALOG_RELEASE_TOKEN?.trim() ||
    null;
  if (buildManifestToken !== null && buildManifestToken.length < 32) {
    throw new Error("The Fashion staging build manifest token must be at least 32 characters.");
  }
  const releaseId =
    environment.FASHION_STORE_LIVE_RELEASE_ID?.trim() || `${catalogVersion}-shopper-release`;
  const rawPort = environment.FASHION_STORE_LIVE_DEV_PORT?.trim() || "3435";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("FASHION_STORE_LIVE_DEV_PORT must be an integer between 1 and 65535.");
  }
  return { apiOrigin, buildManifestToken, port, releaseId, storefrontOrigin };
}

export async function fetchFashionStoreCatalogRelease(
  config: FashionStoreLiveDevelopmentConfig,
  fetcher: Fetch = fetch,
): Promise<CanonicalCatalogRelease> {
  if (!config.buildManifestToken) {
    throw new Error("A build manifest token is required for the Catalog Release API.");
  }
  const url = `${config.apiOrigin}/build/catalog/releases/${encodeURIComponent(config.releaseId)}`;
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${config.buildManifestToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Fashion staging Catalog Release fetch failed (${response.status}).`);
  }
  const release = canonicalCatalogReleaseSchema.parse(await response.json());
  if (release.releaseId !== config.releaseId) {
    throw new Error(
      `Fashion staging returned Catalog Release ${release.releaseId}, expected ${config.releaseId}.`,
    );
  }
  return release;
}

export function createFashionStoreLiveD1Command(releaseId: string): string[] {
  if (!/^[a-z][a-z0-9-]{0,159}$/.test(releaseId)) {
    throw new Error(
      "FASHION_STORE_LIVE_RELEASE_ID must use lowercase letters, digits, and hyphens.",
    );
  }
  const query =
    `SELECT manifest_json FROM catalog_releases WHERE id = '${releaseId}' ` +
    "AND status IN ('approved', 'building', 'deployed')";
  return [
    "bun",
    "x",
    "wrangler",
    "d1",
    "execute",
    fashionStagingDatabase,
    "--remote",
    "--env",
    "fashion-staging",
    "--config",
    "wrangler.jsonc",
    "--command",
    query,
    "--json",
  ];
}

export function parseFashionStoreLiveD1Output(
  output: string,
  releaseId: string,
): CanonicalCatalogRelease {
  const executions = JSON.parse(output) as Array<{
    results?: Array<{ manifest_json?: unknown }>;
    success?: boolean;
  }>;
  const manifest = executions[0]?.results?.[0]?.manifest_json;
  if (executions[0]?.success !== true || typeof manifest !== "string") {
    throw new Error(`Fashion staging Catalog Release ${releaseId} was not found in test D1.`);
  }
  const release = canonicalCatalogReleaseSchema.parse(JSON.parse(manifest));
  if (release.releaseId !== releaseId) {
    throw new Error(
      `Fashion staging D1 returned Catalog Release ${release.releaseId}, expected ${releaseId}.`,
    );
  }
  return release;
}

export async function readFashionStoreCatalogReleaseFromD1(
  config: FashionStoreLiveDevelopmentConfig,
): Promise<CanonicalCatalogRelease> {
  const child = Bun.spawn(createFashionStoreLiveD1Command(config.releaseId), {
    cwd: resolve(repositoryRoot, "apps/api"),
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `Fashion staging D1 read failed. Run \`bun x wrangler login\` first.\n${stderr.trim()}`,
    );
  }
  return parseFashionStoreLiveD1Output(stdout, config.releaseId);
}

export function loadFashionStoreCatalogRelease(
  config: FashionStoreLiveDevelopmentConfig,
): Promise<CanonicalCatalogRelease> {
  return config.buildManifestToken
    ? fetchFashionStoreCatalogRelease(config)
    : readFashionStoreCatalogReleaseFromD1(config);
}

function catalogBindings(release: CanonicalCatalogRelease) {
  const collection = release.collections.find(({ status }) => status === "published");
  const product = release.products.find(
    ({ status, variants }) =>
      status === "published" && variants.some((variant) => variant.status === "active"),
  );
  if (!collection || !product) {
    throw new Error("Fashion staging requires one published collection and active product.");
  }
  return [
    {
      id: "fashion-store-live-home-binding",
      instanceId: "fashion-store-home",
      kind: "catalog" as const,
      reference: { id: collection.id, kind: "collection" as const },
      settingId: "featured-collection",
    },
    {
      id: "fashion-store-live-collection-binding",
      instanceId: "fashion-store-collection",
      kind: "catalog" as const,
      reference: { id: collection.id, kind: "collection" as const },
      settingId: "fashion-store-live-collection-resource",
    },
    {
      id: "fashion-store-live-product-binding",
      instanceId: "fashion-store-product",
      kind: "catalog" as const,
      reference: { id: product.id, kind: "product" as const },
      settingId: "fashion-store-live-product-resource",
    },
  ];
}

function mediaOrigins(release: CanonicalCatalogRelease): string[] {
  const origins = new Set<string>();
  for (const product of release.products) {
    for (const media of product.media) {
      if (media.src.startsWith("/")) continue;
      const url = new URL(media.src);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Fashion staging Catalog Release contains an invalid external media URL.");
      }
      origins.add(url.origin);
      if (origins.size > 8) {
        throw new Error("Fashion staging Catalog Release declares more than eight media origins.");
      }
    }
  }
  return [...origins].sort();
}

export function createFashionStoreLiveBuildInput(
  fixtureInput: PreviewFixtureInput,
  catalogRelease: CanonicalCatalogRelease,
): LiveBuildInput {
  const snapshot = structuredClone(fixtureInput.snapshot);
  snapshot.bindings = catalogBindings(catalogRelease);
  snapshot.experienceId = "experience-fashion-store-local-live";
  snapshot.id = "snapshot-fashion-store-local-live-1";
  const home = snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
  if (!home) throw new Error("Fashion Store live development requires the Home template.");
  applyFashionStoreHomeComposition(home, defaultFashionStoreHomeDevelopmentProfile);
  const parsedSnapshot = experienceSnapshotSchema.parse(snapshot);
  return experienceBuildInputSchema.parse({
    catalogRelease,
    environment: "preview",
    expectedOrigin: fixtureInput.expectedOrigin,
    inputIdentity: {
      catalogReleaseId: catalogRelease.releaseId,
      experienceSnapshotId: parsedSnapshot.id,
      experienceVersion: parsedSnapshot.version,
      platformContractVersion: parsedSnapshot.platformContractVersion,
      themeId: parsedSnapshot.themeId,
      themeVersion: parsedSnapshot.themeVersion,
    },
    mediaOrigins: mediaOrigins(catalogRelease),
    presentationMode: "live",
    snapshot: parsedSnapshot,
    themeId: fixtureInput.themeId,
  });
}

export function createFashionStoreLiveChildEnvironment(
  environment: Environment,
  config: FashionStoreLiveDevelopmentConfig,
  files: FashionStoreLiveDevelopmentFiles,
): Environment {
  const childEnvironment = {
    ...environment,
    API_PROXY_CATALOG_RELEASE_ID: config.releaseId,
    API_PROXY_STOREFRONT_ORIGIN: config.storefrontOrigin,
    API_PROXY_TARGET: config.apiOrigin,
    NUXT_CATALOG_RELEASE_FILE: files.releaseFile,
    STOREFRONT_BUILD_MODE: "preview",
    STOREFRONT_EXPERIENCE_FILE: files.experienceFile,
    STOREFRONT_FASHION_HOME_PROFILE: defaultFashionStoreHomeDevelopmentProfile,
  };
  delete childEnvironment.BUILD_MANIFEST_TOKEN;
  delete childEnvironment.NUXT_CATALOG_RELEASE_TOKEN;
  return childEnvironment;
}

export async function runFashionStoreLiveDevelopment(
  environment: Environment = process.env,
): Promise<number> {
  const source = JSON.parse(
    await readFile(resolve(repositoryRoot, "tools/fashion-store-live-catalog.json"), "utf8"),
  ) as { catalogVersion?: unknown };
  if (typeof source.catalogVersion !== "string" || !source.catalogVersion.trim()) {
    throw new Error("tools/fashion-store-live-catalog.json must declare catalogVersion.");
  }
  const config = resolveFashionStoreLiveDevelopmentConfig(environment, source.catalogVersion);
  const [catalogRelease, fixtureInput] = await Promise.all([
    loadFashionStoreCatalogRelease(config),
    fashionStorePreviewBuildInput("https://preview.example.test"),
  ]);
  const experienceInput = createFashionStoreLiveBuildInput(fixtureInput, catalogRelease);
  const files = {
    experienceFile: resolve(generatedRoot, "fashion-store-local-live-input.json"),
    releaseFile: resolve(generatedRoot, "fashion-store-local-live-release.json"),
  };
  await mkdir(generatedRoot, { recursive: true });
  await Promise.all([
    writeFile(files.experienceFile, `${JSON.stringify(experienceInput, null, 2)}\n`),
    writeFile(files.releaseFile, `${JSON.stringify(catalogRelease, null, 2)}\n`),
  ]);

  console.log(`Fashion Store live development: http://127.0.0.1:${config.port}`);
  console.log(`Catalog Release: ${catalogRelease.releaseId}`);
  console.log(
    `Catalog source: ${config.buildManifestToken ? "authenticated API" : "remote test D1"}`,
  );
  console.log(`Commerce API: ${config.apiOrigin} (Fashion staging test D1)`);
  console.warn("Cart and checkout actions write to the shared Fashion staging test environment.");

  const child = Bun.spawn(
    ["bun", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(config.port)],
    {
      cwd: storefrontRoot,
      env: createFashionStoreLiveChildEnvironment(environment, config, files),
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    },
  );
  const forwardSignal = (signal: NodeJS.Signals) => child.kill(signal);
  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);
  try {
    return await child.exited;
  } finally {
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
  }
}

if (import.meta.main) process.exitCode = await runFashionStoreLiveDevelopment();
