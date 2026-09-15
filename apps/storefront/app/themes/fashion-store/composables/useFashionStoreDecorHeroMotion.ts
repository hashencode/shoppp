import type { Ref } from "vue";
import type { gsap } from "gsap";

import { fashionStoreDecorHeroLayerTimeline } from "../contracts/home-hero";

type HeroMotionPhase = "idle" | "layer-busy";
type HeroTimeline = {
  kill(): void;
  pause(): void;
  play(): void;
  revert(): void;
};

type GsapTimeline = {
  call(callback: () => void, parameters?: unknown[], position?: number): unknown;
  kill(): void;
  pause(): void;
  play(): void;
  revert(): void;
  to(target: object, variables: { duration: number }, position?: number): unknown;
};

const heroLayerEasing = {
  "back.out": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  "power3.inOut": "cubic-bezier(0.645, 0.045, 0.355, 1)",
  "power4.inOut": "cubic-bezier(0.77, 0, 0.175, 1)",
} as const;

export function createFashionStoreDecorHeroTimeline(
  gsap: { timeline(options: { onComplete(): void }): GsapTimeline },
  slide: Pick<HTMLElement, "querySelector">,
  complete: () => void,
  fail: () => void,
): HeroTimeline | undefined {
  let timeline: GsapTimeline | undefined;
  const animations: Animation[] = [];
  const cancelAnimations = () => {
    for (const animation of animations) animation.cancel();
  };
  try {
    for (const layer of fashionStoreDecorHeroLayerTimeline) {
      const element = slide.querySelector<HTMLElement>(`[data-hero-layer='${layer.role}']`);
      if (!element) continue;
      const imageLayer = layer.role === "pattern" || layer.role === "product";
      const shapeLayer = layer.role === "shape";
      const animation = element.animate(
        [
          {
            opacity: 0,
            scale: shapeLayer ? 0.5 : 1,
            translate: imageLayer ? "50px 0" : "0 50px",
          },
          { opacity: 1, scale: 1, translate: "0 0" },
        ],
        {
          delay: layer.delayMs,
          duration: layer.durationMs,
          easing: heroLayerEasing[layer.ease],
          fill: "backwards",
        },
      );
      animation.pause();
      animations.push(animation);
    }
    const durationMs = Math.max(
      ...fashionStoreDecorHeroLayerTimeline.map((layer) => layer.delayMs + layer.durationMs),
    );
    timeline = gsap.timeline({
      onComplete() {
        cancelAnimations();
        complete();
      },
    });
    timeline.call(
      () => {
        for (const animation of animations) animation.play();
      },
      [],
      0,
    );
    timeline.to({}, { duration: durationMs / 1_000 }, 0);
    return {
      kill() {
        timeline?.kill();
        cancelAnimations();
      },
      pause() {
        timeline?.pause();
        for (const animation of animations) animation.pause();
      },
      play() {
        timeline?.play();
        for (const animation of animations) animation.play();
      },
      revert() {
        timeline?.revert();
        cancelAnimations();
      },
    };
  } catch {
    timeline?.revert();
    cancelAnimations();
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
      clearProps: "opacity,transform,willChange",
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
        timeline = undefined;
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

  function setSuspended(suspended: boolean): void {
    if (suspended) {
      timeline?.pause();
    } else if (!reducedMotion.value && timeline) {
      timeline.play();
    }
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
    setSuspended,
  };
}
