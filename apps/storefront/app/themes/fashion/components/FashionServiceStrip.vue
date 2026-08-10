<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useFashionSourceReveal } from "../composables/useFashionSourceReveal";
interface ServiceData {
  items: { assetId: string; detail: string; label: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ServiceData)
    : null,
);
const section = useTemplateRef<HTMLElement>("section");
useFashionSourceReveal(section, {
  delayMs: 200,
  durationMs: 800,
  initialTransform: "translate3d(30px, 0, 0)",
  itemSelector: ":scope > article",
  staggerMs: 300,
});
</script>
<template>
  <section v-if="data" ref="section" class="fashion-service-strip" aria-label="Store services">
    <article v-for="item in data.items" :key="item.assetId">
      <img
        :src="properties.resolveAsset(item.assetId)"
        alt=""
        width="42"
        height="42"
        loading="eager"
      />
      <p>
        <strong>{{ item.label }}</strong
        ><span>{{ item.detail }}</span>
      </p>
    </article>
  </section>
</template>
