<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";
import { recordPreviewIntent } from "../../theme-engine/actions";

const properties = defineProps<{ viewModel: PresentationViewModel }>();

const links = computed(() => {
  const model = properties.viewModel;
  if (model.kind === "navigation") return model.items;
  if (model.kind === "footer") return model.legalLinks;
  if (model.kind === "collection-grid") {
    return model.collections.map(({ action }) => action);
  }
  return [];
});
</script>

<template>
  <nav v-if="links.length" aria-label="Fixture links" data-preview-block="link">
    <NuxtLink
      v-for="link in links"
      :key="link.id"
      :to="link.target"
      @click="recordPreviewIntent(link, 'core.link')"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
