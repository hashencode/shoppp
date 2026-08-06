import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";

interface Fashion2RuntimeOptions {
  autoplayMs: number;
  breakpointPx: number;
  count: number;
  speedMs: number;
}

const liveInstances = ref(0);

export function useFashion2Runtime(options: Fashion2RuntimeOptions) {
  const controller = createInteractionController({
    autoplayDelayMs: options.autoplayMs,
    count: options.count,
    transitionDurationMs: options.speedMs,
  });
  const motion = shallowRef<InteractionSnapshot>(controller.snapshot());
  const direction = ref<"horizontal" | "vertical">("horizontal");
  const hydrated = ref(false);
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

  onMounted(() => {
    liveInstances.value += 1;
    unsubscribe = controller.subscribe((snapshot) => {
      motion.value = snapshot;
    });
    directionQuery = matchMedia(`(min-width: ${options.breakpointPx}px)`);
    reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    updateDirection();
    updateReducedMotion();
    updateVisibility();
    directionQuery.addEventListener("change", updateDirection);
    reducedMotionQuery.addEventListener("change", updateReducedMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    hydrated.value = true;
    controller.start();
  });

  onBeforeUnmount(() => {
    unsubscribe();
    controller.dispose();
    directionQuery?.removeEventListener("change", updateDirection);
    reducedMotionQuery?.removeEventListener("change", updateReducedMotion);
    document.removeEventListener("visibilitychange", updateVisibility);
    liveInstances.value -= 1;
  });

  return {
    direction,
    hydrated,
    liveInstances: readonly(liveInstances),
    keydown,
    motion,
    select: (index: number) => controller.select(index),
  };
}
