<script setup lang="ts">
import { fashionStoreHomeCategories as categories } from "./home-content";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";
import { resolveLiveHomeData } from "./live-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const viewModel = computed(() => resolveLiveHomeData(properties.viewModel));
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
import { resolveHomeAsset } from "./live-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    data-home-section="categories"
    class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0"
    :data-presentation-variant="presentation.categories"
  >
    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-0">
      <div v-for="category in categories" :key="category[0]" class="col categories-style-02">
        <a :href="viewModel.featuredCollection.href" data-fashion-store-route>
          <img
            :src="sourceAsset(category[1])"
            :alt="category[0]"
            width="600"
            height="765"
            class="w-100"
          />
          <span class="d-block alt-font fw-600 text-dark-gray fs-20 mt-15px">{{
            category[0]
          }}</span>
        </a>
      </div>
    </div>
  </section>
</template>
