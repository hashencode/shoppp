import { initializeFashionStoreCapabilities } from "../runtime/capabilities";
import { createFashionStoreLifecycle } from "../runtime/lifecycle";
import { loadFashionStoreVendorRuntime } from "../runtime/loader.client";

const liveInstances = ref(0);

export function useFashionStoreVisualRuntime() {
  const status = ref<"fallback" | "loading" | "ready" | "static">("loading");
  const failure = ref("");
  const lifecycle = createFashionStoreLifecycle();

  onMounted(async () => {
    liveInstances.value += 1;
    await nextTick();
    await document.fonts.ready;
    if (lifecycle.destroyed) return;
    try {
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    try {
      lifecycle.destroy();
    } finally {
      liveInstances.value -= 1;
    }
  });

  return {
    failure,
    liveInstances: readonly(liveInstances),
    status,
  };
}
