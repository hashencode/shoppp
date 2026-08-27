import { describe, expect, test } from "bun:test";
import {
  type GitCommandResult,
  type GitRunner,
  prepareTrustedSourceRequest,
  resolveTrustedSourceIdentity,
} from "./ci-trusted-source-preflight";

const SOURCE_SHA = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const BASE_INPUT = {
  mode: "validation" as const,
  defaultBranch: "main",
  eventName: "workflow_dispatch",
  fallbackSourceSha: SOURCE_SHA,
  repository: "hashencode/shoppp",
  repositoryOwner: "hashencode",
  workflowActor: "hashencode",
  workflowRef: "hashencode/shoppp/.github/workflows/full-validation.yml@refs/heads/main",
};

function result(stdout = "", exitCode = 0, stderr = ""): GitCommandResult {
  return { exitCode, stderr, stdout };
}

describe("trusted source preflight", () => {
  test("rejects untrusted request identities before Git access", () => {
    const cases = [
      {
        input: {
          workflowRef: "hashencode/shoppp/.github/workflows/full-validation.yml@refs/heads/topic",
        },
        message: "protected default branch",
      },
      { input: { workflowActor: "intruder" }, message: "authorized release operator" },
      { input: { requestedSourceSha: "short" }, message: "source SHA" },
      {
        input: { requestedReleaseId: "unsafe\nrelease" },
        message: "unsafe characters",
      },
      {
        input: { requestedSourceRef: "refs/heads/candidate" },
        message: "not governed",
      },
      {
        input: {
          frozenCandidateRef: "refs/heads/governed",
          requestedSourceRef: "refs/heads/other",
        },
        message: "not governed",
      },
    ];
    for (const { input, message } of cases) {
      expect(() => prepareTrustedSourceRequest({ ...BASE_INPUT, ...input })).toThrow(message);
    }
  });

  test("accepts an explicitly listed release operator", () => {
    const request = prepareTrustedSourceRequest({
      ...BASE_INPUT,
      workflowActor: "release-operator",
      releaseOperators: "first, release-operator,third",
    });
    expect(request.sourceSha).toBe(SOURCE_SHA);
  });

  test("scheduled validation fails closed without an approved release ID", () => {
    expect(() => prepareTrustedSourceRequest({ ...BASE_INPUT, eventName: "schedule" })).toThrow(
      "SCHEDULED_CATALOG_RELEASE_ID",
    );
    expect(
      prepareTrustedSourceRequest({
        ...BASE_INPUT,
        eventName: "schedule",
        scheduledCatalogReleaseId: "approved-scheduled-release",
      }).releaseId,
    ).toBe("approved-scheduled-release");
  });

  test("allows deploy only from the protected deploy workflow", () => {
    const deploy = {
      ...BASE_INPUT,
      mode: "deploy" as const,
      requestedReleaseId: "release-1",
      workflowRef: "hashencode/shoppp/.github/workflows/deploy.yml@refs/heads/main",
    };
    expect(prepareTrustedSourceRequest(deploy).releaseId).toBe("release-1");
    expect(() =>
      prepareTrustedSourceRequest({
        ...deploy,
        workflowRef: "hashencode/shoppp/.github/workflows/full-validation.yml@refs/heads/main",
      }),
    ).toThrow("protected default branch");
  });

  test("resolves a default-branch ancestor to its exact tree", async () => {
    const git: GitRunner = async (arguments_) => {
      if (arguments_[0] === "merge-base") return result();
      if (arguments_[0] === "cat-file") return result();
      if (arguments_[0] === "rev-parse") return result(SOURCE_TREE);
      return result("", 2, `unexpected git command: ${arguments_.join(" ")}`);
    };
    await expect(
      resolveTrustedSourceIdentity(prepareTrustedSourceRequest(BASE_INPUT), git),
    ).resolves.toMatchObject({ sourceSha: SOURCE_SHA, sourceTree: SOURCE_TREE });
  });

  test("accepts only the exact fetched frozen candidate SHA", async () => {
    const request = prepareTrustedSourceRequest({
      ...BASE_INPUT,
      frozenCandidateRef: "refs/heads/frozen-candidate",
      requestedSourceRef: "refs/heads/frozen-candidate",
    });
    const git =
      (candidateSha: string): GitRunner =>
      async (arguments_) => {
        if (arguments_[0] === "check-ref-format") return result();
        if (arguments_[0] === "merge-base") return result("", 1);
        if (arguments_[0] === "fetch") return result();
        if (arguments_[0] === "rev-parse" && arguments_[1]?.endsWith("^{commit}")) {
          return result(candidateSha);
        }
        if (arguments_[0] === "cat-file") return result();
        if (arguments_[0] === "rev-parse") return result(SOURCE_TREE);
        return result("", 2, `unexpected git command: ${arguments_.join(" ")}`);
      };
    await expect(resolveTrustedSourceIdentity(request, git(SOURCE_SHA))).resolves.toMatchObject({
      sourceSha: SOURCE_SHA,
      sourceTree: SOURCE_TREE,
    });
    await expect(resolveTrustedSourceIdentity(request, git("c".repeat(40)))).rejects.toThrow(
      "different SHA",
    );
  });

  test("rejects an unreachable source without the governed frozen ref", async () => {
    const git: GitRunner = async () => result("", 1);
    await expect(
      resolveTrustedSourceIdentity(prepareTrustedSourceRequest(BASE_INPUT), git),
    ).rejects.toThrow("outside the protected reachable set");
  });
});
