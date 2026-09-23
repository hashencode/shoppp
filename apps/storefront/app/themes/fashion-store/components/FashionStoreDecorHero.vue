<script setup lang="ts">
import { Autoplay, EffectFade, Keyboard } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper/types";
import { Swiper, SwiperSlide } from "swiper/vue";

import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { FashionStoreDecorHeroSlide } from "../contracts/home-hero";
import { fashionStoreDecorHeroContract, fashionStoreDecorHeroSlides } from "../contracts/home-hero";
import { useFashionStoreDecorHeroMotion } from "../composables/useFashionStoreDecorHeroMotion";
import { useFashionStoreMotionViewport } from "../composables/useFashionStoreMotionViewport";
import plusJakartaFontUrl from "../assets/hero/plus-jakarta-sans-latin.woff2?url";
import FashionStoreIcon from "./shared/FashionStoreIcon.vue";

useHead({
  link: [
    {
      as: "font",
      crossorigin: "anonymous",
      href: plusJakartaFontUrl,
      key: "fashion-store-plus-jakarta-font",
      rel: "preload",
      type: "font/woff2",
    },
  ],
});

type RenderedHeroSlide = Omit<FashionStoreDecorHeroSlide, "id" | "price" | "title"> & {
  id: string;
  price: string;
  title: string;
};
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  slides?: readonly RenderedHeroSlide[];
}>();
const slides = computed(() => properties.slides ?? fashionStoreDecorHeroSlides);
const root = ref<HTMLElement>();
const swiper = shallowRef<SwiperInstance>();
const activeIndex = ref(0);
const initialized = ref(false);
const completedCycle = ref(false);
const documentHidden = ref(false);
const motion = useFashionStoreDecorHeroMotion(root);
const viewportVisible = useFashionStoreMotionViewport(root);
type MotionPauseReason = "document-hidden" | "reduced-motion" | "viewport-hidden";
const motionPauseReasons = computed(() => {
  const reasons = new Set<MotionPauseReason>();
  if (documentHidden.value) reasons.add("document-hidden");
  if (motion.reducedMotion.value) reasons.add("reduced-motion");
  if (!viewportVisible.value) reasons.add("viewport-hidden");
  return reasons;
});
const motionPauseReason = computed(() => [...motionPauseReasons.value].join(","));
const runtimeStatus = computed(() =>
  initialized.value && motion.ready.value ? "operational" : "static",
);

function handleSwiper(instance: SwiperInstance): void {
  swiper.value = instance;
  instance.autoplay?.stop();
  initialized.value = true;
  syncSuspension();
  syncInputBoundary();
}

function syncSuspension(): void {
  const instance = swiper.value;
  if (!instance?.autoplay) return;
  if (runtimeStatus.value !== "operational" || motionPauseReasons.value.size > 0) {
    instance.autoplay.stop();
  } else if (!completedCycle.value) instance.autoplay.start();
  motion.setSuspended(motionPauseReasons.value.size > 0);
}

function syncInputBoundary(): void {
  const instance = swiper.value;
  if (!instance) return;
  const enabled = runtimeStatus.value === "operational" && motion.phase.value === "idle";
  instance.allowTouchMove = enabled;
  instance.allowSlideNext = enabled;
  instance.allowSlidePrev = enabled;
  if (enabled) instance.keyboard.enable();
  else instance.keyboard.disable();
}

function handleSlideChange(instance: SwiperInstance): void {
  if (!motion.ready.value) {
    instance.slideTo(0, 0, false);
    return;
  }
  const prior = activeIndex.value;
  activeIndex.value = instance.realIndex;
  if (prior === slides.value.length - 1 && activeIndex.value === 0) {
    completedCycle.value = true;
    instance.autoplay?.stop();
  }
  const slide = instance.slides[instance.activeIndex] as HTMLElement | undefined;
  if (!slide) return;
  instance.autoplay?.stop();
  motion.animate(
    slide,
    () => {
      syncSuspension();
      syncInputBoundary();
    },
    () => {
      instance.slideTo(0, 0, false);
      activeIndex.value = 0;
      instance.autoplay?.stop();
      syncInputBoundary();
    },
  );
}

function requestNext(): void {
  if (runtimeStatus.value !== "operational" || motion.phase.value !== "idle") return;
  swiper.value?.slideNext();
}

function updateDocumentVisibility(): void {
  documentHidden.value = document.hidden;
}

