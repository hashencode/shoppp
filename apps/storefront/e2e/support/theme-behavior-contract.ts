export type ThemeAcceptanceMode =
  "fallback" | "interaction" | "scroll-fixed" | "static" | "temporal";

export type ThemeBehaviorTrigger =
  "click" | "focus" | "hover" | "keyboard" | "load" | "resize" | "scroll" | "timer" | "touch";

export type ThemeBehaviorRole =
  | "carousel"
  | "commerce-action"
  | "continuous-motion"
  | "fixed-control"
  | "navigation"
  | "overlay-trigger"
  | "state-control";

export type NamedStateAction =
  | { kind: "cart" }
  | { kind: "category-hover" }
  | { kind: "client-pause" }
  | { index: number; kind: "collection" }
  | { kind: "collection-hover" }
  | { index: number; kind: "hero" }
  | { kind: "initial" }
  | { kind: "language" }
  | { kind: "navigation"; menu?: "Collection" | "Pages" | "Shop" }
  | { kind: "overlay" }
  | { kind: "pause" }
  | { kind: "promo-pause" }
  | { kind: "product-focus" }
  | { kind: "product-hover" }
  | { kind: "search" }
  | { group: "category" | "color" | "size" | "tag"; kind: "shop-filter"; label: string }
  | { index: number; kind: "shop-arrivals" }
  | { kind: "tab-secondary" };

export interface NamedStateContract {
  action: NamedStateAction;
  capture: "element" | "viewport-top";
  id: string;
  implementationSelector: string;
  sourceSelector: string;
}

export interface ThemeBehaviorAction {
  kind: "click" | "focus" | "hover" | "keyboard" | "observe" | "scroll" | "wait";
  selector: string;
}

export interface ThemeBehaviorBranch {
  breakpoint?: string;
  id: string;
  input?: "keyboard" | "mouse" | "touch";
  outcome: string;
}

export interface ThemeBehaviorEvidenceState {
  fidelityState?: string;
  namedState?: NamedStateContract;
}

export interface ThemeBehaviorContractRow {
  actions: {
    implementation: ThemeBehaviorAction;
    source: ThemeBehaviorAction;
  };
  branches: readonly ThemeBehaviorBranch[];
  disposition: {
    kind: "approved-adaptation" | "explicitly-deferred" | "reproduced";
    reason?: string;
  };
  evidenceStates: readonly ThemeBehaviorEvidenceState[];
  fallback: {
    outcome: string;
    strategy: string;
  };
  id: string;
  initialState: string;
  modes: readonly ThemeAcceptanceMode[];
  outcome: string;
  owner: "approved-adaptation" | "framework-adapter" | "source-runtime" | string;
  region: string;
  role: ThemeBehaviorRole;
  sourceCandidate: string;
  sourceSelector: string;
  triggers: readonly ThemeBehaviorTrigger[];
}

export interface ThemeBehaviorContract {
  behaviors: readonly ThemeBehaviorContractRow[];
  customAdapters: readonly { id: string; reason: string }[];
  routeId: string;
  suppressions: readonly { candidate: string; reason: string }[];
  themeId: string;
}

export interface ThemeBehaviorModeEvidence {
  actionOutcome?: boolean;
  behaviorId: string;
  branches?: readonly {
    id: string;
    outcome: boolean;
    viewportId: ThemeEvidenceViewportId;
  }[];
  mode: ThemeAcceptanceMode;
  scrollSamples?: readonly number[];
  temporalSamples?: {
    after: number;
    before: number;
    elapsedMs: number;
    loopObserved?: boolean;
  };
}

export type ThemeEvidenceViewportId = "desktop" | "laptop" | "mobile" | "tablet";

const text = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const ACCEPTANCE_MODES = new Set<ThemeAcceptanceMode>([
  "fallback",
  "interaction",
  "scroll-fixed",
  "static",
  "temporal",
]);
const EVIDENCE_VIEWPORTS = new Set<ThemeEvidenceViewportId>([
  "desktop",
  "laptop",
  "mobile",
  "tablet",
]);
const BEHAVIOR_ROLES = new Set<ThemeBehaviorRole>([
  "carousel",
  "commerce-action",
  "continuous-motion",
  "fixed-control",
  "navigation",
  "overlay-trigger",
  "state-control",
]);
const BEHAVIOR_TRIGGERS = new Set<ThemeBehaviorTrigger>([
  "click",
  "focus",
  "hover",
  "keyboard",
  "load",
  "resize",
  "scroll",
  "timer",
  "touch",
]);

