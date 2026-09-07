<script setup lang="ts">
import { fashionStoreHomeCollectionImages as collectionImages } from "./home-content";
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
    data-home-section="collection"
    :data-presentation-variant="presentation.collection"
    class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0"
  >
    <div class="container-fluid py-70px">
      <div class="d-flex justify-content-between align-items-end mb-30px">
        <div>
          <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">Curated for you</p>
          <h2 class="alt-font fw-600 text-dark-gray mb-0">
            {{ viewModel.featuredCollection.name }}
          </h2>
        </div>
        <a :href="viewModel.featuredCollection.href" data-fashion-store-route class="text-dark-gray"
          >View collection</a
        >
      </div>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4">
        <div v-for="(image, index) in collectionImages" :key="image" class="col swiper-slide">
          <a :href="viewModel.featuredCollection.href" data-fashion-store-route>
            <img
              :src="sourceAsset(image)"
              :alt="`${viewModel.featuredCollection.name} look ${index + 1}`"
              width="600"
              height="760"
              class="w-100"
            />
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
