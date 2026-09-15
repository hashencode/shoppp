<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeFoundation,
  resolveFashionStoreHomeSectionContext,
} from "./home-section-context";
import { useFashionStoreMotionViewport } from "../../composables/useFashionStoreMotionViewport";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const foundation = computed(() => resolveFashionStoreHomeFoundation(properties.viewModel));
const marqueeMessages = computed(() => foundation.value.marquee);
const root = ref<HTMLElement>();
const viewportVisible = useFashionStoreMotionViewport(root);
const documentHidden = ref(false);
const reducedMotion = ref(false);
let reducedMotionQuery: MediaQueryList | undefined;
const motionPauseReason = computed(() =>
  [
    viewportVisible.value ? "" : "viewport-hidden",
    documentHidden.value ? "document-hidden" : "",
    reducedMotion.value ? "reduced-motion" : "",
  ]
    .filter(Boolean)
    .join(","),
);

function updateMotionPauseReasons(): void {
  documentHidden.value = document.hidden;
  reducedMotion.value = reducedMotionQuery?.matches === true;
}

onMounted(() => {
  reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotionQuery.addEventListener("change", updateMotionPauseReasons);
  document.addEventListener("visibilitychange", updateMotionPauseReasons);
  updateMotionPauseReasons();
});

onBeforeUnmount(() => {
  reducedMotionQuery?.removeEventListener("change", updateMotionPauseReasons);
  document.removeEventListener("visibilitychange", updateMotionPauseReasons);
});
</script>

<template>
  <section
    ref="root"
    class="p-0 border-top border-bottom border-color-extra-medium-gray"
    data-home-section="marquee"
    :data-presentation-variant="context.presentation.marquee"
  >
    <div class="container-fluid">
      <div class="row position-relative">
        <div
          class="col swiper text-center swiper-width-auto"
          data-slider-options='{ "slidesPerView": "auto", "spaceBetween":0, "speed": 10000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":0, "disableOnInteraction": false }, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "effect": "slide" }'
        >
          <div
            class="swiper-wrapper marquee-slide"
            data-fashion-store-marquee
            :data-motion-paused="motionPauseReason"
          >
            <div v-for="(message, index) in marqueeMessages" :key="index" class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ message }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