export function namedStatesFromBehaviorContract(
  contract: ThemeBehaviorContract,
): readonly NamedStateContract[] {
  return contract.behaviors.flatMap(({ evidenceStates }) =>
    evidenceStates.flatMap(({ namedState }) => (namedState ? [namedState] : [])),
  );
}

export function fidelityStatesByRegionFromBehaviorContract(
  contract: ThemeBehaviorContract,
): Readonly<Record<string, readonly string[]>> {
  const states = new Map<string, string[]>();
  for (const behavior of contract.behaviors) {
    const regionStates = states.get(behavior.region) ?? [];
    for (const { fidelityState } of behavior.evidenceStates) {
      if (fidelityState && !regionStates.includes(fidelityState)) regionStates.push(fidelityState);
    }
    if (regionStates.length > 0) states.set(behavior.region, regionStates);
  }
  return Object.fromEntries(states);
}

export function assertThemeBehaviorContractComplete(
  contract: ThemeBehaviorContract,
  structuralRegionIds: readonly string[],
): void {
  const issues: string[] = [];
  const behaviorIds = new Set<string>();
  const namedStateIds = new Set<string>();
  const fidelityStateIds = new Set<string>();
  const structuralRegions = new Set(structuralRegionIds);

  if (!text(contract.themeId)) issues.push("themeId is required");
  if (!text(contract.routeId)) issues.push("routeId is required");
  if (contract.behaviors.length === 0) issues.push("at least one behavior is required");

  for (const behavior of contract.behaviors) {
    const label = text(behavior.id) ? behavior.id : "(missing behavior ID)";
    if (!text(behavior.id)) issues.push(`${label}: behavior ID is required`);
    else if (behaviorIds.has(behavior.id)) issues.push(`${label}: duplicate behavior ID`);
    behaviorIds.add(behavior.id);
    if (!structuralRegions.has(behavior.region))
      issues.push(`${label}: unknown region ${behavior.region}`);
    if (!text(behavior.sourceCandidate)) issues.push(`${label}: sourceCandidate is required`);
    if (!text(behavior.sourceSelector)) issues.push(`${label}: sourceSelector is required`);
    if (!text(behavior.role)) issues.push(`${label}: role is required`);
    else if (!BEHAVIOR_ROLES.has(behavior.role))
      issues.push(`${label}: unknown role ${behavior.role}`);
    if (!Array.isArray(behavior.triggers) || behavior.triggers.length === 0)
      issues.push(`${label}: at least one trigger is required`);
    else
      for (const trigger of behavior.triggers)
        if (!BEHAVIOR_TRIGGERS.has(trigger)) issues.push(`${label}: unknown trigger ${trigger}`);
    if (!text(behavior.initialState)) issues.push(`${label}: initialState is required`);
    if (!text(behavior.actions?.source?.kind) || !text(behavior.actions?.source?.selector))
      issues.push(`${label}: source action is required`);
    if (
      !text(behavior.actions?.implementation?.kind) ||
      !text(behavior.actions?.implementation?.selector)
    )
      issues.push(`${label}: implementation action is required`);
    if (!text(behavior.outcome)) issues.push(`${label}: outcome is required`);
    for (const [index, branch] of behavior.branches.entries()) {
      if (!text(branch.id) || !text(branch.outcome))
        issues.push(`${label}: branch ${index + 1} requires an ID and outcome`);
    }
    if (!text(behavior.owner)) issues.push(`${label}: owner is required`);
    if (!text(behavior.fallback?.strategy)) issues.push(`${label}: fallback strategy is required`);
    if (!text(behavior.fallback?.outcome)) issues.push(`${label}: fallback outcome is required`);
    if (!Array.isArray(behavior.modes) || behavior.modes.length === 0)
      issues.push(`${label}: at least one acceptance mode is required`);
    else
      for (const mode of behavior.modes)
        if (!ACCEPTANCE_MODES.has(mode)) issues.push(`${label}: unknown acceptance mode ${mode}`);
    if (!text(behavior.disposition?.kind)) issues.push(`${label}: disposition is required`);
    else if (behavior.disposition.kind !== "reproduced" && !text(behavior.disposition.reason))
      issues.push(`${label}: disposition reason is required`);
    if (!Array.isArray(behavior.evidenceStates) || behavior.evidenceStates.length === 0)
      issues.push(`${label}: at least one evidence state is required`);

    for (const [index, evidence] of behavior.evidenceStates.entries()) {
      if (!evidence.namedState && !text(evidence.fidelityState))
        issues.push(`${label}: evidence state ${index + 1} is orphaned`);
      if (evidence.namedState) {
        const stateId = evidence.namedState.id;
        if (!text(stateId)) issues.push(`${label}: named-state ID is required`);
        else if (namedStateIds.has(stateId))
          issues.push(`${label}: duplicate named-state ID ${stateId}`);
        namedStateIds.add(stateId);
      }
      if (text(evidence.fidelityState)) {
        const identity = `${behavior.region}:${evidence.fidelityState}`;
        if (fidelityStateIds.has(identity))
          issues.push(`${label}: duplicate fidelity state ${identity}`);
        fidelityStateIds.add(identity);
      }
    }
  }

  for (const adapter of contract.customAdapters) {
    if (!text(adapter.id)) issues.push("custom adapter ID is required");
    if (!text(adapter.reason))
      issues.push(`${adapter.id || "(missing adapter ID)"}: custom adapter reason is required`);
  }
  for (const suppression of contract.suppressions) {
    if (!text(suppression.candidate)) issues.push("suppression candidate is required");
    if (!text(suppression.reason))
      issues.push(
        `${suppression.candidate || "(missing candidate)"}: suppression reason is required`,
      );
  }

  if (issues.length > 0) throw new Error(`Incomplete behavior contract:\n${issues.join("\n")}`);
}

