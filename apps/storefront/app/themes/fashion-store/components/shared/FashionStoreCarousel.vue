<script setup lang="ts">
import { Autoplay, Keyboard, Parallax } from "swiper/modules";
import type { Swiper as SwiperInstance, SwiperOptions } from "swiper/types";
import { Swiper, SwiperSlide } from "swiper/vue";

type PauseReason = "document-hidden" | "focus" | "hover" | "reduced-motion";

const properties = withDefaults(
  defineProps<{
    autoplayMs?: number;
    breakpoints?: SwiperOptions["breakpoints"];
    direction?: SwiperOptions["direction"];
    keyboard?: boolean;
    loop?: boolean;
    parallax?: boolean;
    rewind?: boolean;
    semanticSlideCount?: number;
    slideClass?: string;
    slideCount: number;
    slideMotionLayers?: boolean;
    slidesPerView?: SwiperOptions["slidesPerView"];
    spaceBetween?: SwiperOptions["spaceBetween"];
    speedMs?: number;
  }>(),
  {
    autoplayMs: 0,
    breakpoints: undefined,
    direction: "horizontal",
    keyboard: true,
    loop: false,
    parallax: false,
    rewind: false,
    semanticSlideCount: undefined,
    slideClass: undefined,
    slideMotionLayers: false,
    slidesPerView: 1,
    spaceBetween: 0,
    speedMs: 300,
  },
);

const emit = defineEmits<{
  activeIndexChange: [index: number];
}>();

const carousel = shallowRef<SwiperInstance>();
const activeIndex = ref(0);
const hydrated = ref(false);
const reducedMotion = ref(false);
const motionPhase = ref<"idle" | "transition">("idle");
const pauseReasons = reactive(new Set<PauseReason>());
const motionDirection = ref<"horizontal" | "vertical">(
  properties.direction === "vertical" ? "vertical" : "horizontal",
);
const enabledModules = computed(() => [
  ...(properties.autoplayMs > 0 ? [Autoplay] : []),
  ...(properties.keyboard ? [Keyboard] : []),
  ...(properties.parallax ? [Parallax] : []),
]);
const autoplay = computed<SwiperOptions["autoplay"]>(() =>
  properties.autoplayMs > 0
    ? {
        delay: properties.autoplayMs,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
      }
    : false,
);
const keyboard = computed<SwiperOptions["keyboard"]>(() =>
  properties.keyboard ? { enabled: false, onlyInViewport: true } : false,
);
const loopEnabled = computed(() => properties.loop && properties.slideCount > 1);
const semanticCount = computed(() => properties.semanticSlideCount ?? properties.slideCount);
const paused = computed(() => [...pauseReasons].join(","));
const effectiveSpeed = computed(() => (reducedMotion.value ? 0 : properties.speedMs));

let reducedMotionQuery: MediaQueryList | undefined;

function handleReducedMotion(): void {
  reducedMotion.value = reducedMotionQuery?.matches === true;
  if (carousel.value) carousel.value.params.speed = effectiveSpeed.value;
  setPause("reduced-motion", reducedMotion.value);
}

function handleVisibility(): void {
  setPause("document-hidden", document.hidden);
}

function semanticIndex(index: number): number {
  return semanticCount.value > 0 ? index % semanticCount.value : 0;
}

function syncActiveIndex(instance = carousel.value): void {
  if (!instance) return;
  const nextIndex = semanticIndex(instance.realIndex);
  activeIndex.value = nextIndex;
  emit("activeIndexChange", nextIndex);
}

function syncDirection(instance = carousel.value): void {
  if (!instance) return;
  motionDirection.value = instance.params.direction === "vertical" ? "vertical" : "horizontal";
}

function syncAutoplay(): void {
  const instance = carousel.value;
  if (!instance?.autoplay || properties.autoplayMs <= 0) return;
  if (pauseReasons.size > 0) instance.autoplay.stop();
  else instance.autoplay.start();
}

function setPause(reason: PauseReason, enabled: boolean): void {
  if (pauseReasons.has(reason) === enabled) return;
  if (enabled) pauseReasons.add(reason);
  else pauseReasons.delete(reason);
  syncAutoplay();
}

function handleSwiper(instance: SwiperInstance): void {
  carousel.value = instance;
  syncActiveIndex(instance);
  syncDirection(instance);
  hydrated.value = true;
  syncAutoplay();
}

function handleFocusIn(): void {
  if (pauseReasons.has("reduced-motion") && carousel.value) carousel.value.params.speed = 0;
  setPause("focus", true);
  carousel.value?.keyboard?.enable();
}

function handleFocusOut(event: FocusEvent): void {
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (currentTarget?.contains(event.relatedTarget as Node | null)) return;
  setPause("focus", false);
  carousel.value?.keyboard?.disable();
}

function select(index: number): void {
  const instance = carousel.value;
  if (!instance || properties.slideCount === 0) return;
  if (loopEnabled.value) instance.slideToLoop(index);
  else instance.slideTo(index);
}

function next(): void {
  carousel.value?.slideNext();
}

function previous(): void {
  carousel.value?.slidePrev();
}

onMounted(() => {
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  setPause("reduced-motion", reducedMotionQuery.matches);
  setPause("document-hidden", document.hidden);
  reducedMotionQuery.addEventListener("change", handleReducedMotion);
  document.addEventListener("visibilitychange", handleVisibility);
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener("change", handleReducedMotion);
  document.removeEventListener("visibilitychange", handleVisibility);
});

defineExpose({ next, previous, select, swiper: carousel });
</script>

<template>
  <Swiper
    :modules="enabledModules"
    :slides-per-view="properties.slidesPerView"
    :space-between="properties.spaceBetween"
    :speed="effectiveSpeed"
    :direction="properties.direction"
    :breakpoints="properties.breakpoints"
    :loop="loopEnabled"
    :loop-prevents-sliding="!pauseReasons.has('reduced-motion')"
    :long-swipes-ratio="0.25"
    :autoplay="autoplay"
    :keyboard="keyboard"
    :parallax="properties.parallax"
    :rewind="properties.rewind"
    :watch-overflow="true"
    :watch-slides-progress="true"
    :prevent-clicks="true"
    :prevent-clicks-propagation="true"
    :data-motion-active-index="activeIndex"
    :data-motion-autoplay-ms="properties.autoplayMs"
    :data-motion-direction="motionDirection"
    :data-motion-duration-ms="properties.speedMs"
    data-motion-easing="ease"
    :data-motion-paused="paused"
    :data-motion-phase="motionPhase"
    :data-motion-ready="hydrated"
    @swiper="handleSwiper"
    @slide-change="syncActiveIndex"
    @transition-start="motionPhase = 'transition'"
    @transition-end="motionPhase = 'idle'"
    @breakpoint="syncDirection"
    @mouseenter="setPause('hover', true)"
    @mouseleave="setPause('hover', false)"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
  >
    <SwiperSlide
      v-for="index in properties.slideCount"
      :key="index - 1"
      :class="properties.slideClass"
      :data-active="properties.slideMotionLayers && semanticIndex(index - 1) === activeIndex"
      :data-motion-layer="properties.slideMotionLayers ? 'slide' : undefined"
      :inert="properties.slideMotionLayers && semanticIndex(index - 1) !== activeIndex"
      :aria-hidden="
        properties.slideMotionLayers && semanticIndex(index - 1) !== activeIndex
          ? 'true'
          : undefined
      "
    >
      <slot :index="index - 1" />
    </SwiperSlide>
    <template #container-end>
      <slot name="container-end" />
    </template>
  </Swiper>
</template>
