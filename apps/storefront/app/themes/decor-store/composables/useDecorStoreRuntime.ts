import {
  decorStoreRevolutionOptions,
  loadDecorStoreRevolutionChain,
  type DecorRevolutionCollection,
} from "../runtime/revolution-loader.client";

export type DecorHeroStatus = "loading" | "ready" | "fallback" | "destroyed";

export function useDecorStoreRuntime(
  root: Readonly<Ref<HTMLElement | null>>,
  resolveRuntimeSource: (sourcePath: string) => string,
) {
  const status = ref<DecorHeroStatus>("loading");
  const activeSlide = ref("rs-73");
  const transition = ref<"moving" | "settled">("settled");
  const failure = ref("");
  const reducedMotion = ref(false);
  let slider: DecorRevolutionCollection | undefined;
  let observer: MutationObserver | undefined;
  let reducedMotionQuery: MediaQueryList | undefined;
  let readinessFrame = 0;
  let disposed = false;

  function publishTestState(instances?: number): void {
    if (typeof window === "undefined") return;
    const target = window as typeof window & {
      __decorStoreHeroTestState?: {
        activeSlide: string;
        destroyed: boolean;
        fallback: string;
        instances: number;
        status: DecorHeroStatus;
        transition: "moving" | "settled";
      };
    };
    target.__decorStoreHeroTestState = {
      activeSlide: activeSlide.value,
      destroyed: status.value === "destroyed",
      fallback: failure.value,
      instances: instances ?? target.__decorStoreHeroTestState?.instances ?? 0,
      status: status.value,
      transition: transition.value,
    };
  }

  function updateActiveSlide(): void {
    const active = root.value?.querySelector("#decor-store-slider > ul > li.active-revslide");
    activeSlide.value = active?.getAttribute("data-index") || activeSlide.value;
    publishTestState();
  }

  function stableFallback(error: unknown): void {
    const sliderElement = root.value?.querySelector<HTMLElement>("#decor-store-slider");
    if (sliderElement) {
      sliderElement.style.display = "block";
      sliderElement.querySelectorAll<HTMLElement>(":scope > ul > li").forEach((slide, index) => {
        slide.hidden = index !== 0;
        slide.style.visibility = index === 0 ? "visible" : "hidden";
      });
    }
    failure.value = error instanceof Error ? error.message : String(error);
    status.value = "fallback";
    publishTestState(0);
  }

  function updateReducedMotion(): void {
    reducedMotion.value = Boolean(reducedMotionQuery?.matches);
    if (reducedMotion.value) slider?.revpause();
    else slider?.revresume();
    publishTestState();
  }

  function isVisiblyRendered(element: HTMLElement): boolean {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    let current: HTMLElement | null = element;
    let opacity = 1;
    while (current && current !== root.value) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return false;
      opacity *= Number.parseFloat(style.opacity || "1");
      current = current.parentElement;
    }
    return opacity > 0.9;
  }

  async function waitForVisibleSourceLayers(sliderElement: HTMLElement): Promise<void> {
    const deadline = performance.now() + 8_000;
    const criticalLayers = [
      "[id$='-layer-07']",
      ".product-image-layer",
      ".shop-button",
      ".navigation-arrow [id$='-layer-13']",
    ];
    while (!disposed && performance.now() < deadline) {
      const active = sliderElement.querySelector<HTMLElement>(":scope > ul > li.active-revslide");
      if (
        active &&
        criticalLayers.every((selector) => {
          const layer = active.querySelector<HTMLElement>(selector);
          return Boolean(layer && isVisiblyRendered(layer));
        })
      ) {
        return;
      }
      await new Promise<void>((resolve) => {
        readinessFrame = requestAnimationFrame(() => {
          readinessFrame = 0;
          resolve();
        });
      });
    }
    if (!disposed) {
      throw new Error("Decor Revolution initialized without rendering its critical source layers.");
    }
  }

  onMounted(async () => {
    await nextTick();
    try {
      const jquery = await loadDecorStoreRevolutionChain(resolveRuntimeSource);
      if (disposed || !root.value?.querySelector("#decor-store-slider")) return;
      slider = jquery("#decor-store-slider");
      if (
        (window as typeof window & { __decorStoreForceInitError?: boolean })
          .__decorStoreForceInitError
      ) {
        throw new Error("Decor Revolution initializer failure requested by the acceptance seam.");
      }
      slider
        .off(".decorStore")
        .on("revolution.slide.onbeforeswap.decorStore", () => {
          transition.value = "moving";
        })
        .on("revolution.slide.onafterswap.decorStore revolution.slide.onloaded.decorStore", () => {
          transition.value = "settled";
          updateActiveSlide();
          publishTestState();
        });
      slider.show().revolution({ ...decorStoreRevolutionOptions });
      if (disposed) {
        slider.revkill();
        slider = undefined;
        return;
      }
      const sliderElement = root.value.querySelector<HTMLElement>("#decor-store-slider");
      if (!sliderElement?.classList.contains("revslider-initialised")) {
        throw new Error("Decor Revolution initializer returned without an initialized instance.");
      }
      observer = new MutationObserver(updateActiveSlide);
      observer.observe(sliderElement, { attributes: true, subtree: true });
      updateActiveSlide();
      await waitForVisibleSourceLayers(sliderElement);
      if (disposed) return;
      reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotionQuery.addEventListener("change", updateReducedMotion);
      updateReducedMotion();
      status.value = "ready";
      publishTestState(1);
    } catch (error) {
      if (!disposed) stableFallback(error);
    }
  });

  onBeforeUnmount(() => {
    disposed = true;
    if (readinessFrame) cancelAnimationFrame(readinessFrame);
    readinessFrame = 0;
    observer?.disconnect();
    observer = undefined;
    reducedMotionQuery?.removeEventListener("change", updateReducedMotion);
    reducedMotionQuery = undefined;
    try {
      slider?.off(".decorStore");
      slider?.revkill();
    } finally {
      slider = undefined;
      status.value = "destroyed";
      publishTestState(0);
    }
  });

  return { activeSlide, failure, reducedMotion, status, transition };
}
