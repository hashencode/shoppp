<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface HeroData {
  options?: {
    autoplayMs: number;
    breakpointPx: number;
    desktopDirection: "vertical";
    disableOnInteraction: false;
    effect: "slide";
    keyboard: boolean;
    loop: boolean;
    mobileDirection: "horizontal";
    parallaxPx: number;
    progress: "numeric-line";
    speedMs: number;
    touch: boolean;
  };
  slides: { assetId: string; eyebrow: string; heading: string }[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as HeroData)
    : null,
);
const options = computed(() => ({
  autoplayMs: data.value?.options?.autoplayMs ?? 4_000,
  breakpointPx: data.value?.options?.breakpointPx ?? 1_199,
  parallaxPx: data.value?.options?.parallaxPx ?? 500,
  speedMs: data.value?.options?.speedMs ?? 1_000,
}));

useHead(() => ({
  link: [
    ...(data.value?.slides[0]
      ? ([
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(data.value.slides[0].assetId),
            rel: "preload",
          },
        ] as const)
      : []),
  ],
}));

const controller = createInteractionController({
  autoplayDelayMs: options.value.autoplayMs,
  count: data.value?.slides.length ?? 0,
  transitionDurationMs: options.value.speedMs,
});
const motion = shallowRef<InteractionSnapshot>(controller.snapshot());
const direction = ref<"horizontal" | "vertical">("vertical");
const ready = ref(false);
const secondaryImagesReady = ref(false);
let unsubscribe: () => void = () => undefined;
let directionQuery: MediaQueryList | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let firstImagePreloader: HTMLImageElement | undefined;

function releaseSecondaryImages(): void {
  secondaryImagesReady.value = true;
}
let pointerStart: { id: number; x: number; y: number } | null = null;

const visibleIndex = computed(() =>
  motion.value.phase === "transitioning" ? motion.value.targetIndex : motion.value.currentIndex,
);
const progress = computed(() => {
  const count = data.value?.slides.length ?? 1;
  return `${((visibleIndex.value + 1) / count) * 100}%`;
});

function headingParts(heading: string): [string, string] {
  const boundary = heading.lastIndexOf(" ");
  return boundary === -1
    ? [heading, ""]
    : [heading.slice(0, boundary), heading.slice(boundary + 1)];
}

function relativeOffset(index: number, activeIndex: number): number {
  const count = data.value?.slides.length ?? 1;
  const forward = (index - activeIndex + count) % count;
  return forward > count / 2 ? forward - count : forward;
}

function slideOffset(index: number): number {
  if (motion.value.phase === "transitioning") {
    if (index === motion.value.currentIndex) return -motion.value.direction;
    if (index === motion.value.targetIndex) return 0;
    return relativeOffset(index, motion.value.targetIndex);
  }
  return relativeOffset(index, motion.value.currentIndex);
}

function slideBackground(assetId: string, index: number): string {
  return index === 0 || secondaryImagesReady.value
    ? `url('${properties.resolveAsset(assetId)}')`
    : "none";
}

function select(index: number): void {
  controller.select(index);
}

function keydown(event: KeyboardEvent): void {
  if (!data.value?.options?.keyboard) return;
  if (controller.handleKey(event.key)) event.preventDefault();
}

function pointerDown(event: PointerEvent): void {
  if (!data.value?.options?.touch || event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea"))
    return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId);
}

function pointerUp(event: PointerEvent): void {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  controller.handleSwipe({
    axis: direction.value,
    deltaX: event.clientX - pointerStart.x,
    deltaY: event.clientY - pointerStart.y,
    threshold: 32,
  });
  pointerStart = null;
}

function visibilityChanged(): void {
  if (document.hidden) controller.pause("document-hidden");
  else controller.resume("document-hidden");
}

function directionChanged(): void {
  direction.value = directionQuery?.matches ? "vertical" : "horizontal";
}

function reducedMotionChanged(): void {
  if (reducedMotionQuery?.matches) controller.pause("reduced-motion");
  else controller.resume("reduced-motion");
}

