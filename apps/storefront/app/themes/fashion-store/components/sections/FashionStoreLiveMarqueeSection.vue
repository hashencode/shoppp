<script setup lang="ts">
import { fashionStoreHomeMarquee as marquee } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
</script>

<template>
  <section
    data-home-section="marquee"
    :data-presentation-variant="presentation.marquee"
    class="p-0 border-top border-bottom border-color-extra-medium-gray overflow-hidden"
  >
    <div
      class="d-flex flex-nowrap py-25px"
      aria-label="Fashion highlights"
      data-fashion-store-marquee
    >
      <span
        v-for="(message, index) in marquee"
        :key="`${message}-${index}`"
        class="alt-font text-uppercase fw-600 fs-18 me-50px swiper-slide text-dark-gray"
        >{{ message }}</span
      >
    </div>
  </section>
</template>
