<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useFashionSourceReveal } from "../composables/useFashionSourceReveal";
interface CategoryData {
  items: { assetId: string; count: string; href: string; name: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as CategoryData)
    : null,
);
const section = useTemplateRef<HTMLElement>("section");
useFashionSourceReveal(section, {
  delayMs: 100,
  durationMs: 400,
  initialTransform: "perspective(1200px) translate3d(0, -15px, 0) scale(1.1) rotateX(50deg)",
  itemSelector: ":scope > article",
  staggerMs: 200,
});
</script>
<template>
  <section v-if="data" id="fashion-categories" ref="section" class="fashion-categories">
    <article v-for="item in data.items" :key="item.assetId">
      <NuxtLink class="fashion-category-image" :to="item.href">
        <img
          :src="properties.resolveAsset(item.assetId)"
          :alt="`${item.name} collection`"
          width="600"
          height="450"
          loading="lazy"
        />
      </NuxtLink>
      <small>{{ item.count }}</small>
      <div class="fashion-category-control-position">
        <NuxtLink class="fashion-category-control" :to="item.href">
          <span :data-text="item.name">{{ item.name }}</span>
        </NuxtLink>
      </div>
    </article>
  </section>
</template>
