<script setup lang="ts">
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
</script>

<template>
  <section class="half-section" data-home-section="services">
    <div class="container">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-4 row-cols-md-2 row-cols-sm-2"
        data-anime='{ "el": "childs", "translateX": [30, 0], "opacity": [0,1], "duration": 800, "delay": 200, "staggervalue": 300, "easing": "easeOutQuad" }'
      >
        <div class="col icon-with-text-style-01 md-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <FashionStoreIcon name="package" class="icon-large text-dark-gray" />
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[0].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[0].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01 md-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <FashionStoreIcon name="refresh-cw" class="icon-large text-dark-gray" />
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[1].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[1].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01 xs-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <FashionStoreIcon name="credit-card" class="icon-large text-dark-gray" />
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[2].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[2].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <FashionStoreIcon name="phone" class="icon-large text-dark-gray" />
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[3].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[3].description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
