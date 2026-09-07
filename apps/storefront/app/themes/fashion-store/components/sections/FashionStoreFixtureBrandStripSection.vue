<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
import { resolveHomeAsset } from "./fixture-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    class="half-section border-bottom border-color-extra-medium-gray"
    data-home-section="brands"
  >
    <div class="container">
      <div
        class="row row-cols-2 row-cols-md-5 row-cols-sm-3 position-relative justify-content-center"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "scale": [0.8, 1], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
      >
        <div class="col text-center sm-mb-30px">
          <span
            ><img
              class="h-30px"
              v-bind:alt="data.brands[0].name"
              v-bind:src="sourceAsset(data.brands[0].sourceImage)"
          /></span>
        </div>

        <div class="col text-center sm-mb-30px">
          <span
            ><img
              class="h-30px"
              v-bind:alt="data.brands[1].name"
              v-bind:src="sourceAsset(data.brands[1].sourceImage)"
          /></span>
        </div>

        <div class="col text-center sm-mb-30px">
          <span
            ><img
              class="h-30px"
              v-bind:alt="data.brands[2].name"
              v-bind:src="sourceAsset(data.brands[2].sourceImage)"
          /></span>
        </div>

        <div class="col text-center xs-mb-30px">
          <span
            ><img
              class="h-30px"
              v-bind:alt="data.brands[3].name"
              v-bind:src="sourceAsset(data.brands[3].sourceImage)"
          /></span>
        </div>

        <div class="col text-center">
          <span
            ><img
              class="h-30px"
              v-bind:alt="data.brands[4].name"
              v-bind:src="sourceAsset(data.brands[4].sourceImage)"
          /></span>
        </div>
      </div>
    </div>
  </section>
</template>
