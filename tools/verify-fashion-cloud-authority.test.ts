import { describe, expect, test } from "bun:test";

import { verifyFashionCloudAuthority } from "./verify-fashion-cloud-authority";

const valid = {
  actor: "hashencode",
  authorizedActors: "hashencode,release-operator",
  candidateSha: "a".repeat(40),
  eventName: "workflow_dispatch",
  expectedRepository: "hashencode/shoppp",
  harnessSha: "b".repeat(40),
  isFork: false,
  ref: "refs/heads/main",
  repository: "hashencode/shoppp",
  repositoryOwner: "hashencode",
  workflowSha: "b".repeat(40),
};

describe("Fashion cloud authority preflight", () => {
  test("accepts an authorized base-repository dispatch on exact main", () => {
    expect(verifyFashionCloudAuthority(valid)).toEqual({
      candidateSha: valid.candidateSha,
      harnessSha: valid.harnessSha,
      passed: true,
      runnerClass: "github-hosted-ubuntu-24.04",
    });
  });

  test("rejects forks, PR events, non-main refs, unauthorized actors, and untrusted workflow SHAs", () => {
    for (const [input, message] of [
      [{ isFork: true }, /base repository/],
      [{ eventName: "pull_request" }, /workflow_dispatch/],
      [{ eventName: "pull_request_target" }, /workflow_dispatch/],
      [{ ref: "refs/heads/feature" }, /exact main/],
      [{ actor: "intruder" }, /authorized/],
      [{ workflowSha: "c".repeat(40) }, /workflow SHA/],
    ] as const) {
      expect(() => verifyFashionCloudAuthority({ ...valid, ...input })).toThrow(message);
    }
  });
});
