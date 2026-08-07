import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  assertThemeBehaviorModeEvidenceComplete,
  decodeThemeBehaviorModeEvidence,
  type ThemeBehaviorModeEvidence,
} from "../apps/storefront/e2e/support/theme-behavior-contract";
import { THEME_BEHAVIOR_EVIDENCE_ANNOTATION } from "../apps/storefront/e2e/support/theme-behavior-evidence";
import { loadThemeBehaviorDescriptor } from "./load-theme-behavior-descriptor";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

interface JsonNode {
  annotations?: { description?: string; type?: string }[];
  results?: { status?: string }[];
  status?: string;
  [key: string]: unknown;
}

function collectPassedEvidence(node: unknown, inheritedPassed = true): ThemeBehaviorModeEvidence[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node))
    return node.flatMap((value) => collectPassedEvidence(value, inheritedPassed));
  const value = node as JsonNode;
  const hasResults = Array.isArray(value.results);
  const passed =
    inheritedPassed &&
    (!hasResults || value.results!.some(({ status }) => status === "passed")) &&
    (value.status === undefined || value.status === "expected" || value.status === "passed");
  const evidence = passed
    ? (value.annotations ?? []).flatMap((annotation) => {
        if (annotation.type !== THEME_BEHAVIOR_EVIDENCE_ANNOTATION || !annotation.description)
          return [];
        return [decodeThemeBehaviorModeEvidence(JSON.parse(annotation.description))];
      })
    : [];
  for (const child of Object.values(value)) {
    if (child === value.annotations || child === value.results) continue;
    evidence.push(...collectPassedEvidence(child, passed));
  }
  return evidence;
}

export async function verifyThemeBehaviorExecution(options: {
  pageId: string;
  reportPath: string;
  root?: string;
  themeId: string;
}): Promise<number> {
  const root = options.root ?? resolve(import.meta.dir, "..");
  const policy = await loadSourceEquivalencePolicy(root);
  const theme = policy.themes.find(({ id }) => id === options.themeId);
  if (!theme) throw new Error(`Unknown source-equivalence theme: ${options.themeId}.`);
  const page = theme.pages.find(({ id }) => id === options.pageId);
  if (!page)
    throw new Error(`Unknown source-equivalence page: ${options.themeId}/${options.pageId}.`);
  const descriptor = await loadThemeBehaviorDescriptor(page, root);
  const report = JSON.parse(await readFile(resolve(options.reportPath), "utf8")) as unknown;
  const evidence = collectPassedEvidence(report);
  assertThemeBehaviorModeEvidenceComplete(descriptor.contract, evidence);
  return evidence.length;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      page: { type: "string" },
      report: { type: "string" },
      theme: { type: "string" },
    },
    strict: true,
  });
  if (!values.page || !values.report || !values.theme)
    throw new Error("--page, --report and --theme are required");
  const count = await verifyThemeBehaviorExecution({
    pageId: values.page,
    reportPath: values.report,
    themeId: values.theme,
  });
  console.log(`Verified ${count} executed behavior-mode evidence records.`);
}
