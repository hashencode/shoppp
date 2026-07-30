<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface ProductData { heading: string; products: { assetId: string; name: string; price: string }[] }
const properties = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() => properties.viewModel.kind === "theme-section" ? properties.viewModel.data as unknown as ProductData : null);
</script>
<template><section v-if="data" id="fashion-products" class="fashion-products"><h2>{{ data.heading }}</h2><div class="fashion-product-grid"><article v-for="product in data.products" :key="product.assetId"><a href="/products/atlas-carry-on" :aria-label="`Preview ${product.name}`"><img :src="properties.resolveAsset(product.assetId)" :alt="product.name" width="600" height="760" loading="lazy" /></a><h3>{{ product.name }}</h3><p>{{ product.price }}</p><button type="button">Add to preview bag</button></article></div></section></template>
