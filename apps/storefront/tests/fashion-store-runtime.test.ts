import { describe, expect, test } from "bun:test";

import { createFashionStoreLifecycle } from "../app/themes/fashion-store/runtime/lifecycle";

type LifecycleCallback = () => void | Promise<void>;
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

describe("Fashion Store runtime lifecycle", () => {
  test("destroys owned resources exactly once", () => {
    const lifecycle = createFashionStoreLifecycle();
    const target = new EventTarget();
    let events = 0;
    let cleanups = 0;
    const listener = () => {
      events += 1;
    };

    lifecycle.listen(target, "fashion-store-test", listener);
    lifecycle.addCleanup(() => {
      cleanups += 1;
    });
    target.dispatchEvent(new Event("fashion-store-test"));

    lifecycle.destroy();
    lifecycle.destroy();
    target.dispatchEvent(new Event("fashion-store-test"));

    expect(events).toBe(1);
    expect(cleanups).toBe(1);
    expect(lifecycle.destroyed).toBe(true);
  });

  test("runs every cleanup even when one cleanup throws", () => {
    const lifecycle = createFashionStoreLifecycle();
    const completed: string[] = [];
    const failure = new Error("vendor cleanup failed");
    lifecycle.addCleanup(() => completed.push("last"));
    lifecycle.addCleanup(() => {
      throw failure;
    });
    lifecycle.addCleanup(() => completed.push("first"));

    expect(() => lifecycle.destroy()).toThrow(failure);
    expect(completed).toEqual(["first", "last"]);
    expect(lifecycle.destroyed).toBe(true);
  });

  test("hydrates before visual state changes and removes every lifecycle listener", async () => {
    let mounted: LifecycleCallback = () => undefined;
    let beforeUnmount: LifecycleCallback = () => undefined;
    const visibilityListeners = new Set<Listener>();
    const directionQuery = new MediaQueryFixture(false);
    const reducedMotionQuery = new MediaQueryFixture(true);
    const bodyAttributes = new Map<string, string>();

    Object.assign(globalThis, {
      document: {
        body: {
          removeAttribute: (name: string) => bodyAttributes.delete(name),
          setAttribute: (name: string, value: string) => bodyAttributes.set(name, value),
        },
        documentElement: {
          style: { removeProperty: () => undefined, setProperty: () => undefined },
        },
        fonts: { ready: Promise.resolve() },
        hidden: false,
        addEventListener: (_type: "visibilitychange", listener: Listener) =>
          visibilityListeners.add(listener),
        removeEventListener: (_type: "visibilitychange", listener: Listener) =>
          visibilityListeners.delete(listener),
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      matchMedia: (query: string) =>
        query === "(prefers-reduced-motion: reduce)" ? reducedMotionQuery : directionQuery,
      onBeforeUnmount: (callback: LifecycleCallback) => {
        beforeUnmount = callback;
      },
      onMounted: (callback: LifecycleCallback) => {
        mounted = callback;
      },
      nextTick: () => Promise.resolve(),
      readonly: <T>(value: T) => value,
      ref: <T>(value: T) => ({ value }),
      shallowRef: <T>(value: T) => ({ value }),
    });

    const { useFashionStoreRuntime } =
      await import("../app/themes/fashion-store/composables/useFashionStoreRuntime");
    const runtime = useFashionStoreRuntime({
      autoplayMs: 4_000,
      breakpointPx: 1_199,
      count: 3,
      speedMs: 1_000,
    });

    expect(runtime.hydrated.value).toBe(false);
    expect(runtime.liveInstances.value).toBe(0);
    await mounted();
    expect(runtime.hydrated.value).toBe(true);
    expect(runtime.liveInstances.value).toBe(1);
    expect(runtime.motion.value.pausedReasons).toEqual(["reduced-motion"]);
    expect(runtime.status.value).toBe("static");
    expect(runtime.direction.value).toBe("horizontal");
    expect(bodyAttributes.get("data-fashion-store-visual-runtime")).toBe("static");

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
    expect(bodyAttributes.has("data-fashion-store-visual-runtime")).toBe(false);
    expect(runtime.select(1)).toBe(false);
  });
});
