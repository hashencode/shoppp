<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { fashionStoreRoutePaths } from "../page-contracts";
import { fashionStoreAssetId, resolveFashionStoreEditorMedia } from "../resources";
import FashionStoreProductCard from "./shared/FashionStoreProductCard.vue";
import FashionStoreShell from "./shared/FashionStoreShell.vue";

type HomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: HomeViewModel;
}>();

const services = [
  ["Free delivery", "On qualifying orders", "icon-feather-truck"],
  ["Secure payment", "Protected checkout", "icon-feather-shield"],
  ["Easy returns", "Straightforward support", "icon-feather-refresh-cw"],
  ["Real support", "Help when you need it", "icon-feather-headphones"],
] as const;
const categories = [
  ["Women", "images/demo-fashion-store-banner-01.jpg"],
  ["Men", "images/demo-fashion-store-banner-02.jpg"],
  ["Accessories", "images/demo-fashion-store-banner-03.jpg"],
  ["Kids", "images/demo-fashion-store-banner-04.jpg"],
] as const;
const collectionImages = [
  "images/demo-fashion-store-collection-slider-01.jpg",
  "images/demo-fashion-store-collection-slider-02.jpg",
  "images/demo-fashion-store-collection-slider-03.jpg",
  "images/demo-fashion-store-collection-slider-04.jpg",
] as const;
const brands = [
  ["ASOS", "images/logo-asos.svg"],
  ["Chanel", "images/logo-chanel.svg"],
  ["Gucci", "images/logo-gucci.svg"],
  ["Celine", "images/logo-celine.svg"],
  ["Adidas", "images/logo-adidas.svg"],
] as const;
const marquee = [
  "New arrivals",
  "Selected essentials",
  "Modern classics",
  "Everyday layers",
  "New arrivals",
  "Selected essentials",
  "Modern classics",
  "Everyday layers",
] as const;
const magazine = [
  ["The new season edit", "images/demo-fashion-store-blog-01.jpg"],
  ["How to build a lasting wardrobe", "images/demo-fashion-store-blog-02.jpg"],
  ["Materials worth knowing", "images/demo-fashion-store-blog-06.jpg"],
  ["Inside the latest collection", "images/demo-fashion-store-blog-07.jpg"],
] as const;

function sourceAsset(resolveAsset: ThemeAssetResolver, sourcePath: string): string {
  return resolveAsset(fashionStoreAssetId(sourcePath));
}

function editorMediaSource(
  resolveAsset: ThemeAssetResolver,
  media: HomeViewModel["hero"]["media"],
): string | undefined {
  return media ? resolveFashionStoreEditorMedia(resolveAsset, media) : undefined;
}

function sectionOrder(kind: HomeViewModel["sections"][number]["kind"]): number {
  if (kind === "best-sellers") return properties.viewModel.merchandisingOrder;
  const others = properties.viewModel.sections.filter((section) => section.kind !== "best-sellers");
  const naturalOrder = others.findIndex((section) => section.kind === kind) + 1;
  return naturalOrder >= properties.viewModel.merchandisingOrder ? naturalOrder + 1 : naturalOrder;
}
</script>