function themeBehaviorModeEvidenceIssues(
  contract: ThemeBehaviorContract,
  evidence: readonly ThemeBehaviorModeEvidence[],
): string[] {
  const issues: string[] = [];
  for (const record of evidence) {
    const behavior = contract.behaviors.find(({ id }) => id === record.behaviorId);
    if (!behavior) {
      issues.push(`${record.behaviorId}: evidence references an unknown behavior`);
      continue;
    }
    if (!behavior.modes.includes(record.mode))
      issues.push(`${record.behaviorId}: ${record.mode} is not a declared acceptance mode`);
    for (const branch of record.branches ?? []) {
      if (!behavior.branches.some(({ id }) => id === branch.id))
        issues.push(`${record.behaviorId}: evidence references unknown branch ${branch.id}`);
      if (branch.outcome !== true)
        issues.push(`${record.behaviorId}/${branch.id}: branch outcome was not observed`);
      if (!EVIDENCE_VIEWPORTS.has(branch.viewportId))
        issues.push(`${record.behaviorId}/${branch.id}: invalid evidence viewport`);
    }
    if (record.mode === "temporal") {
      const samples = record.temporalSamples;
      if (
        !samples ||
        !Number.isFinite(samples.elapsedMs) ||
        samples.elapsedMs <= 0 ||
        !Number.isFinite(samples.before) ||
        !Number.isFinite(samples.after) ||
        samples.before === samples.after
      )
        issues.push(`${record.behaviorId}: temporal evidence requires distinct timed samples`);
    }
    if (record.mode === "scroll-fixed") {
      const samples = record.scrollSamples;
      if (
        !samples ||
        samples.length < 2 ||
        samples.some((value) => !Number.isFinite(value)) ||
        samples.at(-1)! <= samples[0]! ||
        samples.some((value, index) => index > 0 && value < samples[index - 1]!)
      )
        issues.push(
          `${record.behaviorId}: scroll/fixed evidence requires monotonic progress samples`,
        );
    }
    if (
      (record.mode === "interaction" || record.mode === "static" || record.mode === "fallback") &&
      record.actionOutcome !== true
    )
      issues.push(
        `${record.behaviorId}: ${record.mode} evidence requires a successful observable outcome`,
      );
  }
  return issues;
}

export function assertThemeBehaviorModeEvidenceRecord(
  contract: ThemeBehaviorContract,
  evidence: ThemeBehaviorModeEvidence,
): void {
  const issues = themeBehaviorModeEvidenceIssues(contract, [evidence]);
  if (issues.length > 0) throw new Error(`Behavior mode evidence failed:\n${issues.join("\n")}`);
}

