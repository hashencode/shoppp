<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface CollectionData {
  heading: string;
  items: { assetId: string; name: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as CollectionData)
    : null,
);
const rail = useTemplateRef<HTMLDivElement>("rail");
function move(direction: number): void {
  rail.value?.scrollBy({
    behavior: "smooth",
    left: direction * Math.min(rail.value.clientWidth, 720),
  });
}
</script>
<template>
  <section v-if="data" class="fashion-collection">
    <div class="fashion-collection-copy">
      <small>Lookbook 2026</small>
      <h2>{{ data.heading }}</h2>
      <p>Fresh silhouettes and tactile layers selected for the season ahead.</p>
      <a href="#fashion-products">View collection</a>
    </div>
    <div
      ref="rail"
      class="fashion-collection-rail"
      tabindex="0"
      aria-label="New arrival collections"
    >
      <article v-for="item in data.items" :key="item.assetId">
        <img
          :src="properties.resolveAsset(item.assetId)"
          :alt="item.name"
          width="520"
          height="700"
          loading="lazy"
        />
        <h3>{{ item.name }}</h3>
      </article>
    </div>
    <div class="fashion-collection-controls">
      <button type="button" aria-label="Previous collections" @click="move(-1)">
        <ArrowLeft aria-hidden="true" :size="18" :stroke-width="1.7" /></button
      ><button type="button" aria-label="Next collections" @click="move(1)">
        <ArrowRight aria-hidden="true" :size="18" :stroke-width="1.7" />
      </button>
    </div>
  </section>
</template>
