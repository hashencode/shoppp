import { describe, expect, test } from "bun:test";

import {
  cleanupResetAuthorization,
  loadFashionStagingCatalogResetConfig,
  revokeResetCredential,
  runFashionStagingCatalogReset,
} from "./run-fashion-staging-catalog-reset";

const environment = {
  FASHION_CATALOG_RESET_ACCEPTANCE_TOKEN: "a".repeat(40),
  FASHION_CATALOG_RESET_API_ORIGIN: "https://shoppp-api-fashion-staging.hashencode.workers.dev",
  FASHION_CATALOG_RESET_CONFIRM: "RESET_REVIEWED_FASHION_STAGING_CATALOG",
  FASHION_CATALOG_RESET_TOKEN: "r".repeat(40),
};

const publicBytes = new TextEncoder().encode("reviewed-fashion-media");
const publicSha256 = new Bun.CryptoHasher("sha256").update(publicBytes).digest("hex");

function reviewedInput() {
  return {
    catalog: {
      catalogVersion: "fashion-store-live-v1",
      products: Array.from({ length: 18 }, (_, index) => ({
        media: [
          {
            mimeType: "image/jpeg",
            r2Key: `catalog/fashion-store/fashion-store-live-v1/image-${index + 1}.jpg`,
            sha256: publicSha256,
            sourcePath: `reviewed/image-${index + 1}.jpg`,
          },
        ],
      })),
    },
    manifestDigest: "5e3a81859866ffdb1599eb2f2dff23ef0b34a5c77fa6a530d33a050569776766",
    shopperRelease: { releaseId: "fashion-store-live-v1-shopper-release" },
  };
}

function reviewedKeys(): string[] {
  return (reviewedInput().catalog.products as Array<{ media: Array<{ r2Key: string }> }>).flatMap(
    (product) => product.media.map((media) => media.r2Key),
  );
}

