<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
const marqueeMessages = computed(() => data.value.marquee);
</script>

<template>
  <section
    class="p-0 border-top border-bottom border-color-extra-medium-gray"
    data-home-section="marquee"
  >
    <div class="container-fluid">
      <div class="row position-relative">
        <div
          class="col swiper text-center swiper-width-auto"
          data-slider-options='{ "slidesPerView": "auto", "spaceBetween":0, "speed": 10000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":0, "disableOnInteraction": false }, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "effect": "slide" }'
        >
          <div class="swiper-wrapper marquee-slide" data-fashion-store-marquee>
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
