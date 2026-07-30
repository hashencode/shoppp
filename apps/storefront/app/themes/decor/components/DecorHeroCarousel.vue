<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface HeroData {
  slides: { accentAssetId: string; assetId: string; heading: string; price: string }[];
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
const current = ref(0);
const paused = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
function select(index: number): void {
  const count = data.value?.slides.length ?? 1;
  current.value = (index + count) % count;
}
onMounted(() => {
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    timer = setInterval(() => {
      if (!paused.value && document.visibilityState === "visible") select(current.value + 1);
    }, 6500);
});
onBeforeUnmount(() => timer && clearInterval(timer));
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
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    @focusin="paused = true"
    @focusout="paused = false"
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
      <img
        class="decor-hero-accent"
        :src="properties.resolveAsset(slide.accentAssetId)"
        alt=""
        width="900"
        height="900"
      /><img
        class="decor-hero-product"
        :src="properties.resolveAsset(slide.assetId)"
        :alt="slide.heading"
        width="1400"
        height="900"
        fetchpriority="high"
      />
      <div class="decor-hero-copy">
        <h1>{{ slide.heading }}</h1>
        <p>
          Price starting from <strong>{{ slide.price }}</strong>
        </p>
        <a href="#decor-products">▣ Shop now</a>
      </div>
    </article>
    <div class="decor-hero-controls">
      <button type="button" aria-label="Previous furniture" @click="select(current - 1)">←</button
      ><span
        >{{ String(current + 1).padStart(2, "0") }} /
        {{ String(data.slides.length).padStart(2, "0") }}</span
      ><button type="button" aria-label="Next furniture" @click="select(current + 1)">→</button>
    </div>
  </section>
</template>
