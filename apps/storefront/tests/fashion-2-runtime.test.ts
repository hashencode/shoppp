import { describe, expect, test } from "bun:test";

type LifecycleCallback = () => void;
type Listener = () => void;

class MediaQueryFixture {
  private readonly listeners = new Set<Listener>();

  constructor(public matches: boolean) {}

  addEventListener(_type: "change", listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "change", listener: Listener): void {
    this.listeners.delete(listener);
  }

  emit(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) listener();
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

describe("Fashion 2 runtime lifecycle", () => {
  test("hydrates before visual state changes and removes every lifecycle listener", async () => {
    let mounted: LifecycleCallback = () => undefined;
    let beforeUnmount: LifecycleCallback = () => undefined;
    const visibilityListeners = new Set<Listener>();
    const directionQuery = new MediaQueryFixture(false);
    const reducedMotionQuery = new MediaQueryFixture(true);

    Object.assign(globalThis, {
      document: {
        hidden: false,
        addEventListener: (_type: "visibilitychange", listener: Listener) =>
          visibilityListeners.add(listener),
        removeEventListener: (_type: "visibilitychange", listener: Listener) =>
          visibilityListeners.delete(listener),
      },
      matchMedia: (query: string) =>
        query === "(prefers-reduced-motion: reduce)" ? reducedMotionQuery : directionQuery,
      onBeforeUnmount: (callback: LifecycleCallback) => {
        beforeUnmount = callback;
      },
      onMounted: (callback: LifecycleCallback) => {
        mounted = callback;
      },
      readonly: <T>(value: T) => value,
      ref: <T>(value: T) => ({ value }),
      shallowRef: <T>(value: T) => ({ value }),
    });

    const { useFashion2Runtime } =
      await import("../app/themes/fashion-2/composables/useFashion2Runtime");
    const runtime = useFashion2Runtime({
      autoplayMs: 4_000,
      breakpointPx: 1_199,
      count: 3,
      speedMs: 1_000,
    });

    expect(runtime.hydrated.value).toBe(false);
    expect(runtime.liveInstances.value).toBe(0);
    mounted();
    expect(runtime.hydrated.value).toBe(true);
    expect(runtime.liveInstances.value).toBe(1);
    expect(runtime.motion.value.pausedReasons).toEqual(["reduced-motion"]);
    expect(runtime.direction.value).toBe("horizontal");

    directionQuery.emit(true);
    expect(runtime.direction.value).toBe("vertical");
    expect(directionQuery.listenerCount()).toBe(1);
    expect(reducedMotionQuery.listenerCount()).toBe(1);
    expect(visibilityListeners.size).toBe(1);

    beforeUnmount();
    expect(runtime.liveInstances.value).toBe(0);
    expect(directionQuery.listenerCount()).toBe(0);
    expect(reducedMotionQuery.listenerCount()).toBe(0);
    expect(visibilityListeners.size).toBe(0);
    expect(runtime.select(1)).toBe(false);
  });
});
