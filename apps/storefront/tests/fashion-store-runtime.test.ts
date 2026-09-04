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
    const mountedCallbacks: LifecycleCallback[] = [];
    const beforeUnmountCallbacks: LifecycleCallback[] = [];
    const visibilityListeners = new Set<Listener>();
    const reducedMotionQuery = new MediaQueryFixture(true);
    const bodyAttributes = new Map<string, string>();
    const fixtureGlobalKeys = [
      "document",
      "matchMedia",
      "nextTick",
      "onBeforeUnmount",
      "onMounted",
      "readonly",
      "ref",
      "shallowRef",
    ] as const;
    const originalGlobalDescriptors = new Map(
      fixtureGlobalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
    );

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
      matchMedia: () => reducedMotionQuery,
      onBeforeUnmount: (callback: LifecycleCallback) => {
        beforeUnmountCallbacks.push(callback);
      },
      onMounted: (callback: LifecycleCallback) => {
        mountedCallbacks.push(callback);
      },
      nextTick: () => Promise.resolve(),
      readonly: <T>(value: T) => value,
      ref: <T>(value: T) => ({ value }),
      shallowRef: <T>(value: T) => ({ value }),
    });

    try {
      const { useFashionStoreVisualRuntime } =
        await import("../app/themes/fashion-store/composables/useFashionStoreVisualRuntime");
      const visualRuntime = useFashionStoreVisualRuntime();

      expect(visualRuntime.liveInstances.value).toBe(0);
      await Promise.all(mountedCallbacks.map((callback) => callback()));
      expect(visualRuntime.liveInstances.value).toBe(1);
      expect(visualRuntime.status.value).toBe("static");
      expect(bodyAttributes.get("data-fashion-store-visual-runtime")).toBe("static");

      expect(reducedMotionQuery.listenerCount()).toBe(0);
      expect(visibilityListeners.size).toBe(0);

      for (const callback of beforeUnmountCallbacks) await callback();
      expect(visualRuntime.liveInstances.value).toBe(0);
      expect(reducedMotionQuery.listenerCount()).toBe(0);
      expect(visibilityListeners.size).toBe(0);
      expect(bodyAttributes.has("data-fashion-store-visual-runtime")).toBe(false);
    } finally {
      for (const key of fixtureGlobalKeys) {
        const descriptor = originalGlobalDescriptors.get(key);
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
});
