<script setup lang="ts">
import { ArrowLeft, ArrowRight, ShoppingBag } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface HeroData {
  slides: {
    accentAssetId: string;
    assetId: string;
    heading: string;
    mobileAccentAssetId?: string;
    mobileAssetId?: string;
    price: string;
  }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as HeroData)
    : null,
);
useHead(() => ({
  link: (() => {
    const firstSlide = data.value?.slides[0];
    if (!firstSlide) return [];
    return [
      ...(firstSlide.mobileAssetId
        ? [
            {
              as: "image",
              fetchpriority: "high",
              href: properties.resolveAsset(firstSlide.mobileAssetId),
              media: "(max-width: 767px)",
              rel: "preload",
              type: "image/webp",
            } as const,
          ]
        : []),
      ...(firstSlide.mobileAccentAssetId
        ? [
            {
              as: "image",
              fetchpriority: "high",
              href: properties.resolveAsset(firstSlide.mobileAccentAssetId),
              media: "(max-width: 767px)",
              rel: "preload",
              type: "image/webp",
            } as const,
          ]
        : []),
      {
        as: "image",
        fetchpriority: "high",
        href: properties.resolveAsset(firstSlide.assetId),
        media: "(min-width: 768px)",
        rel: "preload",
      },
      {
        as: "image",
        fetchpriority: "high",
        href: properties.resolveAsset(firstSlide.accentAssetId),
        media: "(min-width: 768px)",
        rel: "preload",
      },
    ];
  })(),
}));
const current = ref(0);
function select(index: number): void {
  const count = data.value?.slides.length ?? 1;
  current.value = (index + count) % count;
}
</script>
<template>
  <section
    v-if="data"
    class="decor-hero"
    aria-roledescription="carousel"
    aria-label="Furniture collections"
    tabindex="0"
    @keydown.right.prevent="select(current + 1)"
    @keydown.left.prevent="select(current - 1)"
  >
    <aside class="decor-social">
      <span>Instagram</span><span>Twitter</span><span>Dribbble</span><span>Facebook</span>
    </aside>
    <article
      v-for="(slide, index) in data.slides"
      v-show="current === index"
      :key="slide.assetId"
      class="decor-hero-slide"
    >
      <div class="decor-hero-shape"></div>
      <picture>
        <source
          v-if="slide.mobileAccentAssetId"
          media="(max-width: 767px)"
          :srcset="properties.resolveAsset(slide.mobileAccentAssetId)"
          type="image/webp"
        />
        <img
          class="decor-hero-accent"
          :src="properties.resolveAsset(slide.accentAssetId)"
          alt=""
          width="900"
          height="900"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
          :loading="index === 0 ? 'eager' : 'lazy'"
        />
      </picture>
      <picture>
        <source
          v-if="slide.mobileAssetId"
          media="(max-width: 767px)"
          :srcset="properties.resolveAsset(slide.mobileAssetId)"
          type="image/webp"
        />
        <img
          class="decor-hero-product"
          :src="properties.resolveAsset(slide.assetId)"
          :alt="slide.heading"
          width="1400"
          height="900"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
          :loading="index === 0 ? 'eager' : 'lazy'"
        />
      </picture>
      <div class="decor-hero-copy">
        <h1>{{ slide.heading }}</h1>
        <p>
          Price starting from <strong>{{ slide.price }}</strong>
        </p>
        <a href="#decor-products"
          ><ShoppingBag aria-hidden="true" :size="15" :stroke-width="1.7" />Shop now</a
        >
      </div>
    </article>
    <div class="decor-hero-controls">
      <button type="button" aria-label="Previous furniture" @click="select(current - 1)">
        <ArrowLeft aria-hidden="true" :size="18" :stroke-width="1.7" /></button
      ><span
        >{{ String(current + 1).padStart(2, "0") }} /
        {{ String(data.slides.length).padStart(2, "0") }}</span
      ><button type="button" aria-label="Next furniture" @click="select(current + 1)">
        <ArrowRight aria-hidden="true" :size="18" :stroke-width="1.7" />
      </button>
    </div>
  </section>
</template>
