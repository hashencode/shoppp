import type { Ref } from "vue";
import type { gsap } from "gsap";

import { fashionStoreDecorHeroLayerTimeline } from "../contracts/home-hero";

type HeroMotionPhase = "idle" | "layer-busy";
type HeroTimeline = {
  fromTo(...arguments_: unknown[]): unknown;
  kill(): void;
  pause(): void;
  play(): void;
  revert(): void;
};

export function createFashionStoreDecorHeroTimeline(
  gsap: { timeline(options: { onComplete(): void }): HeroTimeline },
  slide: Pick<HTMLElement, "querySelector">,
  complete: () => void,
  fail: () => void,
): HeroTimeline | undefined {
  let timeline: HeroTimeline | undefined;
  try {
    timeline = gsap.timeline({ onComplete: complete });
    for (const layer of fashionStoreDecorHeroLayerTimeline) {
      const element = slide.querySelector<HTMLElement>(`[data-hero-layer='${layer.role}']`);
      if (!element) continue;
      const imageLayer = layer.role === "pattern" || layer.role === "product";
      const shapeLayer = layer.role === "shape";
      timeline.fromTo(
        element,
        {
          autoAlpha: 0,
          filter: layer.role === "title" || layer.role === "price" ? "blur(10px)" : "none",
          scale: shapeLayer ? 0.5 : 1,
          x: imageLayer ? 50 : 0,
          y: imageLayer ? 0 : 50,
        },
        {
          autoAlpha: 1,
          duration: layer.durationMs / 1_000,
          ease: layer.ease,
          filter: "blur(0px)",
          scale: 1,
          x: 0,
          y: 0,
        },
        layer.delayMs / 1_000,
      );
    }
    return timeline;
  } catch {
    timeline?.revert();
    fail();
    return undefined;
  }
}

export function useFashionStoreDecorHeroMotion(root: Ref<HTMLElement | undefined>) {
  const phase = ref<HeroMotionPhase>("idle");
  const ready = ref(false);
  const reducedMotion = ref(false);
  let generation = 0;
  let timeline: HeroTimeline | undefined;
  let gsapModule: { gsap: typeof gsap } | undefined;
  let mediaQuery: MediaQueryList | undefined;
  let mounted = true;
  const handleMotionChange = () => {
    reducedMotion.value = Boolean(mediaQuery?.matches);
    if (reducedMotion.value) {
      clear();
      const activeSlide = root.value?.querySelector<HTMLElement>(".swiper-slide-active");
      if (activeSlide) setFinalState(activeSlide);
    }
  };

  function clear(): void {
    generation += 1;
    timeline?.revert();
    timeline = undefined;
    phase.value = "idle";
  }

  function setFinalState(slide: HTMLElement): void {
    if (!gsapModule) return;
    gsapModule.gsap.set(slide.querySelectorAll<HTMLElement>("[data-hero-layer]"), {
      clearProps: "opacity,transform,filter,willChange",
    });
  }

  function animate(slide: HTMLElement, settle: () => void, fail: () => void): void {
    clear();
    if (reducedMotion.value || !gsapModule) {
      setFinalState(slide);
      settle();
      return;
    }

    const activeGeneration = generation;
    phase.value = "layer-busy";
    const nextTimeline = createFashionStoreDecorHeroTimeline(
      gsapModule.gsap,
      slide,
      () => {
          if (activeGeneration !== generation) return;
          setFinalState(slide);
          phase.value = "idle";
          settle();
      },
      () => {
        clear();
        setFinalState(slide);
        ready.value = false;
        fail();
      },
    );
    if (nextTimeline) timeline = nextTimeline;
  }

  function setHidden(hidden: boolean): void {
    if (hidden) timeline?.pause();
    else if (!reducedMotion.value) timeline?.play();
  }

  onMounted(async () => {
    const loadedModule = await import("gsap").catch(() => undefined);
    if (!mounted || !loadedModule) return;
    gsapModule = loadedModule;
    mediaQuery = matchMedia("(prefers-reduced-motion: reduce)");
    handleMotionChange();
    mediaQuery.addEventListener("change", handleMotionChange);
    ready.value = true;
  });

  onBeforeUnmount(() => {
    mounted = false;
    mediaQuery?.removeEventListener("change", handleMotionChange);
    clear();
  });

  return {
    animate,
    phase: readonly(phase),
    ready: readonly(ready),
    reducedMotion: readonly(reducedMotion),
    setHidden,
  };
}
