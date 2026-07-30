<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface HeroData {
  slides: { assetId: string; eyebrow: string; heading: string }[];
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
function keydown(event: KeyboardEvent): void {
  if (event.key === "ArrowRight") select(current.value + 1);
  if (event.key === "ArrowLeft") select(current.value - 1);
}
onMounted(() => {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    timer = setInterval(() => {
      if (!paused.value && document.visibilityState === "visible") select(current.value + 1);
    }, 6_000);
});
onBeforeUnmount(() => timer && clearInterval(timer));
</script>

<template>
  <section
    v-if="data"
    class="fashion-hero"
    aria-roledescription="carousel"
    aria-label="Seasonal collections"
    tabindex="0"
    @keydown="keydown"
    @mouseenter="paused = true"
    @mouseleave="paused = false"
    @focusin="paused = true"
    @focusout="paused = false"
  >
    <aside class="fashion-social-rail" aria-label="Social channels">
      <span>Instagram</span><span>Twitter</span><span>Dribbble</span><span>Facebook</span>
    </aside>
    <article
      v-for="(slide, index) in data.slides"
      v-show="current === index"
      :key="slide.assetId"
      class="fashion-hero-slide"
      :aria-label="`${index + 1} of ${data.slides.length}`"
    >
      <img
        :src="properties.resolveAsset(slide.assetId)"
        :alt="`${slide.heading} campaign portrait`"
        width="1920"
        height="1080"
        fetchpriority="high"
      />
      <div class="fashion-hero-copy">
        <p>{{ slide.eyebrow }}</p>
        <h1>{{ slide.heading }}</h1>
        <a href="#fashion-products">View collection</a>
      </div>
    </article>
    <div class="fashion-hero-pagination" aria-label="Choose collection">
      <button
        v-for="(_, index) in data.slides"
        :key="index"
        type="button"
        :aria-current="current === index ? 'true' : undefined"
        :aria-label="`Show slide ${index + 1}`"
        @click="select(index)"
      >
        {{ String(index + 1).padStart(2, "0") }}
      </button>
    </div>
  </section>
</template>
