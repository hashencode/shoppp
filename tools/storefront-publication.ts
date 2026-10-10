import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parsePublicationEvidence } from "./release-validate";
import {
  canonicalStorefrontJson,
  sameStorefrontPublicationIdentity,
  storefrontActivationObservationSchema,
  storefrontPublicationBuildManifestSchema,
  storefrontPublicationCallbackSchema,
  storefrontPublicationReceiptSchema,
  storefrontPublicationIdentitySchema,
  storefrontReleaseMarkerSchema,
  type StorefrontPublicationIdentity,
  type StorefrontPublication,
  type StorefrontPublicationReceipt,
  type StorefrontReleaseMarker,
} from "../packages/contracts/src/storefront-publication";

type PublicationFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PublicationSource {
  apiOrigin: string;
  buildToken: string;
  sourceEnvironment: "staging" | "production" | "development";
  publicationId: string;
}
export interface PublicationTarget {
  environment: "staging" | "production";
  accountId: string;
  workerName: string;
  cloudflareToken: string;
  storefrontOrigin: string;
}
interface PublicationRun {
  runId: string;
  runAttempt: number;
  sourceCommit: string;
}
export interface StorefrontBaseline {
  workerVersionId: string;
  marker: StorefrontReleaseMarker | null;
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function exactOrigin(value: string): string {
  const url = new URL(value);
  assert(
    url.protocol === "https:" && url.origin === value && !url.username && !url.password,
    "Publication origin must be exact credential-free HTTPS",
  );
  return value;
}
function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function assertPublicationSource(source: PublicationSource): void {
  exactOrigin(source.apiOrigin);
  assert(
    source.sourceEnvironment === "staging" || source.sourceEnvironment === "production",
    "Publication source must be a protected environment",
  );
  assert(
    source.buildToken && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(source.publicationId),
    "Publication credential or ID is missing",
  );
}
function endpoint(source: PublicationSource, suffix = ""): string {
  assertPublicationSource(source);
  return `${source.apiOrigin}/build/storefront-publications/${encodeURIComponent(source.publicationId)}${suffix}`;
}
async function jsonRequest(
  url: string,
  init: RequestInit,
  fetcher: PublicationFetch,
): Promise<unknown> {
  const response = await fetcher(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, `Publication request failed (${response.status})`);
  return response.json();
}
export async function fetchPublicationBuild(
  source: PublicationSource,
  releaseId: string,
  fetcher: PublicationFetch = fetch,
) {
  const result = storefrontPublicationBuildManifestSchema.parse(
    await jsonRequest(
      endpoint(source),
      {
        headers: { Authorization: `Bearer ${source.buildToken}` },
      },
      fetcher,
    ),
  );
  const input = result.input;
  assert(
    result.publication.id === source.publicationId && input.publicationId === source.publicationId,
    "Publication response ID differs from the protected request",
  );
  assert(
    result.publication.environment === source.sourceEnvironment &&
      input.sourceEnvironment === source.sourceEnvironment,
    "Publication response crosses its source environment",
  );
  assert(
    input.inputIdentity.catalogReleaseId === releaseId &&
      sameStorefrontPublicationIdentity(input.inputIdentity, result.publication.identity),
    "Publication release or identity differs from the protected request",
  );
  assert(
    digest(input.catalogManifestJson) === input.inputIdentity.catalogManifestDigest,
    "Publication Catalog raw-byte digest mismatch",
  );
  assert(
    canonicalStorefrontJson(JSON.parse(input.catalogManifestJson)) ===
      canonicalStorefrontJson(input.catalogRelease),
    "Publication Catalog input differs from retained raw bytes",
  );
  assert(
    digest(canonicalStorefrontJson(input.snapshot)) === input.inputIdentity.snapshotDigest,
    "Publication Snapshot digest mismatch",
  );
  return result;
}
export async function publicationCallback(
  source: PublicationSource,
  callback: unknown,
  fetcher: PublicationFetch = fetch,
): Promise<void> {
  const body = storefrontPublicationCallbackSchema.parse(callback);
  const response = await fetcher(endpoint(source, "/status"), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${source.buildToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `publication-${body.status}-${digest(canonicalStorefrontJson({ publicationId: source.publicationId, callback: body }))}`,
    },
    body: JSON.stringify(body),
  });
  assert(response.ok, `Publication callback rejected (${response.status})`);
}
function deploymentsUrl(target: PublicationTarget): string {
  assert(
    /^[A-Za-z0-9_-]+$/.test(target.accountId) &&
      /^[A-Za-z0-9_-]+$/.test(target.workerName) &&
      target.cloudflareToken,
    "Protected Cloudflare target is missing",
  );
  exactOrigin(target.storefrontOrigin);
  return `https://api.cloudflare.com/client/v4/accounts/${target.accountId}/workers/scripts/${target.workerName}/deployments`;
}
async function deployedVersion(target: PublicationTarget, fetcher: PublicationFetch) {
  const result = (await jsonRequest(
    deploymentsUrl(target),
    { headers: { Authorization: `Bearer ${target.cloudflareToken}` } },
    fetcher,
  )) as {
    success?: boolean;
    result?: Array<{
      id: string;
      created_on: string;
      versions: Array<{ version_id: string; percentage: number }>;
    }>;
  };
  assert(
    result.success && Array.isArray(result.result) && result.result.length > 0,
    "Cloudflare deployment observation is missing",
  );
  const current = [...result.result].sort(
    (a, b) => Date.parse(b.created_on) - Date.parse(a.created_on),
  )[0]!;
  assert(
    current.versions.length === 1 && current.versions[0]?.percentage === 100,
    "Storefront must serve exactly one version at 100 percent traffic",
  );
  assert(current.id && current.versions[0].version_id, "Cloudflare deployment identity is missing");
  return { workerVersionId: current.versions[0].version_id, deploymentId: current.id };
}
async function publicObservation(target: PublicationTarget, fetcher: PublicationFetch) {
  const response = await fetcher(
    `${exactOrigin(target.storefrontOrigin)}/.well-known/shoppp-release`,
    {
      redirect: "error",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 404) return null;
  assert(response.ok, "Public storefront observation is unavailable");
  return storefrontActivationObservationSchema.parse(await response.json());
}
export async function observeStorefrontActivation(
  options: {
    target: PublicationTarget;
    sourceEnvironment: PublicationSource["sourceEnvironment"];
    identity: StorefrontPublicationIdentity;
    expectedWorkerVersionId?: string;
  },
  fetcher: PublicationFetch = fetch,
) {
  const deployment = await deployedVersion(options.target, fetcher);
  const marker = await publicObservation(options.target, fetcher);
  assert(marker, "Public storefront release marker is missing");
  assert(
    marker.workerVersionId === deployment.workerVersionId,
    "Public runtime version differs from the Cloudflare deployment",
  );
  assert(
    !options.expectedWorkerVersionId ||
      deployment.workerVersionId === options.expectedWorkerVersionId,
    "Deployed Worker version differs from the saved exact version",
  );
  assert(
    marker.sourceEnvironment === options.sourceEnvironment &&
      sameStorefrontPublicationIdentity(marker.identity, options.identity),
    "Public storefront identity differs from the approved publication",
  );
  return { ...deployment, observedAt: new Date().toISOString() };
}
export async function captureStorefrontBaseline(
  target: PublicationTarget,
  expectedReceipt: StorefrontPublicationReceipt | null,
  fetcher: PublicationFetch = fetch,
): Promise<StorefrontBaseline> {
  const deployment = await deployedVersion(target, fetcher);
  const observation = await publicObservation(target, fetcher);
  assert(
    !observation || observation.workerVersionId === deployment.workerVersionId,
    "Baseline public runtime version mismatch",
  );
  if (expectedReceipt) {
    assert(
      expectedReceipt.environment === target.environment &&
        expectedReceipt.workerVersionId === deployment.workerVersionId &&
        observation &&
        observation.sourceEnvironment === expectedReceipt.environment &&
        sameStorefrontPublicationIdentity(expectedReceipt.identity, observation.identity),
      "Actual baseline differs from the previous active publication",
    );
  }
  return {
    workerVersionId: deployment.workerVersionId,
    marker: observation
      ? {
          schemaVersion: 1,
          sourceEnvironment: observation.sourceEnvironment,
          identity: observation.identity,
        }
      : null,
  };
}
export interface RetainedStorefrontBaseline {
  schemaVersion: 1;
  publicationId: string;
  sourceEnvironment: PublicationSource["sourceEnvironment"];
  environment: PublicationTarget["environment"];
  workerName: string;
  storefrontOrigin: string;
  run: PublicationRun;
  identity: StorefrontPublicationIdentity;
  capturedAt: string;
  baseline: StorefrontBaseline;
}
interface BaselineContext {
  source: PublicationSource;
  target: PublicationTarget;
  run: PublicationRun;
  identity: StorefrontPublicationIdentity;
  path: string;
}
export async function retainStorefrontBaseline(
  options: BaselineContext & {
    expectedReceipt: StorefrontPublicationReceipt | null;
  },
  fetcher: PublicationFetch = fetch,
): Promise<RetainedStorefrontBaseline> {
  storefrontPublicationCallbackSchema.parse({ ...options.run, status: "building" });
  const baseline = await captureStorefrontBaseline(
    options.target,
    options.expectedReceipt,
    fetcher,
  );
  const record: RetainedStorefrontBaseline = {
    schemaVersion: 1,
    publicationId: options.source.publicationId,
    sourceEnvironment: options.source.sourceEnvironment,
    environment: options.target.environment,
    workerName: options.target.workerName,
    storefrontOrigin: exactOrigin(options.target.storefrontOrigin),
    run: options.run,
    identity: storefrontPublicationIdentitySchema.parse(options.identity),
    capturedAt: new Date().toISOString(),
    baseline,
  };
  await mkdir(dirname(resolve(options.path)), { recursive: true });
  await writeFile(resolve(options.path), JSON.stringify(record), { flag: "wx" });
  return record;
}
export async function readRetainedStorefrontBaseline(
  options: BaselineContext,
): Promise<RetainedStorefrontBaseline> {
  const value = JSON.parse(
    await readFile(resolve(options.path), "utf8"),
  ) as RetainedStorefrontBaseline;
  assert(
    value &&
      value.schemaVersion === 1 &&
      value.publicationId === options.source.publicationId &&
      value.sourceEnvironment === options.source.sourceEnvironment &&
      value.environment === options.target.environment &&
      value.workerName === options.target.workerName &&
      value.storefrontOrigin === exactOrigin(options.target.storefrontOrigin) &&
      canonicalStorefrontJson(value.run) === canonicalStorefrontJson(options.run),
    "The retained baseline does not match this publication, target or protected run",
  );
  const identity = storefrontPublicationIdentitySchema.parse(value.identity);
  assert(
    sameStorefrontPublicationIdentity(identity, options.identity),
    "The retained baseline publication identity differs",
  );
  assert(
    typeof value.capturedAt === "string" &&
      Number.isFinite(Date.parse(value.capturedAt)) &&
      value.baseline &&
      typeof value.baseline.workerVersionId === "string" &&
      value.baseline.workerVersionId.length > 0 &&
      value.baseline.workerVersionId.length <= 160 &&
      !/\s/.test(value.baseline.workerVersionId),
    "The retained baseline version or timestamp is invalid",
  );
  const marker =
    value.baseline.marker === null
      ? null
      : storefrontReleaseMarkerSchema.parse(value.baseline.marker);
  return {
    ...value,
    identity,
    baseline: { workerVersionId: value.baseline.workerVersionId, marker },
  };
}
export async function recheckStorefrontBaseline(
  target: PublicationTarget,
  baseline: StorefrontBaseline,
  fetcher: PublicationFetch = fetch,
): Promise<void> {
  const actual = await captureStorefrontBaseline(target, null, fetcher);
  assert(
    canonicalStorefrontJson(actual) === canonicalStorefrontJson(baseline),
    "The storefront baseline changed after capture; stop before mutation",
  );
}

async function restoreBaseline(
  target: PublicationTarget,
  baseline: StorefrontBaseline,
  fetcher: PublicationFetch,
): Promise<void> {
  await jsonRequest(
    deploymentsUrl(target),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.cloudflareToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        strategy: "percentage",
        versions: [{ version_id: baseline.workerVersionId, percentage: 100 }],
      }),
    },
    fetcher,
  );
  const current = await deployedVersion(target, fetcher);
  assert(current.workerVersionId === baseline.workerVersionId, "Restored Worker version mismatch");
  const observation = await publicObservation(target, fetcher);
  if (baseline.marker) {
    assert(
      observation &&
        observation.workerVersionId === baseline.workerVersionId &&
        canonicalStorefrontJson(baseline.marker) ===
          canonicalStorefrontJson({
            schemaVersion: observation.schemaVersion,
            sourceEnvironment: observation.sourceEnvironment,
            identity: observation.identity,
          }),
      "Restored public identity mismatch",
    );
  } else {
    assert(!observation, "Restored legacy baseline unexpectedly changed identity");
  }
}
export async function restorePublicationVersion(
  options: {
    target: PublicationTarget;
    sourceEnvironment: PublicationSource["sourceEnvironment"];
    identity: StorefrontPublicationIdentity;
    receipt: StorefrontPublicationReceipt;
  },
  fetcher: PublicationFetch = fetch,
): Promise<void> {
  assert(
    options.receipt.environment === options.target.environment &&
      options.target.environment === options.sourceEnvironment &&
      sameStorefrontPublicationIdentity(options.receipt.identity, options.identity),
    "Retained rollback receipt crosses its environment or approved identity",
  );
  await jsonRequest(
    deploymentsUrl(options.target),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.target.cloudflareToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        strategy: "percentage",
        versions: [{ version_id: options.receipt.workerVersionId, percentage: 100 }],
      }),
    },
    fetcher,
  );
  await observeStorefrontActivation(
    { ...options, expectedWorkerVersionId: options.receipt.workerVersionId },
    fetcher,
  );
}

