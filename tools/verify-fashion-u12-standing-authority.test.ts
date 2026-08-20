import { describe, expect, test } from "bun:test";

import { assertStandingFashionU12Authority } from "./verify-fashion-u12-standing-authority";

const baseline = "79fbee07f60245b036b5a4d42858227502947a5c";
const head = "d2297f0f73cfbc1c7d5dc766ba1291f09b05f5b4";

describe("Fashion U12 standing execution authority", () => {
  test("accepts a descendant composed only of scoped U12 commits and files", () => {
    expect(
      assertStandingFashionU12Authority({
        baseline,
        commits: [
          {
            files: [".github/workflows/preview-storefront.yml", "tools/deploy-workflow.test.ts"],
            parentCount: 1,
            sha: "a".repeat(40),
            subject: "fix(ci): reconcile Fashion Preview readiness identity (U12)",
          },
          {
            files: ["apps/storefront/scripts/prepare-experience.ts"],
            parentCount: 1,
            sha: head,
            subject: "fix(storefront): accept governed Preview media origins (U12)",
          },
        ],
        head,
        isDescendant: true,
      }),
    ).toEqual({ baseline, commitCount: 2, head });
  });

  test("rejects a non-descendant, unrelated commit, or out-of-scope file", () => {
    expect(() =>
      assertStandingFashionU12Authority({
        baseline,
        commits: [],
        head,
        isDescendant: false,
      }),
    ).toThrow(/descend from the approved baseline/);

    expect(() =>
      assertStandingFashionU12Authority({
        baseline,
        commits: [
          {
            files: ["tools/deploy-workflow.test.ts"],
            parentCount: 1,
            sha: head,
            subject: "feat(ci): start unrelated validation lane (CI-U1)",
          },
        ],
        head,
        isDescendant: true,
      }),
    ).toThrow(/not an FS-U12 commit/);

    expect(() =>
      assertStandingFashionU12Authority({
        baseline,
        commits: [
          {
            files: ["apps/api/src/http/app.ts"],
            parentCount: 1,
            sha: head,
            subject: "fix(api): change an unrelated API surface (U12)",
          },
        ],
        head,
        isDescendant: true,
      }),
    ).toThrow(/outside the standing FS-U12 scope/);

    expect(() =>
      assertStandingFashionU12Authority({
        baseline,
        commits: [
          {
            files: [],
            parentCount: 2,
            sha: head,
            subject: "merge: combine an opaque branch (U12)",
          },
        ],
        head,
        isDescendant: true,
      }),
    ).toThrow(/must have exactly one parent/);
  });
});
