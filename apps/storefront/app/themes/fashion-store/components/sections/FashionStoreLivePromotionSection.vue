<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveLiveHomeData } from "./live-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const viewModel = computed(() => resolveLiveHomeData(properties.viewModel));
</script>

<template>
  <section data-home-section="promotion" class="p-15px bg-dark-gray text-white">
    <div class="container text-center">
      <p class="alt-font mb-0">
        New-season pieces are available now.
        <a
          :href="viewModel.featuredCollection.href"
          data-fashion-store-route
          class="text-white text-decoration-line-bottom"
          >Shop the collection</a
        >
      </p>
    </div>
  </section>
</template>
