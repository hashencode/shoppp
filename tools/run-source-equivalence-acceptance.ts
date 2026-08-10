import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  loadSourceEquivalencePolicy,
  type SourceEquivalencePolicy,
} from "./verify-source-equivalent-themes";

export type AcceptanceScope = "focused" | "page" | "repository" | "shadow" | "theme";

export type AcceptanceFailureClassification =
  | "CONTRACT_MISMATCH"
  | "EVIDENCE_MISMATCH"
  | "PAGE_ACCEPTANCE_FAILURE"
  | "RC_IDENTITY_MISMATCH"
  | "STATE_OR_BEHAVIOR_FAILURE"
  | "TRANSIENT_INFRASTRUCTURE_FAILURE"
  | "UNKNOWN_ACCEPTANCE_FAILURE";

export interface AcceptanceStep {
  command: string[];
  label: string;
}

export interface AcceptanceRunOptions {
  commit?: string;
  evidencePath?: string;
  mode?: "fallback" | "interaction" | "scroll-fixed" | "static" | "temporal";
  pageId?: string;
  rcManifest?: string;
  scope: AcceptanceScope;
  state?: string;
  themeId?: string;
  workers?: number;
}

export interface AcceptancePlan {
  filteredModes: string[];
  fullEvidenceOutstanding: boolean;
  pageIds: string[];
  scope: AcceptanceScope;
  steps: AcceptanceStep[];
  themeIds: string[];
}

function resolvedCommand(command: string[], values: { page?: string; theme: string }): string[] {
  return command.map((argument) =>
    argument.replaceAll("{theme}", values.theme).replaceAll("{page}", values.page ?? ""),
  );
}

