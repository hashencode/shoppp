<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreContentData } from "../../fixtures/pages/content";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreAccordion from "../shared/FashionStoreAccordion.vue";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store About requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreContentData).about;
});
const accordionIndex = ref<number | null>(0);
const carouselIndex = ref(0);
const pointerStart = ref<number>();
let carouselTimer: ReturnType<typeof setInterval> | undefined;

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function moveCarousel(step: number): void {
  const count = data.value.carouselImages.length;
  carouselIndex.value = (carouselIndex.value + step + count) % count;
}

function handleCarouselKey(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  moveCarousel(event.key === "ArrowRight" ? 1 : -1);
}

function handlePointerDown(event: PointerEvent): void {
  pointerStart.value = event.clientX;
}

function handlePointerUp(event: PointerEvent): void {
  if (pointerStart.value === undefined) return;
  const distance = event.clientX - pointerStart.value;
  pointerStart.value = undefined;
  if (Math.abs(distance) >= 30) moveCarousel(distance < 0 ? 1 : -1);
}

onMounted(() => {
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    carouselTimer = setInterval(() => moveCarousel(1), 2_000);
  }
});

onBeforeUnmount(() => {
  if (carouselTimer) clearInterval(carouselTimer);
});
</script>

<template>
  <FashionStoreShell
    :announcement="data.announcement"
    :preload-image="sourceAsset('images/demo-fashion-store-about-01.jpg')"
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-about
      data-runtime-status="ready"
      :data-carousel-index="carouselIndex"
      :data-accordion-index="accordionIndex ?? 'closed'"
    >
      <FashionStorePageTitle title="About" />

      <section class="pt-0 ps-8 pe-8 lg-ps-3 lg-pe-3 position-relative xs-px-0 fashion-about-hero">
        <div class="container-fluid">
          <div class="row">
            <div class="col-12">
              <img
                :src="sourceAsset('images/demo-fashion-store-about-01.jpg')"
                class="w-100"
                alt=""
              />
              <div class="fashion-about-seal absolute-middle-left">
                <img
                  :src="sourceAsset('images/demo-fashion-store-about-03.png')"
                  class="position-absolute top-50 translate-middle-y"
                  alt=""
                />
                <img
                  :src="sourceAsset('images/demo-fashion-store-about-02.png')"
                  class="animation-rotation"
                  alt=""
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="pt-0 fashion-about-story">
        <div class="container">
          <div class="row">
            <div class="col-12 col-lg-5">
              <div class="alt-font text-dark-gray mb-15px fs-20">
                <span class="text-highlight"
                  >{{ data.story.eyebrow }}<span class="bg-base-color h-8px bottom-0px"></span
                ></span>
              </div>
              <h2 class="alt-font text-dark-gray fw-400 ls-minus-1px">
                The journey of <span class="fw-600">crafto lifestyle.</span>
              </h2>
            </div>
            <div class="col-12 col-lg-6 offset-lg-1 last-paragraph-no-margin">
              <p v-for="paragraph in data.story.body" :key="paragraph">{{ paragraph }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden position-relative p-0 fashion-about-carousel-section">
        <div class="container">
          <div class="absolute-middle-left w-100 h-2px bg-base-color"></div>
          <div class="row align-items-center">
            <div class="col-12 position-relative">
              <div
                class="fashion-about-carousel"
                role="region"
                aria-label="Fashion story carousel"
                tabindex="0"
                @keydown="handleCarouselKey"
                @pointerdown="handlePointerDown"
                @pointerup="handlePointerUp"
              >
                <div
                  class="fashion-about-carousel-track"
                  :style="{ '--fashion-about-carousel-index': carouselIndex }"
                >
                  <div
                    v-for="sourceImage in data.carouselImages"
                    :key="sourceImage"
                    class="fashion-about-carousel-slide"
                  >
                    <img :src="sourceAsset(sourceImage)" alt="" />
                  </div>
                  <div class="fashion-about-carousel-slide" aria-hidden="true"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="bg-gradient-top-very-light-gray overlap-height pb-4 sm-pb-50px fashion-about-timeline"
      >
        <div class="container overlap-gap-section">
          <div class="row mb-4 xs-mb-8">
            <div class="col-12 text-center">
              <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
                We care our <span class="text-highlight fw-600">customers</span>
              </h2>
            </div>
          </div>
          <div class="row row-cols-auto row-cols-lg-4 row-cols-sm-2 position-relative">
            <div
              v-for="(milestone, index) in data.timeline"
              :key="milestone.number"
              class="col"
              :class="index % 2 ? 'align-self-end mt-30px' : 'align-self-start'"
            >
              <div class="feature-box text-start ps-30px sm-ps-20px">
                <div class="feature-box-icon position-absolute left-0px top-10px">
                  <h1
                    class="opacity-1 fw-800 ls-minus-1px mb-0"
                    :class="index === 0 ? 'fs-100' : 'alt-font fs-90'"
                  >
                    {{ milestone.number }}
                  </h1>
                </div>
                <div
                  class="feature-box-content last-paragraph-no-margin pt-30 lg-pt-60px sm-pt-40px"
                >
                  <span class="text-dark-gray fs-19 d-inline-block fw-600 mb-5px">{{
                    milestone.title
                  }}</span>
                  <p class="w-90 xl-w-95">{{ milestone.body }}</p>
                  <span class="w-60px h-2px bg-dark-gray mt-20px d-inline-block"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="fashion-about-mission">
        <div class="container">
          <div class="row justify-content-center mb-10 overlap-section">
            <div class="col-xl-9 col-lg-10">
              <div
                class="row align-items-center justify-content-center bg-white box-shadow-medium-bottom border border-color-extra-medium-gray border-radius-100px sm-border-radius-6px md-mx-0"
              >
                <div
                  class="col-lg-6 p-20px border-end border-color-transparent-dark-very-light text-center ls-minus-05px align-items-center d-flex justify-content-center md-border-end-0 md-pb-10px"
                >
                  <i class="bi bi-emoji-smile text-dark-gray icon-extra-medium me-10px"></i>
                  <span class="text-dark-gray fs-20 text-start fw-500"
                    >Join the <span class="fw-700">10000+</span> people trusting us.</span
                  >
                </div>
                <div
                  class="col-lg-6 p-20px md-pt-0 text-center ls-minus-05px align-items-center d-flex justify-content-center"
                >
                  <i class="bi bi-star text-dark-gray icon-extra-medium me-10px"></i>
                  <span class="text-dark-gray fs-20 text-start fw-500"
                    >4.9 out of 5 - <span class="fw-700">8549</span> Total reviews.</span
                  >
                </div>
              </div>
            </div>
          </div>
          <div class="row align-items-center mb-10">
            <div class="col-lg-6 position-relative md-mb-70px fashion-about-mission-media">
              <div class="w-75 position-relative xs-w-80">
                <img
                  class="w-100"
                  :src="sourceAsset('images/demo-fashion-store-about-10.jpg')"
                  alt=""
                />
                <div class="fashion-about-mission-seal">
                  <img
                    :src="sourceAsset('images/demo-fashion-store-about-13.png')"
                    class="position-absolute top-50 translate-middle-y"
                    alt=""
                  />
                  <img
                    :src="sourceAsset('images/demo-fashion-store-about-12.png')"
                    class="animation-rotation"
                    alt=""
                  />
                </div>
              </div>
              <div class="fashion-about-secondary-image">
                <img
                  class="w-100"
                  :src="sourceAsset('images/demo-fashion-store-about-11.jpg')"
                  alt=""
                />
              </div>
            </div>
            <div class="col-12 col-lg-5 offset-lg-1">
              <div class="alt-font text-dark-gray mb-15px fs-20">
                <span class="text-highlight"
                  >Our fashion store mission<span class="bg-base-color h-8px bottom-0px"></span
                ></span>
              </div>
              <h2
                class="alt-font text-dark-gray mb-20px fw-400 ls-minus-1px w-90 lg-fs-50 lg-w-100"
              >
                Quality product with <span class="fw-600">exceptional price-value.</span>
              </h2>
              <FashionStoreAccordion
                v-model="accordionIndex"
                id-prefix="fashion-about-mission"
                :items="data.accordion"
              />
            </div>
          </div>
          <div class="fashion-about-brands" aria-label="Client brands">
            <div class="fashion-about-brand-track">
              <div
                v-for="(logo, index) in [...data.brandLogos, ...data.brandLogos.slice(0, 2)]"
                :key="`${logo}-${index}`"
                :data-source-clone="index >= data.brandLogos.length ? 'true' : undefined"
                :aria-hidden="index >= data.brandLogos.length ? 'true' : undefined"
              >
                <img :src="sourceAsset(logo)" alt="" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
