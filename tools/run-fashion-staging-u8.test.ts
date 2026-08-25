import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendFashionU8Attempt,
  assertFashionU8RunManifest,
  redactFashionU8Evidence,
  recordFashionU8Attempt,
  runFashionStagingU8,
  type FashionU8RunManifest,
  type FashionU8TerminalManifest,
} from "./run-fashion-staging-u8";

const manifest = (): FashionU8RunManifest => ({
  u12ArtifactDigest: "a".repeat(64),
  candidateSha: "b".repeat(40),
  catalogReleaseId: "fashion-staging-u12-release",
  contractTestDigest: "9".repeat(64),
  harnessManifestDigest: "c".repeat(64),
  harnessSha: "d".repeat(40),
  platformContractVersion: "1.0.0",
  runId: "fashion-u8-run-1",
  schemaVersion: 1 as const,
  sourceDraftId: "draft-fashion-u8-source",
  themeId: "fashion-store",
  themeVersion: "1.0.0",
  u12ReadinessDigest: "e".repeat(64),
  u12SnapshotId: "snapshot-approved-u12",
});

const terminalManifest = (): FashionU8TerminalManifest => ({
  ...manifest(),
  acceptanceRunId: "fashion-u8-acceptance-1",
  buildId: "preview-build-u8-successor",
  currency: "USD",
  experienceVersion: 3,
  productId: "product-stable-u8",
  refreshAttestationDigest: "1".repeat(64),
  runManifestDigest: "2".repeat(64),
  successorArtifactDigest: "3".repeat(64),
  successorAuditId: "audit-u8-approval",
  successorContentDigest: "4".repeat(64),
  successorSnapshotId: "snapshot-approved-u8",
});

