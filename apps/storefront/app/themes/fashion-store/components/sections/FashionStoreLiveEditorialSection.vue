<script setup lang="ts">
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreHomeMagazine as magazine } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveHomeAsset } from "./live-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    data-home-section="magazine"
    class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0"
    :data-presentation-variant="presentation.editorial"
  >
    <div class="container-fluid pt-70px">
      <div class="text-center mb-40px">
        <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">Stories and ideas</p>
        <h2 class="alt-font fw-600 text-dark-gray">Magazine</h2>
      </div>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4">
        <article v-for="entry in magazine" :key="entry[0]" class="col grid-item">
          <a :href="fashionStoreRoutePaths.article" data-fashion-store-route>
            <img
              :src="sourceAsset(entry[1])"
              :alt="entry[0]"
              width="600"
              height="420"
              class="w-100"
            />
            <h3 class="alt-font fs-20 fw-600 text-dark-gray mt-20px">{{ entry[0] }}</h3>
          </a>
        </article>
      </div>
    </div>
  </section>
</template>
