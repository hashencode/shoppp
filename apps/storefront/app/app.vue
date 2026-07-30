<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import {
  activeExperienceSnapshot,
  activePreviewOrigin,
  activeThemeRegistry,
} from "./generated/active-theme";
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

const previewOrigin = activePreviewOrigin;
if (activeExperienceSnapshot && previewOrigin) {
  useSeoMeta({ robots: "noindex, nofollow" });
  useHead(() => ({
    link: [{ href: new URL(route.path, previewOrigin).href, rel: "canonical" }],
  }));
}
</script>

<template>
  <UApp>
    <ThemeRenderer
      v-if="previewTemplate"
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
