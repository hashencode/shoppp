<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useFashionSourceReveal } from "../composables/useFashionSourceReveal";
interface MagazineData {
  heading: string;
  items: { assetId: string; author: string; date: string; title: string }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as MagazineData)
    : null,
);
const list = useTemplateRef<HTMLElement>("list");
useFashionSourceReveal(list, {
  delayMs: 300,
  durationMs: 500,
  initialTransform: "translate3d(-15px, 15px, 0)",
  itemSelector: ":scope > article",
  staggerMs: 300,
});

function headingLead(heading: string): string {
  return heading.split(" ").slice(0, -1).join(" ");
}

function headingHighlight(heading: string): string {
  return heading.split(" ").at(-1) ?? heading;
}
</script>
<template>
  <section v-if="data" id="fashion-magazine" class="fashion-magazine">
    <h2>
      {{ headingLead(data.heading) }}
      <strong>{{ headingHighlight(data.heading) }}</strong>
    </h2>
    <div ref="list">
      <article v-for="item in data.items" :key="item.assetId">
        <div class="fashion-magazine-image">
          <NuxtLink :to="`/magazine/${item.assetId.replace('fashion.blog-', '')}`">
            <img
              :src="properties.resolveAsset(item.assetId)"
              :alt="item.title"
              width="600"
              height="455"
              loading="lazy"
            />
          </NuxtLink>
        </div>
        <div class="fashion-magazine-body">
          <p class="fashion-magazine-meta">
            By <strong>{{ item.author }}</strong
            ><i>•</i>{{ item.date }}
          </p>
          <h3>
            <NuxtLink :to="`/magazine/${item.assetId.replace('fashion.blog-', '')}`">{{
              item.title
            }}</NuxtLink>
          </h3>
        </div>
      </article>
    </div>
  </section>
</template>
