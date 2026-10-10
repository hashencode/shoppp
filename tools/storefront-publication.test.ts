import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { canonicalCatalogReleaseSchema } from "../packages/contracts/src/catalog";
import {
  canonicalStorefrontJson,
  storefrontPublicationBuildManifestSchema,
} from "../packages/contracts/src/storefront-publication";
import {
  observeStorefrontActivation,
  completeStorefrontPublication,
  recoverStorefrontPublication,
  assertPublicationSource,
  fetchPublicationBuild,
  captureStorefrontBaseline,
  PublicationReceiptUncertainError,
  restorePublicationVersion,
  retainStorefrontBaseline,
  readRetainedStorefrontBaseline,
  recheckStorefrontBaseline,
  assertStorefrontRecoveryOwner,
  publicationCallback,
} from "./storefront-publication";

const identity = {
  catalogReleaseId: "release-approved",
  catalogManifestDigest: "a".repeat(64),
  catalogSourceDigest: "b".repeat(64),
  experienceSnapshotId: "snapshot-approved",
  snapshotDigest: "c".repeat(64),
  contactVersion: "d".repeat(64),
  experienceVersion: 3,
  themeId: "fashion-store",
  themeVersion: "2.0.0",
  platformContractVersion: "1.0.0",
};
const target = {
  environment: "staging" as const,
  accountId: "account",
  workerName: "shoppp-storefront-staging",
  cloudflareToken: "cf-secret",
  storefrontOrigin: "https://storefront-staging.example.test",
};
const source = {
  apiOrigin: "https://api.production.example.test",
  buildToken: "build-secret",
  sourceEnvironment: "production" as const,
  publicationId: "publication-exact",
};
const run = { runId: "12345", runAttempt: 2, sourceCommit: "e".repeat(40) };
const deployment = (version = "version-new", percentage = 100) => ({
  id: "deployment-observed",
  created_on: "2026-10-11T00:00:00Z",
  versions: [{ version_id: version, percentage }],
});
const marker = (version = "version-new") => ({
  schemaVersion: 1,
  sourceEnvironment: "production",
  identity,
  workerVersionId: version,
});
function network(
  options: { percentage?: number; markerVersion?: string; receiptRejected?: boolean } = {},
) {
  const callbacks: unknown[] = [];
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    if (url.startsWith("https://api.cloudflare.com/")) {
      return Response.json({
        success: true,
        result: [deployment("version-new", options.percentage)],
      });
    }
    if (url.endsWith("/.well-known/shoppp-release"))
      return Response.json(marker(options.markerVersion));
    if (url.endsWith("/status")) {
      callbacks.push(JSON.parse(String(init?.body)));
      return Response.json({ data: {} }, { status: options.receiptRejected ? 409 : 200 });
    }
    throw new Error(`Unexpected test request ${url}`);
  };
  return { fetcher: fetcher, callbacks, requests };
}

