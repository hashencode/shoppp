import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve, sep } from "node:path";

import {
  createFashionStoreLiveCatalogMigrationPlan,
  FASHION_STORE_LIVE_CATALOG_RESET_TARGET,
  loadFashionStoreLiveCatalog,
} from "./prepare-fashion-store-live-catalog";

type EnvironmentValues = Record<string, string | undefined>;
type ResetFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type ReviewedMediaReader = (path: string) => Promise<Uint8Array>;

interface ResetChildProcess {
  exited: Promise<number>;
  kill(signal?: number | NodeJS.Signals): void;
}

type SpawnCommand = (
  command: string[],
  options: { cwd?: string; stderr: "inherit"; stdout: "inherit" },
) => ResetChildProcess;

const EXACT_API_ORIGIN = "https://shoppp-api-fashion-staging.hashencode.workers.dev";
const EXACT_STOREFRONT_ORIGIN = "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";
const CONFIRMATION = "RESET_REVIEWED_FASHION_STAGING_CATALOG";

export interface FashionStagingCatalogResetConfig {
  acceptanceToken: string;
  apiOrigin: typeof EXACT_API_ORIGIN;
  resetToken: string;
}

interface ResetDependencies {
  activateReviewedArtifact?: (
    preparation: FashionCatalogActivationPreparation,
  ) => Promise<{ digest: string; expiresAt: string; prefix: string }>;
  cleanup?: (completedSuccessfully: boolean) => Promise<void>;
  fetcher?: ResetFetch;
  loadReviewedInput?: (preflight: { iamFingerprint: string }) => Promise<Record<string, unknown>>;
  mediaFetcher?: ResetFetch;
  readReviewedMedia?: ReviewedMediaReader;
  spawnCommand?: SpawnCommand;
  uploadTimeoutMs?: number;
}

interface FashionCatalogActivationPreparation {
  buildId: string;
  buildInput: Record<string, unknown>;
  shopperReleaseId: string;
  snapshotId: string;
}

interface PackagedPreviewArtifact {
  digest: string;
  files: Array<{ contentType: string; path: string; sourcePath: string }>;
  prefix: string;
}

