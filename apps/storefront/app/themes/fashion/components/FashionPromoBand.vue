<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface PromoData {
  code: string;
  message: string;
}
const properties = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as PromoData)
    : null,
);
</script>
<template>
  <aside v-if="data" class="fashion-promo-band">
    {{ data.message }} <strong>{{ data.code }}</strong>
  </aside>
</template>
