import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  loadSourceEquivalencePolicy,
  type SourceEquivalencePolicy,
} from "./verify-source-equivalent-themes";

export type AcceptanceScope = "focused" | "page" | "repository";

export interface AcceptanceRunOptions {
  commit?: string;
  evidencePath?: string;
  mode?: "fallback" | "interaction" | "scroll-fixed" | "static" | "temporal";
  scope: AcceptanceScope;
  state?: string;
  themeId?: string;
  workers?: number;
}

export interface AcceptancePlan {
  filteredModes: string[];
  fullEvidenceOutstanding: boolean;
  scope: AcceptanceScope;
  steps: { command: string[]; label: string }[];
  themeIds: string[];
}

const ROOT = resolve(import.meta.dir, "..");
const MODES = new Set(["fallback", "interaction", "scroll-fixed", "static", "temporal"]);

export function buildAcceptancePlan(
  policy: SourceEquivalencePolicy,
  options: AcceptanceRunOptions,
): AcceptancePlan {
  const workers = options.workers ?? policy.resources.heavyBatchDefaultWorkers;
  if (
    !Number.isInteger(workers) ||
    workers < 1 ||
    workers > policy.resources.maxConcurrentBrowserWorkers
  )
    throw new Error(
      `workers must be between 1 and ${policy.resources.maxConcurrentBrowserWorkers}`,
    );
  if (options.mode && !MODES.has(options.mode))
    throw new Error(`unknown acceptance mode: ${options.mode}`);
  const themes = options.themeId
    ? policy.themes.filter(({ id }) => id === options.themeId)
    : policy.themes;
  if (themes.length === 0) throw new Error(`unknown source-equivalence theme: ${options.themeId}`);
  if (options.scope !== "repository" && themes.length !== 1)
    throw new Error(`${options.scope} acceptance requires --theme`);

  if (options.scope === "focused") {
    const theme = themes[0]!;
    if (!options.state) throw new Error("focused acceptance requires --state");
    const focusedState = theme.acceptance.focusedStates.find(({ id }) => id === options.state);
    if (!focusedState) throw new Error(`${theme.id}: unknown focused state ${options.state}`);
    if (!options.mode) throw new Error("focused acceptance requires --mode");
    if (!focusedState.modes.includes(options.mode))
      throw new Error(`${theme.id}/${options.state}: mode ${options.mode} is not declared`);
    return {
      filteredModes: [options.mode],
      fullEvidenceOutstanding: true,
      scope: options.scope,
      steps: [
        {
          command: [
            "bunx",
            "playwright",
            "test",
            "--config",
            theme.acceptance.browserConfig,
            "--project",
            theme.acceptance.browserProject,
            "--grep",
            `${options.state} ${options.mode}`,
            "--workers",
            String(workers),
          ],
          label: `${theme.id}/${options.state}`,
        },
      ],
      themeIds: [theme.id],
    };
  }

  if (options.scope === "page") {
    const theme = themes[0]!;
    return {
      filteredModes: [],
      fullEvidenceOutstanding: true,
      scope: options.scope,
      steps: [{ command: theme.acceptance.pageCommand, label: `${theme.id}/page` }],
      themeIds: [theme.id],
    };
  }

  if (!options.commit || !/^[a-f0-9]{7,40}$/.test(options.commit))
    throw new Error("repository acceptance requires --commit=<git-sha>");
  if (!options.evidencePath)
    throw new Error("repository acceptance requires --evidence=<report-directory>");
  return {
    filteredModes: [],
    fullEvidenceOutstanding: false,
    scope: options.scope,
    steps: [
      { command: ["bun", "run", "verify:source-equivalence"], label: "contracts" },
      { command: ["bun", "run", "test:theme-matrix"], label: "all-pages" },
      {
        command: [
          "bun",
          "tools/verify-source-equivalent-themes.ts",
          "--evidence",
          options.evidencePath,
          "--commit",
          options.commit,
        ],
        label: "fidelity-evidence",
      },
    ],
    themeIds: themes.map(({ id }) => id),
  };
}

export async function runAcceptancePlan(plan: AcceptancePlan): Promise<void> {
  for (const step of plan.steps) {
    console.log(`[source-equivalence] ${step.label}: ${step.command.join(" ")}`);
    const child = Bun.spawn(step.command, {
      cwd: ROOT,
      env: process.env,
      stderr: "inherit",
      stdout: "inherit",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) throw new Error(`${step.label} failed with exit code ${exitCode}`);
  }
  console.log(
    JSON.stringify({
      filteredModes: plan.filteredModes,
      fullEvidenceOutstanding: plan.fullEvidenceOutstanding,
      scope: plan.scope,
      themeIds: plan.themeIds,
    }),
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      commit: { type: "string" },
      evidence: { type: "string" },
      mode: { type: "string" },
      scope: { default: "page", type: "string" },
      state: { type: "string" },
      theme: { type: "string" },
      workers: { type: "string" },
    },
    strict: true,
  });
  if (!["focused", "page", "repository"].includes(values.scope))
    throw new Error(`unknown acceptance scope: ${values.scope}`);
  const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
    scope: values.scope as AcceptanceScope,
    ...(values.commit ? { commit: values.commit } : {}),
    ...(values.evidence ? { evidencePath: values.evidence } : {}),
    ...(values.mode ? { mode: values.mode as NonNullable<AcceptanceRunOptions["mode"]> } : {}),
    ...(values.state ? { state: values.state } : {}),
    ...(values.theme ? { themeId: values.theme } : {}),
    ...(values.workers ? { workers: Number(values.workers) } : {}),
  });
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runAcceptancePlan(plan);
}

if (import.meta.main) await main();
