import type { TestInfo } from "@playwright/test";
import type { ThemeBehaviorModeEvidence } from "./theme-behavior-contract";

export const THEME_BEHAVIOR_EVIDENCE_ANNOTATION = "theme-behavior-evidence";

export function recordThemeBehaviorEvidence(
  testInfo: TestInfo,
  ...evidence: ThemeBehaviorModeEvidence[]
): void {
  for (const record of evidence) {
    testInfo.annotations.push({
      description: JSON.stringify(record),
      type: THEME_BEHAVIOR_EVIDENCE_ANNOTATION,
    });
  }
}
