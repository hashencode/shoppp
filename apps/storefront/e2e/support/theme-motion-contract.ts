import type { Page } from "@playwright/test";

export interface MotionLayerSnapshot {
  id: string;
  opacity: number;
  transform: string;
  zIndex: number;
}

export interface MotionContractSnapshot {
  activeIndex: number;
  checkpoint: string;
  direction: "horizontal" | "vertical";
  easing: string;
  layers: MotionLayerSnapshot[];
  pausedReasons: string[];
  timing: {
    autoplayDelayMs: number;
    delayMs: number;
    durationMs: number;
  };
}

export interface MotionContractTolerance {
  numeric: number;
}

export interface PageActivityTraceEvent {
  dur?: number;
  name?: string;
  ph?: string;
  pid?: number;
  ts?: number;
  tid?: number;
}

export function pageActivityRunTaskDuration(
  events: PageActivityTraceEvent[],
  thread: Pick<PageActivityTraceEvent, "pid" | "tid">,
  activityNames: ReadonlySet<string>,
): number {
  // Sorting once lets the descending task sweep reuse every eligible activity interval instead
  // of rescanning the full trace for each RunTask.
  const threadEvents = events.filter(
    (event) => event.ph === "X" && event.pid === thread.pid && event.tid === thread.tid,
  );
  const activityIntervals = threadEvents
    .filter(
      (event): event is PageActivityTraceEvent & { ts: number } =>
        event.ts !== undefined && activityNames.has(event.name ?? ""),
    )
    .map((event) => ({ end: event.ts + (event.dur ?? 0), start: event.ts }))
    .sort((left, right) => right.start - left.start);
  const tasks = threadEvents
    .filter(
      (event): event is PageActivityTraceEvent & { ts: number } =>
        event.name === "RunTask" && event.ts !== undefined,
    )
    .map((event) => ({
      duration: event.dur ?? 0,
      end: event.ts + (event.dur ?? 0),
      start: event.ts,
    }))
    .sort((left, right) => right.start - left.start);

  let activityIndex = 0;
  let earliestEligibleEnd = Number.POSITIVE_INFINITY;
  let totalDuration = 0;
  for (const task of tasks) {
    while (
      activityIndex < activityIntervals.length &&
      activityIntervals[activityIndex]!.start >= task.start
    ) {
      earliestEligibleEnd = Math.min(earliestEligibleEnd, activityIntervals[activityIndex]!.end);
      activityIndex += 1;
    }
    if (earliestEligibleEnd <= task.end) totalDuration += task.duration;
  }
  return totalDuration / 1_000;
}

export function compareMotionContractSnapshots(
  reference: MotionContractSnapshot,
  implementation: MotionContractSnapshot,
  tolerance: Partial<MotionContractTolerance> = {},
): string[] {
  const allowed = { numeric: 0.0005, ...tolerance };
  const issues: string[] = [];
  const compareDiscrete = (
    property: string,
    expected: string | number,
    actual: string | number,
  ) => {
    if (expected !== actual)
      issues.push(
        `${property}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
      );
  };
  const compareNumber = (property: string, expected: number, actual: number) => {
    if (Math.abs(expected - actual) > allowed.numeric)
      issues.push(`${property}: expected ${expected}, received ${actual}`);
  };

  compareDiscrete("activeIndex", reference.activeIndex, implementation.activeIndex);
  compareDiscrete("checkpoint", reference.checkpoint, implementation.checkpoint);
  compareDiscrete("direction", reference.direction, implementation.direction);
  compareDiscrete("easing", reference.easing, implementation.easing);
  const expectedPause = reference.pausedReasons.join(", ");
  const actualPause = implementation.pausedReasons.join(", ");
  if (expectedPause !== actualPause)
    issues.push(`pausedReasons: expected [${expectedPause}], received [${actualPause}]`);
  compareNumber(
    "timing.autoplayDelayMs",
    reference.timing.autoplayDelayMs,
    implementation.timing.autoplayDelayMs,
  );
  compareNumber("timing.delayMs", reference.timing.delayMs, implementation.timing.delayMs);
  compareNumber("timing.durationMs", reference.timing.durationMs, implementation.timing.durationMs);

  const actualLayers = new Map(implementation.layers.map((layer) => [layer.id, layer]));
  for (const expected of reference.layers) {
    const actual = actualLayers.get(expected.id);
    if (!actual) {
      issues.push(`${expected.id}: missing layer`);
      continue;
    }
    compareDiscrete(`${expected.id}.transform`, expected.transform, actual.transform);
    compareNumber(`${expected.id}.opacity`, expected.opacity, actual.opacity);
    compareDiscrete(`${expected.id}.zIndex`, expected.zIndex, actual.zIndex);
  }
  for (const actual of implementation.layers) {
    if (!reference.layers.some(({ id }) => id === actual.id))
      issues.push(`${actual.id}: unexpected layer`);
  }
  return issues;
}

export async function captureMotionContract(
  page: Page,
  selector: string,
  checkpoint: string,
): Promise<MotionContractSnapshot> {
  return page.locator(selector).evaluate((root, requestedCheckpoint) => {
    const dataset = (root as HTMLElement).dataset;
    const layers = [...root.querySelectorAll<HTMLElement>("[data-motion-layer]")].map((layer) => {
      const style = getComputedStyle(layer);
      return {
        id: layer.dataset.motionLayer ?? "",
        opacity: Number(style.opacity),
        transform: style.transform,
        zIndex: Number(style.zIndex || "0"),
      };
    });
    return {
      activeIndex: Number(dataset.motionActiveIndex ?? "0"),
      checkpoint: requestedCheckpoint,
      direction: (dataset.motionDirection ?? "horizontal") as "horizontal" | "vertical",
      easing: dataset.motionEasing ?? "ease",
      layers,
      pausedReasons: (dataset.motionPaused ?? "").split(",").filter(Boolean),
      timing: {
        autoplayDelayMs: Number(dataset.motionAutoplayMs ?? "0"),
        delayMs: Number(dataset.motionDelayMs ?? "0"),
        durationMs: Number(dataset.motionDurationMs ?? "0"),
      },
    };
  }, checkpoint);
}
