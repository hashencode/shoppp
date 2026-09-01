import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { loadFashionStagingU12Config, runFashionStagingU12 } from "./run-fashion-staging-u12";
import {
  runStagingLatencyProbe,
  type StagingLatencyConfig,
  type StagingLatencyFetch,
  type StagingLatencyLifecycle,
  type StagingLatencyReport,
} from "./verify-staging-latency";

export interface FashionU8RunManifest {
  u12ArtifactDigest: string;
  candidateSha: string;
  catalogReleaseId: string;
  contractTestDigest: string;
  harnessManifestDigest: string;
  harnessSha: string;
  platformContractVersion: string;
  runId: string;
  schemaVersion: 1;
  sourceDraftId: string;
  themeId: "fashion-store";
  themeVersion: string;
  u12ReadinessDigest: string;
  u12SnapshotId: string;
}

export type FashionU8AttemptKind = "build" | "cleanup" | "human" | "machine" | "preparation";

export interface FashionU8Attempt {
  attemptId: string;
  cleanup?: "complete" | "failed" | "not-required";
  correctiveReason?: string;
  failureClass?: string;
  finishedAt?: string;
  kind: FashionU8AttemptKind;
  manifestDigest: string;
  startedAt: string;
  status: "failed" | "passed" | "started";
}

export interface FashionU8TerminalManifest extends FashionU8RunManifest {
  acceptanceRunId: string;
  buildId: string;
  currency: string;
  experienceVersion: number;
  productId: string;
  refreshAttestationDigest: string;
  runManifestDigest: string;
  successorArtifactDigest: string;
  successorAuditId: string;
  successorContentDigest: string;
  successorSnapshotId: string;
}

export interface FashionU8Lifecycle {
  acquire(): Promise<unknown>;
  cleanup(): Promise<unknown>;
  failure(failure: string): Promise<unknown>;
  reconcile(runId: string): Promise<unknown>;
  registerCart(cartId: string): Promise<unknown>;
}

export interface FashionU8TerminalConfig {
  authorityOrigin: string;
  handoffOrigin: string;
  manifest: FashionU8TerminalManifest;
  previewOrigin: string;
  recoveryRunId?: string;
  serviceToken: string;
}

export interface FashionU8TerminalReport {
  buildId: string;
  catalogReleaseId: string;
  cleanup: { attempted: boolean; failure?: "cleanup_failed"; passed: boolean };
  latency?: StagingLatencyReport;
  passed: boolean;
  proofFailure?: string;
  refreshAttestationDigest: string;
  runId: string;
  runManifestDigest: string;
  successorArtifactDigest: string;
  successorAuditId: string;
  successorContentDigest: string;
  successorSnapshotId: string;
}

type LatencyRunner = (
  config: StagingLatencyConfig,
  fetcher: StagingLatencyFetch,
  lifecycle: StagingLatencyLifecycle,
) => Promise<StagingLatencyReport>;

export interface FashionU8Dependencies {
  fetcher?: StagingLatencyFetch;
  latencyRunner?: LatencyRunner;
  lifecycle: FashionU8Lifecycle;
}

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const CONTROL_PLANE_TIMEOUT_MS = 10_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function fashionU8OwnerForRun(runId: string): string {
  const owner = `fashion-u8-${runId}`;
  assert(IDENTIFIER.test(runId) && IDENTIFIER.test(owner), "runId cannot form a stable U8 owner");
  return owner;
}

export function assertFashionU8RunManifest(value: FashionU8RunManifest): FashionU8RunManifest {
  assert(value.schemaVersion === 1, "schemaVersion must be 1");
  assert(SHA.test(value.candidateSha), "candidateSha must be one full lowercase SHA");
  assert(SHA.test(value.harnessSha), "harnessSha must be one full lowercase SHA");
  assert(
    value.candidateSha !== value.harnessSha,
    "candidate and harness SHAs must remain separate",
  );
  for (const [name, digest] of Object.entries({
    contractTestDigest: value.contractTestDigest,
    harnessManifestDigest: value.harnessManifestDigest,
    u12ReadinessDigest: value.u12ReadinessDigest,
    u12ArtifactDigest: value.u12ArtifactDigest,
  }))
    assert(DIGEST.test(digest), `${name} must be a lowercase SHA-256 digest`);
  for (const [name, identifier] of Object.entries({
    catalogReleaseId: value.catalogReleaseId,
    runId: value.runId,
    sourceDraftId: value.sourceDraftId,
    u12SnapshotId: value.u12SnapshotId,
  }))
    assert(IDENTIFIER.test(identifier), `${name} must be a stable identifier`);
  assert(value.themeId === "fashion-store", "themeId must be fashion-store");
  for (const [name, version] of Object.entries({
    platformContractVersion: value.platformContractVersion,
    themeVersion: value.themeVersion,
  }))
    assert(/^\d+\.\d+\.\d+$/.test(version), `${name} must be semantic version`);
  return value;
}