export async function completeStorefrontPublication(
  options: {
    source: PublicationSource;
    target: PublicationTarget;
    identity: StorefrontPublicationIdentity;
    run: PublicationRun;
    artifactDigest: string;
    reportDigest: string;
    expectedWorkerVersionId?: string;
  },
  fetcher: PublicationFetch = fetch,
): Promise<StorefrontPublicationReceipt> {
  assert(
    options.source.sourceEnvironment === options.target.environment,
    "Activation target must equal the source environment; staging proof cannot activate production",
  );
  const observation = await observeStorefrontActivation(
    { ...options, sourceEnvironment: options.source.sourceEnvironment },
    fetcher,
  );
  const receipt = storefrontPublicationReceiptSchema.parse({
    environment: options.target.environment,
    identity: options.identity,
    ...observation,
    artifactDigest: options.artifactDigest,
    reportDigest: options.reportDigest,
  });
  try {
    await publicationCallback(
      options.source,
      { ...options.run, status: "activated", receipt },
      fetcher,
    );
  } catch (error) {
    // A timeout can occur after the producer committed the pointer. Never restore
    // behind an accepted receipt merely because the HTTP response was lost.
    if (error instanceof Error && /callback rejected \(4[0-9]{2}\)/.test(error.message))
      throw error;
    let accepted = false;
    try {
      const current = await fetchPublicationBuild(
        options.source,
        options.identity.catalogReleaseId,
        fetcher,
      );
      accepted =
        current.publication.status === "succeeded" &&
        current.publication.runId === options.run.runId &&
        current.publication.runAttempt === options.run.runAttempt &&
        current.publication.sourceCommit === options.run.sourceCommit &&
        current.publication.receipt !== null &&
        canonicalStorefrontJson(current.publication.receipt) === canonicalStorefrontJson(receipt);
    } catch {
      /* Without a conclusive read the pointer outcome remains unknown. */
    }
    if (!accepted) throw new PublicationReceiptUncertainError();
    try {
      await observeStorefrontActivation(
        { ...options, sourceEnvironment: options.source.sourceEnvironment },
        fetcher,
      );
    } catch {
      throw new PublicationReceiptUncertainError();
    }
  }
  return receipt;
}
export class PublicationReceiptUncertainError extends Error {
  constructor() {
    super("Publication receipt outcome is unresolved; verify the active request before recovery");
  }
}
export function assertStorefrontRecoveryOwner(
  publication: StorefrontPublication,
  run: PublicationRun,
  identity: StorefrontPublicationIdentity,
): void {
  assert(
    (publication.status === "building" || publication.status === "unresolved") &&
      publication.runId === run.runId &&
      publication.runAttempt === run.runAttempt &&
      publication.sourceCommit === run.sourceCommit &&
      sameStorefrontPublicationIdentity(publication.identity, identity),
    "Recovery requires the same unfinished protected run; succeeded, failed or changed requests cannot be restored",
  );
}
export async function recoverStorefrontPublication(
  options: {
    source: PublicationSource;
    target: PublicationTarget;
    run: PublicationRun;
    baseline: StorefrontBaseline;
    failureCode: string;
  },
  fetcher: PublicationFetch = fetch,
): Promise<boolean> {
  let restorationVerified = false;
  try {
    await restoreBaseline(options.target, options.baseline, fetcher);
    restorationVerified = true;
  } catch {
    /* A failed restoration must remain unresolved at the producer. */
  }
  await publicationCallback(
    options.source,
    { ...options.run, status: "failed", failureCode: options.failureCode, restorationVerified },
    fetcher,
  );
  return restorationVerified;
}
async function command(arguments_: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(arguments_, {
    cwd,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  assert((await child.exited) === 0, `Publication command failed: ${arguments_[0]}`);
}
function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  assert(value, `Publication requires ${key}`);
  return value;
}
function rootPath(): string {
  return resolve(import.meta.dir, "..");
}
if (import.meta.main) {
  const { positionals, values } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      input: { type: "string" },
      metadata: { type: "string" },
      baseline: { type: "string" },
      "proof-only": { type: "boolean" },
      "proof-command": { type: "string" },
    },
  });
  const action = positionals[0];
  const proofOnly = values["proof-only"] ?? false;
  const source: PublicationSource = {
    apiOrigin: required(process.env, "API_URL"),
    buildToken: proofOnly ? "unused-proof-only" : required(process.env, "BUILD_MANIFEST_TOKEN"),
    sourceEnvironment: required(
      process.env,
      "SOURCE_ENVIRONMENT",
    ) as PublicationSource["sourceEnvironment"],
    publicationId: required(process.env, "PUBLICATION_ID"),
  };
  const run = {
    runId: required(process.env, "GITHUB_RUN_ID"),
    runAttempt: Number(required(process.env, "GITHUB_RUN_ATTEMPT")),
    sourceCommit: required(process.env, "RELEASE_EXPECTED_COMMIT"),
  };
  if (action === "fail") {
    await publicationCallback(source, {
      ...run,
      status: "failed",
      failureCode: process.env.PUBLICATION_FAILURE_CODE ?? "validation_failed",
      restorationVerified: true,
    });
  } else if (action === "fetch") {
    const result = await fetchPublicationBuild(source, required(process.env, "RELEASE_ID"));
    const inputPath = resolve(values.input ?? "artifacts/storefront-publication/input.json");
    const metadataPath = resolve(
      values.metadata ?? "artifacts/storefront-publication/publication.json",
    );
    await mkdir(dirname(inputPath), { recursive: true });
    await mkdir(dirname(metadataPath), { recursive: true });
    await writeFile(inputPath, JSON.stringify(result.input), { flag: "wx" });
    await writeFile(metadataPath, JSON.stringify(result), { flag: "wx" });
    if (process.env.GITHUB_OUTPUT)
      await writeFile(
        process.env.GITHUB_OUTPUT,
        `operation=${result.publication.operation}\nsource_api_origin=${source.apiOrigin}\n`,
        { flag: "a" },
      );
    await publicationCallback(source, { ...run, status: "building" });
  } else if (action === "capture" || action === "deliver" || action === "recover") {
    const result = storefrontPublicationBuildManifestSchema.parse(
      JSON.parse(
        await readFile(
          resolve(values.metadata ?? "artifacts/storefront-publication/publication.json"),
          "utf8",
        ),
      ),
    );
    assert(
      result.publication.id === source.publicationId &&
        result.publication.environment === source.sourceEnvironment,
      "Delivery metadata differs from the protected request",
    );
    const environment = required(process.env, "ACTIVATION_ENVIRONMENT");
    assert(
      environment === "staging" || environment === "production",
      "Invalid protected activation environment",
    );
    const target: PublicationTarget = {
      environment,
      accountId: required(process.env, "CLOUDFLARE_ACCOUNT_ID"),
      cloudflareToken: required(process.env, "CLOUDFLARE_API_TOKEN"),
      workerName: required(process.env, "STOREFRONT_WORKER_NAME"),
      storefrontOrigin: required(process.env, "STOREFRONT_URL"),
    };
    assert(
      values["proof-only"]
        ? environment === "staging" && source.sourceEnvironment === "production"
        : environment === source.sourceEnvironment,
      "Protected delivery target crosses publication source",
    );
    if (action !== "recover" && result.publication.operation === "publish") {
      const reportContents = await readFile(
        resolve(rootPath(), `artifacts/releases/${required(process.env, "RELEASE_ID")}.json`),
        "utf8",
      );
      assert(
        `sha256:${digest(reportContents)}` === required(process.env, "EXPECTED_REPORT_DIGEST"),
        "Publication report digest mismatch",
      );
      const report = JSON.parse(reportContents) as {
        commit: string;
        status: string;
        publication: unknown;
      };
      const binding = parsePublicationEvidence(report.publication);
      assert(
        report.status === "passed" &&
          report.commit === run.sourceCommit &&
          binding.publicationId === source.publicationId &&
          binding.sourceEnvironment === source.sourceEnvironment &&
          sameStorefrontPublicationIdentity(binding.identity, result.publication.identity) &&
          binding.inputDigest === `sha256:${digest(JSON.stringify(result.input))}`,
        "Validated report does not bind this exact publication input",
      );
    } else if (action !== "recover") {
      assert(
        result.rollbackReceipt &&
          result.rollbackReceipt.environment === source.sourceEnvironment &&
          sameStorefrontPublicationIdentity(
            result.rollbackReceipt.identity,
            result.publication.identity,
          ),
        "Rollback retained receipt mismatch",
      );
    }
    if (action !== "recover" && !proofOnly) {
      await publicationCallback(source, { ...run, status: "building" });
      const current = await fetchPublicationBuild(
        source,
        result.publication.identity.catalogReleaseId,
      );
      assert(
        current.publication.status === "building" &&
          current.publication.runId === run.runId &&
          current.publication.runAttempt === run.runAttempt &&
          current.publication.sourceCommit === run.sourceCommit &&
          sameStorefrontPublicationIdentity(
            current.publication.identity,
            result.publication.identity,
          ) &&
          current.publication.operation === result.publication.operation &&
          current.publication.restoreWorkerVersionId === result.publication.restoreWorkerVersionId,
        "Publication is no longer owned by this pending protected run",
      );
    }
    const baselineContext = {
      source,
      target,
      run,
      identity: result.publication.identity,
      path: values.baseline ?? ".artifacts/storefront-publication/baseline.json",
    };
    if (action === "capture") {
      await retainStorefrontBaseline({
        ...baselineContext,
        expectedReceipt: environment === source.sourceEnvironment ? result.baselineReceipt : null,
      });
      console.log("Exact storefront baseline captured; retain its artifact before delivery");
      process.exit(0);
    }
    const retained = await readRetainedStorefrontBaseline(baselineContext);
    const baseline = retained.baseline;
    if (action === "recover") {
      if (!proofOnly) {
        const current = await fetchPublicationBuild(
          source,
          result.publication.identity.catalogReleaseId,
        );
        assertStorefrontRecoveryOwner(current.publication, run, result.publication.identity);
      }
      if (proofOnly) {
        await restoreBaseline(target, baseline, fetch);
      } else {
        const restored = await recoverStorefrontPublication({
          source,
          target,
          run,
          baseline,
          failureCode: process.env.PUBLICATION_FAILURE_CODE ?? "interrupted_delivery",
        });
        assert(restored, "Exact recovery remains unresolved; inspect the actual storefront");
      }
      console.log("Exact storefront baseline restored and its current public identity verified");
      process.exit(0);
    }
    await recheckStorefrontBaseline(target, baseline);
    const root = resolve(import.meta.dir, "..");
    try {
      let expectedWorkerVersionId: string | undefined;
      if (result.publication.operation === "rollback") {
        assert(
          !values["proof-only"] &&
            result.rollbackReceipt &&
            result.publication.restoreWorkerVersionId === result.rollbackReceipt.workerVersionId,
          "Rollback requires the retained successful exact-version receipt",
        );
        expectedWorkerVersionId = result.rollbackReceipt.workerVersionId;
        await restorePublicationVersion({
          target,
          sourceEnvironment: source.sourceEnvironment,
          identity: result.publication.identity,
          receipt: result.rollbackReceipt,
        });
      } else {
        await command(
          [
            "bunx",
            "wrangler",
            "versions",
            "upload",
            "worker-dist/index.js",
            "--env",
            environment,
            "--no-bundle",
            "--assets",
            ".output/public",
            "--tag",
            `publication-${source.publicationId}`,
            "--message",
            source.publicationId,
            "--strict",
          ],
          resolve(root, "apps/storefront"),
        );
        await command(
          [
            "bunx",
            "wrangler",
            "versions",
            "deploy",
            "--env",
            environment,
            "--version-tag",
            `publication-${source.publicationId}`,
            "--message",
            source.publicationId,
            "--yes",
          ],
          resolve(root, "apps/storefront"),
        );
      }
      await observeStorefrontActivation({
        target,
        sourceEnvironment: source.sourceEnvironment,
        identity: result.publication.identity,
        ...(expectedWorkerVersionId ? { expectedWorkerVersionId } : {}),
      });
      if (values["proof-command"])
        await command(["bash", "-euo", "pipefail", "-c", values["proof-command"]], root);
      if (values["proof-only"]) {
        await restoreBaseline(target, baseline, fetch);
      } else {
        const receipt =
          result.publication.operation === "rollback"
            ? result.rollbackReceipt!
            : {
                artifactDigest: required(process.env, "EXPECTED_DEPLOYABLE_DIGEST").replace(
                  /^sha256:/,
                  "",
                ),
                reportDigest: required(process.env, "EXPECTED_REPORT_DIGEST").replace(
                  /^sha256:/,
                  "",
                ),
              };
        await completeStorefrontPublication({
          source,
          target,
          identity: result.publication.identity,
          run,
          artifactDigest: receipt.artifactDigest,
          reportDigest: receipt.reportDigest,
          ...(expectedWorkerVersionId ? { expectedWorkerVersionId } : {}),
        });
      }
    } catch (error) {
      if (proofOnly) {
        await restoreBaseline(target, baseline, fetch);
      } else if (error instanceof PublicationReceiptUncertainError) {
        await publicationCallback(source, {
          ...run,
          status: "failed",
          failureCode: "receipt_unresolved",
          restorationVerified: false,
        });
      } else {
        await recoverStorefrontPublication({
          source,
          target,
          run,
          baseline,
          failureCode: "activation_failed",
        });
      }
      throw error;
    }
  } else {
    throw new Error("Use publication fetch, capture, deliver, recover or fail");
  }
}
