import { initializeFashionStoreCapabilities } from "../runtime/capabilities";
import { createFashionStoreLifecycle } from "../runtime/lifecycle";

const liveInstances = ref(0);

export function useFashionStoreVisualRuntime() {
  const status = ref<"fallback" | "loading" | "ready" | "static">("loading");
  const lifecycle = createFashionStoreLifecycle();

  onMounted(async () => {
    liveInstances.value += 1;
    await nextTick();
    await document.fonts.ready;
    if (lifecycle.destroyed) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    initializeFashionStoreCapabilities(document, lifecycle, reducedMotion);
    status.value = reducedMotion ? "static" : "ready";
  });

  onBeforeUnmount(() => {
    try {
      lifecycle.destroy();
    } finally {
      liveInstances.value -= 1;
    }
  });

  return {
    liveInstances: readonly(liveInstances),
    status,
  };
}