function uniqueThemeCommandSteps(themes: SourceEquivalencePolicy["themes"]): AcceptanceStep[] {
  const groups = new Map<
    string,
    { command: string[]; pageLabels: string[]; themeIds: Set<string> }
  >();
  for (const theme of themes) {
    const command = resolvedCommand(theme.acceptance.themeCommand, { theme: theme.id });
    const key = JSON.stringify(command);
    const group = groups.get(key) ?? {
      command,
      pageLabels: [],
      themeIds: new Set<string>(),
    };
    group.pageLabels.push(...theme.pages.map(({ id }) => id));
    group.themeIds.add(theme.id);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ command, pageLabels, themeIds }) => ({
    command,
    label: `${[...themeIds].join("+")}/pages[${pageLabels.join(",")}]`,
  }));
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
  if (options.scope !== "repository" && options.scope !== "shadow" && themes.length !== 1)
    throw new Error(`${options.scope} acceptance requires --theme`);

  const selectedTheme = themes[0];
  const selectedPage = selectedTheme?.pages.find(({ id }) => id === options.pageId);
  if ((options.scope === "focused" || options.scope === "page") && !options.pageId)
    throw new Error(`${options.scope} acceptance requires --page`);
  if ((options.scope === "focused" || options.scope === "page") && !selectedPage)
    throw new Error(`${selectedTheme?.id}: unknown page ${options.pageId}`);

  if (options.scope === "focused") {
    const theme = themes[0]!;
    const page = selectedPage!;
    if (!options.state) throw new Error("focused acceptance requires --state");
    const focusedState = page.focusedStates.find(({ id }) => id === options.state);
    if (!focusedState)
      throw new Error(`${theme.id}/${page.id}: unknown focused state ${options.state}`);
    if (!options.mode) throw new Error("focused acceptance requires --mode");
    if (!page.applicableModes.includes(options.mode))
      throw new Error(`${theme.id}/${page.id}: mode ${options.mode} is not applicable`);
    if (!focusedState.modes.includes(options.mode))
      throw new Error(
        `${theme.id}/${page.id}/${options.state}: mode ${options.mode} is not declared`,
      );
    return {
      filteredModes: [options.mode],
      fullEvidenceOutstanding: true,
      pageIds: [page.id],
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
          label: `${theme.id}/${page.id}/${options.state}`,
        },
      ],
      themeIds: [theme.id],
    };
  }

  if (options.scope === "page") {
    const theme = themes[0]!;
    const page = selectedPage!;
    return {
      filteredModes: [],
      fullEvidenceOutstanding: true,
      pageIds: [page.id],
      scope: options.scope,
      steps: [
        {
          command: resolvedCommand(theme.acceptance.pageCommand, {
            page: page.id,
            theme: theme.id,
          }),
          label: `${theme.id}/${page.id}/page`,
        },
      ],
      themeIds: [theme.id],
    };
  }

  if (options.scope === "theme") {
    const theme = themes[0]!;
    return {
      filteredModes: [],
      fullEvidenceOutstanding: true,
      pageIds: theme.pages.map(({ id }) => id),
      scope: options.scope,
      steps: uniqueThemeCommandSteps([theme]),
      themeIds: [theme.id],
    };
  }

  if (options.scope === "shadow") {
    if (options.commit || options.evidencePath || options.rcManifest)
      throw new Error("shadow acceptance runs before commit-bound RC evidence");
    return {
      filteredModes: [],
      fullEvidenceOutstanding: true,
      pageIds: themes.flatMap((theme) => theme.pages.map(({ id }) => id)),
      scope: options.scope,
      steps: [
        { command: ["bun", "run", "verify:source-equivalence"], label: "contracts" },
        ...uniqueThemeCommandSteps(themes),
      ],
      themeIds: themes.map(({ id }) => id),
    };
  }

  if (!options.commit || !/^[a-f0-9]{40}$/.test(options.commit))
    throw new Error("repository acceptance requires --commit=<full-git-sha>");
  if (!options.evidencePath)
    throw new Error("repository acceptance requires --evidence=<report-directory>");
  if (!options.rcManifest)
    throw new Error("repository acceptance requires --rc-manifest=<frozen-manifest>");
  return {
    filteredModes: [],
    fullEvidenceOutstanding: false,
    pageIds: themes.flatMap((theme) => theme.pages.map(({ id }) => id)),
    scope: options.scope,
    steps: [
      {
        command: [
          "bun",
          "tools/source-equivalence-rc.ts",
          "verify",
          `--manifest=${options.rcManifest}`,
          `--commit=${options.commit}`,
        ],
        label: "rc-identity",
      },
      { command: ["bun", "run", "verify:source-equivalence"], label: "contracts" },
      ...uniqueThemeCommandSteps(themes),
      {
        command: [
          "bun",
          "tools/verify-source-equivalent-themes.ts",
          "--evidence",
          options.evidencePath,
          "--commit",
          options.commit,
          "--rc-manifest",
          options.rcManifest,
        ],
        label: "fidelity-evidence",
      },
    ],
    themeIds: themes.map(({ id }) => id),
  };
}

const TRANSIENT_INFRASTRUCTURE_PATTERNS = [
  /EADDRINUSE/i,
  /is already used, make sure that nothing is running on the port/i,
  /net::ERR_CONNECTION_(?:REFUSED|RESET)/i,
  /ECONNRESET/i,
  /Target page, context or browser has been closed/i,
] as const;

export function classifyAcceptanceFailure(
  step: AcceptanceStep,
  output = "",
): AcceptanceFailureClassification {
  if (TRANSIENT_INFRASTRUCTURE_PATTERNS.some((pattern) => pattern.test(output)))
    return "TRANSIENT_INFRASTRUCTURE_FAILURE";
  if (step.label === "rc-identity") return "RC_IDENTITY_MISMATCH";
  if (step.label === "contracts") return "CONTRACT_MISMATCH";
  if (step.label === "fidelity-evidence") return "EVIDENCE_MISMATCH";
  if (step.label.endsWith("/page") || step.label.includes("/pages["))
    return "PAGE_ACCEPTANCE_FAILURE";
  if (step.label.split("/").length >= 3) return "STATE_OR_BEHAVIOR_FAILURE";
  return "UNKNOWN_ACCEPTANCE_FAILURE";
}

