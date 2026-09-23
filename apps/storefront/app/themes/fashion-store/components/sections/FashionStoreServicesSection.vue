<script setup lang="ts">
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeFoundation,
  resolveFashionStoreHomeSectionContext,
} from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const foundation = computed(() =>
  resolveFashionStoreHomeFoundation(properties.viewModel, properties.instance),
);
</script>

<template>
  <section
    v-if="foundation.services.length > 0"
    class="half-section"
    data-home-section="services"
    :data-presentation-variant="context.presentation.services"
  >
    <div class="container">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-4 row-cols-md-2 row-cols-sm-2"
        data-anime='{ "el": "childs", "translateX": [30, 0], "opacity": [0,1], "duration": 800, "delay": 200, "staggervalue": 300, "easing": "easeOutQuad" }'
      >
        <div
          v-for="(service, index) in foundation.services"
          :key="service.title"
          class="col icon-with-text-style-01"
          :class="{
            'md-mb-35px': index < 2,
            'xs-mb-35px': index === 2,
          }"
        >
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <FashionStoreIcon
                :name="service.icon"
                class="icon-large text-dark-gray"
                :stroke-width="1.5"
              />
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{ service.title }}</span>
              <p class="fs-16 lh-24 text-dark-gray">{{ service.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
