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
  const pageHidden = ref(false);
  const bodyReady = ref(false);
  let slider: DecorRevolutionCollection | undefined;
  let observer: MutationObserver | undefined;
  let heroSection: HTMLElement | undefined;
  let frozenHeroMarkup = "";
  let reducedMotionQuery: MediaQueryList | undefined;
  let readinessFrame = 0;
  let resolveReadinessFrame: (() => void) | undefined;
  let disposed = false;
  let bodyAbort: AbortController | undefined;
  let bodyMotionQuery: MediaQueryList | undefined;
  let bodyMotionRegions: HTMLElement[] = [];
  let carouselTimer: ReturnType<typeof setInterval> | undefined;
  let carouselRegion: HTMLElement | undefined;
  let carouselSlides: HTMLElement[] = [];
  let carouselIndex = 0;
  let carouselPointerStart: number | undefined;
  let tailAbort: AbortController | undefined;
  let tailFrame = 0;
  let stickyRegion: HTMLElement | undefined;
  let scrollProgressRegion: HTMLElement | undefined;
  let footerRegion: HTMLElement | undefined;

  function bodyCapabilityFailure(): string {
    if (typeof window === "undefined") return "";
    return (
      (
        window as typeof window & {
          __decorStoreBodyFailure?: string;
        }
      ).__decorStoreBodyFailure || ""
    );
  }

  function bodyMotionIsPaused(region: HTMLElement): boolean {
    return (
      Boolean(bodyMotionQuery?.matches) ||
      document.hidden ||
      region.matches(":hover") ||
      region.contains(document.activeElement)
    );
  }

  function publishBodyPauseState(): void {
    bodyMotionRegions.forEach((region) => {
      const paused = String(bodyMotionIsPaused(region));
      if (region.dataset.motionPaused !== paused) region.dataset.motionPaused = paused;
    });
  }

  function renderCarousel(): void {
    if (!carouselRegion) return;
    carouselSlides.forEach((slide, index) => {
      const active = index === carouselIndex;
      slide.hidden = !active;
      slide.classList.toggle("decor-body-carousel-slide-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    carouselRegion.dataset.carouselIndex = String(carouselIndex);
  }

  function moveCarousel(delta: number): void {
    if (!carouselSlides.length || carouselRegion?.dataset.bodyStatus !== "ready") return;
    carouselIndex = (carouselIndex + delta + carouselSlides.length) % carouselSlides.length;
    renderCarousel();
  }

  function activateProductTab(tab: HTMLElement, focus: boolean): void {
    const products = tab.closest<HTMLElement>("[data-decor-region='products']");
    const panelId = tab.getAttribute("aria-controls");
    if (!products || !panelId) return;
    products.querySelectorAll<HTMLElement>("[role='tab']").forEach((candidate) => {
      const selected = candidate === tab;
      candidate.classList.toggle("active", selected);
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    products.querySelectorAll<HTMLElement>("[role='tabpanel']").forEach((panel) => {
      const selected = panel.id === panelId;
      panel.hidden = !selected;
      panel.classList.toggle("active", selected);
      panel.classList.toggle("show", selected);
    });
    if (focus) tab.focus();
  }

  function initializeBody(): void {
    const host = root.value;
    if (!host) return;
    bodyAbort = new AbortController();
    const signal = bodyAbort.signal;
    bodyMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    bodyMotionRegions = [
      ...host.querySelectorAll<HTMLElement>(
        "[data-decor-region='promotional-marquee'], [data-decor-region='collection-carousel'], [data-decor-region='client-marquee']",
      ),
    ];
    const failedCapability = bodyCapabilityFailure();

    for (const key of ["promotional-marquee", "client-marquee"] as const) {
      const region = host.querySelector<HTMLElement>(`[data-decor-region='${key}']`);
      if (!region) continue;
      region.dataset.motionDirection = "left";
      region.dataset.motionLoop = "true";
      if (failedCapability === key) {
        region.dataset.bodyStatus = "fallback";
      } else {
        region.dataset.bodyStatus = "ready";
        region.classList.add("decor-body-marquee-ready");
      }
    }

    carouselRegion =
      host.querySelector<HTMLElement>("[data-decor-region='collection-carousel']") || undefined;
    if (carouselRegion) {
      carouselRegion.dataset.motionLoop = "true";
      carouselSlides = [
        ...carouselRegion.querySelectorAll<HTMLElement>(".swiper-wrapper > .swiper-slide"),
      ];
      if (failedCapability === "collection-carousel") {
        carouselRegion.dataset.bodyStatus = "fallback";
      } else {
        carouselRegion.dataset.bodyStatus = "ready";
        carouselRegion.classList.add("decor-body-carousel-ready");
        renderCarousel();
        carouselTimer = setInterval(() => {
          if (carouselRegion && !bodyMotionIsPaused(carouselRegion)) moveCarousel(1);
        }, 3_000);
      }
    }

    host.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const tab = target.closest<HTMLElement>("[data-decor-region='products'] [role='tab']");
        if (tab) {
          event.preventDefault();
          activateProductTab(tab, true);
          return;
        }
        if (target.closest("[data-decor-region='collection-carousel'] .swiper-button-next")) {
          event.preventDefault();
          moveCarousel(1);
          return;
        }
        if (target.closest("[data-decor-region='collection-carousel'] .swiper-button-prev")) {
          event.preventDefault();
          moveCarousel(-1);
        }
      },
      { signal },
    );
    host.addEventListener(
      "keydown",
      (event) => {
        const target = event.target as HTMLElement;
        const tab = target.closest<HTMLElement>("[data-decor-region='products'] [role='tab']");
        if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const tabs = [
            ...tab
              .closest<HTMLElement>("[role='tablist'], .nav-tabs")!
              .querySelectorAll<HTMLElement>("[role='tab']"),
          ];
          const current = tabs.indexOf(tab);
          let next: HTMLElement | undefined;
          if (event.key === "Home") next = tabs[0];
          else if (event.key === "End") next = tabs.at(-1);
          else {
            const delta = event.key === "ArrowRight" ? 1 : -1;
            next = tabs[(current + delta + tabs.length) % tabs.length];
          }
          if (next) activateProductTab(next, true);
          return;
        }
        if (
          (event.key === "Enter" || event.key === " ") &&
          target.closest("[data-decor-region='collection-carousel'] .swiper-button-next")
        ) {
          event.preventDefault();
          moveCarousel(1);
        }
        if (
          (event.key === "Enter" || event.key === " ") &&
          target.closest("[data-decor-region='collection-carousel'] .swiper-button-prev")
        ) {
          event.preventDefault();
          moveCarousel(-1);
        }
      },
      { signal },
    );
    host.addEventListener("mouseover", publishBodyPauseState, { signal });
    host.addEventListener("mouseout", publishBodyPauseState, { signal });
    host.addEventListener("focusin", publishBodyPauseState, { signal });
    host.addEventListener("focusout", publishBodyPauseState, { signal });
    carouselRegion?.addEventListener(
      "pointerdown",
      (event) => {
        carouselPointerStart = event.clientX;
      },
      { signal },
    );
    carouselRegion?.addEventListener(
      "pointerup",
      (event) => {
        if (carouselPointerStart === undefined) return;
        const distance = event.clientX - carouselPointerStart;
        carouselPointerStart = undefined;
        if (Math.abs(distance) >= 50) moveCarousel(distance < 0 ? 1 : -1);
      },
      { signal },
    );
    document.addEventListener("visibilitychange", publishBodyPauseState, { signal });
    bodyMotionQuery.addEventListener("change", publishBodyPauseState);
    publishBodyPauseState();
    bodyReady.value = true;
  }

  function renderFixedControls(): void {
    tailFrame = 0;
    const scrollTop = Math.max(document.documentElement.scrollTop, window.scrollY);
    const maxScrollTop = Math.max(
      0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    if (scrollProgressRegion) {
      const visible = scrollTop > 200;
      const progress = Math.max(
        0,
        Math.min(100, (scrollTop / Math.max(1, maxScrollTop - 200)) * 100),
      );
      scrollProgressRegion.classList.toggle("visible", visible);
      scrollProgressRegion.dataset.scrollVisible = String(visible);
      scrollProgressRegion.dataset.scrollProgress = progress.toFixed(2);
      scrollProgressRegion
        .querySelector<HTMLElement>(".scroll-point")
        ?.style.setProperty("height", `${progress}%`);
    }
    if (stickyRegion) {
      const desktop = matchMedia("(min-width: 1200px)").matches;
      const footerVisible = Boolean(
        footerRegion &&
        footerRegion.getBoundingClientRect().top < innerHeight &&
        footerRegion.getBoundingClientRect().bottom > 0,
      );
      stickyRegion.classList.toggle("shadow-in", desktop);
      stickyRegion.classList.toggle("sticky-hidden", footerVisible);
      stickyRegion.classList.toggle(
        "sticky-highlight",
        Boolean(footerRegion && footerRegion.getBoundingClientRect().top < innerHeight * 0.9),
      );
      stickyRegion.dataset.stickyVisible = String(desktop && !footerVisible);
    }
  }

  function scheduleFixedControls(): void {
    if (tailFrame || disposed) return;
    tailFrame = requestAnimationFrame(renderFixedControls);
  }

  function initializeTail(): void {
    const host = root.value;
    if (!host) return;
    tailAbort = new AbortController();
    const signal = tailAbort.signal;
    stickyRegion = host.querySelector<HTMLElement>(".sticky-wrap") || undefined;
    scrollProgressRegion = host.querySelector<HTMLElement>(".scroll-progress") || undefined;
    footerRegion = host.querySelector<HTMLElement>("footer.footer-dark") || undefined;
    host
      .querySelector<HTMLElement>(".cookie-message")
      ?.setAttribute("data-cookie-state", "visible");
    host
      .querySelector<HTMLFormElement>("[data-decor-newsletter-form]")
      ?.setAttribute("data-newsletter-supported", "false");
    window.addEventListener("scroll", scheduleFixedControls, { passive: true, signal });
    window.addEventListener("resize", scheduleFixedControls, { passive: true, signal });
    renderFixedControls();
    host.dataset.decorTailReady = "true";
  }

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

  function destroyHeroRuntime(restoreFrozenMarkup = false): void {
    if (readinessFrame) cancelAnimationFrame(readinessFrame);
    readinessFrame = 0;
    resolveReadinessFrame?.();
    resolveReadinessFrame = undefined;
    observer?.disconnect();
    observer = undefined;
    try {
      slider?.off(".decorStore");
      slider?.revkill();
    } catch {
      // A partially initialized source instance may not expose a complete revkill state.
    } finally {
      slider = undefined;
      if (restoreFrozenMarkup && heroSection?.isConnected && frozenHeroMarkup) {
        heroSection.innerHTML = frozenHeroMarkup;
      }
    }
  }

  function updateReducedMotion(): void {
    reducedMotion.value = Boolean(reducedMotionQuery?.matches);
    if (reducedMotion.value || document.hidden) slider?.revpause();
    else slider?.revresume();
    publishTestState();
  }

  function updatePageVisibility(): void {
    pageHidden.value = document.hidden;
    updateReducedMotion();
    publishBodyPauseState();
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
        resolveReadinessFrame = resolve;
        readinessFrame = requestAnimationFrame(() => {
          readinessFrame = 0;
          resolveReadinessFrame = undefined;
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
    if (disposed) return;
    heroSection =
      root.value?.querySelector<HTMLElement>("#decor-store-slider")?.closest("section") ||
      undefined;
    frozenHeroMarkup = heroSection?.innerHTML || "";
    try {
      reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotionQuery.addEventListener("change", updateReducedMotion);
      document.addEventListener("visibilitychange", updatePageVisibility);
      pageHidden.value = document.hidden;
      updateReducedMotion();
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
      if (reducedMotion.value || document.hidden) slider.revpause();
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
      observer.observe(sliderElement, {
        attributeFilter: ["data-slideactive"],
        attributes: true,
      });
      updateActiveSlide();
      if (
        (window as typeof window & { __decorStoreForceReadinessError?: boolean })
          .__decorStoreForceReadinessError
      ) {
        throw new Error("Decor Revolution post-initialization readiness failure requested.");
      }
      await waitForVisibleSourceLayers(sliderElement);
      if (disposed) return;
      updateReducedMotion();
      status.value = "ready";
      publishTestState(1);
    } catch (error) {
      if (!disposed) {
        destroyHeroRuntime(true);
        stableFallback(error);
      }
    }
  });

  onMounted(async () => {
    await nextTick();
    if (!disposed) {
      initializeBody();
      initializeTail();
    }
  });

  onBeforeUnmount(() => {
    disposed = true;
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = undefined;
    bodyAbort?.abort();
    bodyAbort = undefined;
    bodyMotionQuery?.removeEventListener("change", publishBodyPauseState);
    bodyMotionQuery = undefined;
    bodyMotionRegions = [];
    carouselSlides.forEach((slide) => {
      slide.hidden = false;
      slide.removeAttribute("aria-hidden");
    });
    carouselSlides = [];
    carouselRegion = undefined;
    root.value?.removeAttribute("data-decor-tail-ready");
    bodyReady.value = false;
    tailAbort?.abort();
    tailAbort = undefined;
    if (tailFrame) cancelAnimationFrame(tailFrame);
    tailFrame = 0;
    stickyRegion = undefined;
    scrollProgressRegion = undefined;
    footerRegion = undefined;
    destroyHeroRuntime();
    reducedMotionQuery?.removeEventListener("change", updateReducedMotion);
    document.removeEventListener("visibilitychange", updatePageVisibility);
    reducedMotionQuery = undefined;
    status.value = "destroyed";
    if (typeof window !== "undefined") {
      const target = window as typeof window & {
        __decorStoreBodyFailure?: string;
        __decorStoreForceInitError?: boolean;
        __decorStoreForceReadinessError?: boolean;
        __decorStoreHeroTestState?: unknown;
      };
      delete target.__decorStoreBodyFailure;
      delete target.__decorStoreForceInitError;
      delete target.__decorStoreForceReadinessError;
      delete target.__decorStoreHeroTestState;
    }
  });

  return { activeSlide, bodyReady, failure, pageHidden, reducedMotion, status, transition };
}
