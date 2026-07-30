<script setup lang="ts">
import type { PresentationViewModel } from "../../theme-engine/view-models";

const properties = defineProps<{ viewModel: PresentationViewModel }>();
const copy = computed(() => {
  const model = properties.viewModel;
  if ("body" in model) return model.body;
  if ("message" in model) return model.message;
  if ("summary" in model) return model.summary;
  return "";
});
</script>

<template>
  <p v-if="copy" data-preview-block="text">{{ copy }}</p>
</template>
