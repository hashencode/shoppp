<script setup lang="ts">
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data { message: string }
const p = defineProps<{ viewModel: PresentationViewModel }>();
const data = computed(() => p.viewModel.kind === "theme-section" ? p.viewModel.data as unknown as Data : null);
</script>
<template><aside v-if="data" class="decor-marquee" aria-label="Store values"><div><span v-for="index in 4" :key="index">{{ data.message }} <b>✦</b></span></div></aside></template>