describe("Fashion staging U8 run evidence", () => {
  test("accepts the frozen candidate/harness split and rejects mutable or malformed identity", () => {
    expect(assertFashionU8RunManifest(manifest())).toEqual(manifest());
    expect(() => assertFashionU8RunManifest({ ...manifest(), candidateSha: "main" })).toThrow(
      /candidateSha/,
    );
    expect(() =>
      assertFashionU8RunManifest({ ...manifest(), harnessSha: manifest().candidateSha }),
    ).toThrow(/separate/);
  });

  test("maintains an append-only attempt ledger and requires a corrective reason before retry", () => {
    const started = appendFashionU8Attempt([], {
      attemptId: "prepare-1",
      kind: "preparation",
      manifestDigest: "f".repeat(64),
      startedAt: "2026-08-24T00:00:00.000Z",
      status: "started",
    });
    const failed = appendFashionU8Attempt(started, {
      ...started[0]!,
      cleanup: "complete",
      failureClass: "environment",
      finishedAt: "2026-08-24T00:01:00.000Z",
      status: "failed",
    });
    expect(() =>
      appendFashionU8Attempt(failed, {
        attemptId: "prepare-2",
        kind: "preparation",
        manifestDigest: "f".repeat(64),
        startedAt: "2026-08-24T00:02:00.000Z",
        status: "started",
      }),
    ).toThrow(/corrective reason/);
    expect(
      appendFashionU8Attempt(failed, {
        attemptId: "prepare-2",
        correctiveReason: "fresh Preview build attempt requested",
        kind: "preparation",
        manifestDigest: "f".repeat(64),
        startedAt: "2026-08-24T00:02:00.000Z",
        status: "started",
      }),
    ).toHaveLength(3);
  });

  test("records attempt events atomically without overwriting prior evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "shoppp-u8-ledger-"));
    const ledgerPath = join(directory, "ledger.json");
    const eventPath = join(directory, "event.json");
    try {
      const started = {
        attemptId: "machine-1",
        kind: "machine" as const,
        manifestDigest: "7".repeat(64),
        startedAt: "2026-08-24T00:00:00.000Z",
        status: "started" as const,
      };
      await writeFile(eventPath, JSON.stringify(started));
      await recordFashionU8Attempt(ledgerPath, eventPath);
      await writeFile(
        eventPath,
        JSON.stringify({
          ...started,
          cleanup: "complete",
          finishedAt: "2026-08-24T00:01:00.000Z",
          status: "passed",
        }),
      );
      await recordFashionU8Attempt(ledgerPath, eventPath);
      expect(JSON.parse(await readFile(ledgerPath, "utf8"))).toHaveLength(2);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("rejects bearer-capable or browser-state evidence", () => {
    expect(redactFashionU8Evidence({ runId: "fashion-u8-run", snapshotId: "snapshot-u8" })).toEqual(
      { runId: "fashion-u8-run", snapshotId: "snapshot-u8" },
    );
    for (const value of [
      { Authorization: "Bearer secret" },
      { cookie: "__Host-shoppp-preview=secret" },
      { cartToken: "token" },
      { trace: "trace.zip" },
    ])
      expect(() => redactFashionU8Evidence(value)).toThrow(/sensitive/i);
  });

  test("validates, redeems, locks, probes through Preview, registers carts, and cleans up", async () => {
    const calls: string[] = [];
    const lifecycle: string[] = [];
    const report = await runFashionStagingU8(
      {
        authorityOrigin: "https://shoppp-api-fashion-staging.example.com",
        handoffOrigin: "https://shoppp-admin-staging.example.com",
        manifest: terminalManifest(),
        previewOrigin: "https://shoppp-storefront-fashion-preview.example.com",
        recoveryRunId: "fashion-u8-interrupted",
        serviceToken: "service_token_with_high_entropy_value_123456",
      },
      {
        fetcher: async (input, init) => {
          const url = String(input);
          calls.push(url);
          if (url.endsWith("/preview-build-u8-successor")) {
            return Response.json({
              data: {
                artifactDigest: terminalManifest().successorArtifactDigest,
                id: terminalManifest().buildId,
                inputIdentity: {
                  catalogReleaseId: terminalManifest().catalogReleaseId,
                  experienceSnapshotId: terminalManifest().successorSnapshotId,
                  experienceVersion: terminalManifest().experienceVersion,
                  platformContractVersion: terminalManifest().platformContractVersion,
                  themeId: terminalManifest().themeId,
                  themeVersion: terminalManifest().themeVersion,
                },
                snapshotId: terminalManifest().successorSnapshotId,
                status: "deployed",
              },
            });
          }
          if (url.endsWith("/snapshot-approved-u8")) {
            return Response.json({
              data: {
                contentDigest: terminalManifest().successorContentDigest,
                id: terminalManifest().successorSnapshotId,
                kind: "approved",
              },
            });
          }
          if (url.endsWith("/grants")) {
            expect(init?.headers).toEqual(
              expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
            );
            return Response.json({
              data: {
                grant: "private_grant_that_must_not_enter_report",
                inputIdentity: {
                  catalogReleaseId: terminalManifest().catalogReleaseId,
                  experienceSnapshotId: terminalManifest().successorSnapshotId,
                  experienceVersion: terminalManifest().experienceVersion,
                  platformContractVersion: terminalManifest().platformContractVersion,
                  themeId: terminalManifest().themeId,
                  themeVersion: terminalManifest().themeVersion,
                },
                redeemUrl:
                  "https://shoppp-storefront-fashion-preview.example.com/__preview/session",
                snapshotId: terminalManifest().successorSnapshotId,
              },
            });
          }
          if (url.endsWith("/__preview/session")) {
            return new Response(null, {
              headers: {
                Location: "/",
                "Set-Cookie":
                  "__Host-shoppp-preview=private_session_cookie_value; Secure; HttpOnly",
              },
              status: 303,
            });
          }
          if (url.endsWith("/__preview/context")) {
            return Response.json({
              contentDigest: terminalManifest().successorContentDigest,
              environment: "private-preview",
              expiresAt: "2099-01-01T00:00:00.000Z",
              generatedAt: "2026-08-24T00:00:00.000Z",
              returnUrl: "https://shoppp-admin-staging.example.com/storefront/themes/draft-u8",
              snapshotId: terminalManifest().successorSnapshotId,
            });
          }
          if (url.endsWith("/revoke")) {
            expect(init?.method).toBe("POST");
            return Response.json({ data: { revoked: true } });
          }
          throw new Error(`unexpected request ${url}`);
        },
        latencyRunner: async (config, _fetcher, probeLifecycle) => {
          expect(config.previewOrigin).toBe(
            "https://shoppp-storefront-fashion-preview.example.com",
          );
          expect(config.previewCookie).toContain("private_session_cookie_value");
          await probeLifecycle.registerCart("cart-u8-1");
          await probeLifecycle.cleanup();
          return {
            catalogDurationsMs: Array(20).fill(100),
            catalogReadP95Ms: 100,
            cartDurationsMs: Array(20).fill(120),
            cartReadP95Ms: 120,
            sampleCount: 20,
            shippingConcurrency: 4,
            shippingDurationsMs: Array(20).fill(200),
            shippingMutationP95Ms: 200,
          };
        },
        lifecycle: {
          acquire: async () => lifecycle.push("acquire"),
          cleanup: async () => lifecycle.push("cleanup"),
          failure: async () => lifecycle.push("failure"),
          reconcile: async (runId) => lifecycle.push(`reconcile:${runId}`),
          registerCart: async (cartId) => lifecycle.push(`register:${cartId}`),
        },
      },
    );

    expect(report.passed).toBe(true);
    expect(report.cleanup).toEqual({ attempted: true, passed: true });
    expect(lifecycle).toEqual([
      "reconcile:fashion-u8-interrupted",
      "acquire",
      "register:cart-u8-1",
      "cleanup",
    ]);
    expect(calls.some((url) => url.endsWith("/__preview/context"))).toBe(true);
    expect(calls.some((url) => url.endsWith("/revoke"))).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(
      /service_token|private_grant|private_session|cookie/i,
    );
  });

  test("retains proof and cleanup failures separately without secret-bearing messages", async () => {
    const report = await runFashionStagingU8(
      {
        authorityOrigin: "https://shoppp-api-fashion-staging.example.com",
        handoffOrigin: "https://shoppp-admin-staging.example.com",
        manifest: terminalManifest(),
        previewOrigin: "https://shoppp-storefront-fashion-preview.example.com",
        serviceToken: "service_token_with_high_entropy_value_123456",
      },
      {
        fetcher: async (input) => {
          const url = String(input);
          if (url.endsWith("/preview-build-u8-successor"))
            return Response.json({
              data: {
                artifactDigest: terminalManifest().successorArtifactDigest,
                id: terminalManifest().buildId,
                inputIdentity: {
                  catalogReleaseId: terminalManifest().catalogReleaseId,
                  experienceSnapshotId: terminalManifest().successorSnapshotId,
                  experienceVersion: terminalManifest().experienceVersion,
                  platformContractVersion: terminalManifest().platformContractVersion,
                  themeId: terminalManifest().themeId,
                  themeVersion: terminalManifest().themeVersion,
                },
                snapshotId: terminalManifest().successorSnapshotId,
                status: "deployed",
              },
            });
          if (url.endsWith("/snapshot-approved-u8"))
            return Response.json({
              data: {
                contentDigest: terminalManifest().successorContentDigest,
                id: terminalManifest().successorSnapshotId,
                kind: "approved",
              },
            });
          if (url.endsWith("/grants"))
            return Response.json({
              data: {
                grant: "private_grant",
                inputIdentity: {
                  catalogReleaseId: terminalManifest().catalogReleaseId,
                  experienceSnapshotId: terminalManifest().successorSnapshotId,
                  experienceVersion: terminalManifest().experienceVersion,
                  platformContractVersion: terminalManifest().platformContractVersion,
                  themeId: terminalManifest().themeId,
                  themeVersion: terminalManifest().themeVersion,
                },
                redeemUrl:
                  "https://shoppp-storefront-fashion-preview.example.com/__preview/session",
                snapshotId: terminalManifest().successorSnapshotId,
              },
            });
          if (url.endsWith("/__preview/session"))
            return new Response(null, {
              headers: {
                Location: "/",
                "Set-Cookie":
                  "__Host-shoppp-preview=private_session_cookie_value; Secure; HttpOnly",
              },
              status: 303,
            });
          if (url.endsWith("/revoke")) return new Response(null, { status: 500 });
          return Response.json({
            contentDigest: terminalManifest().successorContentDigest,
            environment: "private-preview",
            expiresAt: "2099-01-01T00:00:00.000Z",
            generatedAt: null,
            returnUrl: "https://shoppp-admin-staging.example.com/storefront/themes/draft-u8",
            snapshotId: terminalManifest().successorSnapshotId,
          });
        },
        latencyRunner: async () => {
          throw new Error("CartToken secret proof failure");
        },
        lifecycle: {
          acquire: async () => undefined,
          cleanup: async () => {
            throw new Error("Bearer secret cleanup failure");
          },
          failure: async () => undefined,
          reconcile: async () => undefined,
          registerCart: async () => undefined,
        },
      },
    );
    expect(report.passed).toBe(false);
    expect(report.proofFailure).toBe("latency_probe_failed");
    expect(report.cleanup).toEqual({ attempted: true, failure: "cleanup_failed", passed: false });
    expect(JSON.stringify(report)).not.toMatch(/CartToken|Bearer|secret/);
  });

  test("revokes preview access when a committed grant returns malformed evidence", async () => {
    const calls: string[] = [];
    let lifecycleCleanup = 0;
    const report = await runFashionStagingU8(
      {
        authorityOrigin: "https://shoppp-api-fashion-staging.example.com",
        handoffOrigin: "https://shoppp-admin-staging.example.com",
        manifest: terminalManifest(),
        previewOrigin: "https://shoppp-storefront-fashion-preview.example.com",
        serviceToken: "service_token_with_high_entropy_value_123456",
      },
      {
        fetcher: async (input) => {
          const url = String(input);
          calls.push(url);
          if (url.endsWith("/preview-build-u8-successor"))
            return Response.json({
              data: {
                artifactDigest: terminalManifest().successorArtifactDigest,
                id: terminalManifest().buildId,
                inputIdentity: {
                  catalogReleaseId: terminalManifest().catalogReleaseId,
                  experienceSnapshotId: terminalManifest().successorSnapshotId,
                  experienceVersion: terminalManifest().experienceVersion,
                  platformContractVersion: terminalManifest().platformContractVersion,
                  themeId: terminalManifest().themeId,
                  themeVersion: terminalManifest().themeVersion,
                },
                snapshotId: terminalManifest().successorSnapshotId,
                status: "deployed",
              },
            });
          if (url.endsWith("/snapshot-approved-u8"))
            return Response.json({
              data: {
                contentDigest: terminalManifest().successorContentDigest,
                id: terminalManifest().successorSnapshotId,
                kind: "approved",
              },
            });
          if (url.endsWith("/grants")) return Response.json({ data: { committed: true } });
          if (url.endsWith("/revoke")) return Response.json({ data: { revoked: true } });
          throw new Error(`unexpected request ${url}`);
        },
        lifecycle: {
          acquire: async () => undefined,
          cleanup: async () => {
            lifecycleCleanup += 1;
          },
          failure: async () => undefined,
          reconcile: async () => undefined,
          registerCart: async () => undefined,
        },
      },
    );
    expect(report.proofFailure).toBe("preview_grant_failed");
    expect(report.cleanup).toEqual({ attempted: true, passed: true });
    expect(calls.filter((url) => url.endsWith("/revoke"))).toHaveLength(1);
    expect(lifecycleCleanup).toBe(0);
  });
});