describe("formal publication runner", () => {
  test("checks one version at full traffic and the actual runtime marker", async () => {
    const http = network();
    await expect(
      observeStorefrontActivation(
        { target, sourceEnvironment: "production", identity },
        http.fetcher,
      ),
    ).resolves.toMatchObject({
      workerVersionId: "version-new",
      deploymentId: "deployment-observed",
    });
    expect(http.requests[0]?.authorization).toBe("Bearer cf-secret");
    expect(http.requests[1]?.authorization).toBeNull();
    await expect(
      observeStorefrontActivation(
        { target, sourceEnvironment: "production", identity },
        network({ percentage: 50 }).fetcher,
      ),
    ).rejects.toThrow(/100 percent/);
    await expect(
      observeStorefrontActivation(
        { target, sourceEnvironment: "production", identity },
        network({ markerVersion: "stale-version" }).fetcher,
      ),
    ).rejects.toThrow(/runtime version/);
  });

  test("production-source staging proof cannot activate its production producer", async () => {
    const http = network();
    await expect(
      completeStorefrontPublication(
        {
          source,
          target,
          identity,
          run,
          artifactDigest: "f".repeat(64),
          reportDigest: "0".repeat(64),
        },
        http.fetcher,
      ),
    ).rejects.toThrow(/source environment/);
    expect(http.callbacks).toHaveLength(0);
  });

  test("submits a run-bound receipt only after observation, and surfaces stale callback rejection", async () => {
    const http = network();
    const stagingSource = { ...source, sourceEnvironment: "staging" as const };
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/.well-known/shoppp-release"))
        return Response.json({ ...marker(), sourceEnvironment: "staging" });
      return http.fetcher(input, init);
    };
    const receipt = await completeStorefrontPublication(
      {
        source: stagingSource,
        target,
        identity,
        run,
        artifactDigest: "f".repeat(64),
        reportDigest: "0".repeat(64),
      },
      fetcher,
    );
    expect(receipt.environment).toBe("staging");
    expect(http.callbacks[0]).toMatchObject({
      ...run,
      status: "activated",
      receipt: { identity, environment: "staging", workerVersionId: "version-new" },
    });
    const rejected = network({ receiptRejected: true });
    const failingFetch = async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith("/.well-known/shoppp-release")
        ? Response.json({ ...marker(), sourceEnvironment: "staging" })
        : rejected.fetcher(input, init);
    await expect(
      completeStorefrontPublication(
        {
          source: stagingSource,
          target,
          identity,
          run,
          artifactDigest: "f".repeat(64),
          reportDigest: "0".repeat(64),
        },
        failingFetch,
      ),
    ).rejects.toThrow(/callback rejected/);
  });

  test("failed restoration records unresolved recovery and never a success receipt", async () => {
    const http = network();
    const result = await recoverStorefrontPublication(
      {
        source: { ...source, sourceEnvironment: "staging" },
        target,
        run,
        baseline: { workerVersionId: "version-old", marker: null },
        failureCode: "activation_failed",
      },
      http.fetcher,
    );
    expect(result).toBe(false);
    expect(http.callbacks).toEqual([
      { ...run, status: "failed", failureCode: "activation_failed", restorationVerified: false },
    ]);
  });

  test("source authorization rejects unknown environment and credential-bearing origins", () => {
    expect(() => assertPublicationSource({ ...source, sourceEnvironment: "development" })).toThrow(
      /protected/,
    );
    expect(() =>
      assertPublicationSource({
        ...source,
        apiOrigin: "https://user:secret@api.production.example.test",
      }),
    ).toThrow(/origin/);
  });
});

