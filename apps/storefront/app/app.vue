<script setup lang="ts">
import { defineAsyncComponent, type HydrationStrategy } from "vue";
import { captureStorefrontInteraction, hydrateOnStorefrontInteraction } from "./hydration";

const defersHomeHydration =
  import.meta.client &&
  location.pathname === "/" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const earlyStorefrontInteraction = defersHomeHydration
  ? captureStorefrontInteraction()
  : undefined;

const hydrateStorefrontExperience: HydrationStrategy = (hydrate, forEachElement) => {
  if (!defersHomeHydration) {
    hydrate();
    return;
  }

  return hydrateOnStorefrontInteraction(hydrate, forEachElement, earlyStorefrontInteraction);
};

const StorefrontExperience = defineAsyncComponent({
  hydrate: hydrateStorefrontExperience,
  loader: () => import("./StorefrontExperience.vue"),
});
</script>

<template>
  <StorefrontExperience />
</template>
