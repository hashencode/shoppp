<script setup lang="ts">
import { Autoplay, Keyboard } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper/types";
import { Swiper, SwiperSlide } from "swiper/vue";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { fashionStoreAssetId } from "../../resources";

type PauseReason = "document-hidden" | "focus" | "hover" | "lightbox" | "reduced-motion";

const properties = defineProps<{
  images: readonly string[];
  paused: boolean;
  resolveAsset: ThemeAssetResolver;
}>();

const emit = defineEmits<{
  activeIndexChange: [index: number];
  open: [];
}>();

const mainSwiper = shallowRef<SwiperInstance>();
const thumbnailSwiper = shallowRef<SwiperInstance>();
const activeIndex = ref(0);
const pauseReasons = reactive(new Set<PauseReason>());
const loopEnabled = computed(() => properties.images.length > 1);
let reducedMotionQuery: MediaQueryList | undefined;
let touchStart: { x: number; y: number } | undefined;

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function syncAutoplay(): void {
  const swiper = mainSwiper.value;
  if (!swiper?.autoplay || !loopEnabled.value) return;
  if (pauseReasons.size > 0) swiper.autoplay.stop();
  else swiper.autoplay.start();
}

function setPause(reason: PauseReason, paused: boolean): void {
  if (pauseReasons.has(reason) === paused) return;
  if (paused) pauseReasons.add(reason);
  else pauseReasons.delete(reason);
  syncAutoplay();
}

function syncActiveIndex(swiper = mainSwiper.value): void {
  if (!swiper) return;
  const index = swiper.realIndex;
  activeIndex.value = index;
  thumbnailSwiper.value?.slideTo(index);
  emit("activeIndexChange", index);
}

function handleMainSwiper(swiper: SwiperInstance): void {
  mainSwiper.value = swiper;
  syncActiveIndex(swiper);
  syncAutoplay();
}

function handleThumbnailSwiper(swiper: SwiperInstance): void {
  thumbnailSwiper.value = swiper;
  swiper.slideTo(activeIndex.value);
}

function select(index: number): void {
  const swiper = mainSwiper.value;
  if (!swiper || properties.images.length === 0) return;
  const normalizedIndex =
    ((index % properties.images.length) + properties.images.length) % properties.images.length;
  if (loopEnabled.value) swiper.slideToLoop(normalizedIndex);
  else swiper.slideTo(normalizedIndex);
}

function handleVisibility(): void {
  setPause("document-hidden", document.hidden);
}

function handleReducedMotion(): void {
  setPause("reduced-motion", reducedMotionQuery?.matches === true);
}

function handleFocusIn(): void {
  setPause("focus", true);
  mainSwiper.value?.keyboard?.enable();
}

function handleFocusOut(event: FocusEvent): void {
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (currentTarget?.contains(event.relatedTarget as Node | null)) return;
  setPause("focus", false);
  mainSwiper.value?.keyboard?.disable();
}

function handleImageTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  if (touch) touchStart = { x: touch.clientX, y: touch.clientY };
}

function handleImageTouchEnd(event: TouchEvent): void {
  const start = touchStart;
  touchStart = undefined;
  const touch = event.changedTouches[0];
  if (!start || !touch) return;
  if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) <= 10) emit("open");
}

watch(
  () => properties.paused,
  (paused) => setPause("lightbox", paused),
  { immediate: true },
);

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

defineExpose({ select });
</script>

<template>
  <div class="row overflow-hidden position-relative">
    <div class="col-12 col-lg-10 position-relative order-lg-2 product-image ps-30px md-ps-15px">
      <Swiper
        class="product-image-slider"
        tabindex="0"
        role="group"
        aria-label="Product gallery"
        :modules="[Autoplay, Keyboard]"
        :loop="loopEnabled"
        :autoplay="loopEnabled ? { delay: 2000, disableOnInteraction: false } : false"
        :keyboard="{ enabled: false, onlyInViewport: true }"
        :speed="300"
        :watch-overflow="true"
        :prevent-clicks="true"
        :prevent-clicks-propagation="true"
        :data-gallery-index="activeIndex"
        @swiper="handleMainSwiper"
        @slide-change="syncActiveIndex"
        @mouseenter="setPause('hover', true)"
        @mouseleave="setPause('hover', false)"
        @focusin="handleFocusIn"
        @focusout="handleFocusOut"
        @keydown.enter.prevent="emit('open')"
        @keydown.space.prevent="emit('open')"
      >
        <SwiperSlide
          v-for="(image, index) in images"
          :key="image"
          class="gallery-box"
          :inert="index !== activeIndex"
          :aria-hidden="index === activeIndex ? undefined : 'true'"
        >
          <button
            type="button"
            aria-label="Open product image preview"
            @click="emit('open')"
            @touchstart.passive="handleImageTouchStart"
            @touchend="handleImageTouchEnd"
            @touchcancel="touchStart = undefined"
          >
            <img
              class="w-100"
              :src="sourceAsset(image)"
              alt=""
              width="600"
              height="765"
              draggable="false"
            />
          </button>
        </SwiperSlide>
      </Swiper>
    </div>
    <div class="col-12 col-lg-2 order-lg-1 position-relative single-product-thumb">
      <Swiper
        class="product-image-thumb slider-vertical"
        :slides-per-view="4"
        :space-between="15"
        :breakpoints="{ 992: { direction: 'vertical', slidesPerView: 3 } }"
        :watch-overflow="true"
        @swiper="handleThumbnailSwiper"
      >
        <SwiperSlide
          v-for="(image, index) in images"
          :key="image"
          :class="{ 'swiper-slide-thumb-active': index === activeIndex }"
        >
          <img
            class="w-100"
            :src="sourceAsset(image)"
            alt=""
            width="600"
            height="765"
            draggable="false"
          />
          <button
            type="button"
            class="fashion-product-thumb-control"
            :aria-label="`View product image ${index + 1}`"
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="select(index)"
          ></button>
        </SwiperSlide>
      </Swiper>
    </div>
  </div>
</template>