export function assertFashionU8TerminalManifest(
  value: FashionU8TerminalManifest,
): FashionU8TerminalManifest {
  assertFashionU8RunManifest(value);
  for (const [name, digest] of Object.entries({
    refreshAttestationDigest: value.refreshAttestationDigest,
    runManifestDigest: value.runManifestDigest,
    successorArtifactDigest: value.successorArtifactDigest,
    successorContentDigest: value.successorContentDigest,
  }))
    assert(DIGEST.test(digest), `${name} must be a lowercase SHA-256 digest`);
  for (const [name, identifier] of Object.entries({
    acceptanceRunId: value.acceptanceRunId,
    buildId: value.buildId,
    productId: value.productId,
    successorAuditId: value.successorAuditId,
    successorSnapshotId: value.successorSnapshotId,
  }))
    assert(IDENTIFIER.test(identifier), `${name} must be a stable identifier`);
  assert(
    value.successorSnapshotId !== value.u12SnapshotId,
    "successorSnapshotId must differ from the U12 baseline Snapshot",
  );
  assert(
    Number.isSafeInteger(value.experienceVersion) && value.experienceVersion > 0,
    "experienceVersion must be a positive integer",
  );
  assert(/^[A-Z]{3}$/.test(value.currency), "currency must be uppercase ISO-4217");
  return value;
}

function validTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function appendFashionU8Attempt(
  ledger: readonly FashionU8Attempt[],
  attempt: FashionU8Attempt,
): FashionU8Attempt[] {
  assert(IDENTIFIER.test(attempt.attemptId), "attemptId must be a stable identifier");
  assert(DIGEST.test(attempt.manifestDigest), "manifestDigest must be a lowercase SHA-256 digest");
  assert(validTimestamp(attempt.startedAt), "startedAt must be one canonical ISO timestamp");
  const priorEvents = ledger.filter(({ attemptId }) => attemptId === attempt.attemptId);
  if (priorEvents.length > 0) {
    const prior = priorEvents.at(-1)!;
    assert(prior.status === "started", "attemptId already has a terminal append-only event");
    assert(attempt.status !== "started", "attemptId cannot be started twice");
    assert(
      prior.kind === attempt.kind &&
        prior.manifestDigest === attempt.manifestDigest &&
        prior.startedAt === attempt.startedAt,
      "attempt terminal event cannot change its frozen start identity",
    );
  }
  const previousSameKind = [...ledger]
    .reverse()
    .find(({ attemptId, kind }) => kind === attempt.kind && attemptId !== attempt.attemptId);
  if (attempt.status === "started" && previousSameKind?.status === "failed") {
    assert(attempt.correctiveReason?.trim(), "a retry after failure requires a corrective reason");
  }
  if (attempt.status !== "started") {
    assert(
      attempt.finishedAt && validTimestamp(attempt.finishedAt),
      "finished attempts require finishedAt",
    );
  }
  if (attempt.status === "failed") {
    assert(attempt.failureClass?.trim(), "failed attempts require failureClass");
    assert(attempt.cleanup, "failed attempts require cleanup classification");
  }
  return [...ledger, { ...attempt }];
}

