<script setup lang="ts">
import FashionStoreCarousel from "../shared/FashionStoreCarousel.vue";
import type { FashionStoreHomeData } from "../../fixtures/home";
import { fashionStoreRoutePaths } from "../../page-contracts";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { resolveFixtureHomeData } from "./fixture-home-section-context";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const data = computed(() => resolveFixtureHomeData(properties.viewModel));
const presentation = computed(() => resolveFashionStoreHomePresentation(properties.viewModel));
import { resolveHomeAsset } from "./fixture-home-section-context";

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
const collectionIndex = ref(0);
const collectionSlides = computed(() =>
  data.value.collection.length > 1
    ? [...data.value.collection, ...data.value.collection]
    : data.value.collection,
);
function collectionSlide(index: number): FashionStoreHomeData["collection"][number] {
  return collectionSlides.value[index] ?? data.value.collection[0];
}
</script>

<template>
  <section
    class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0"
    data-home-section="collection"
    :data-presentation-variant="presentation.collection"
  >
    <div class="container-fluid">
      <div class="row align-items-center">
        <div class="col-lg-3 ps-5 pe-5 xl-pe-0 lg-ps-0 text-center text-lg-start md-mb-40px">
          <div class="mb-10px">
            <span class="text-dark-gray fw-500 text-highlight"
              >Lookbook 2023<span class="bg-base-color h-8px bottom-0px"></span
            ></span>
          </div>
          <h2 class="alt-font lh-50 text-dark-gray ls-minus-1px mb-15px">
            New arrival <span class="fw-600">collection</span>
          </h2>
          <p class="xs-pe-15px xs-ps-15px">
            Flash summer sale 70% off on selected collection for him.
          </p>
          <a
            :href="fashionStoreRoutePaths.collection"
            data-fashion-store-route
            class="btn btn-dark-gray btn-box-shadow btn-medium"
            >View collection</a
          >
        </div>
        <div class="col-12 col-lg-9 position-relative">
          <div
            class="outside-box-right-10 lg-outside-box-right-20 md-outside-box-right-25 xs-outside-box-right-0"
          >
            <FashionStoreCarousel
              class="slider-three-slide"
              data-fashion-store-collection-carousel
              :slide-count="collectionSlides.length"
              :semantic-slide-count="data.collection.length"
              :slides-per-view="1"
              :space-between="30"
              :speed-ms="650"
              :autoplay-ms="4_000"
              :loop="data.collection.length > 1"
              :breakpoints="{
                576: { slidesPerView: 2 },
                768: { slidesPerView: 3 },
                1400: { slidesPerView: 4 },
              }"
              :data-collection-index="collectionIndex"
              tabindex="0"
              aria-label="New arrival collection carousel"
              @active-index-change="collectionIndex = $event"
            >
              <template #default="{ index }">
                <div
                  class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                >
                  <img alt="" :src="sourceAsset(collectionSlide(index).sourceImage)" />
                  <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                  <div
                    class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                  >
                    <div
                      class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                    >
                      <span class="text-white fw-500 fs-22">{{ collectionSlide(index).name }}</span>
                      <span
                        class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                        >{{ collectionSlide(index).subtitle }}</span
                      >
                      <a
                        :href="fashionStoreRoutePaths.collection"
                        data-fashion-store-route
                        class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                        >Explore collection</a
                      >
                      <span
                        class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                        ><FashionStoreIcon
                          name="arrow-right"
                          class="text-dark-gray icon-very-medium"
                      /></span>
                    </div>
                    <div
                      class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                    ></div>
                    <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                    <a
                      :href="fashionStoreRoutePaths.collection"
                      data-fashion-store-route
                      :aria-label="`Explore ${collectionSlide(index).name}`"
                      class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                    ></a>
                  </div>
                </div>
              </template>
            </FashionStoreCarousel>
          </div>
        </div>
      </div>
    </div>
    <div
      class="fs-180 lg-fs-150 md-fs-130 fw-700 position-absolute bottom-minus-50px md-bottom-minus-40px ls-minus-5px left-0px right-0px text-center w-100 opacity-1 d-none d-md-block"
      aria-hidden="true"
      data-bottom-top="transform:scale(1, 1) translate3d(0px, 0px, 0px);"
      data-top-bottom="transform:scale(1, 1) translate3d(-100px, 0px, 0px);"
    >
      new collection
    </div>
  </section>
</template>