onMounted(() => {
  updateDocumentVisibility();
  document.addEventListener("visibilitychange", updateDocumentVisibility);
});
onBeforeUnmount(() => document.removeEventListener("visibilitychange", updateDocumentVisibility));
watch([motion.ready, motionPauseReasons], syncSuspension);
watch([motion.ready, motion.phase], syncInputBoundary, { flush: "sync" });
</script>

<template>
  <section ref="root" class="fashion-store-decor-hero" aria-label="Featured furniture">
    <Swiper
      id="fashion-store-decor-hero"
      :modules="[Autoplay, EffectFade, Keyboard]"
      :slides-per-view="1"
      :speed="fashionStoreDecorHeroContract.transitionMs"
      :threshold="fashionStoreDecorHeroContract.swipeThresholdPx"
      :autoplay="{
        delay: fashionStoreDecorHeroContract.autoplayMs,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
      }"
      :keyboard="{ enabled: motion.ready.value, onlyInViewport: true }"
      :allow-touch-move="motion.ready.value"
      :lazy-preload-prev-next="fashionStoreDecorHeroContract.lazyPreloadPrevNext"
      :rewind="true"
      effect="fade"
      :fade-effect="{ crossFade: true }"
      class="fashion-store-decor-hero__swiper full-screen"
      :data-action-phase="motion.phase.value"
      :data-active-slide="activeIndex + 1"
      :data-motion-active-index="activeIndex"
      :data-motion-phase="motion.phase.value"
      :data-motion-ready="runtimeStatus === 'operational' ? 'true' : 'false'"
      :data-motion-paused="motionPauseReason"
      :data-runtime-status="runtimeStatus"
      @swiper="handleSwiper"
      @real-index-change="handleSlideChange"
    >
      <SwiperSlide
        v-for="(slide, index) in slides"
        :key="slide.id"
        class="fashion-store-hero-slide"
        :data-active="activeIndex === index ? 'true' : 'false'"
      >
        <article
          class="fashion-store-decor-hero__slide"
          :data-hero-slide="index + 1"
          :style="{ backgroundColor: slide.background, color: slide.foreground }"
        >
          <div class="fashion-store-decor-hero__shape" data-hero-layer="shape"></div>
          <picture class="fashion-store-decor-hero__pattern" data-hero-layer="pattern">
            <source
              media="(max-width: 778px)"
              :srcset="properties.resolveAsset(slide.patternMobile)"
            />
            <img
              :src="properties.resolveAsset(slide.patternDesktop)"
              alt=""
              :loading="index === 0 ? 'eager' : 'lazy'"
              :fetchpriority="index === 0 ? 'high' : 'auto'"
            />
          </picture>
          <img
            class="fashion-store-decor-hero__product"
            data-hero-layer="product"
            :src="properties.resolveAsset(slide.product)"
            alt=""
            :loading="index === 0 ? 'eager' : 'lazy'"
            :fetchpriority="index === 0 ? 'high' : 'auto'"
          />
          <div class="fashion-store-decor-hero__copy">
            <component :is="index === 0 ? 'h1' : 'h2'" data-hero-layer="title">{{
              slide.title
            }}</component>
            <p data-hero-layer="price">
              Price starting from <strong>{{ slide.price }}</strong>
            </p>
            <component
              :is="slide.href ? 'a' : 'span'"
              :href="slide.href || undefined"
              class="btn btn-dark-gray btn-large btn-round-edge btn-box-shadow"
              :data-fashion-store-route="slide.href ? '' : undefined"
              data-hero-layer="cta"
              ><FashionStoreIcon name="shopping-bag" />Shop Now</component
            >
          </div>
          <div class="fashion-store-decor-hero__next">
            <button
              type="button"
              data-hero-layer="next"
              aria-label="Show next Hero slide"
              @click="requestNext"
            >
              Next
            </button>
            <button
              type="button"
              class="fashion-store-decor-hero__thumb"
              data-hero-layer="thumbnail"
              aria-label="Show next Hero slide"
              :style="{
                backgroundImage:
                  activeIndex === index
                    ? `url('${properties.resolveAsset(
                        slides[(index + 1) % slides.length]!.thumb,
                      )}')`
                    : 'none',
              }"
              @click="requestNext"
            ></button>
          </div>
        </article>
      </SwiperSlide>
    </Swiper>
  </section>
</template>
