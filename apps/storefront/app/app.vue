<script setup lang="ts">
import { defineAsyncComponent, hydrateOnInteraction, type HydrationStrategy } from "vue";

const hydrateStorefrontExperience: HydrationStrategy = (hydrate, forEachElement) => {
  if (location.pathname !== "/" || !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hydrate();
    return;
  }

  return hydrateOnInteraction(["click", "focusin", "keydown", "pointerdown"])(
    hydrate,
    forEachElement,
  );
};

const StorefrontExperience = defineAsyncComponent({
  hydrate: hydrateStorefrontExperience,
  loader: () => import("./StorefrontExperience.vue"),
});
</script>

<template>
  <StorefrontExperience />
</template>
