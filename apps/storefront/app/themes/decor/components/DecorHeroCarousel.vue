<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import {
  createInteractionController,
  type InteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface HeroData {
  autoplayMs?: number;
  interaction?: {
    stopAfterLoops: number;
    stopAtSlide: number;
    stopLoop: boolean;
    swipeThresholdPx: number;
  };
  layerTimeline?: { durationMs: number };
  slides: {
    accentAssetId: string;
    assetId: string;
    backgroundColor: string;
    backgroundAssetId: string;
    heading: string;
    mobileAccentAssetId?: string;
    mobileAssetId?: string;
    price: string;
    thumbAssetId: string;
  }[];
  transition?: { durationMs: number };
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
useHead(() => ({
  link: [
    ...(data.value?.slides[0]
      ? ([
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(
              data.value.slides[0].mobileAssetId ?? data.value.slides[0].assetId,
            ),
            media: "(max-width: 575px)",
            rel: "preload",
          },
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(data.value.slides[0].assetId),
            media: "(min-width: 576px)",
            rel: "preload",
          },
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(
              data.value.slides[0].mobileAccentAssetId ?? data.value.slides[0].backgroundAssetId,
            ),
            media: "(max-width: 575px)",
            rel: "preload",
          },
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(data.value.slides[0].backgroundAssetId),
            media: "(min-width: 576px) and (max-width: 768px)",
            rel: "preload",
          },
          {
            as: "image",
            fetchpriority: "high",
            href: properties.resolveAsset(data.value.slides[0].accentAssetId),
            media: "(min-width: 769px)",
            rel: "preload",
          },
        ] as const)
      : []),
  ],
}));
const snapshot = ref<InteractionSnapshot>({
  currentIndex: 0,
  direction: 0,
  pausedReasons: [],
  phase: "idle",
  targetIndex: 0,
  transitionStartedAt: null,
});
const visibleIndex = computed(() =>
  snapshot.value.phase === "transitioning"
    ? snapshot.value.targetIndex
    : snapshot.value.currentIndex,
);
const controllerReady = ref(false);
const layerTimelineDurationMs = computed(() => data.value?.layerTimeline?.durationMs ?? 2_700);
const transitionDurationMs = computed(() => data.value?.transition?.durationMs ?? 300);
const swipeThresholdPx = computed(() => data.value?.interaction?.swipeThresholdPx ?? 75);
const layerTimelineBusy = ref(true);
const announcement = ref("");
let controller: InteractionController | undefined;
let unsubscribe: (() => void) | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
let pointerStart: { id: number; x: number; y: number } | undefined;
let layerTimelineTimer = 0;

function finishLayerTimeline(): void {
  layerTimelineBusy.value = false;
  const slide = data.value?.slides[visibleIndex.value];
  if (slide) {
    announcement.value = `${slide.heading}, slide ${visibleIndex.value + 1} of ${data.value?.slides.length ?? 0}`;
  }
}
function startLayerTimeline(): void {
  window.clearTimeout(layerTimelineTimer);
  if (reducedMotionQuery?.matches) {
    finishLayerTimeline();
    return;
  }
  layerTimelineBusy.value = true;
  layerTimelineTimer = window.setTimeout(finishLayerTimeline, layerTimelineDurationMs.value);
}

