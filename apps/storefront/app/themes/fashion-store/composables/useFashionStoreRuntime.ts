import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import { createFashionStoreLifecycle } from "../runtime/lifecycle";

interface FashionStoreRuntimeOptions {
  autoplayMs: number;
  breakpointPx: number;
  count: number;
  speedMs: number;
}

export function useFashionStoreRuntime(options: FashionStoreRuntimeOptions) {
  const controller = createInteractionController({
    autoplayDelayMs: options.autoplayMs,
    count: options.count,
    transitionDurationMs: options.speedMs,
  });
  const motion = shallowRef<InteractionSnapshot>(controller.snapshot());
  const direction = ref<"horizontal" | "vertical">("horizontal");
  const hydrated = ref(false);
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
  });

  onBeforeUnmount(() => {
    unsubscribe();
    controller.dispose();
    lifecycle.destroy();
  });

  return {
    direction,
    hydrated,
    keydown,
    motion,
    select: (index: number) => controller.select(index),
  };
}
