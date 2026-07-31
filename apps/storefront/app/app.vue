<script setup lang="ts">
import type { PageTemplate } from "@shoppp/contracts";

import {
  activeExperienceSnapshot,
  activePreviewOrigin,
  activeThemeAssets,
  activeThemeFixtures,
  activeThemeId,
  activeThemeRegistry,
} from "./generated/active-theme";
import { createThemeAssetResolver, mergeExperienceFixtureRegistries } from "./theme-engine/assets";
import { experienceFixtureRegistry } from "../fixtures/experience";
import ThemeRenderer from "./theme-engine/renderer.vue";

const selectedFixtures = mergeExperienceFixtureRegistries(
  experienceFixtureRegistry,
  activeThemeFixtures,
);
const resolveThemeAsset = createThemeAssetResolver(activeThemeId, activeThemeAssets);

const router = useRouter();
const currentRoute = computed(() => router.currentRoute.value);
const pageType = computed<PageTemplate["pageType"]>(() => {
  const path = currentRoute.value.path;
  if (path === "/") return "home";
  if (path === "/cart") return "cart";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/collections/")) return "collection";
  if (path.startsWith("/orders/")) return "order";
  if (path.startsWith("/policies/")) return "policy";
  if (path.startsWith("/products/")) return "product";
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
    link: [{ rel: "canonical", href: new URL(currentRoute.value.path, previewOrigin).href }],
    title: `${previewTitle.value} · Private fixture preview`,
  }));
}
</script>

<template>
  <div class="app-shell">
    <ThemeRenderer
      v-if="previewTemplate"
      :bindings="activeExperienceSnapshot?.bindings ?? []"
      :fixtures="selectedFixtures"
      :registry="activeThemeRegistry"
      :resolve-asset="resolveThemeAsset"
      :template="previewTemplate"
    />
    <main v-else-if="activeExperienceSnapshot">
      <h1>Preview template unavailable</h1>
      <p>The selected theme does not declare this presentation surface.</p>
    </main>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