async function buildFixture() {
  const catalogRelease = canonicalCatalogReleaseSchema.parse(
    JSON.parse(
      await readFile(resolve(import.meta.dir, "../apps/storefront/fixtures/release.json"), "utf8"),
    ),
  );
  const snapshot = {
    kind: "approved",
    id: identity.experienceSnapshotId,
    experienceId: "experience-test",
    version: 3,
    approvedAt: "2026-10-11T00:00:00.000Z",
    approvedBy: "operator",
    bindings: [],
    overrides: [],
    configurationSchemaVersion: 1,
    themeId: identity.themeId,
    themeVersion: identity.themeVersion,
    platformContractVersion: identity.platformContractVersion,
    provenance: {
      approvedAt: "2026-10-11T00:00:00.000Z",
      approvedBy: "operator",
      license: "MIT",
      source: "test",
    },
    resolvedTemplates: [{ id: "home", pageType: "home", requiredCapabilities: [], sections: [] }],
    contact: {
      version: identity.contactVersion,
      publicContact: {
        supportEmail: null,
        privacyEmail: null,
        publicPhone: null,
        serviceHours: null,
        timeZone: "UTC",
        locations: [],
        socials: [],
      },
    },
  };
  const catalogManifestJson = JSON.stringify(catalogRelease);
  const bound = {
    ...identity,
    catalogReleaseId: catalogRelease.releaseId,
    catalogSourceDigest: null,
    catalogManifestDigest: createHash("sha256").update(catalogManifestJson).digest("hex"),
    snapshotDigest: createHash("sha256").update(canonicalStorefrontJson(snapshot)).digest("hex"),
  };
  return storefrontPublicationBuildManifestSchema.parse({
    input: {
      environment: "public",
      sourceEnvironment: "staging",
      expectedOrigin: target.storefrontOrigin,
      publicationId: source.publicationId,
      inputIdentity: bound,
      catalogManifestJson,
      catalogRelease,
      snapshot,
      themeId: bound.themeId,
      presentationMode: "live",
      mediaOrigins: [],
    },
    publication: {
      id: source.publicationId,
      environment: "staging",
      identity: bound,
      operation: "publish",
      status: "building",
      expectedActivePublicationId: null,
      rollbackOf: null,
      restoreWorkerVersionId: null,
      createdAt: "2026-10-11T00:00:00.000Z",
      updatedAt: "2026-10-11T00:00:00.000Z",
      createdBy: "operator",
      reason: "Launch",
      correlationId: null,
      failureCode: null,
      ...run,
      receipt: null,
    },
    rollbackReceipt: null,
    baselineReceipt: null,
  });
}
describe("publication input and receipt recovery", () => {
  test("checks the original raw Catalog and canonical Snapshot before handing input to the compiler", async () => {
    const result = await buildFixture();
    const owningSource = { ...source, sourceEnvironment: "staging" as const };
    const fetcher = async () => Response.json(result);
    await expect(
      fetchPublicationBuild(owningSource, result.publication.identity.catalogReleaseId, fetcher),
    ).resolves.toMatchObject({ input: { inputIdentity: result.publication.identity } });
    const changed = structuredClone(result);
    changed.input.catalogManifestJson += " ";
    await expect(
      fetchPublicationBuild(owningSource, result.publication.identity.catalogReleaseId, async () =>
        Response.json(changed),
      ),
    ).rejects.toThrow(/raw-byte digest/);
  });
  test("a lost activation response re-reads accepted state and never restores behind that pointer", async () => {
    const result = await buildFixture();
    const owningSource = { ...source, sourceEnvironment: "staging" as const };
    let posts = 0;
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.cloudflare.com/"))
        return Response.json({ success: true, result: [deployment()] });
      if (url.endsWith("/.well-known/shoppp-release"))
        return Response.json({
          ...marker(),
          sourceEnvironment: "staging",
          identity: result.publication.identity,
        });
      if (url.endsWith("/status")) {
        posts++;
        const callback = JSON.parse(String(init?.body));
        result.publication.status = "succeeded";
        result.publication.receipt = callback.receipt;
        throw new Error("HTTP timeout after server committed");
      }
      return Response.json(result);
    };
    await expect(
      completeStorefrontPublication(
        {
          source: owningSource,
          target,
          identity: result.publication.identity,
          run,
          artifactDigest: "f".repeat(64),
          reportDigest: "0".repeat(64),
        },
        fetcher,
      ),
    ).resolves.toMatchObject({ workerVersionId: "version-new" });
    expect(posts).toBe(1);
  });
  test("unknown callback outcome remains unresolved instead of blindly changing deployed bytes", async () => {
    const http = network();
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/.well-known/shoppp-release"))
        return Response.json({ ...marker(), sourceEnvironment: "staging" });
      if (!String(input).startsWith("https://api.cloudflare.com/"))
        throw new Error("network unavailable");
      return http.fetcher(input, init);
    };
    await expect(
      completeStorefrontPublication(
        {
          source: { ...source, sourceEnvironment: "staging" },
          target,
          identity,
          run,
          artifactDigest: "f".repeat(64),
          reportDigest: "0".repeat(64),
        },
        fetcher,
      ),
    ).rejects.toBeInstanceOf(PublicationReceiptUncertainError);
    expect(http.requests.filter((request) => request.url.includes("deployments")).length).toBe(1);
  });
  test("baseline capture rejects a moved active version before mutation", async () => {
    await expect(
      captureStorefrontBaseline(
        target,
        {
          environment: "staging",
          identity,
          workerVersionId: "version-old",
          deploymentId: "old",
          artifactDigest: "a".repeat(64),
          reportDigest: "b".repeat(64),
          observedAt: "2026-10-11T00:00:00.000Z",
        },
        network().fetcher,
      ),
    ).rejects.toThrow(/previous active publication/);
  });
  test("recovery restores exactly the saved version then verifies the prior public identity", async () => {
    const callbacks: unknown[] = [];
    let active = "version-new";
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://api.cloudflare.com/")) {
        if (init?.method === "POST") active = JSON.parse(String(init.body)).versions[0].version_id;
        return Response.json({ success: true, result: [deployment(active)] });
      }
      if (url.endsWith("/.well-known/shoppp-release")) return Response.json(marker(active));
      callbacks.push(JSON.parse(String(init?.body)));
      return Response.json({ data: {} });
    };
    const recovered = await recoverStorefrontPublication(
      {
        source: { ...source, sourceEnvironment: "staging" },
        target,
        run,
        baseline: {
          workerVersionId: "version-old",
          marker: { schemaVersion: 1, sourceEnvironment: "production", identity },
        },
        failureCode: "receipt_rejected",
      },
      fetcher,
    );
    expect(recovered).toBe(true);
    expect(active).toBe("version-old");
    expect(callbacks).toEqual([
      { ...run, status: "failed", failureCode: "receipt_rejected", restorationVerified: true },
    ]);
  });
});

