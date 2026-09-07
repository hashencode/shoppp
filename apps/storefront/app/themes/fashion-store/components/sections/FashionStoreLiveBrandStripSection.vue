<script setup lang="ts">
import { fashionStoreHomeBrands as brands } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveHomeAsset } from "./live-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    data-home-section="brands"
    class="half-section border-bottom border-color-extra-medium-gray"
  >
    <div class="container">
      <div class="row row-cols-2 row-cols-md-5 align-items-center text-center">
        <div v-for="[brand, image] in brands" :key="brand" class="col">
          <img :src="sourceAsset(image)" :alt="brand" width="160" height="80" />
        </div>
      </div>
    </div>
  </section>
</template>
