<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
const brandCopies = computed(() => (presentation.value.brands === "decor-continuous" ? 2 : 1));
import { resolveHomeAsset } from "./fixture-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    class="half-section border-bottom border-color-extra-medium-gray"
    data-home-section="brands"
    :data-presentation-variant="presentation.brands"
  >
    <div class="container">
      <div
        class="row row-cols-2 row-cols-md-5 row-cols-sm-3 position-relative justify-content-center"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "scale": [0.8, 1], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
      >
        <template v-if="presentation.brands === 'decor-continuous'">
          <div
            v-for="copy in brandCopies"
            :key="copy"
            class="fashion-store-brand-sequence"
            :aria-hidden="copy === 2 ? 'true' : undefined"
          >
            <div
              v-for="brand in data.brands"
              :key="`${copy}-${brand.name}`"
              class="col text-center sm-mb-30px"
            >
              <span
                ><img class="h-30px" :alt="brand.name" :src="sourceAsset(brand.sourceImage)"
              /></span>
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="brand in data.brands" :key="brand.name" class="col text-center sm-mb-30px">
            <span
              ><img class="h-30px" :alt="brand.name" :src="sourceAsset(brand.sourceImage)"
            /></span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
