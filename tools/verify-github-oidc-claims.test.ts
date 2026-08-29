import { describe, expect, test } from "bun:test";

import { verifyGithubOidcClaims } from "./verify-github-oidc-claims";

const claims = {
  actor: "hashencode",
  aud: "shoppp-fashion-staging",
  environment: "fashion-staging",
  event_name: "workflow_dispatch",
  exp: 2_000,
  iss: "https://token.actions.githubusercontent.com",
  nbf: 900,
  ref: "refs/heads/main",
  repository: "hashencode/shoppp",
  repository_owner: "hashencode",
  sub: "repo:hashencode/shoppp:environment:fashion-staging",
  workflow_ref: "hashencode/shoppp/.github/workflows/preview-storefront.yml@refs/heads/main",
};
const authority = {
  authorizedActors: "release-operator",
  expectedAudience: "shoppp-fashion-staging",
  expectedEnvironment: "fashion-staging",
  expectedRepository: "hashencode/shoppp",
  expectedWorkflowRef: claims.workflow_ref,
  nowSeconds: 1_000,
};

describe("GitHub OIDC Fashion staging claims", () => {
  test("accepts the exact protected main workflow identity", () => {
    expect(verifyGithubOidcClaims(claims, authority)).toEqual({
      actor: "hashencode",
      passed: true,
      repository: "hashencode/shoppp",
    });
  });

  test("rejects cross-repository, non-main, PR, and unauthorized identities", () => {
    for (const [override, message] of [
      [{ aud: "another-service" }, /audience/],
      [{ repository: "fork/shoppp" }, /repository/],
      [{ ref: "refs/heads/feature" }, /exact main/],
      [{ event_name: "pull_request_target" }, /workflow_dispatch/],
      [{ actor: "intruder" }, /actor/],
      [{ environment: "production" }, /environment/],
      [{ sub: "repo:hashencode/shoppp:ref:refs/heads/main" }, /subject/],
      [
        { workflow_ref: "hashencode/shoppp/.github/workflows/other.yml@refs/heads/main" },
        /workflow ref/,
      ],
      [{ iss: "https://issuer.example.test" }, /issuer/],
      [{ exp: 1_000 }, /expired/],
      [{ nbf: 1_001 }, /not active/],
    ] as const) {
      expect(() => verifyGithubOidcClaims({ ...claims, ...override }, authority)).toThrow(message);
    }
  });
});