<template>
  <FashionStoreShell
    :announcement="viewModel.announcement"
    :announcement-link="viewModel.announcementLink"
    :footer="viewModel.shell.footer"
    :header="viewModel.shell.header"
    :preload-image="resolveAsset('fashion-store.slider-01')"
    :resolve-asset="resolveAsset"
  >
    <main
      id="fashion-store-main"
      class="d-flex flex-column"
      data-fashion-store-live-home
      data-runtime-status="static"
    >
      <section
        data-home-section="hero"
        :style="{ order: sectionOrder('hero') }"
        class="p-0 top-space-margin position-relative overflow-hidden"
      >
        <div class="container-fluid p-0">
          <div class="row g-0 align-items-stretch">
            <div class="col-lg-6 d-flex align-items-center">
              <div class="p-80px lg-p-50px sm-p-30px">
                <p class="alt-font text-uppercase fs-13 fw-600 text-dark-gray">
                  {{ viewModel.hero.eyebrow }}
                </p>
                <h1 class="alt-font fw-600 text-dark-gray">{{ viewModel.hero.heading }}</h1>
                <p class="fs-18 mb-30px text-dark-gray">{{ viewModel.hero.body }}</p>
                <a
                  :href="viewModel.hero.primaryLink?.href ?? viewModel.featuredCollection.href"
                  :target="
                    viewModel.hero.primaryLink?.targetBehavior === 'new-window'
                      ? '_blank'
                      : undefined
                  "
                  :rel="
                    viewModel.hero.primaryLink?.targetBehavior === 'new-window'
                      ? 'noopener noreferrer'
                      : undefined
                  "
                  data-fashion-store-route
                  class="btn btn-dark-gray btn-large"
                >
                  {{
                    viewModel.hero.primaryLink?.label ?? `Shop ${viewModel.featuredCollection.name}`
                  }}
                </a>
                <a
                  v-if="viewModel.hero.secondaryLink"
                  :href="viewModel.hero.secondaryLink.href"
                  :target="
                    viewModel.hero.secondaryLink.targetBehavior === 'new-window'
                      ? '_blank'
                      : undefined
                  "
                  :rel="
                    viewModel.hero.secondaryLink.targetBehavior === 'new-window'
                      ? 'noopener noreferrer'
                      : undefined
                  "
                  data-fashion-store-route
                  class="btn btn-transparent-dark-gray btn-large ms-10px"
                  >{{ viewModel.hero.secondaryLink.label }}</a
                >
              </div>
            </div>
            <div class="col-lg-6">
              <img
                :src="
                  editorMediaSource(resolveAsset, viewModel.hero.media) ??
                  resolveAsset('fashion-store.slider-01')
                "
                :alt="viewModel.hero.media?.alt ?? viewModel.hero.heading"
                :width="viewModel.hero.media?.width ?? 960"
                :height="viewModel.hero.media?.height ?? 1080"
                class="w-100 h-100 object-fit-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        data-home-section="services"
        :style="{ order: sectionOrder('services') }"
        class="half-section"
      >
        <div class="container">
          <div class="row row-cols-1 row-cols-md-2 row-cols-lg-4">
            <div v-for="service in services" :key="service[0]" class="col md-mb-30px">
              <div class="feature-box d-flex align-items-center">
                <i class="feather me-15px fs-28" :class="service[2]"></i>
                <div>
                  <p class="alt-font fw-600 text-dark-gray mb-0">{{ service[0] }}</p>
                  <p class="mb-0 text-dark-gray">{{ service[1] }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        data-home-section="categories"
        :style="{ order: sectionOrder('categories') }"
        class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0"
      >
        <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-0">
          <div v-for="category in categories" :key="category[0]" class="col categories-style-02">
            <a :href="viewModel.featuredCollection.href" data-fashion-store-route>
              <img
                :src="sourceAsset(resolveAsset, category[1])"
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

      <section
        v-if="viewModel.merchandisingVisible"
        data-home-section="best-sellers"
        :style="{ order: sectionOrder('best-sellers') }"
        class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 sm-pb-6 xs-px-0"
      >
        <div class="container-fluid">
          <div class="text-center mb-40px">
            <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">
              Selected catalog release
            </p>
            <h2 class="alt-font fw-600 text-dark-gray">{{ viewModel.merchandisingTitle }}</h2>
          </div>
          <p v-if="viewModel.products.length === 0" role="status">
            This collection does not have published products yet.
          </p>
          <ul
            v-else
            class="shop-modern shop-wrapper grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col xs-grid-1col gutter-extra-large text-center"
            :aria-label="viewModel.merchandisingTitle"
          >
            <FashionStoreProductCard
              v-for="product in viewModel.products"
              :key="product.productId"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
        </div>
      </section>

      <section
        data-home-section="promotion"
        :style="{ order: sectionOrder('promotion') }"
        class="p-15px bg-dark-gray text-white"
      >
        <div class="container text-center">
          <p class="alt-font mb-0">
            New-season pieces are available now.
            <a
              :href="viewModel.featuredCollection.href"
              data-fashion-store-route
              class="text-white text-decoration-line-bottom"
              >Shop the collection</a
            >
          </p>
        </div>
      </section>

      <section
        data-home-section="collection"
        :style="{ order: sectionOrder('collection') }"
        class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0"
      >
        <div class="container-fluid py-70px">
          <div class="d-flex justify-content-between align-items-end mb-30px">
            <div>
              <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">
                Curated for you
              </p>
              <h2 class="alt-font fw-600 text-dark-gray mb-0">
                {{ viewModel.featuredCollection.name }}
              </h2>
            </div>
            <a
              :href="viewModel.featuredCollection.href"
              data-fashion-store-route
              class="text-dark-gray"
              >View collection</a
            >
          </div>
          <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4">
            <div v-for="(image, index) in collectionImages" :key="image" class="col swiper-slide">
              <a :href="viewModel.featuredCollection.href" data-fashion-store-route>
                <img
                  :src="sourceAsset(resolveAsset, image)"
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

      <section
        data-home-section="brands"
        :style="{ order: sectionOrder('brands') }"
        class="half-section border-bottom border-color-extra-medium-gray"
      >
        <div class="container">
          <div class="row row-cols-2 row-cols-md-5 align-items-center text-center">
            <div v-for="[brand, image] in brands" :key="brand" class="col">
              <img :src="sourceAsset(resolveAsset, image)" :alt="brand" width="160" height="80" />
            </div>
          </div>
        </div>
      </section>

      <section
        data-home-section="featured-products"
        :style="{ order: sectionOrder('featured-products') }"
        class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 md-pb-5 xs-px-0"
      >
        <div class="container-fluid">
          <div class="text-center mb-40px">
            <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">
              The latest edit
            </p>
            <h2 class="alt-font fw-600 text-dark-gray">Featured products</h2>
          </div>
          <ul
            class="shop-modern shop-wrapper grid grid-4col lg-grid-3col md-grid-2col xs-grid-1col gutter-extra-large text-center"
            aria-label="Featured products"
          >
            <FashionStoreProductCard
              v-for="product in viewModel.featuredProduct
                ? [viewModel.featuredProduct]
                : viewModel.products"
              :key="`featured-${product.productId}`"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
        </div>
      </section>

      <section
        data-home-section="marquee"
        :style="{ order: sectionOrder('marquee') }"
        class="p-0 border-top border-bottom border-color-extra-medium-gray overflow-hidden"
      >
        <div class="d-flex flex-nowrap py-25px" aria-label="Fashion highlights">
          <span
            v-for="(message, index) in marquee"
            :key="`${message}-${index}`"
            class="alt-font text-uppercase fw-600 fs-18 me-50px swiper-slide text-dark-gray"
            >{{ message }}</span
          >
        </div>
      </section>

      <section
        data-home-section="magazine"
        :style="{ order: sectionOrder('magazine') }"
        class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0"
      >
        <div class="container-fluid pt-70px">
          <div class="text-center mb-40px">
            <p class="alt-font text-uppercase fs-12 fw-600 mb-5px text-dark-gray">
              Stories and ideas
            </p>
            <h2 class="alt-font fw-600 text-dark-gray">Magazine</h2>
          </div>
          <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4">
            <article v-for="entry in magazine" :key="entry[0]" class="col grid-item">
              <a :href="fashionStoreRoutePaths.article" data-fashion-store-route>
                <img
                  :src="sourceAsset(resolveAsset, entry[1])"
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
    </main>
  </FashionStoreShell>
</template>