const spawnCommand: SpawnCommand = (command, options) => Bun.spawn(command, options);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function waitForExit(
  child: ResetChildProcess,
  timeoutMs: number,
): Promise<number | "timeout"> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      child.exited,
      new Promise<"timeout">((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout("timeout"), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function terminateAndReap(child: ResetChildProcess): Promise<void> {
  child.kill("SIGTERM");
  if ((await waitForExit(child, 2_000)) !== "timeout") return;
  child.kill("SIGKILL");
  if ((await waitForExit(child, 2_000)) === "timeout") {
    throw new Error("timed-out child process could not be reaped");
  }
}

async function runBoundedCommand(
  command: string[],
  options: { cwd?: string; stderr: "inherit"; stdout: "inherit" },
  label: string,
  spawn: SpawnCommand,
  timeoutMs: number,
): Promise<void> {
  const child = spawn(command, options);
  const exitCode = await waitForExit(child, timeoutMs);
  if (exitCode === "timeout") {
    try {
      await terminateAndReap(child);
    } catch (error) {
      throw new Error(`${label} timed out and cleanup failed: ${errorMessage(error)}`, {
        cause: error,
      });
    }
    throw new Error(`${label} timed out`);
  }
  if (exitCode !== 0) throw new Error(`${label} failed with exit code ${exitCode}`);
}

function required(environment: EnvironmentValues, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function opaqueToken(environment: EnvironmentValues, name: string): string {
  const value = required(environment, name);
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(value)) throw new Error(`${name} must be an opaque token`);
  return value;
}

export function loadFashionStagingCatalogResetConfig(
  environment: EnvironmentValues = process.env,
): FashionStagingCatalogResetConfig {
  if (environment.FASHION_CATALOG_RESET_MANIFEST?.trim()) {
    throw new Error("The one-time reset does not accept a manifest override");
  }
  const apiOrigin = required(environment, "FASHION_CATALOG_RESET_API_ORIGIN");
  if (apiOrigin !== EXACT_API_ORIGIN) {
    throw new Error(
      "FASHION_CATALOG_RESET_API_ORIGIN must be the exact Fashion staging API origin",
    );
  }
  if (required(environment, "FASHION_CATALOG_RESET_CONFIRM") !== CONFIRMATION) {
    throw new Error("FASHION_CATALOG_RESET_CONFIRM must contain the explicit reset confirmation");
  }
  return {
    acceptanceToken: opaqueToken(environment, "FASHION_CATALOG_RESET_ACCEPTANCE_TOKEN"),
    apiOrigin: EXACT_API_ORIGIN,
    resetToken: opaqueToken(environment, "FASHION_CATALOG_RESET_TOKEN"),
  };
}

async function responseData<T>(response: Response, label: string): Promise<T> {
  if (!response.ok)
    throw new Error(`Fashion staging catalog reset ${label} failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { data?: T };
  if (!("data" in payload))
    throw new Error(`Fashion staging catalog reset ${label} returned no data`);
  return payload.data as T;
}

async function defaultReviewedInput(preflight: { iamFingerprint: string }) {
  const repositoryRoot = new URL("..", import.meta.url).pathname;
  const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
  const plan = createFashionStoreLiveCatalogMigrationPlan(catalog, {
    expectedIamFingerprint: preflight.iamFingerprint,
    mediaPublicOrigin: FASHION_STORE_LIVE_CATALOG_RESET_TARGET.mediaOrigin,
    storefrontOrigin: EXACT_STOREFRONT_ORIGIN,
  });
  return plan.applyInput as unknown as Record<string, unknown>;
}

async function uploadMissingReviewedMedia(
  input: Record<string, unknown>,
  missingKeys: string[],
  spawn: SpawnCommand,
  uploadTimeoutMs: number,
): Promise<void> {
  const repositoryRoot = resolve(import.meta.dir, "..");
  const reviewedByKey = new Map(reviewedMediaFromInput(input).map((media) => [media.r2Key, media]));
  for (const key of missingKeys) {
    const upload = reviewedByKey.get(key);
    if (!upload) throw new Error(`Media preflight returned an unexpected missing key: ${key}`);
    await runBoundedCommand(
      [
        "bunx",
        "wrangler",
        "r2",
        "object",
        "put",
        `${FASHION_STORE_LIVE_CATALOG_RESET_TARGET.r2BucketName}/${upload.r2Key}`,
        "--file",
        upload.sourcePath,
        "--content-type",
        upload.mimeType,
        "--remote",
        "--config",
        "apps/api/wrangler.jsonc",
      ],
      { cwd: repositoryRoot, stderr: "inherit", stdout: "inherit" },
      `Upload of reviewed media ${upload.r2Key}`,
      spawn,
      uploadTimeoutMs,
    );
  }
}

async function deleteWorkerSecret(
  name: "FASHION_CATALOG_RESET_ENABLED" | "FASHION_CATALOG_RESET_TOKEN",
  spawn: SpawnCommand = spawnCommand,
  timeoutMs = 30_000,
): Promise<void> {
  await runBoundedCommand(
    [
      "bunx",
      "wrangler",
      "secret",
      "delete",
      name,
      "--env",
      "fashion-staging",
      "--config",
      "apps/api/wrangler.jsonc",
    ],
    { stderr: "inherit", stdout: "inherit" },
    `${name} revocation`,
    spawn,
    timeoutMs,
  );
}

export async function revokeResetCredential(
  spawn: SpawnCommand = spawnCommand,
  timeoutMs = 30_000,
): Promise<void> {
  await deleteWorkerSecret("FASHION_CATALOG_RESET_TOKEN", spawn, timeoutMs);
}

export async function cleanupResetAuthorization(
  completedSuccessfully: boolean,
  spawn: SpawnCommand = spawnCommand,
  timeoutMs = 30_000,
): Promise<void> {
  const errors: unknown[] = [];
  try {
    await revokeResetCredential(spawn, timeoutMs);
  } catch (error) {
    errors.push(error);
  }
  if (completedSuccessfully) {
    try {
      await deleteWorkerSecret("FASHION_CATALOG_RESET_ENABLED", spawn, timeoutMs);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Temporary reset authorization cleanup failed: ${errors.map(errorMessage).join("; ")}`,
      { cause: new AggregateError(errors) },
    );
  }
}

interface ReviewedMedia {
  mimeType: string;
  r2Key: string;
  sha256: string;
  sourcePath: string;
}

interface MediaPreflight {
  missingKeys: string[];
  presentKeys: string[];
}

interface TerminalActivation {
  activeArtifactDigest: string;
  activeArtifactPrefix: string;
  activeBuildId: string;
  catalogVersion: string;
  manifestDigest: string;
  shopperReleaseId: string;
}

interface ResumableActivation {
  activeBuildId: string;
  catalogVersion: string;
  manifestDigest: string;
  shopperReleaseId: string;
}

function reviewedMediaFromInput(input: Record<string, unknown>): ReviewedMedia[] {
  const catalog = input.catalog as { products?: Array<{ media?: ReviewedMedia[] }> } | undefined;
  const media = catalog?.products?.flatMap((product) => product.media ?? []) ?? [];
  if (media.length !== 18) {
    throw new Error(
      `Reviewed reset payload must contain exactly 18 media objects; got ${media.length}`,
    );
  }
  return media;
}

function validateMediaPreflight(input: Record<string, unknown>, result: MediaPreflight): void {
  const expected = reviewedMediaFromInput(input).map((media) => media.r2Key);
  const combined = [...result.missingKeys, ...result.presentKeys];
  if (
    new Set(combined).size !== combined.length ||
    combined.length !== expected.length ||
    [...combined].sort().join("\n") !== [...expected].sort().join("\n")
  ) {
    throw new Error("Fashion staging media preflight did not return the exact reviewed key set");
  }
}

function validateTerminalRecovery(
  input: Record<string, unknown>,
  preflightIamFingerprint: string,
  terminal: TerminalActivation | null,
  verification: Record<string, unknown>,
): void {
  const catalog = input.catalog as { catalogVersion?: string } | undefined;
  const shopperRelease = input.shopperRelease as { releaseId?: string } | undefined;
  if (
    !terminal ||
    !terminal.activeBuildId ||
    !/^[a-f0-9]{64}$/.test(terminal.activeArtifactDigest) ||
    !terminal.activeArtifactPrefix
  ) {
    throw new Error("Closed Fashion catalog reset has no exact terminal activation identity");
  }
  if (
    terminal.catalogVersion !== catalog?.catalogVersion ||
    terminal.manifestDigest !== input.manifestDigest ||
    terminal.shopperReleaseId !== shopperRelease?.releaseId
  ) {
    throw new Error("Persisted terminal catalog identity does not match the reviewed payload");
  }
  const identityFields: Array<keyof TerminalActivation> = [
    "activeArtifactDigest",
    "activeArtifactPrefix",
    "activeBuildId",
    "catalogVersion",
    "manifestDigest",
    "shopperReleaseId",
  ];
  if (identityFields.some((field) => verification[field] !== terminal[field])) {
    throw new Error("Persisted terminal activation identity does not match catalog verification");
  }
  if (
    verification.productCount !== 13 ||
    verification.variantCount !== 24 ||
    verification.sellableVariantCount !== 24 ||
    verification.mediaCount !== 18 ||
    verification.dimensionsVerified !== 18 ||
    verification.foreignKeyViolations !== 0 ||
    verification.iamFingerprint !== preflightIamFingerprint
  ) {
    throw new Error("Recovered Fashion catalog verification is incomplete");
  }
}

function validateResumableActivation(
  input: Record<string, unknown>,
  preflightIamFingerprint: string,
  resumable: ResumableActivation,
  verification: Record<string, unknown>,
): void {
  const catalog = input.catalog as { catalogVersion?: string } | undefined;
  const shopperRelease = input.shopperRelease as { releaseId?: string } | undefined;
  if (
    !resumable.activeBuildId ||
    resumable.catalogVersion !== catalog?.catalogVersion ||
    resumable.manifestDigest !== input.manifestDigest ||
    resumable.shopperReleaseId !== shopperRelease?.releaseId ||
    verification.catalogVersion !== resumable.catalogVersion ||
    verification.manifestDigest !== resumable.manifestDigest ||
    verification.shopperReleaseId !== resumable.shopperReleaseId ||
    verification.activeBuildId !== null ||
    verification.activeArtifactDigest !== null ||
    verification.activeArtifactPrefix !== null
  ) {
    throw new Error("Persisted resumable activation identity does not match the reviewed catalog");
  }
  if (
    verification.productCount !== 13 ||
    verification.variantCount !== 24 ||
    verification.sellableVariantCount !== 24 ||
    verification.mediaCount !== 18 ||
    verification.dimensionsVerified !== 18 ||
    verification.foreignKeyViolations !== 0 ||
    verification.iamFingerprint !== preflightIamFingerprint
  ) {
    throw new Error("Resumable Fashion catalog verification is incomplete");
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

async function verifyPublicMedia(
  input: Record<string, unknown>,
  fetcher: ResetFetch,
  readReviewedMedia: ReviewedMediaReader,
): Promise<void> {
  const repositoryRoot = resolve(import.meta.dir, "..");
  for (const media of reviewedMediaFromInput(input)) {
    const expectedBytes = await readReviewedMedia(resolve(repositoryRoot, media.sourcePath));
    if ((await sha256(expectedBytes)) !== media.sha256) {
      throw new Error(`Reviewed source checksum mismatch for ${media.r2Key}`);
    }
    const url = `${FASHION_STORE_LIVE_CATALOG_RESET_TARGET.mediaOrigin}/${media.r2Key}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`Public media ${media.r2Key} failed with HTTP ${response.status}`);
    }
    if (response.headers.get("Content-Type") !== media.mimeType) {
      throw new Error(`Public media MIME mismatch for ${media.r2Key}`);
    }
    const publicBytes = new Uint8Array(await response.arrayBuffer());
    if (publicBytes.byteLength !== expectedBytes.byteLength) {
      throw new Error(`Public media byte length mismatch for ${media.r2Key}`);
    }
    if ((await sha256(publicBytes)) !== media.sha256) {
      throw new Error(`Public media checksum mismatch for ${media.r2Key}`);
    }
  }
}

async function copyActivationWorkspace(repositoryRoot: string, target: string): Promise<void> {
  const skipped = new Set([
    ".git",
    ".nuxt",
    ".output",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
    "worker-dist",
  ]);
  await cp(repositoryRoot, target, {
    filter: (source) => {
      const parts = relative(repositoryRoot, source).split(sep);
      return !parts.some((part) => skipped.has(part));
    },
    recursive: true,
  });
  await symlink(resolve(repositoryRoot, "node_modules"), resolve(target, "node_modules"));
  await mkdir(resolve(target, "apps/storefront"), { recursive: true });
  await symlink(
    resolve(repositoryRoot, "apps/storefront/node_modules"),
    resolve(target, "apps/storefront/node_modules"),
  );
}

async function activateReviewedArtifact(
  preparation: FashionCatalogActivationPreparation,
  spawn: SpawnCommand = spawnCommand,
  timeoutMs = 15 * 60_000,
): Promise<{ digest: string; expiresAt: string; prefix: string }> {
  const repositoryRoot = resolve(import.meta.dir, "..");
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "shoppp-fashion-catalog-activation-"));
  const workspace = resolve(temporaryRoot, "shoppp");
  try {
    await copyActivationWorkspace(repositoryRoot, workspace);
    const inputPath = resolve(temporaryRoot, "build-input.json");
    const releasePath = resolve(temporaryRoot, "shopper-release.json");
    const artifactManifestPath = resolve(temporaryRoot, "artifact-manifest.json");
    const artifactResultPath = resolve(temporaryRoot, "artifact-result.json");
    await Promise.all([
      writeFile(inputPath, `${JSON.stringify(preparation.buildInput)}\n`),
      writeFile(
        releasePath,
        `${JSON.stringify(preparation.buildInput.catalogRelease as Record<string, unknown>)}\n`,
      ),
    ]);
    await runBoundedCommand(
      [
        "env",
        "STOREFRONT_BUILD_MODE=preview",
        `STOREFRONT_EXPERIENCE_FILE=${inputPath}`,
        `NUXT_CATALOG_RELEASE_FILE=${releasePath}`,
        "bun",
        "run",
        "--cwd",
        resolve(workspace, "apps/storefront"),
        "build",
      ],
      { cwd: workspace, stderr: "inherit", stdout: "inherit" },
      "Fashion shopper artifact build",
      spawn,
      timeoutMs,
    );
    await runBoundedCommand(
      [
        "env",
        "STOREFRONT_BUILD_MODE=preview",
        "bun",
        "run",
        "--cwd",
        resolve(workspace, "apps/storefront"),
        "verify:static",
      ],
      { cwd: workspace, stderr: "inherit", stdout: "inherit" },
      "Fashion shopper artifact verification",
      spawn,
      timeoutMs,
    );
    await runBoundedCommand(
      [
        "bun",
        "run",
        resolve(workspace, "apps/storefront/scripts/package-preview-artifact.ts"),
        `--snapshot-id=${preparation.snapshotId}`,
        `--catalog-release-id=${preparation.shopperReleaseId}`,
        `--output=${resolve(workspace, "apps/storefront/.output/public")}`,
        `--manifest=${artifactManifestPath}`,
        `--result=${artifactResultPath}`,
      ],
      { cwd: workspace, stderr: "inherit", stdout: "inherit" },
      "Fashion shopper artifact packaging",
      spawn,
      timeoutMs,
    );
    const artifact = JSON.parse(
      await readFile(artifactResultPath, "utf8"),
    ) as PackagedPreviewArtifact;
    for (const file of [
      ...artifact.files,
      {
        contentType: "application/json; charset=utf-8",
        path: "_preview-manifest.json",
        sourcePath: artifactManifestPath,
      },
    ]) {
      await runBoundedCommand(
        [
          "bunx",
          "wrangler",
          "r2",
          "object",
          "put",
          `shoppp-fashion-staging-preview-artifacts/${artifact.prefix}/${file.path}`,
          "--file",
          file.sourcePath,
          "--content-type",
          file.contentType,
          "--remote",
          "--force",
          "--config",
          "apps/storefront/wrangler.preview.jsonc",
        ],
        { cwd: repositoryRoot, stderr: "inherit", stdout: "inherit" },
        `Preview artifact upload ${file.path}`,
        spawn,
        120_000,
      );
    }
    return {
      digest: artifact.digest,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
      prefix: artifact.prefix,
    };
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function completeReviewedActivation(options: {
  catalogVersion: string;
  config: FashionStagingCatalogResetConfig;
  dependencies: ResetDependencies;
  expectedResumable?: ResumableActivation;
  fetcher: ResetFetch;
  sharedHeaders: { Authorization: string };
}): Promise<Record<string, unknown>> {
  const { catalogVersion, config, dependencies, expectedResumable, fetcher, sharedHeaders } =
    options;
  const activation = await responseData<FashionCatalogActivationPreparation>(
    await fetcher(
      `${config.apiOrigin}/internal/testing/fashion-staging/catalog-activation/prepare`,
      {
        headers: {
          ...sharedHeaders,
          "X-Fashion-Catalog-Reset-Token": config.resetToken,
        },
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      },
    ),
    "activation preparation",
  );
  if (
    expectedResumable &&
    (activation.buildId !== expectedResumable.activeBuildId ||
      activation.shopperReleaseId !== expectedResumable.shopperReleaseId)
  ) {
    throw new Error("Activation preparation did not return the persisted resumable build");
  }
  const artifact = await (dependencies.activateReviewedArtifact
    ? dependencies.activateReviewedArtifact(activation)
    : activateReviewedArtifact(
        activation,
        dependencies.spawnCommand ?? spawnCommand,
        dependencies.uploadTimeoutMs,
      ));
  const activated = await responseData<{
    artifactDigest: string;
    artifactPrefix: string;
    id: string;
    status: string;
  }>(
    await fetcher(
      `${config.apiOrigin}/internal/testing/fashion-staging/catalog-activation/${encodeURIComponent(activation.buildId)}/complete`,
      {
        body: JSON.stringify({
          artifactDigest: artifact.digest,
          artifactPrefix: artifact.prefix,
          expiresAt: artifact.expiresAt,
          status: "deployed",
        }),
        headers: {
          ...sharedHeaders,
          "Content-Type": "application/json",
          "X-Fashion-Catalog-Reset-Token": config.resetToken,
        },
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      },
    ),
    "activation completion",
  );
  if (
    activated.id !== activation.buildId ||
    activated.status !== "deployed" ||
    activated.artifactDigest !== artifact.digest ||
    activated.artifactPrefix !== artifact.prefix
  ) {
    throw new Error("Fashion staging catalog activation receipt mismatch");
  }
  const verification = await responseData<Record<string, unknown>>(
    await fetcher(
      `${config.apiOrigin}/internal/testing/fashion-staging/catalog-migration/${encodeURIComponent(catalogVersion)}`,
      { headers: sharedHeaders, signal: AbortSignal.timeout(10_000) },
    ),
    "activated verification",
  );
  if (
    verification.activeBuildId !== activation.buildId ||
    verification.activeArtifactDigest !== artifact.digest ||
    verification.activeArtifactPrefix !== artifact.prefix
  ) {
    throw new Error("Fashion staging catalog activation was not observable");
  }
  return verification;
}

export async function runFashionStagingCatalogReset(
  config: FashionStagingCatalogResetConfig,
  dependencies: ResetDependencies = {},
): Promise<Record<string, unknown>> {
  const fetcher = dependencies.fetcher ?? fetch;
  const mediaFetcher = dependencies.mediaFetcher ?? fetch;
  const sharedHeaders = { Authorization: `Bearer ${config.acceptanceToken}` };
  const resetHeaders = {
    ...sharedHeaders,
    "X-Fashion-Catalog-Reset-Token": config.resetToken,
  };
  let primaryError: unknown;
  let receipt: Record<string, unknown> | undefined;
  try {
    const preflight = await responseData<{
      activeWorkCount: number;
      iamFingerprint: string;
      resumableActivation: ResumableActivation | null;
      resetClosed: boolean;
      terminalActivation: TerminalActivation | null;
    }>(
      await fetcher(
        `${config.apiOrigin}/internal/testing/fashion-staging/catalog-reset/preflight`,
        {
          headers: resetHeaders,
          signal: AbortSignal.timeout(10_000),
        },
      ),
      "reset preflight",
    );
    if (preflight.activeWorkCount !== 0)
      throw new Error("Fashion staging has active protected work");
    const input = await (dependencies.loadReviewedInput
      ? dependencies.loadReviewedInput(preflight)
      : defaultReviewedInput(preflight));
    if (preflight.resetClosed) {
      const terminal = preflight.terminalActivation;
      if (!terminal) {
        throw new Error("Closed Fashion catalog reset has no terminal activation identity");
      }
      const verification = await responseData<Record<string, unknown>>(
        await fetcher(
          `${config.apiOrigin}/internal/testing/fashion-staging/catalog-migration/${encodeURIComponent(terminal.catalogVersion)}`,
          { headers: sharedHeaders, signal: AbortSignal.timeout(10_000) },
        ),
        "terminal recovery verification",
      );
      validateTerminalRecovery(input, preflight.iamFingerprint, terminal, verification);
      await verifyPublicMedia(
        input,
        mediaFetcher,
        dependencies.readReviewedMedia ?? (async (path) => readFile(path)),
      );
      receipt = { ...verification, terminalRecovered: true };
    }
    if (!receipt && preflight.resumableActivation) {
      const resumable = preflight.resumableActivation;
      const verification = await responseData<Record<string, unknown>>(
        await fetcher(
          `${config.apiOrigin}/internal/testing/fashion-staging/catalog-migration/${encodeURIComponent(resumable.catalogVersion)}`,
          { headers: sharedHeaders, signal: AbortSignal.timeout(10_000) },
        ),
        "resumable activation verification",
      );
      validateResumableActivation(input, preflight.iamFingerprint, resumable, verification);
      await verifyPublicMedia(
        input,
        mediaFetcher,
        dependencies.readReviewedMedia ?? (async (path) => readFile(path)),
      );
      const activatedVerification = await completeReviewedActivation({
        catalogVersion: resumable.catalogVersion,
        config,
        dependencies,
        expectedResumable: resumable,
        fetcher,
        sharedHeaders,
      });
      receipt = { ...activatedVerification, activationResumed: true };
    }
    if (!receipt) {
      const mediaPreflight = async () => {
        const result = await responseData<MediaPreflight>(
          await fetcher(
            `${config.apiOrigin}/internal/testing/fashion-staging/catalog-reset/media-preflight`,
            {
              body: JSON.stringify(input),
              headers: { ...resetHeaders, "Content-Type": "application/json" },
              method: "POST",
              signal: AbortSignal.timeout(60_000),
            },
          ),
          "reviewed media preflight",
        );
        validateMediaPreflight(input, result);
        return result;
      };
      const media = await mediaPreflight();
      if (media.missingKeys.length > 0) {
        await uploadMissingReviewedMedia(
          input,
          media.missingKeys,
          dependencies.spawnCommand ?? spawnCommand,
          dependencies.uploadTimeoutMs ?? 120_000,
        );
        const afterUpload = await mediaPreflight();
        if (afterUpload.missingKeys.length > 0) {
          throw new Error("Reviewed media remained missing after upload");
        }
      }
      const reset = await responseData<{
        catalogVersion: string;
        deletedMediaCount: number;
        deletedTableCount: number;
      }>(
        await fetcher(`${config.apiOrigin}/internal/testing/fashion-staging/catalog-reset`, {
          body: JSON.stringify(input),
          headers: {
            ...resetHeaders,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: AbortSignal.timeout(60_000),
        }),
        "apply",
      );
      const verification = await responseData<Record<string, unknown>>(
        await fetcher(
          `${config.apiOrigin}/internal/testing/fashion-staging/catalog-migration/${encodeURIComponent(reset.catalogVersion)}`,
          { headers: sharedHeaders, signal: AbortSignal.timeout(10_000) },
        ),
        "verification",
      );
      if (
        verification.productCount !== 13 ||
        verification.variantCount !== 24 ||
        verification.mediaCount !== 18
      ) {
        throw new Error("Fashion staging catalog verification counts mismatch");
      }
      await verifyPublicMedia(
        input,
        mediaFetcher,
        dependencies.readReviewedMedia ?? (async (path) => readFile(path)),
      );
      const activatedVerification = await completeReviewedActivation({
        catalogVersion: reset.catalogVersion,
        config,
        dependencies,
        fetcher,
        sharedHeaders,
      });
      receipt = {
        ...activatedVerification,
        deletedMediaCount: reset.deletedMediaCount,
        deletedTableCount: reset.deletedTableCount,
      };
    }
  } catch (error) {
    primaryError = error;
  }
  let cleanupError: unknown;
  try {
    const completedSuccessfully = !primaryError && Boolean(receipt);
    await (dependencies.cleanup
      ? dependencies.cleanup(completedSuccessfully)
      : cleanupResetAuthorization(
          completedSuccessfully,
          dependencies.spawnCommand ?? spawnCommand,
        ));
  } catch (error) {
    cleanupError = error;
  }
  if (primaryError && cleanupError) {
    throw new Error(
      `Fashion staging catalog reset failed: ${errorMessage(primaryError)}; reset credential cleanup failed: ${errorMessage(cleanupError)}`,
      { cause: new AggregateError([primaryError, cleanupError]) },
    );
  }
  if (cleanupError) {
    throw new Error(`Reset credential cleanup failed: ${errorMessage(cleanupError)}`, {
      cause: cleanupError,
    });
  }
  if (primaryError) throw primaryError;
  if (!receipt) throw new Error("Fashion staging catalog reset produced no receipt");
  return receipt;
}

if (import.meta.main) {
  console.log(
    JSON.stringify(await runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig())),
  );
}
