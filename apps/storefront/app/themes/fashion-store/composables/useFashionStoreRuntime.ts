import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import { initializeFashionStoreCapabilities } from "../runtime/capabilities";
import { createFashionStoreLifecycle } from "../runtime/lifecycle";
import { loadFashionStoreVendorRuntime } from "../runtime/loader.client";

interface FashionStoreRuntimeOptions {
  autoplayMs: number;
  breakpointPx: number;
  count: number;
  speedMs: number;
}

const liveInstances = ref(0);

export function useFashionStoreRuntime(options: FashionStoreRuntimeOptions) {
  const controller = createInteractionController({
    autoplayDelayMs: options.autoplayMs,
    count: options.count,
    transitionDurationMs: options.speedMs,
  });
  const motion = shallowRef<InteractionSnapshot>(controller.snapshot());
  const direction = ref<"horizontal" | "vertical">("horizontal");
  const hydrated = ref(false);
  const status = ref<"fallback" | "loading" | "ready" | "static">("loading");
  const failure = ref("");
  const lifecycle = createFashionStoreLifecycle();
  let directionQuery: MediaQueryList | undefined;
  let reducedMotionQuery: MediaQueryList | undefined;
  let unsubscribe: () => void = () => undefined;

  function updateDirection(): void {
    direction.value = directionQuery?.matches ? "vertical" : "horizontal";
  }

  function updateReducedMotion(): void {
    if (reducedMotionQuery?.matches) controller.pause("reduced-motion");
    else controller.resume("reduced-motion");
  }

  function updateVisibility(): void {
    if (document.hidden) controller.pause("document-hidden");
    else controller.resume("document-hidden");
  }

  function keydown(event: KeyboardEvent): void {
    if (controller.handleKey(event.key)) event.preventDefault();
  }

  onMounted(async () => {
    liveInstances.value += 1;
    unsubscribe = controller.subscribe((snapshot) => {
      motion.value = snapshot;
    });
    directionQuery = matchMedia(`(min-width: ${options.breakpointPx}px)`);
    reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    updateDirection();
    updateReducedMotion();
    updateVisibility();
    lifecycle.listen(directionQuery, "change", updateDirection);
    lifecycle.listen(reducedMotionQuery, "change", updateReducedMotion);
    lifecycle.listen(document, "visibilitychange", updateVisibility);
    hydrated.value = true;
    controller.start();
    await nextTick();
    await document.fonts.ready;
    if (lifecycle.destroyed) return;
    try {
      const reducedMotion = reducedMotionQuery.matches;
      const vendorRuntime = reducedMotion ? {} : await loadFashionStoreVendorRuntime(lifecycle);
      if (lifecycle.destroyed) return;
      initializeFashionStoreCapabilities(document, vendorRuntime, lifecycle, reducedMotion);
      status.value = reducedMotion ? "static" : "ready";
    } catch (error) {
      if (lifecycle.destroyed) return;
      initializeFashionStoreCapabilities(document, {}, lifecycle, true);
      document.body.dataset.fashionStoreVisualRuntime = "fallback";
      failure.value = error instanceof Error ? error.message : String(error);
      status.value = "fallback";
    }
  });

  onBeforeUnmount(() => {
    unsubscribe();
    controller.dispose();
    try {
      lifecycle.destroy();
    } finally {
      liveInstances.value -= 1;
    }
  });

  return {
    direction,
    failure,
    hydrated,
    liveInstances: readonly(liveInstances),
    keydown,
    motion,
    status,
    select: (index: number) => controller.select(index),
  };
}
