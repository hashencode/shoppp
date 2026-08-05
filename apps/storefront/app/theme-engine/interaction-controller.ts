import {
  browserInteractionClock,
  type InteractionClock,
  type InteractionClockHandle,
} from "./interaction-clock";

export type InteractionPauseReason =
  "document-hidden" | "focus" | "hover" | "manual" | "reduced-motion";

export interface InteractionSnapshot {
  currentIndex: number;
  direction: -1 | 0 | 1;
  pausedReasons: readonly InteractionPauseReason[];
  phase: "idle" | "transitioning";
  targetIndex: number;
  transitionStartedAt: number | null;
}

export interface InteractionControllerOptions {
  autoplayDelayMs: number;
  clock?: InteractionClock;
  count: number;
  initialIndex?: number;
  transitionDurationMs: number;
}

export interface SwipeRequest {
  axis: "horizontal" | "vertical";
  deltaX: number;
  deltaY: number;
  threshold: number;
}

export interface InteractionController {
  dispose(): void;
  handleKey(key: string): boolean;
  handleSwipe(request: SwipeRequest): boolean;
  next(): boolean;
  pause(reason: InteractionPauseReason): void;
  previous(): boolean;
  resume(reason: InteractionPauseReason): void;
  select(index: number): boolean;
  snapshot(): InteractionSnapshot;
  start(): void;
  subscribe(listener: (snapshot: InteractionSnapshot) => void): () => void;
}

function normalizedIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function createInteractionController(
  options: InteractionControllerOptions,
): InteractionController {
  const count = Math.max(0, Math.floor(options.count));
  const clock = options.clock ?? browserInteractionClock;
  const listeners = new Set<(snapshot: InteractionSnapshot) => void>();
  const pausedReasons = new Set<InteractionPauseReason>();
  let autoplayHandle: InteractionClockHandle | null = null;
  let transitionHandle: InteractionClockHandle | null = null;
  let disposed = false;
  let started = false;
  let state: InteractionSnapshot = {
    currentIndex: count ? normalizedIndex(options.initialIndex ?? 0, count) : 0,
    direction: 0,
    pausedReasons: [],
    phase: "idle",
    targetIndex: count ? normalizedIndex(options.initialIndex ?? 0, count) : 0,
    transitionStartedAt: null,
  };

  const emit = (): void => {
    state = {
      ...state,
      pausedReasons: [...pausedReasons].sort(),
    };
    for (const listener of listeners) listener({ ...state });
  };

  const clearAutoplay = (): void => {
    if (autoplayHandle === null) return;
    clock.clearTimeout(autoplayHandle);
    autoplayHandle = null;
  };

  const clearTransition = (): void => {
    if (transitionHandle === null) return;
    clock.clearTimeout(transitionHandle);
    transitionHandle = null;
  };

  const scheduleAutoplay = (): void => {
    clearAutoplay();
    if (
      disposed ||
      !started ||
      count < 2 ||
      options.autoplayDelayMs <= 0 ||
      pausedReasons.size > 0 ||
      state.phase !== "idle"
    )
      return;
    autoplayHandle = clock.setTimeout(() => {
      autoplayHandle = null;
      request(state.currentIndex + 1, 1);
    }, options.autoplayDelayMs);
  };

  const settle = (): void => {
    clearTransition();
    state = {
      ...state,
      currentIndex: state.targetIndex,
      direction: 0,
      phase: "idle",
      transitionStartedAt: null,
    };
    emit();
    scheduleAutoplay();
  };

  const request = (index: number, requestedDirection?: -1 | 1): boolean => {
    if (disposed || count < 2 || state.phase !== "idle") return false;
    const targetIndex = normalizedIndex(index, count);
    if (targetIndex === state.currentIndex) return false;

    const forwardDistance = normalizedIndex(targetIndex - state.currentIndex, count);
    const backwardDistance = normalizedIndex(state.currentIndex - targetIndex, count);
    const direction =
      requestedDirection ?? (forwardDistance <= backwardDistance ? (1 as const) : (-1 as const));
    clearAutoplay();
    state = {
      ...state,
      direction,
      phase: "transitioning",
      targetIndex,
      transitionStartedAt: clock.now(),
    };
    emit();

    const duration = pausedReasons.has("reduced-motion")
      ? 0
      : Math.max(0, options.transitionDurationMs);
    if (duration === 0) settle();
    else transitionHandle = clock.setTimeout(settle, duration);
    return true;
  };

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      clearAutoplay();
      clearTransition();
      listeners.clear();
    },
    handleKey(key) {
      if (key === "ArrowRight" || key === "ArrowDown") return request(state.currentIndex + 1, 1);
      if (key === "ArrowLeft" || key === "ArrowUp") return request(state.currentIndex - 1, -1);
      return false;
    },
    handleSwipe({ axis, deltaX, deltaY, threshold }) {
      const delta = axis === "horizontal" ? deltaX : deltaY;
      const crossAxisDelta = axis === "horizontal" ? deltaY : deltaX;
      if (Math.abs(delta) < threshold || Math.abs(delta) <= Math.abs(crossAxisDelta)) return false;
      return delta < 0 ? request(state.currentIndex + 1, 1) : request(state.currentIndex - 1, -1);
    },
    next() {
      return request(state.currentIndex + 1, 1);
    },
    pause(reason) {
      if (disposed || pausedReasons.has(reason)) return;
      pausedReasons.add(reason);
      clearAutoplay();
      emit();
    },
    previous() {
      return request(state.currentIndex - 1, -1);
    },
    resume(reason) {
      if (disposed || !pausedReasons.delete(reason)) return;
      emit();
      scheduleAutoplay();
    },
    select(index) {
      return request(index);
    },
    snapshot() {
      return { ...state, pausedReasons: [...state.pausedReasons] };
    },
    start() {
      if (disposed || started) return;
      started = true;
      scheduleAutoplay();
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      listener({ ...state, pausedReasons: [...state.pausedReasons] });
      return () => listeners.delete(listener);
    },
  };
}
