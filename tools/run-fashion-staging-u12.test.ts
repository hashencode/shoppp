import { describe, expect, test } from "bun:test";

import {
  loadFashionStagingU12Config,
  runFashionStagingU12,
  type FashionStagingU12Action,
} from "./run-fashion-staging-u12";

const environment = {
  FASHION_U12_ACCEPTANCE_TOKEN: "t".repeat(40),
  FASHION_U12_API_ORIGIN: "https://fashion-api.example.test",
  FASHION_U12_ARTIFACT_DIGEST: "a".repeat(64),
  FASHION_U12_CATALOG_RELEASE_ID: "release-fashion-u12",
  FASHION_U12_COMMIT_SHA: "b".repeat(40),
  FASHION_U12_OWNER: "workflow-runner",
  FASHION_U12_RUN_ID: "run-101-attempt-1",
  FASHION_U12_SEED_MANIFEST_DIGEST: "c".repeat(64),
  FASHION_U12_SNAPSHOT_ID: "snapshot-fashion-u12",
  FASHION_U12_VARIANT_ID: "variant-fashion-u12",
  FASHION_U12_WAREHOUSE_ID: "warehouse-fashion-u12",
};

describe("Fashion staging U12 lifecycle client", () => {
  test("rejects incomplete or production-like configuration before network access", () => {
    expect(() =>
      loadFashionStagingU12Config("acquire", {
        ...environment,
        FASHION_U12_API_ORIGIN: "http://fashion-api.example.test",
      }),
    ).toThrow(/HTTPS origin/);
    expect(() =>
      loadFashionStagingU12Config("acquire", { ...environment, FASHION_U12_COMMIT_SHA: "main" }),
    ).toThrow(/40-character/);
    expect(() => loadFashionStagingU12Config("register", environment)).toThrow(/RESOURCE_TYPE/);
  });

  test("sends exact acquisition identity without leaking the lifecycle token into the body", async () => {
    const requests: Request[] = [];
    const config = loadFashionStagingU12Config("acquire", environment);
    const result = await runFashionStagingU12(config, async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json(
        { data: { namespace: "fashion-u12-run-101-attempt-1" } },
        { status: 201 },
      );
    });
    expect(result).toEqual({ namespace: "fashion-u12-run-101-attempt-1" });
    expect(requests[0]!.headers.get("Authorization")).toBe(
      `Bearer ${environment.FASHION_U12_ACCEPTANCE_TOKEN}`,
    );
    expect(requests[0]!.signal).toBeInstanceOf(AbortSignal);
    const body = await requests[0]!.json();
    expect(body).toMatchObject({
      artifactDigest: environment.FASHION_U12_ARTIFACT_DIGEST,
      catalogReleaseId: environment.FASHION_U12_CATALOG_RELEASE_ID,
      commitSha: environment.FASHION_U12_COMMIT_SHA,
      runId: environment.FASHION_U12_RUN_ID,
      seedManifestDigest: environment.FASHION_U12_SEED_MANIFEST_DIGEST,
    });
    expect(JSON.stringify(body)).not.toContain(environment.FASHION_U12_ACCEPTANCE_TOKEN);
  });

  test("keeps cleanup, failure, resource registration, and recovery as distinct operations", async () => {
    const seen: { body: unknown; path: string }[] = [];
    for (const action of [
      "register",
      "failure",
      "cleanup",
      "reconcile",
    ] as FashionStagingU12Action[]) {
      const values = {
        ...environment,
        ...(action === "register"
          ? { FASHION_U12_RESOURCE_ID: "cart-fashion-u12", FASHION_U12_RESOURCE_TYPE: "cart" }
          : {}),
        ...(action === "failure" ? { FASHION_U12_FAILURE: "journey failed" } : {}),
      };
      await runFashionStagingU12(
        loadFashionStagingU12Config(action, values),
        async (input, init) => {
          const request = new Request(input, init);
          seen.push({ body: await request.json(), path: new URL(request.url).pathname });
          return action === "register" || action === "failure"
            ? new Response(null, { status: 204 })
            : Response.json({ data: { status: "completed" } });
        },
      );
    }
    expect(seen.map((entry) => entry.path)).toEqual([
      `/internal/testing/fashion-staging/runs/${environment.FASHION_U12_RUN_ID}/resources`,
      `/internal/testing/fashion-staging/runs/${environment.FASHION_U12_RUN_ID}/failure`,
      `/internal/testing/fashion-staging/runs/${environment.FASHION_U12_RUN_ID}/cleanup`,
      `/internal/testing/fashion-staging/runs/${environment.FASHION_U12_RUN_ID}/reconcile`,
    ]);
    expect(seen[0]!.body).toEqual({
      owner: "workflow-runner",
      resourceId: "cart-fashion-u12",
      resourceType: "cart",
    });
    expect(seen[1]!.body).toEqual({ failure: "journey failed", owner: "workflow-runner" });
  });
});