describe("retained exact-version rollback", () => {
  test("restores the qualified saved Worker without compiling or changing another environment", async () => {
    let active = "version-current";
    const mutations: unknown[] = [];
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith("https://api.cloudflare.com/")) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          mutations.push(body);
          active = body.versions[0].version_id;
        }
        return Response.json({ success: true, result: [deployment(active)] });
      }
      return Response.json({ ...marker(active), sourceEnvironment: "staging" });
    };
    const receipt = {
      environment: "staging" as const,
      identity,
      workerVersionId: "version-saved",
      deploymentId: "old-deployment",
      artifactDigest: "a".repeat(64),
      reportDigest: "b".repeat(64),
      observedAt: "2026-10-11T00:00:00.000Z",
    };
    await restorePublicationVersion(
      { target, sourceEnvironment: "staging", identity, receipt },
      fetcher,
    );
    expect(mutations).toEqual([
      { strategy: "percentage", versions: [{ version_id: "version-saved", percentage: 100 }] },
    ]);
    await expect(
      restorePublicationVersion(
        { target, sourceEnvironment: "production", identity, receipt },
        fetcher,
      ),
    ).rejects.toThrow(/crosses/);
    expect(mutations).toHaveLength(1);
  });
});

const baselineDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    baselineDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
describe("retained pre-deployment baseline", () => {
  test("retains a non-secret exact version bound to publication, target and run before mutation", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-publication-baseline-"));
    baselineDirectories.push(directory);
    const path = resolve(directory, "baseline.json");
    const options = { source, target, run, identity };
    const baseline = await retainStorefrontBaseline(
      { ...options, expectedReceipt: null, path },
      network().fetcher,
    );
    const contents = await readFile(path, "utf8");
    expect(contents).not.toContain("cf-secret");
    expect(contents).not.toContain("build-secret");
    expect(baseline.baseline.workerVersionId).toBe("version-new");
    await expect(readRetainedStorefrontBaseline({ ...options, path })).resolves.toMatchObject({
      publicationId: source.publicationId,
      run,
    });
    await expect(
      readRetainedStorefrontBaseline({ ...options, path, run: { ...run, runAttempt: 3 } }),
    ).rejects.toThrow(/retained baseline/);
    await expect(
      readRetainedStorefrontBaseline({
        ...options,
        path,
        target: { ...target, environment: "production" },
      }),
    ).rejects.toThrow(/retained baseline/);
    await expect(
      recheckStorefrontBaseline(target, baseline.baseline, network().fetcher),
    ).resolves.toBeUndefined();
    const drift = async (input: string | URL | Request) =>
      String(input).startsWith("https://api.cloudflare.com/")
        ? Response.json({ success: true, result: [deployment("changed-version")] })
        : Response.json(marker("changed-version"));
    await expect(recheckStorefrontBaseline(target, baseline.baseline, drift)).rejects.toThrow(
      /changed after capture/,
    );
  });
});

describe("manual interrupted-run recovery ownership", () => {
  test("only a freshly read unfinished same-run publication may recover its baseline", async () => {
    const { publication } = await buildFixture();
    expect(() =>
      assertStorefrontRecoveryOwner(publication, run, publication.identity),
    ).not.toThrow();
    expect(() =>
      assertStorefrontRecoveryOwner(
        { ...publication, status: "unresolved" },
        run,
        publication.identity,
      ),
    ).not.toThrow();
    for (const status of ["queued", "succeeded", "failed"] as const) {
      expect(() =>
        assertStorefrontRecoveryOwner({ ...publication, status }, run, publication.identity),
      ).toThrow(/unfinished protected run/);
    }
    expect(() =>
      assertStorefrontRecoveryOwner(publication, { ...run, runAttempt: 3 }, publication.identity),
    ).toThrow(/changed requests/);
  });
});

test("same-run unresolved and verified recovery callbacks use distinct keys while exact retry is stable", async () => {
  const keys: Array<string | null> = [];
  const fetcher = async (_input: string | URL | Request, init?: RequestInit) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key"));
    return Response.json({ data: {} });
  };
  const failed = {
    ...run,
    status: "failed",
    failureCode: "activation_failed",
    restorationVerified: false,
  };
  await publicationCallback(source, failed, fetcher);
  await publicationCallback(source, failed, fetcher);
  await publicationCallback(source, { ...failed, restorationVerified: true }, fetcher);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[0]);
});
