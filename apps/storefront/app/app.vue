<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import {
  activeExperienceSnapshot,
  activePreviewOrigin,
  activeThemeId,
  activeThemeRegistry,
} from "./generated/active-theme";
import { experienceFixtureRegistry } from "../fixtures/experience";
import ThemeRenderer from "./theme-engine/renderer.vue";

const route = useRoute();
const pageType = computed<PageTemplate["pageType"]>(() => {
  if (route.path === "/") return "home";
  if (route.path === "/cart") return "cart";
  if (route.path.startsWith("/checkout")) return "checkout";
  if (route.path.startsWith("/collections/")) return "collection";
  if (route.path.startsWith("/orders/")) return "order";
  if (route.path.startsWith("/policies/")) return "policy";
  if (route.path.startsWith("/products/")) return "product";
  return "home";
});
const previewTemplate = computed(() =>
  activeExperienceSnapshot?.resolvedTemplates.find(
    (template) => template.pageType === pageType.value,
  ),
);
const previewTitle = computed(
  () =>
    ({
      cart: "Preview bag",
      checkout: "Checkout presentation",
      collection: "Fixture collection",
      home: `${activeThemeId[0]?.toUpperCase()}${activeThemeId.slice(1)} storefront`,
      order: "Order status presentation",
      policy: "Fixture policy",
      product: "Fixture product",
    })[pageType.value],
);

const previewOrigin = activePreviewOrigin;
if (activeExperienceSnapshot && previewOrigin) {
  useSeoMeta({
    description: "A private fixture-backed storefront theme preview.",
    robots: "noindex, nofollow",
  });
  useHead(() => ({
    link: [{ rel: "canonical", href: new URL(route.path, previewOrigin).href }],
    title: `${previewTitle.value} · Private fixture preview`,
  }));
}
</script>

<template>
  <UApp>
    <ThemeRenderer
      v-if="previewTemplate"
      :bindings="activeExperienceSnapshot?.bindings ?? []"
      :fixtures="experienceFixtureRegistry"
      :registry="activeThemeRegistry"
      :template="previewTemplate"
    />
    <main v-else-if="activeExperienceSnapshot">
      <h1>Preview template unavailable</h1>
      <p>The selected theme does not declare this presentation surface.</p>
    </main>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