onMounted(() => {
  unsubscribe = controller.subscribe((snapshot) => {
    motion.value = snapshot;
  });
  directionQuery = matchMedia(`(min-width: ${options.value.breakpointPx}px)`);
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  directionChanged();
  reducedMotionChanged();
  visibilityChanged();
  directionQuery.addEventListener("change", directionChanged);
  reducedMotionQuery.addEventListener("change", reducedMotionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  const firstSlide = data.value?.slides[0];
  if (firstSlide) {
    firstImagePreloader = new Image();
    firstImagePreloader.addEventListener("load", releaseSecondaryImages, { once: true });
    firstImagePreloader.addEventListener("error", releaseSecondaryImages, { once: true });
    firstImagePreloader.src = properties.resolveAsset(firstSlide.assetId);
    if (firstImagePreloader.complete) releaseSecondaryImages();
  }
  controller.start();
  ready.value = true;
});

onBeforeUnmount(() => {
  unsubscribe();
  controller.dispose();
  directionQuery?.removeEventListener("change", directionChanged);
  reducedMotionQuery?.removeEventListener("change", reducedMotionChanged);
  document.removeEventListener("visibilitychange", visibilityChanged);
  firstImagePreloader?.removeEventListener("load", releaseSecondaryImages);
  firstImagePreloader?.removeEventListener("error", releaseSecondaryImages);
  firstImagePreloader = undefined;
});
</script>

<template>
  <section
    v-if="data"
    class="fashion-hero"
    aria-roledescription="carousel"
    aria-label="Seasonal collections"
    :data-motion-active-index="visibleIndex"
    :data-motion-autoplay-ms="options.autoplayMs"
    :data-motion-direction="direction"
    data-motion-easing="ease"
    :data-motion-duration-ms="options.speedMs"
    :data-motion-paused="motion.pausedReasons.join(',')"
    :data-motion-phase="motion.phase"
    :data-motion-ready="ready"
    :style="{
      '--fashion-hero-duration': `${options.speedMs}ms`,
      '--fashion-hero-parallax': `${options.parallaxPx}px`,
    }"
    tabindex="0"
    @keydown="keydown"
    @pointerdown="pointerDown"
    @pointerup="pointerUp"
    @pointercancel="pointerStart = null"
  >
    <aside class="fashion-social-rail" aria-label="Social channels">
      <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
        <span class="fashion-brand-icon fashion-brand-facebook" aria-hidden="true" />
        <span>Facebook</span>
      </a>
      <a href="https://dribbble.com/" target="_blank" rel="noreferrer">
        <span class="fashion-brand-icon fashion-brand-dribbble" aria-hidden="true" />
        <span>Dribbble</span>
      </a>
      <a href="https://twitter.com/" target="_blank" rel="noreferrer">
        <span class="fashion-brand-icon fashion-brand-twitter" aria-hidden="true" />
        <span>Twitter</span>
      </a>
      <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
        <span class="fashion-brand-icon fashion-brand-instagram" aria-hidden="true" />
        <span>Instagram</span>
      </a>
    </aside>
    <article
      v-for="(slide, index) in data.slides"
      :key="slide.assetId"
      class="fashion-hero-slide"
      data-motion-layer="slide"
      :data-active="visibleIndex === index"
      :data-current="motion.currentIndex === index"
      :aria-hidden="visibleIndex === index ? undefined : 'true'"
      :aria-label="`${index + 1} of ${data.slides.length}`"
      :style="{ '--fashion-slide-offset': slideOffset(index) }"
    >
      <div
        class="fashion-hero-image"
        role="img"
        :aria-label="`${slide.heading} campaign portrait`"
        :style="{ backgroundImage: slideBackground(slide.assetId, index) }"
      />
      <div class="fashion-hero-copy">
        <div class="fashion-hero-eyebrow">
          <span class="fashion-hero-highlight">
            {{ slide.eyebrow }}<span class="fashion-hero-highlight-bar" aria-hidden="true" />
          </span>
        </div>
        <h1>
          <span class="fashion-hero-heading-strong">{{ headingParts(slide.heading)[0] }}</span>
          <span class="fashion-hero-heading-light">{{ headingParts(slide.heading)[1] }}</span>
        </h1>
        <div class="fashion-hero-action">
          <NuxtLink to="/#fashion-bestsellers" :tabindex="visibleIndex === index ? undefined : -1">
            View collection
          </NuxtLink>
        </div>
      </div>
    </article>
    <div
      class="fashion-hero-pagination"
      aria-label="Choose collection"
      :style="{ '--fashion-progress': progress }"
    >
      <span class="fashion-hero-current" aria-live="polite">{{
        String(visibleIndex + 1).padStart(2, "0")
      }}</span>
      <div class="fashion-hero-progress" aria-hidden="true"><span></span></div>
      <span class="fashion-hero-total">{{ String(data.slides.length).padStart(2, "0") }}</span>
      <div class="fashion-hero-pagination-targets">
        <button
          v-for="(_, index) in data.slides"
          :key="index"
          type="button"
          :aria-current="visibleIndex === index ? 'true' : undefined"
          :aria-label="`Show slide ${index + 1}`"
          @click="select(index)"
        ></button>
      </div>
    </div>
  </section>
</template>
