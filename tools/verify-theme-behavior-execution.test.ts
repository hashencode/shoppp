import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fashionStoreBehaviorContract } from "../apps/storefront/app/themes/fashion-store/behavior-contract";
import type { ThemeBehaviorModeEvidence } from "../apps/storefront/e2e/support/theme-behavior-contract";
import { THEME_BEHAVIOR_EVIDENCE_ANNOTATION } from "../apps/storefront/e2e/support/theme-behavior-evidence";
import { verifyThemeBehaviorExecution } from "./verify-theme-behavior-execution";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

function completeEvidence(): ThemeBehaviorModeEvidence[] {
  return fashionStoreBehaviorContract.behaviors.flatMap((behavior) =>
    behavior.modes.map((mode, modeIndex) => ({
      ...(mode === "temporal"
        ? { temporalSamples: { after: 12, before: 0, elapsedMs: 1_000 } }
        : {}),
      ...(mode === "scroll-fixed" ? { scrollSamples: [0, 100] } : {}),
      ...(mode === "interaction" || mode === "static" || mode === "fallback"
        ? { actionOutcome: true }
        : {}),
      behaviorId: behavior.id,
      ...(modeIndex === 0 && behavior.branches.length > 0
        ? {
            branches: behavior.branches.map(({ id }) => ({
              id,
              outcome: true,
              viewportId: /compact|mobile/.test(id) ? ("mobile" as const) : ("desktop" as const),
            })),
          }
        : {}),
      mode,
    })),
  );
}

async function report(records: ThemeBehaviorModeEvidence[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "shoppp-behavior-execution-"));
  temporaryRoots.push(directory);
  const path = join(directory, "report.json");
  await writeFile(
    path,
    JSON.stringify({
      suites: [
        {
          specs: [
            {
              tests: [
                {
                  annotations: records.map((record) => ({
                    description: JSON.stringify(record),
                    type: THEME_BEHAVIOR_EVIDENCE_ANNOTATION,
                  })),
                  results: [{ status: "passed" }],
                  status: "expected",
                },
              ],
            },
          ],
        },
      ],
    }),
  );
  return path;
}

describe("executed behavior-mode evidence", () => {
  test("accepts complete evidence from passed Playwright results", async () => {
    await expect(
      verifyThemeBehaviorExecution({
        reportPath: await report(completeEvidence()),
        root: resolve(import.meta.dir, ".."),
        themeId: "fashion-store",
      }),
    ).resolves.toBe(31);
  });

  test("rejects a missing mode and ignores evidence from failed tests", async () => {
    const records = completeEvidence();
    records.pop();
    await expect(
      verifyThemeBehaviorExecution({
        reportPath: await report(records),
        root: resolve(import.meta.dir, ".."),
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/missing .* evidence/);
  });

  test("rejects malformed numeric evidence decoded from Playwright annotations", async () => {
    const records = completeEvidence() as unknown as Record<string, unknown>[];
    const temporal = records.find((record) => record.mode === "temporal")!;
    temporal.temporalSamples = { after: 1, before: 0, elapsedMs: "not-a-number" };
    await expect(
      verifyThemeBehaviorExecution({
        reportPath: await report(records as unknown as ThemeBehaviorModeEvidence[]),
        root: resolve(import.meta.dir, ".."),
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/temporalSamples must contain finite numbers/);
  });

  test("rejects complete behavior-mode pairs when a declared branch is missing", async () => {
    const records = completeEvidence();
    for (const record of records) {
      if (record.behaviorId === "header-shop-navigation")
        Reflect.deleteProperty(record, "branches");
    }
    await expect(
      verifyThemeBehaviorExecution({
        reportPath: await report(records),
        root: resolve(import.meta.dir, ".."),
        themeId: "fashion-store",
      }),
    ).rejects.toThrow(/missing desktop-hover branch evidence/);
  });
});
