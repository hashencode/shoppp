import { describe, expect, test } from "bun:test";

import {
  assertReleaseStagingLatencyAuthority,
  assertReleaseStagingLatencyThresholds,
  runReleaseStagingLatencyProbe,
  type ReleaseStagingLatencyConfig,
} from "./verify-release-staging-latency";

const sourceSha = "a".repeat(40);

function authorityEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    CI_GH_PRODUCTION_PROMOTION: "false",
    CI_GH_STAGING_REHEARSAL: "true",
    CI_GH_VALIDATED_SOURCE_SHA: sourceSha,
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "hashencode/shoppp",
    GITHUB_SHA: sourceSha,
    GITHUB_WORKFLOW_REF: "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main",
    ...overrides,
  };
}

function latencyConfig(): ReleaseStagingLatencyConfig {
  return {
    apiBaseUrl: "https://api.example.com/api",
    checkoutConcurrency: 4,
    currency: "USD",
    productSlug: "atlas-tee",
    runId: "33067627981-1",
    sampleCount: 20,
    storefrontOrigin: "https://shop.example.com",
    timeoutMs: 1_000,
  };
}

describe("CI-GH release staging latency verifier", () => {
  test("allows only the exact protected staging rehearsal authority", () => {
    expect(() =>
      assertReleaseStagingLatencyAuthority(authorityEnvironment(), sourceSha),
    ).not.toThrow();
    expect(() =>
      assertReleaseStagingLatencyAuthority(
        authorityEnvironment({ CI_GH_PRODUCTION_PROMOTION: "true" }),
        sourceSha,
      ),
    ).toThrow("production promotion must remain disabled");
    expect(() =>
      assertReleaseStagingLatencyAuthority(
        authorityEnvironment({ GITHUB_ACTIONS: "false" }),
        sourceSha,
      ),
    ).toThrow("GitHub Actions");
    expect(() =>
      assertReleaseStagingLatencyAuthority(authorityEnvironment(), "b".repeat(40)),
    ).toThrow("validated source SHA must equal the checked-out source SHA");
    expect(() =>
      assertReleaseStagingLatencyAuthority(
        authorityEnvironment({
          GITHUB_WORKFLOW_REF:
            "hashencode/shoppp/.github/workflows/accept-fashion-staging-u8.yml@refs/heads/main",
        }),
        sourceSha,
      ),
    ).toThrow("deploy.yml");
  });

  test("preserves the 20-sample, concurrency-4, 500/800 ms release thresholds", async () => {
    let cart = 0;
    const report = await runReleaseStagingLatencyProbe(
      latencyConfig(),
      async (input, init) => {
        const url = String(input);
        if (url.endsWith("/cart") && init?.method === "POST") {
          cart += 1;
          return Response.json({ data: { token: `private-token-${cart}` } });
        }
        return Response.json({ data: {} });
      },
      () => 0,
    );

    expect(report).toEqual({
      catalogReadP95Ms: 0,
      cartReadP95Ms: 0,
      checkoutConcurrency: 4,
      checkoutMutationP95Ms: 0,
      sampleCount: 20,
    });
    expect(JSON.stringify(report)).not.toContain("private-token");

    const boundary = {
      catalogReadP95Ms: 500,
      cartReadP95Ms: 500,
      checkoutConcurrency: 4 as const,
      checkoutMutationP95Ms: 800,
      sampleCount: 20 as const,
    };
    expect(() => assertReleaseStagingLatencyThresholds(boundary)).not.toThrow();
    expect(() =>
      assertReleaseStagingLatencyThresholds({ ...boundary, catalogReadP95Ms: 501 }),
    ).toThrow("staging read p95 exceeds 500 ms");
    expect(() =>
      assertReleaseStagingLatencyThresholds({ ...boundary, checkoutMutationP95Ms: 801 }),
    ).toThrow("staging checkout mutation p95 exceeds 800 ms");
  });
});

test("the actual formal publication job environment reaches its own authority path without rehearsal flags", async () => {
  const { readFile } = await import("node:fs/promises");
  const { formalPublicationEnvironment, formalPublicationFixture } =
    await import("../e2e/formal-publication-test-fixture");
  const { parseFormalPublicationContext } = await import("../e2e/formal-publication-context");
  const verifier = await import("./verify-release-staging-latency");
  const workflow = Bun.YAML.parse(
    await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
  ) as {
    jobs: Record<
      string,
      {
        env: Record<string, string>;
        steps: Array<{ id?: string; env?: Record<string, string>; run?: string }>;
      }
    >;
  };
  const job = workflow.jobs["publication-staging"]!;
  const deliver = job.steps.find((step) => step.id === "deliver")!;
  const fixture = formalPublicationFixture();
  const runtime = formalPublicationEnvironment(fixture);
  const values: Record<string, string> = {
    "inputs.publication_id": runtime.PUBLICATION_ID,
    "inputs.source_environment": runtime.SOURCE_ENVIRONMENT,
    "needs.preflight.outputs.source_sha": sourceSha,
    "needs.validate.outputs.source_sha": sourceSha,
    "vars.PRODUCT_SLUG": runtime.E2E_PRODUCT_SLUG,
    "vars.STOREFRONT_URL": runtime.STOREFRONT_E2E_BASE_URL,
  };
  const actual = Object.fromEntries(
    Object.entries({ ...job.env, ...deliver.env }).map(([key, value]) => [
      key,
      value.replace(
        /\$\{\{\s*([^}]+?)\s*\}\}/g,
        (_, expression: string) => values[expression] ?? "unused",
      ),
    ]),
  );
  const env = { ...runtime, ...actual };
  expect(deliver.run).toContain("--formal-publication");
  expect(job.env.CI_GH_STAGING_REHEARSAL).toBeUndefined();
  expect(() =>
    verifier.assertFormalPublicationStagingLatencyAuthority(
      parseFormalPublicationContext(fixture, env),
      env,
      sourceSha,
    ),
  ).not.toThrow();
  expect(() => assertReleaseStagingLatencyAuthority(env, sourceSha)).toThrow("rehearsal");
});
