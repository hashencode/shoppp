<script setup lang="ts">
import { defineAsyncComponent, type HydrationStrategy } from "vue";
import { hydrateOnStorefrontInteraction } from "./hydration";

const hydrateStorefrontExperience: HydrationStrategy = (hydrate, forEachElement) => {
  if (location.pathname !== "/" || !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hydrate();
    return;
  }

  return hydrateOnStorefrontInteraction(hydrate, forEachElement);
};

const StorefrontExperience = defineAsyncComponent({
  hydrate: hydrateStorefrontExperience,
  loader: () => import("./StorefrontExperience.vue"),
});
</script>

<template>
  <StorefrontExperience />
</template>