export function acceptanceFailureRecord(step: AcceptanceStep, exitCode: number, output = "") {
  return {
    classification: classifyAcceptanceFailure(step, output),
    exitCode,
    failedStep: step.label,
    rerunCommand: step.command.join(" "),
  } as const;
}

async function forwardAndCapture(
  stream: ReadableStream<Uint8Array>,
  destination: { write(chunk: Uint8Array): unknown },
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let tail = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    destination.write(value);
    tail = `${tail}${decoder.decode(value, { stream: true })}`.slice(-32_768);
  }
  return `${tail}${decoder.decode()}`.slice(-32_768);
}

export async function runAcceptancePlan(
  plan: AcceptancePlan,
  options: { transientRetries?: number } = {},
): Promise<void> {
  for (const step of plan.steps) {
    const allowedRetries = Math.min(1, Math.max(0, options.transientRetries ?? 0));
    for (let attempt = 0; ; attempt += 1) {
      console.log(`[source-equivalence] ${step.label}: ${step.command.join(" ")}`);
      const child = Bun.spawn(step.command, {
        cwd: ROOT,
        env: process.env,
        stderr: "pipe",
        stdout: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        forwardAndCapture(child.stdout, process.stdout),
        forwardAndCapture(child.stderr, process.stderr),
        child.exited,
      ]);
      if (exitCode === 0) break;
      const failure = acceptanceFailureRecord(step, exitCode, `${stdout}\n${stderr}`);
      console.error(JSON.stringify(failure));
      if (
        failure.classification === "TRANSIENT_INFRASTRUCTURE_FAILURE" &&
        attempt < allowedRetries
      ) {
        console.error(
          `[source-equivalence] clean transient retry ${attempt + 1}/${allowedRetries}: ${failure.rerunCommand}`,
        );
        continue;
      }
      throw new Error(
        `${step.label} failed with exit code ${exitCode}; rerun: ${failure.rerunCommand}`,
      );
    }
  }
  console.log(
    JSON.stringify({
      filteredModes: plan.filteredModes,
      fullEvidenceOutstanding: plan.fullEvidenceOutstanding,
      pageIds: plan.pageIds,
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
      page: { type: "string" },
      "rc-manifest": { type: "string" },
      scope: { default: "page", type: "string" },
      state: { type: "string" },
      theme: { type: "string" },
      "retry-transient": { type: "string" },
      workers: { type: "string" },
    },
    strict: true,
  });
  if (!["focused", "page", "repository", "shadow", "theme"].includes(values.scope))
    throw new Error(`unknown acceptance scope: ${values.scope}`);
  const plan = buildAcceptancePlan(await loadSourceEquivalencePolicy(), {
    scope: values.scope as AcceptanceScope,
    ...(values.commit ? { commit: values.commit } : {}),
    ...(values.evidence ? { evidencePath: values.evidence } : {}),
    ...(values.mode ? { mode: values.mode as NonNullable<AcceptanceRunOptions["mode"]> } : {}),
    ...(values.page ? { pageId: values.page } : {}),
    ...(values["rc-manifest"] ? { rcManifest: values["rc-manifest"] } : {}),
    ...(values.state ? { state: values.state } : {}),
    ...(values.theme ? { themeId: values.theme } : {}),
    ...(values.workers ? { workers: Number(values.workers) } : {}),
  });
  const transientRetries = values["retry-transient"] ? Number(values["retry-transient"]) : 0;
  if (!Number.isInteger(transientRetries) || transientRetries < 0 || transientRetries > 1)
    throw new Error("--retry-transient must be 0 or 1");
  if (values["dry-run"]) console.log(JSON.stringify(plan, null, 2));
  else await runAcceptancePlan(plan, { transientRetries });
}

if (import.meta.main) await main();
