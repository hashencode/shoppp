<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useFashionSourceReveal } from "../composables/useFashionSourceReveal";

interface BrandData {
  items: { assetId: string; label: string }[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as BrandData)
    : null,
);
const section = useTemplateRef<HTMLElement>("section");
useFashionSourceReveal(section, {
  delayMs: 0,
  durationMs: 300,
  initialTransform: "translate3d(0, -15px, 0) scale(0.8)",
  itemSelector: ":scope > .fashion-brands-inner > a",
  staggerMs: 100,
});
</script>

<template>
  <section v-if="data" ref="section" class="fashion-brands" aria-label="Featured fashion labels">
    <div class="fashion-brands-inner">
      <NuxtLink v-for="item in data.items" :key="item.assetId" to="/#fashion-featured">
        <img
          :src="properties.resolveAsset(item.assetId)"
          :alt="item.label"
          width="150"
          height="30"
          loading="lazy"
        />
      </NuxtLink>
    </div>
  </section>
</template>
