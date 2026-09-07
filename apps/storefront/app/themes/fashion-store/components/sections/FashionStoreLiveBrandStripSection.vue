<script setup lang="ts">
import { fashionStoreHomeBrands as brands } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveHomeAsset } from "./live-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
const brandCopies = computed(() => (presentation.value.brands === "decor-continuous" ? 2 : 1));

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    data-home-section="brands"
    :data-presentation-variant="presentation.brands"
    class="half-section border-bottom border-color-extra-medium-gray"
  >
    <div class="container">
      <div class="row row-cols-2 row-cols-md-5 align-items-center text-center">
        <template v-if="presentation.brands === 'decor-continuous'">
          <div
            v-for="copy in brandCopies"
            :key="copy"
            class="fashion-store-brand-sequence"
            :aria-hidden="copy === 2 ? 'true' : undefined"
          >
            <div v-for="[brand, image] in brands" :key="`${copy}-${brand}`" class="col">
              <img :src="sourceAsset(image)" :alt="brand" width="160" height="80" />
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="[brand, image] in brands" :key="brand" class="col">
            <img :src="sourceAsset(image)" :alt="brand" width="160" height="80" />
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