function stateFor(index: number): "active" | "entering" | "exiting" | "inactive" {
  if (snapshot.value.phase === "transitioning") {
    if (index === snapshot.value.targetIndex) return "entering";
    if (index === snapshot.value.currentIndex) return "exiting";
  }
  return index === snapshot.value.currentIndex ? "active" : "inactive";
}
function next(): void {
  if (layerTimelineBusy.value) return;
  controller?.next();
}
function previous(): void {
  if (layerTimelineBusy.value) return;
  controller?.previous();
}
function handleKey(event: KeyboardEvent): void {
  if (layerTimelineBusy.value) return;
  if (!controller?.handleKey(event.key)) return;
  event.preventDefault();
}
function pointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea"))
    return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (event.currentTarget instanceof HTMLElement)
    event.currentTarget.setPointerCapture(event.pointerId);
}
function pointerUp(event: PointerEvent): void {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  if (layerTimelineBusy.value) {
    pointerStart = undefined;
    return;
  }
  controller?.handleSwipe({
    axis: "horizontal",
    deltaX: event.clientX - pointerStart.x,
    deltaY: event.clientY - pointerStart.y,
    threshold: swipeThresholdPx.value,
  });
  pointerStart = undefined;
}
function pointerCancel(event: PointerEvent): void {
  if (pointerStart?.id === event.pointerId) pointerStart = undefined;
}
function visibilityChanged(): void {
  if (document.hidden) controller?.pause("document-hidden");
  else controller?.resume("document-hidden");
}
function reducedMotionChanged(): void {
  if (reducedMotionQuery?.matches) {
    controller?.pause("reduced-motion");
    window.clearTimeout(layerTimelineTimer);
    finishLayerTimeline();
  } else controller?.resume("reduced-motion");
}
onMounted(() => {
  controller = createInteractionController({
    autoplayDelayMs: data.value?.autoplayMs ?? 9_000,
    count: data.value?.slides.length ?? 0,
    transitionDurationMs: transitionDurationMs.value,
  });
  unsubscribe = controller.subscribe((nextSnapshot) => {
    if (snapshot.value.phase !== "transitioning" && nextSnapshot.phase === "transitioning") {
      startLayerTimeline();
    }
    snapshot.value = nextSnapshot;
  });
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionChanged();
  if (document.hidden) controller.pause("document-hidden");
  reducedMotionQuery.addEventListener("change", reducedMotionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  const interaction = data.value?.interaction;
  const sourceStopsBeforeFirstAutoplay =
    interaction?.stopLoop === true &&
    interaction.stopAfterLoops === 0 &&
    interaction.stopAtSlide === 1;
  if (!sourceStopsBeforeFirstAutoplay) controller.start();
  startLayerTimeline();
  controllerReady.value = true;
});
onBeforeUnmount(() => {
  window.clearTimeout(layerTimelineTimer);
  unsubscribe?.();
  controller?.dispose();
  reducedMotionQuery?.removeEventListener("change", reducedMotionChanged);
  document.removeEventListener("visibilitychange", visibilityChanged);
});
</script>

<template>
  <section
    v-if="data"
    class="decor-hero"
    aria-roledescription="carousel"
    aria-label="Furniture collections"
    tabindex="0"
    :data-current-index="snapshot.currentIndex"
    :data-target-index="snapshot.targetIndex"
    :data-transition-phase="snapshot.phase"
    data-motion-autoplay-ms="9000"
    data-motion-direction="horizontal"
    data-motion-duration-ms="300"
    :data-layer-timeline-duration-ms="layerTimelineDurationMs"
    data-motion-easing="ease-in-out"
    :data-motion-ready="controllerReady ? 'true' : 'false'"
    :data-motion-active-index="visibleIndex"
    :data-motion-paused="snapshot.pausedReasons.join(',')"
    :data-motion-phase="layerTimelineBusy ? 'layer-timeline' : snapshot.phase"
    @keydown="handleKey"
    @pointerdown="pointerDown"
    @pointerup="pointerUp"
    @pointercancel="pointerCancel"
  >
    <aside class="decor-social">
      <span><i class="decor-brand-icon decor-brand-facebook" aria-hidden="true"></i>Facebook</span>
      <span><i class="decor-brand-icon decor-brand-dribbble" aria-hidden="true"></i>Dribbble</span>
      <span><i class="decor-brand-icon decor-brand-twitter" aria-hidden="true"></i>Twitter</span>
      <span
        ><i class="decor-brand-icon decor-brand-instagram" aria-hidden="true"></i>Instagram</span
      >
    </aside>
    <article
      v-for="(slide, index) in data.slides"
      :key="slide.assetId"
      class="decor-hero-slide"
      :data-state="stateFor(index)"
      :inert="stateFor(index) === 'inactive'"
      :style="{
        backgroundColor: slide.backgroundColor,
        backgroundImage: `url(${properties.resolveAsset(slide.backgroundAssetId)})`,
      }"
      :aria-hidden="stateFor(index) === 'inactive'"
      :aria-label="`${index + 1} of ${data.slides.length}`"
    >
      <picture>
        <source
          v-if="slide.mobileAccentAssetId"
          media="(max-width: 575px)"
          :srcset="properties.resolveAsset(slide.mobileAccentAssetId)"
          width="2000"
          height="650"
        />
        <source
          media="(min-width: 769px)"
          :srcset="properties.resolveAsset(slide.accentAssetId)"
          width="650"
          height="2000"
        />
        <img
          class="decor-hero-accent"
          :data-motion-layer="`slide-${index}-accent`"
          :src="properties.resolveAsset(slide.mobileAccentAssetId ?? slide.backgroundAssetId)"
          alt=""
          width="2000"
          height="650"
          :decoding="index === 0 ? 'sync' : 'async'"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
          :loading="index === 0 ? 'eager' : 'lazy'"
        />
      </picture>
      <picture>
        <source
          v-if="slide.mobileAssetId"
          media="(max-width: 575px)"
          :srcset="properties.resolveAsset(slide.mobileAssetId)"
        />
        <img
          class="decor-hero-product"
          :data-motion-layer="`slide-${index}-product`"
          :src="properties.resolveAsset(slide.assetId)"
          :alt="slide.heading"
          width="1678"
          height="740"
          :decoding="index === 0 ? 'sync' : 'async'"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
          :loading="index === 0 ? 'eager' : 'lazy'"
        />
      </picture>
      <div class="decor-hero-copy">
        <h1 :data-motion-layer="`slide-${index}-heading`">{{ slide.heading }}</h1>
        <p :data-motion-layer="`slide-${index}-price`">
          Price starting from <strong>{{ slide.price }}</strong>
        </p>
        <a :data-motion-layer="`slide-${index}-action`" href="/#decor-products"
          ><i class="decor-feather decor-feather-shopping-bag" aria-hidden="true"></i>Shop now</a
        >
      </div>
    </article>
    <div class="decor-hero-controls">
      <button
        type="button"
        aria-label="Previous furniture"
        :aria-disabled="layerTimelineBusy"
        @click="previous"
      >
        <ArrowLeft aria-hidden="true" :size="18" :stroke-width="1.7" /></button
      ><span
        >{{ String(visibleIndex + 1).padStart(2, "0") }} /
        {{ String(data.slides.length).padStart(2, "0") }}</span
      ><button
        type="button"
        aria-label="Next furniture"
        :aria-disabled="layerTimelineBusy"
        @click="next"
      >
        <ArrowRight aria-hidden="true" :size="18" :stroke-width="1.7" />
      </button>
    </div>
    <button
      class="decor-hero-next-card"
      type="button"
      :aria-disabled="layerTimelineBusy"
      @click="next"
    >
      <img
        :src="
          properties.resolveAsset(
            data.slides[(visibleIndex + 1) % data.slides.length]!.thumbAssetId,
          )
        "
        alt=""
        width="200"
        height="115"
      />
      <span>Next</span>
    </button>
    <div class="decor-hero-more">
      <span>More information</span>
      <button type="button" aria-label="More information about this furniture">
        <i class="decor-bootstrap-icon decor-bootstrap-info" aria-hidden="true"></i>
      </button>
      <span class="decor-hero-tooltip" role="tooltip"
        >The three-seater works not just as the primary seating option, but also as an elegant
        statement piece.</span
      >
    </div>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>