describe("one-time Fashion staging catalog reset runner", () => {
  test("rejects mutable origins, missing confirmation, and caller-supplied manifests", () => {
    expect(() =>
      loadFashionStagingCatalogResetConfig({
        ...environment,
        FASHION_CATALOG_RESET_API_ORIGIN: "https://api.example.test",
      }),
    ).toThrow(/exact Fashion staging API origin/);
    expect(() =>
      loadFashionStagingCatalogResetConfig({
        ...environment,
        FASHION_CATALOG_RESET_CONFIRM: "yes",
      }),
    ).toThrow(/explicit reset confirmation/);
    expect(() =>
      loadFashionStagingCatalogResetConfig({
        ...environment,
        FASHION_CATALOG_RESET_MANIFEST: "arbitrary.json",
      }),
    ).toThrow(/does not accept a manifest override/);
  });

  test("uses both credentials, the reviewed payload, and always revokes reset authorization", async () => {
    const requests: Request[] = [];
    const publicRequests: Request[] = [];
    let cleanupCalls = 0;
    const result = await runFashionStagingCatalogReset(
      loadFashionStagingCatalogResetConfig(environment),
      {
        cleanup: async () => {
          cleanupCalls += 1;
        },
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          requests.push(request);
          const path = new URL(request.url).pathname;
          if (path.endsWith("/catalog-reset/preflight")) {
            return Response.json({
              data: {
                activeWorkCount: 0,
                iamFingerprint: "i".repeat(64),
                resetClosed: false,
              },
            });
          }
          if (path.endsWith("/catalog-reset/media-preflight")) {
            return Response.json({ data: { missingKeys: [], presentKeys: reviewedKeys() } });
          }
          if (path.endsWith("/catalog-reset")) {
            return Response.json(
              {
                data: {
                  catalogVersion: "fashion-store-live-v1",
                  deletedMediaCount: 7,
                  deletedTableCount: 52,
                },
              },
              { status: 201 },
            );
          }
          if (path.endsWith("/catalog-activation/prepare")) {
            return Response.json(
              {
                data: {
                  buildId: "preview-build-reviewed-1",
                  buildInput: { catalogRelease: { releaseId: "reviewed-release" } },
                  shopperReleaseId: "reviewed-release",
                  snapshotId: "snapshot-reviewed",
                },
              },
              { status: 201 },
            );
          }
          if (path.endsWith("/catalog-activation/preview-build-reviewed-1/complete")) {
            return Response.json({
              data: {
                artifactDigest: "d".repeat(64),
                artifactPrefix: `snapshots/snapshot-reviewed/reviewed-release/${"d".repeat(64)}`,
                id: "preview-build-reviewed-1",
                status: "deployed",
              },
            });
          }
          return Response.json({
            data: {
              activeArtifactDigest:
                requests.filter(({ method }) => method === "POST").length > 3
                  ? "d".repeat(64)
                  : null,
              activeArtifactPrefix:
                requests.filter(({ method }) => method === "POST").length > 3
                  ? `snapshots/snapshot-reviewed/reviewed-release/${"d".repeat(64)}`
                  : null,
              activeBuildId:
                requests.filter(({ method }) => method === "POST").length > 3
                  ? "preview-build-reviewed-1"
                  : null,
              mediaCount: 18,
              productCount: 13,
              variantCount: 24,
            },
          });
        },
        activateReviewedArtifact: async () => ({
          digest: "d".repeat(64),
          expiresAt: "2026-09-15T00:00:00Z",
          prefix: `snapshots/snapshot-reviewed/reviewed-release/${"d".repeat(64)}`,
        }),
        loadReviewedInput: async () => reviewedInput(),
        mediaFetcher: async (input, init) => {
          const request = new Request(input, init);
          publicRequests.push(request);
          return new Response(publicBytes, {
            headers: { "Content-Type": "image/jpeg" },
          });
        },
        readReviewedMedia: async () => publicBytes,
      },
    );

    expect(result).toMatchObject({
      deletedMediaCount: 7,
      deletedTableCount: 52,
      mediaCount: 18,
      productCount: 13,
      variantCount: 24,
    });
    expect(publicRequests).toHaveLength(18);
    expect(publicRequests.every((request) => request.headers.get("Authorization") === null)).toBe(
      true,
    );
    expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual(
      [
        "GET /internal/testing/fashion-staging/catalog-reset/preflight",
        "POST /internal/testing/fashion-staging/catalog-reset/media-preflight",
        "POST /internal/testing/fashion-staging/catalog-reset",
        "GET /internal/testing/fashion-staging/catalog-migration/fashion-store-live-v1",
        "POST /internal/testing/fashion-staging/catalog-activation/prepare",
        "POST /internal/testing/fashion-staging/catalog-activation/preview-build-reviewed-1/complete",
        "GET /internal/testing/fashion-staging/catalog-migration/fashion-store-live-v1",
      ],
    );
    expect(requests[0]!.headers.get("Authorization")).toBe(
      `Bearer ${environment.FASHION_CATALOG_RESET_ACCEPTANCE_TOKEN}`,
    );
    expect(requests[0]!.headers.get("X-Fashion-Catalog-Reset-Token")).toBe(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(requests[1]!.headers.get("X-Fashion-Catalog-Reset-Token")).toBe(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(requests[2]!.headers.get("X-Fashion-Catalog-Reset-Token")).toBe(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(requests[4]!.headers.get("X-Fashion-Catalog-Reset-Token")).toBe(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(requests[5]!.headers.get("X-Fashion-Catalog-Reset-Token")).toBe(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(JSON.stringify(await requests[2]!.json())).not.toContain(
      environment.FASHION_CATALOG_RESET_TOKEN,
    );
    expect(cleanupCalls).toBe(1);
  });

  test("recovers a lost activation response from exact persisted terminal identities", async () => {
    const apiRequests: Request[] = [];
    let cleanupSucceeded: boolean | undefined;
    const terminalActivation = {
      activeArtifactDigest: "d".repeat(64),
      activeArtifactPrefix: `snapshots/snapshot-reviewed/fashion-store-live-v1-shopper-release/${"d".repeat(64)}`,
      activeBuildId: "preview-build-reviewed-1",
      catalogVersion: "fashion-store-live-v1",
      manifestDigest: reviewedInput().manifestDigest,
      shopperReleaseId: "fashion-store-live-v1-shopper-release",
    };

    const result = await runFashionStagingCatalogReset(
      loadFashionStagingCatalogResetConfig(environment),
      {
        cleanup: async (completedSuccessfully) => {
          cleanupSucceeded = completedSuccessfully;
        },
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          apiRequests.push(request);
          return new URL(request.url).pathname.endsWith("/catalog-reset/preflight")
            ? Response.json({
                data: {
                  activeWorkCount: 0,
                  iamFingerprint: "i".repeat(64),
                  resetClosed: true,
                  terminalActivation,
                },
              })
            : Response.json({
                data: {
                  ...terminalActivation,
                  dimensionsVerified: 18,
                  foreignKeyViolations: 0,
                  iamFingerprint: "i".repeat(64),
                  mediaCount: 18,
                  productCount: 13,
                  sellableVariantCount: 24,
                  variantCount: 24,
                },
              });
        },
        loadReviewedInput: async () => reviewedInput(),
        mediaFetcher: async () =>
          new Response(publicBytes, { headers: { "Content-Type": "image/jpeg" } }),
        readReviewedMedia: async () => publicBytes,
      },
    );

    expect(result).toMatchObject({ ...terminalActivation, terminalRecovered: true });
    expect(
      apiRequests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    ).toEqual([
      "GET /internal/testing/fashion-staging/catalog-reset/preflight",
      "GET /internal/testing/fashion-staging/catalog-migration/fashion-store-live-v1",
    ]);
    expect(cleanupSucceeded).toBe(true);
  });

  test("resumes the exact persisted building activation without repeating the media reset", async () => {
    const apiRequests: Request[] = [];
    let cleanupSucceeded: boolean | undefined;
    const resumableActivation = {
      activeBuildId: "preview-build-reviewed-1",
      catalogVersion: "fashion-store-live-v1",
      manifestDigest: reviewedInput().manifestDigest,
      shopperReleaseId: "fashion-store-live-v1-shopper-release",
    };
    const artifact = {
      digest: "d".repeat(64),
      expiresAt: "2026-09-15T00:00:00Z",
      prefix: `snapshots/snapshot-reviewed/fashion-store-live-v1-shopper-release/${"d".repeat(64)}`,
    };

    const result = await runFashionStagingCatalogReset(
      loadFashionStagingCatalogResetConfig(environment),
      {
        activateReviewedArtifact: async () => artifact,
        cleanup: async (completedSuccessfully) => {
          cleanupSucceeded = completedSuccessfully;
        },
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          apiRequests.push(request);
          const path = new URL(request.url).pathname;
          if (path.endsWith("/catalog-reset/preflight")) {
            return Response.json({
              data: {
                activeWorkCount: 0,
                iamFingerprint: "i".repeat(64),
                resetClosed: false,
                resumableActivation,
                terminalActivation: null,
              },
            });
          }
          if (path.endsWith("/catalog-activation/prepare")) {
            return Response.json({
              data: {
                buildId: resumableActivation.activeBuildId,
                buildInput: { catalogRelease: { releaseId: resumableActivation.shopperReleaseId } },
                shopperReleaseId: resumableActivation.shopperReleaseId,
                snapshotId: "snapshot-reviewed",
              },
            });
          }
          if (path.endsWith(`/${resumableActivation.activeBuildId}/complete`)) {
            return Response.json({
              data: {
                artifactDigest: artifact.digest,
                artifactPrefix: artifact.prefix,
                id: resumableActivation.activeBuildId,
                status: "deployed",
              },
            });
          }
          const activated = apiRequests.some((candidate) =>
            new URL(candidate.url).pathname.endsWith(
              `/${resumableActivation.activeBuildId}/complete`,
            ),
          );
          return Response.json({
            data: {
              activeArtifactDigest: activated ? artifact.digest : null,
              activeArtifactPrefix: activated ? artifact.prefix : null,
              activeBuildId: activated ? resumableActivation.activeBuildId : null,
              catalogVersion: resumableActivation.catalogVersion,
              dimensionsVerified: 18,
              foreignKeyViolations: 0,
              iamFingerprint: "i".repeat(64),
              manifestDigest: resumableActivation.manifestDigest,
              mediaCount: 18,
              productCount: 13,
              sellableVariantCount: 24,
              shopperReleaseId: resumableActivation.shopperReleaseId,
              variantCount: 24,
            },
          });
        },
        loadReviewedInput: async () => reviewedInput(),
        mediaFetcher: async () =>
          new Response(publicBytes, { headers: { "Content-Type": "image/jpeg" } }),
        readReviewedMedia: async () => publicBytes,
      },
    );

    expect(result).toMatchObject({
      activationResumed: true,
      activeBuildId: resumableActivation.activeBuildId,
    });
    expect(
      apiRequests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
    ).toEqual([
      "GET /internal/testing/fashion-staging/catalog-reset/preflight",
      "GET /internal/testing/fashion-staging/catalog-migration/fashion-store-live-v1",
      "POST /internal/testing/fashion-staging/catalog-activation/prepare",
      "POST /internal/testing/fashion-staging/catalog-activation/preview-build-reviewed-1/complete",
      "GET /internal/testing/fashion-staging/catalog-migration/fashion-store-live-v1",
    ]);
    expect(cleanupSucceeded).toBe(true);
  });

  test("revokes reset authorization when the destructive request fails", async () => {
    let cleanupCalls = 0;
    await expect(
      runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig(environment), {
        cleanup: async () => {
          cleanupCalls += 1;
        },
        fetcher: async () => new Response(null, { status: 500 }),
        loadReviewedInput: async () => ({
          manifestDigest: "5e3a81859866ffdb1599eb2f2dff23ef0b34a5c77fa6a530d33a050569776766",
        }),
      }),
    ).rejects.toThrow(/failed with HTTP 500/);
    expect(cleanupCalls).toBe(1);
  });

  test("rejects completion when an exact public media object has the wrong bytes", async () => {
    let cleanupCalls = 0;
    await expect(
      runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig(environment), {
        cleanup: async () => {
          cleanupCalls += 1;
        },
        fetcher: async (input, init) => {
          const request = new Request(input, init);
          const path = new URL(request.url).pathname;
          if (path.endsWith("/catalog-reset/preflight")) {
            return Response.json({
              data: {
                activeWorkCount: 0,
                iamFingerprint: "i".repeat(64),
                resetClosed: false,
              },
            });
          }
          if (path.endsWith("/catalog-reset/media-preflight")) {
            return Response.json({ data: { missingKeys: [], presentKeys: reviewedKeys() } });
          }
          if (path.endsWith("/catalog-reset")) {
            return Response.json({
              data: {
                catalogVersion: "fashion-store-live-v1",
                deletedMediaCount: 0,
                deletedTableCount: 52,
              },
            });
          }
          return Response.json({
            data: { productCount: 13, variantCount: 24, mediaCount: 18 },
          });
        },
        loadReviewedInput: async () => reviewedInput(),
        mediaFetcher: async () =>
          new Response(new TextEncoder().encode("tampered"), {
            headers: { "Content-Type": "image/jpeg" },
          }),
        readReviewedMedia: async () => publicBytes,
      }),
    ).rejects.toThrow(/Public media byte length mismatch/);
    expect(cleanupCalls).toBe(1);
  });

  test("terminates and reaps a timed-out reset-secret deletion", async () => {
    let resolveExit!: (code: number) => void;
    let killCalls = 0;
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });

    await expect(
      revokeResetCredential(
        () => ({
          exited,
          kill: () => {
            killCalls += 1;
            resolveExit(143);
          },
        }),
        5,
      ),
    ).rejects.toThrow(/timed out/);
    expect(killCalls).toBe(1);
    expect(await exited).toBe(143);
  });

  test("terminates and reaps a timed-out reviewed-media upload", async () => {
    let resolveExit!: (code: number) => void;
    let killCalls = 0;
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });

    const apiPaths: string[] = [];
    await expect(
      runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig(environment), {
        cleanup: async () => {},
        fetcher: async (input, init) => {
          const path = new URL(String(input)).pathname;
          apiPaths.push(path);
          if (path.endsWith("/catalog-reset/preflight")) {
            return Response.json({
              data: {
                activeWorkCount: 0,
                iamFingerprint: "a".repeat(64),
                resetClosed: false,
              },
            });
          }
          const payload = JSON.parse(String(init?.body)) as ReturnType<typeof reviewedInput>;
          const keys = payload.catalog.products.flatMap((product) =>
            product.media.map((media) => media.r2Key),
          );
          return Response.json({ data: { missingKeys: keys, presentKeys: [] } });
        },
        spawnCommand: () => ({
          exited,
          kill: () => {
            killCalls += 1;
            resolveExit(143);
          },
        }),
        uploadTimeoutMs: 5,
      }),
    ).rejects.toThrow(/Upload of reviewed media .* timed out/);
    expect(apiPaths).toEqual([
      "/internal/testing/fashion-staging/catalog-reset/preflight",
      "/internal/testing/fashion-staging/catalog-reset/media-preflight",
    ]);
    expect(killCalls).toBe(1);
    expect(await exited).toBe(143);
  });

  test("uploads only API-confirmed missing media without a force overwrite flag", async () => {
    const commands: string[][] = [];
    const paths: string[] = [];
    const missingKey = reviewedKeys()[1]!;
    let mediaPreflightCalls = 0;
    await expect(
      runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig(environment), {
        cleanup: async () => {},
        fetcher: async (input) => {
          const path = new URL(String(input)).pathname;
          paths.push(path);
          if (path.endsWith("/catalog-reset/preflight")) {
            return Response.json({
              data: {
                activeWorkCount: 0,
                iamFingerprint: "a".repeat(64),
                resetClosed: false,
              },
            });
          }
          if (path.endsWith("/catalog-reset/media-preflight")) {
            mediaPreflightCalls += 1;
            return Response.json({
              data:
                mediaPreflightCalls === 1
                  ? {
                      missingKeys: [missingKey],
                      presentKeys: reviewedKeys().filter((key) => key !== missingKey),
                    }
                  : { missingKeys: [], presentKeys: reviewedKeys() },
            });
          }
          return new Response(null, { status: 500 });
        },
        loadReviewedInput: async () => reviewedInput(),
        spawnCommand: (command) => {
          commands.push(command);
          return { exited: Promise.resolve(0), kill: () => {} };
        },
      }),
    ).rejects.toThrow(/apply failed with HTTP 500/);

    expect(commands).toHaveLength(1);
    expect(commands[0]!.join(" ")).toContain(missingKey);
    expect(commands[0]).not.toContain("--force");
    expect(paths.slice(0, 3)).toEqual([
      "/internal/testing/fashion-staging/catalog-reset/preflight",
      "/internal/testing/fashion-staging/catalog-reset/media-preflight",
      "/internal/testing/fashion-staging/catalog-reset/media-preflight",
    ]);
  });

  test("removes reset enablement only after successful completion", async () => {
    const successCommands: string[][] = [];
    await cleanupResetAuthorization(
      true,
      (command) => {
        successCommands.push(command);
        return { exited: Promise.resolve(0), kill: () => {} };
      },
      5,
    );
    expect(successCommands.map((command) => command[4])).toEqual([
      "FASHION_CATALOG_RESET_TOKEN",
      "FASHION_CATALOG_RESET_ENABLED",
    ]);

    const failureCommands: string[][] = [];
    await cleanupResetAuthorization(
      false,
      (command) => {
        failureCommands.push(command);
        return { exited: Promise.resolve(0), kill: () => {} };
      },
      5,
    );
    expect(failureCommands.map((command) => command[4])).toEqual(["FASHION_CATALOG_RESET_TOKEN"]);
  });

  test("reports both reset and cleanup failures", async () => {
    await expect(
      runFashionStagingCatalogReset(loadFashionStagingCatalogResetConfig(environment), {
        cleanup: async () => {
          throw new Error("credential still active");
        },
        fetcher: async () => new Response(null, { status: 500 }),
      }),
    ).rejects.toThrow(/reset failed.*cleanup failed.*credential still active/i);
  });
});
