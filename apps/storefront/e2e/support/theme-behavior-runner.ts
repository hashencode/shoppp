import type { Page } from "@playwright/test";
import type {
  ThemeBehaviorAction,
  ThemeBehaviorContract,
  ThemeBehaviorContractRow,
} from "./theme-behavior-contract";
import {
  probeCollectionCarouselOutcome,
  probeContinuousMovement,
  probePreviewCardOutcome,
  probeScrollProgressAndReturn,
  probeSearchOverlayOutcome,
} from "./theme-behavior-probes";

export type ThemeBehaviorSide = "implementation" | "source";
export type ThemeBehaviorAdapter = (options: {
  behavior: ThemeBehaviorContractRow;
  page: Page;
  side: ThemeBehaviorSide;
}) => Promise<unknown>;

export function assertCustomBehaviorAdaptersRegistered(
  contract: ThemeBehaviorContract,
  adapters: Readonly<Record<string, ThemeBehaviorAdapter>>,
): void {
  const missing = contract.customAdapters
    .map(({ id }) => id)
    .filter((id) => typeof adapters[id] !== "function");
  if (missing.length > 0)
    throw new Error(`Missing custom behavior adapter(s): ${missing.join(", ")}.`);
}

export function behaviorRow(contract: ThemeBehaviorContract, id: string): ThemeBehaviorContractRow {
  const behavior = contract.behaviors.find((candidate) => candidate.id === id);
  if (!behavior) throw new Error(`${contract.themeId}: missing behavior row ${id}.`);
  return behavior;
}

export function sideAction(
  behavior: ThemeBehaviorContractRow,
  side: ThemeBehaviorSide,
): ThemeBehaviorAction {
  const action = behavior.actions?.[side];
  if (!action?.kind || !action.selector) {
    throw new Error(`${behavior.id}/${side}: side action is missing.`);
  }
  return action;
}

export async function runSearchBehavior(options: {
  behavior: ThemeBehaviorContractRow;
  expectedFocusWhileOpen: "input" | "trigger";
  inputSelector: string;
  page: Page;
  panelSelector: string;
  side: ThemeBehaviorSide;
}) {
  const action = sideAction(options.behavior, options.side);
  if (action.kind !== "click") {
    throw new Error(`${options.behavior.id}/${options.side}: search requires a click action.`);
  }
  return probeSearchOverlayOutcome({
    expectedFocusWhileOpen: options.expectedFocusWhileOpen,
    inputSelector: options.inputSelector,
    page: options.page,
    panelSelector: options.panelSelector,
    triggerSelector: action.selector,
  });
}

export async function runCollectionBehavior(options: {
  behavior: ThemeBehaviorContractRow;
  maximumCardWidthRatio: number;
  minimumVisibleCards: number;
  mode: "interaction" | "temporal";
  page: Page;
  side: ThemeBehaviorSide;
}) {
  const action = sideAction(options.behavior, options.side);
  if (options.mode === "interaction" && action.kind !== "click" && action.kind !== "keyboard")
    throw new Error(
      `${options.behavior.id}/${options.side}: collection interaction requires click or keyboard.`,
    );
  return probeCollectionCarouselOutcome({
    ...(options.mode === "interaction" && action.kind === "click"
      ? { advanceSelector: action.selector }
      : {}),
    ...(options.mode === "interaction" && action.kind === "keyboard"
      ? { advanceKey: "ArrowRight" }
      : {}),
    carouselSelector: action.selector,
    maximumCardWidthRatio: options.maximumCardWidthRatio,
    minimumVisibleCards: options.minimumVisibleCards,
    page: options.page,
  });
}

export async function runPreviewBehavior(options: {
  behavior: ThemeBehaviorContractRow;
  contentPattern: RegExp;
  page: Page;
  panelSelector: string;
  side: ThemeBehaviorSide;
}) {
  const action = sideAction(options.behavior, options.side);
  if (action.kind !== "hover")
    throw new Error(`${options.behavior.id}/${options.side}: preview requires a hover action.`);
  return probePreviewCardOutcome({
    contentPattern: options.contentPattern,
    page: options.page,
    panelSelector: options.panelSelector,
    triggerSelector: action.selector,
  });
}

export async function runContinuousMovementBehavior(options: {
  behavior: ThemeBehaviorContractRow;
  page: Page;
  side: ThemeBehaviorSide;
  trackSelector: string;
}) {
  sideAction(options.behavior, options.side);
  return probeContinuousMovement({ page: options.page, trackSelector: options.trackSelector });
}

export async function runScrollBehavior(options: {
  backToTopBehavior: ThemeBehaviorContractRow;
  indicatorBehavior: ThemeBehaviorContractRow;
  page: Page;
  progressSelector: string;
  side: ThemeBehaviorSide;
}) {
  const indicator = sideAction(options.indicatorBehavior, options.side);
  const backToTop = sideAction(options.backToTopBehavior, options.side);
  return probeScrollProgressAndReturn({
    backToTopSelector: backToTop.selector,
    controlSelector: indicator.selector,
    page: options.page,
    progressSelector: options.progressSelector,
  });
}
