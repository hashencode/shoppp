<script setup lang="ts">
import FashionStoreFixtureBestSellersSection from "./FashionStoreFixtureBestSellersSection.vue";
import FashionStoreFixtureFeaturedProductsSection from "./FashionStoreFixtureFeaturedProductsSection.vue";
import type { FashionStoreHomeSectionProperties } from "./fixture-home-section-context";
import { fashionStoreProductSectionVariant } from "../../successor/composition";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const variant = computed(() => fashionStoreProductSectionVariant(properties.instance.id));
</script>

<template>
  <FashionStoreFixtureBestSellersSection v-if="variant === 'best-sellers'" v-bind="properties" />
  <FashionStoreFixtureFeaturedProductsSection v-else v-bind="properties" />
</template>
