<script setup lang="ts">
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeEditorial,
  resolveFashionStoreHomeSectionContext,
  resolveHomeAsset,
} from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const editorial = computed(() => resolveFashionStoreHomeEditorial(properties.viewModel));

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0"
    data-home-section="categories"
    :data-presentation-variant="context.presentation.categories"
  >
    <div class="container-fluid">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-2 row-cols-md-2"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "perspective": [1200,1200], "scale": [1.1, 1], "rotateX": [50, 0], "opacity": [0,1], "duration": 400, "delay": 100, "staggervalue": 200, "easing": "easeOutQuad" }'
      >
        <div
          v-for="(category, index) in editorial.categories"
          :key="category.name"
          class="col categories-style-02"
          :class="{ 'lg-mb-30px': index < 2, 'sm-mb-30px': index === 2 }"
        >
          <div class="categories-box">
            <a :href="category.href" data-fashion-store-route :aria-label="`View ${category.name}`">
              <img class="sm-w-100" alt="" :src="sourceAsset(category.sourceImage)" />
            </a>
            <div
              v-if="category.itemCount"
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ category.itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                :href="category.href"
                data-fashion-store-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" :data-text="category.name">{{
                    category.name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