export async function recordFashionU8Attempt(
  ledgerPath: string,
  eventPath: string,
): Promise<FashionU8Attempt[]> {
  let ledger: FashionU8Attempt[] = [];
  try {
    ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as FashionU8Attempt[];
    assert(Array.isArray(ledger), "attempt ledger must be a JSON array");
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  const event = JSON.parse(await readFile(eventPath, "utf8")) as FashionU8Attempt;
  const next = appendFashionU8Attempt(ledger, event);
  const temporaryPath = `${ledgerPath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
    await rename(temporaryPath, ledgerPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return next;
}

const SENSITIVE_KEY =
  /authorization|cart.?token|cookie|grant|har|password|request.?bod|session|trace|storage.?state/i;
const SENSITIVE_VALUE = /(?:Bearer|CartToken)\s+\S+|__Host-shoppp-preview=/i;

export function redactFashionU8Evidence<T>(value: T): T {
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string" && SENSITIVE_VALUE.test(current)) {
      throw new Error(`sensitive evidence value at ${path}`);
    }
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`sensitive evidence field at ${path}.${key}`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(value, "$ ");
  return structuredClone(value);
}

function exactOrigin(value: string, name: string): string {
  const url = new URL(value);
  assert(
    url.protocol === "https:" &&
      url.origin === value &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    `${name} must be one exact credential-free HTTPS origin`,
  );
  return value;
}

function objectValue(value: unknown, stage: string): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value), `${stage} was invalid`);
  return value as Record<string, unknown>;
}

async function dataResponse(response: Response, stage: string): Promise<unknown> {
  assert(response.ok, `${stage} failed`);
  const payload = objectValue(await response.json(), stage);
  assert("data" in payload, `${stage} returned no data`);
  return payload.data;
}

function fetchWithTimeout(
  fetcher: StagingLatencyFetch,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetcher(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(CONTROL_PLANE_TIMEOUT_MS),
  });
}

function inputIdentity(manifest: FashionU8TerminalManifest) {
  return {
    catalogReleaseId: manifest.catalogReleaseId,
    experienceSnapshotId: manifest.successorSnapshotId,
    experienceVersion: manifest.experienceVersion,
    platformContractVersion: manifest.platformContractVersion,
    themeId: manifest.themeId,
    themeVersion: manifest.themeVersion,
  };
}

function exactIdentity(value: unknown, expected: ReturnType<typeof inputIdentity>): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(expected).every(
    ([key, expectedValue]) => (value as Record<string, unknown>)[key] === expectedValue,
  );
}

function previewCookie(response: Response): string {
  const header = response.headers.get("Set-Cookie") ?? "";
  const match = /(?:^|,\s*)(__Host-shoppp-preview=[A-Za-z0-9_-]{16,256})(?:;|$)/.exec(header);
  assert(match?.[1], "preview grant redemption returned no private session");
  return match[1];
}

export async function runFashionStagingU8(
  config: FashionU8TerminalConfig,
  dependencies: FashionU8Dependencies,
): Promise<FashionU8TerminalReport> {
  const manifest = assertFashionU8TerminalManifest(config.manifest);
  exactOrigin(config.authorityOrigin, "authorityOrigin");
  exactOrigin(config.handoffOrigin, "handoffOrigin");
  exactOrigin(config.previewOrigin, "previewOrigin");
  assert(
    /^[A-Za-z0-9_-]{32,256}$/.test(config.serviceToken),
    "serviceToken must be one opaque service credential",
  );
  if (config.recoveryRunId) {
    assert(IDENTIFIER.test(config.recoveryRunId), "recoveryRunId must be a stable identifier");
    assert(
      config.recoveryRunId !== manifest.acceptanceRunId,
      "recoveryRunId must name an interrupted run",
    );
  }
  const fetcher = dependencies.fetcher ?? fetch;
  const latencyRunner = dependencies.latencyRunner ?? runStagingLatencyProbe;
  let stage = "build_identity";
  let lifecycleCleanupRequired = false;
  let previewCleanupRequired = false;
  let cleanupAttempted = false;
  let cleanupFailure = false;
  let proofFailure: string | undefined;
  let latency: StagingLatencyReport | undefined;

  const cleanup = async (): Promise<void> => {
    if ((!lifecycleCleanupRequired && !previewCleanupRequired) || cleanupAttempted) return;
    cleanupAttempted = true;
    if (lifecycleCleanupRequired) {
      try {
        await dependencies.lifecycle.cleanup();
      } catch {
        cleanupFailure = true;
      }
    }
    if (previewCleanupRequired) {
      try {
        const response = await fetchWithTimeout(
          fetcher,
          `${config.authorityOrigin}/admin/storefront-experiences/snapshots/${manifest.successorSnapshotId}/revoke`,
          {
            body: JSON.stringify({
              reason: `Fashion U8 cleanup ${manifest.acceptanceRunId} ${manifest.runManifestDigest}`,
            }),
            headers: {
              Authorization: `Bearer ${config.serviceToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        assert(response.ok, "preview access cleanup failed");
      } catch {
        cleanupFailure = true;
      }
    }
  };

  try {
    const expectedIdentity = inputIdentity(manifest);
    const build = objectValue(
      await dataResponse(
        await fetchWithTimeout(
          fetcher,
          `${config.authorityOrigin}/admin/storefront-experiences/builds/${manifest.buildId}`,
          { headers: { Authorization: `Bearer ${config.serviceToken}` } },
        ),
        stage,
      ),
      stage,
    );
    assert(
      build.id === manifest.buildId &&
        build.status === "deployed" &&
        build.snapshotId === manifest.successorSnapshotId &&
        build.artifactDigest === manifest.successorArtifactDigest &&
        exactIdentity(build.inputIdentity, expectedIdentity),
      "deployed build identity mismatch",
    );

    stage = "successor_identity";
    const successor = objectValue(
      await dataResponse(
        await fetchWithTimeout(
          fetcher,
          `${config.authorityOrigin}/admin/storefront-experiences/snapshots/${manifest.successorSnapshotId}`,
          { headers: { Authorization: `Bearer ${config.serviceToken}` } },
        ),
        stage,
      ),
      stage,
    );
    assert(
      successor.id === manifest.successorSnapshotId &&
        successor.kind === "approved" &&
        successor.contentDigest === manifest.successorContentDigest,
      "approved successor identity mismatch",
    );

    if (config.recoveryRunId) {
      stage = "reconciliation";
      await dependencies.lifecycle.reconcile(config.recoveryRunId);
    }

    stage = "preview_grant";
    previewCleanupRequired = true;
    const grant = objectValue(
      await dataResponse(
        await fetchWithTimeout(
          fetcher,
          `${config.authorityOrigin}/admin/storefront-experiences/snapshots/${manifest.successorSnapshotId}/grants`,
          {
            body: JSON.stringify({
              catalogReleaseId: manifest.catalogReleaseId,
              origin: config.previewOrigin,
              reason: `Fashion U8 ${manifest.acceptanceRunId} ${manifest.runManifestDigest}`,
            }),
            headers: {
              Authorization: `Bearer ${config.serviceToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        ),
        stage,
      ),
      stage,
    );
    assert(
      typeof grant.grant === "string" &&
        grant.redeemUrl === `${config.previewOrigin}/__preview/session` &&
        grant.snapshotId === manifest.successorSnapshotId &&
        exactIdentity(grant.inputIdentity, expectedIdentity),
      "preview grant identity mismatch",
    );

    stage = "preview_redemption";
    const redemption = await fetchWithTimeout(fetcher, grant.redeemUrl as string, {
      body: JSON.stringify({ grant: grant.grant }),
      headers: { "Content-Type": "application/json", Origin: config.handoffOrigin },
      method: "POST",
      redirect: "manual",
    });
    assert(
      redemption.status === 303 && redemption.headers.get("Location") === "/",
      "preview grant redemption failed",
    );
    const cookie = previewCookie(redemption);

    stage = "preview_context";
    const contextResponse = await fetchWithTimeout(
      fetcher,
      `${config.previewOrigin}/__preview/context`,
      {
        headers: { Cookie: cookie },
      },
    );
    assert(contextResponse.ok, "private preview context failed");
    const previewContext = objectValue(await contextResponse.json(), stage);
    assert(
      previewContext.environment === "private-preview" &&
        previewContext.snapshotId === manifest.successorSnapshotId &&
        previewContext.contentDigest === manifest.successorContentDigest,
      "private preview context identity mismatch",
    );

    stage = "acceptance_lock";
    lifecycleCleanupRequired = true;
    await dependencies.lifecycle.acquire();

    stage = "latency_probe";
    latency = await latencyRunner(
      {
        catalogReleaseId: manifest.catalogReleaseId,
        currency: manifest.currency,
        previewCookie: cookie,
        previewOrigin: config.previewOrigin,
        productId: manifest.productId,
        runId: manifest.acceptanceRunId,
        sampleCount: 20,
        shippingConcurrency: 4,
        timeoutMs: 10_000,
      },
      fetcher,
      {
        cleanup,
        registerCart: async (cartId) => {
          await dependencies.lifecycle.registerCart(cartId);
        },
      },
    );
  } catch {
    proofFailure = `${stage}_failed`;
    if (lifecycleCleanupRequired) {
      try {
        await dependencies.lifecycle.failure(proofFailure);
      } catch {
        // Failure recording is best-effort; the non-secret proof classification remains authoritative.
      }
    }
  } finally {
    await cleanup();
  }

  const report: FashionU8TerminalReport = {
    buildId: manifest.buildId,
    catalogReleaseId: manifest.catalogReleaseId,
    cleanup: cleanupFailure
      ? { attempted: cleanupAttempted, failure: "cleanup_failed", passed: false }
      : { attempted: cleanupAttempted, passed: cleanupAttempted },
    ...(latency ? { latency } : {}),
    passed: !proofFailure && !cleanupFailure && Boolean(latency),
    ...(proofFailure ? { proofFailure } : {}),
    refreshAttestationDigest: manifest.refreshAttestationDigest,
    runId: manifest.acceptanceRunId,
    runManifestDigest: manifest.runManifestDigest,
    successorArtifactDigest: manifest.successorArtifactDigest,
    successorAuditId: manifest.successorAuditId,
    successorContentDigest: manifest.successorContentDigest,
    successorSnapshotId: manifest.successorSnapshotId,
  };
  return redactFashionU8Evidence(report);
}

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function lifecycleForManifest(
  manifest: FashionU8TerminalManifest,
  environment: Record<string, string | undefined>,
): FashionU8Lifecycle {
  const baseEnvironment = (
    runId: string,
    ownerRunId = manifest.acceptanceRunId,
  ): Record<string, string | undefined> => ({
    ...environment,
    FASHION_U12_ARTIFACT_DIGEST: manifest.successorArtifactDigest,
    FASHION_U12_CATALOG_RELEASE_ID: manifest.catalogReleaseId,
    FASHION_U12_COMMIT_SHA: manifest.candidateSha,
    FASHION_U12_OWNER: fashionU8OwnerForRun(ownerRunId),
    FASHION_U12_RUN_ID: runId,
    FASHION_U12_SNAPSHOT_ID: manifest.successorSnapshotId,
  });
  const execute = async (
    action: "acquire" | "cleanup" | "failure" | "reconcile" | "register",
    additions: Record<string, string | undefined> = {},
  ) =>
    runFashionStagingU12(
      loadFashionStagingU12Config(action, {
        ...baseEnvironment(manifest.acceptanceRunId),
        ...additions,
      }),
    );
  return {
    acquire: () => execute("acquire"),
    cleanup: () => execute("cleanup"),
    failure: (failure) => execute("failure", { FASHION_U12_FAILURE: failure }),
    reconcile: (runId) =>
      runFashionStagingU12(loadFashionStagingU12Config("reconcile", baseEnvironment(runId, runId))),
    registerCart: (cartId) =>
      execute("register", {
        FASHION_U12_RESOURCE_ID: cartId,
        FASHION_U12_RESOURCE_TYPE: "cart",
      }),
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      attempt: { type: "string" },
      ledger: { type: "string" },
      manifest: { type: "string" },
    },
    strict: true,
  });
  if (values.attempt || values.ledger) {
    if (!values.attempt || !values.ledger || values.manifest) {
      throw new Error("Use --ledger and --attempt together, without --manifest");
    }
    const ledger = await recordFashionU8Attempt(values.ledger, values.attempt);
    process.stdout.write(`${JSON.stringify({ events: ledger.length, recorded: true })}\n`);
    process.exit(0);
  }
  if (!values.manifest) throw new Error("Use --manifest=<terminal-manifest.json>");
  const manifest = JSON.parse(await readFile(values.manifest, "utf8")) as FashionU8TerminalManifest;
  const config: FashionU8TerminalConfig = {
    authorityOrigin: required(process.env, "FASHION_U8_AUTHORITY_ORIGIN"),
    handoffOrigin: required(process.env, "FASHION_U8_HANDOFF_ORIGIN"),
    manifest,
    previewOrigin: required(process.env, "FASHION_U8_PREVIEW_ORIGIN"),
    ...(process.env.FASHION_U8_RECOVERY_RUN_ID?.trim()
      ? { recoveryRunId: process.env.FASHION_U8_RECOVERY_RUN_ID.trim() }
      : {}),
    serviceToken: required(process.env, "FASHION_U8_ADMIN_SERVICE_TOKEN"),
  };
  const report = await runFashionStagingU8(config, {
    lifecycle: lifecycleForManifest(manifest, process.env),
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.passed) process.exitCode = 1;
}