export function assertThemeBehaviorModeEvidenceComplete(
  contract: ThemeBehaviorContract,
  evidence: readonly ThemeBehaviorModeEvidence[],
): void {
  const issues = themeBehaviorModeEvidenceIssues(contract, evidence);
  for (const behavior of contract.behaviors) {
    for (const mode of behavior.modes) {
      if (!evidence.some((record) => record.behaviorId === behavior.id && record.mode === mode))
        issues.push(`${behavior.id}: missing ${mode} evidence`);
    }
    for (const branch of behavior.branches) {
      if (
        !evidence.some(
          (record) =>
            record.behaviorId === behavior.id &&
            record.branches?.some((candidate) => candidate.id === branch.id && candidate.outcome),
        )
      )
        issues.push(`${behavior.id}: missing ${branch.id} branch evidence`);
    }
  }
  if (issues.length > 0) throw new Error(`Behavior mode evidence failed:\n${issues.join("\n")}`);
}

export function decodeThemeBehaviorModeEvidence(value: unknown): ThemeBehaviorModeEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Behavior evidence must be an object.");
  const candidate = value as Record<string, unknown>;
  if (!text(candidate.behaviorId)) throw new Error("Behavior evidence requires behaviorId.");
  if (!text(candidate.mode) || !ACCEPTANCE_MODES.has(candidate.mode as ThemeAcceptanceMode))
    throw new Error(`${candidate.behaviorId}: behavior evidence has an invalid mode.`);
  if (candidate.actionOutcome !== undefined && typeof candidate.actionOutcome !== "boolean")
    throw new Error(`${candidate.behaviorId}: actionOutcome must be boolean.`);

  let branches: ThemeBehaviorModeEvidence["branches"];
  if (candidate.branches !== undefined) {
    if (!Array.isArray(candidate.branches))
      throw new Error(`${candidate.behaviorId}: branches must be an array.`);
    branches = candidate.branches.map((branch, index) => {
      if (!branch || typeof branch !== "object" || Array.isArray(branch))
        throw new Error(`${candidate.behaviorId}: branch ${index + 1} must be an object.`);
      const record = branch as Record<string, unknown>;
      if (!text(record.id) || typeof record.outcome !== "boolean")
        throw new Error(`${candidate.behaviorId}: branch ${index + 1} is malformed.`);
      if (
        !text(record.viewportId) ||
        !EVIDENCE_VIEWPORTS.has(record.viewportId as ThemeEvidenceViewportId)
      )
        throw new Error(`${candidate.behaviorId}/${record.id}: invalid evidence viewport.`);
      return {
        id: record.id,
        outcome: record.outcome,
        viewportId: record.viewportId as ThemeEvidenceViewportId,
      };
    });
  }

  let scrollSamples: readonly number[] | undefined;
  if (candidate.scrollSamples !== undefined) {
    if (
      !Array.isArray(candidate.scrollSamples) ||
      candidate.scrollSamples.some(
        (sample) => typeof sample !== "number" || !Number.isFinite(sample),
      )
    )
      throw new Error(`${candidate.behaviorId}: scrollSamples must contain finite numbers.`);
    scrollSamples = candidate.scrollSamples as number[];
  }

  let temporalSamples: ThemeBehaviorModeEvidence["temporalSamples"];
  if (candidate.temporalSamples !== undefined) {
    if (
      !candidate.temporalSamples ||
      typeof candidate.temporalSamples !== "object" ||
      Array.isArray(candidate.temporalSamples)
    )
      throw new Error(`${candidate.behaviorId}: temporalSamples must be an object.`);
    const samples = candidate.temporalSamples as Record<string, unknown>;
    if (
      typeof samples.after !== "number" ||
      !Number.isFinite(samples.after) ||
      typeof samples.before !== "number" ||
      !Number.isFinite(samples.before) ||
      typeof samples.elapsedMs !== "number" ||
      !Number.isFinite(samples.elapsedMs) ||
      (samples.loopObserved !== undefined && typeof samples.loopObserved !== "boolean")
    )
      throw new Error(`${candidate.behaviorId}: temporalSamples must contain finite numbers.`);
    temporalSamples = {
      after: samples.after,
      before: samples.before,
      elapsedMs: samples.elapsedMs,
      ...(typeof samples.loopObserved === "boolean" ? { loopObserved: samples.loopObserved } : {}),
    };
  }

  return {
    ...(typeof candidate.actionOutcome === "boolean"
      ? { actionOutcome: candidate.actionOutcome }
      : {}),
    behaviorId: candidate.behaviorId,
    ...(branches ? { branches } : {}),
    mode: candidate.mode as ThemeAcceptanceMode,
    ...(scrollSamples ? { scrollSamples } : {}),
    ...(temporalSamples ? { temporalSamples } : {}),
  };
}
