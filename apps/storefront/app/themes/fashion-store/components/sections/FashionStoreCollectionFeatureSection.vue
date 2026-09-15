<script setup lang="ts">
import FashionStoreCarousel from "../shared/FashionStoreCarousel.vue";
import FashionStoreIcon from "../shared/FashionStoreIcon.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeEditorial,
  resolveFashionStoreHomeSectionContext,
  resolveHomeAsset,
} from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const editorial = computed(() => resolveFashionStoreHomeEditorial(properties.viewModel));
const collectionIndex = ref(0);
const collectionSlides = computed(() => {
  const items = editorial.value.collection.items;
  return items.length > 1 ? [...items, ...items] : items;
});

function collectionSlide(index: number) {
  const slide = collectionSlides.value[index] ?? editorial.value.collection.items[0];
  if (!slide) throw new Error("Fashion Store collection carousel requires a rendered slide.");
  return slide;
}

function sourceAsset(sourcePath: string): string {
  return resolveHomeAsset(properties.resolveAsset, sourcePath);
}
</script>

<template>
  <section
    class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0"
    data-home-section="collection"
    :data-presentation-variant="context.presentation.collection"
  >
    <div class="container-fluid">
      <div class="row align-items-center">
        <div class="col-lg-3 ps-5 pe-5 xl-pe-0 lg-ps-0 text-center text-lg-start md-mb-40px">
          <div class="mb-10px">
            <span class="text-dark-gray fw-500 text-highlight"
              >{{ editorial.collection.eyebrow }}<span class="bg-base-color h-8px bottom-0px"></span
            ></span>
          </div>
          <h2 class="alt-font lh-50 text-dark-gray ls-minus-1px mb-15px">
            {{ editorial.collection.title.lead }}
            <span v-if="editorial.collection.title.emphasis" class="fw-600">{{
              editorial.collection.title.emphasis
            }}</span>
          </h2>
          <p v-if="editorial.collection.description" class="xs-pe-15px xs-ps-15px">
            {{ editorial.collection.description }}
          </p>
          <a
            :href="editorial.collection.href"
            data-fashion-store-route
            class="btn btn-dark-gray btn-box-shadow btn-medium"
            >View collection</a
          >
        </div>
        <div v-if="editorial.collection.items.length" class="col-12 col-lg-9 position-relative">
          <div
            class="outside-box-right-10 lg-outside-box-right-20 md-outside-box-right-25 xs-outside-box-right-0"
          >
            <FashionStoreCarousel
              class="slider-three-slide"
              data-fashion-store-collection-carousel
              :slide-count="collectionSlides.length"
              :semantic-slide-count="editorial.collection.items.length"
              :slides-per-view="1"
              :space-between="30"
              :speed-ms="650"
              :autoplay-ms="4_000"
              :loop="editorial.collection.items.length > 1"
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
                        v-if="collectionSlide(index).subtitle"
                        class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                        >{{ collectionSlide(index).subtitle }}</span
                      >
                      <a
                        :href="editorial.collection.href"
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
                      :href="editorial.collection.href"
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
