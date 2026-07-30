<script setup lang="ts">
import type { SectionInstance } from "@shoppp/contracts";

import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { recordPreviewIntent } from "../../../theme-engine/actions";

const properties = defineProps<{
  instance: SectionInstance;
  viewModel: PresentationViewModel;
}>();
const model = computed(() =>
  properties.viewModel.kind === "footer" ? properties.viewModel : null,
);
const note = computed(() => {
  const value = properties.instance.settings.note;
  return typeof value === "string" ? value : model.value?.summary;
});
</script>

<template>
  <footer v-if="model" class="decor-footer">
    <div>
      <p class="decor-wordmark">{{ model.brand }}</p>
      <p>{{ note }}</p>
    </div>
    <nav aria-label="Legal">
      <NuxtLink
        v-for="link in model.legalLinks"
        :key="link.id"
        :to="link.target"
        @click="recordPreviewIntent(link, 'decor.footer')"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
    <slot />
  </footer>
</template>
