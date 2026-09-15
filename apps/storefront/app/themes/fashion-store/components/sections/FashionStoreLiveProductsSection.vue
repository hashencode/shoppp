<script setup lang="ts">
import FashionStoreLiveBestSellersSection from "./FashionStoreLiveBestSellersSection.vue";
import FashionStoreLiveFeaturedProductsSection from "./FashionStoreLiveFeaturedProductsSection.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import { fashionStoreProductSectionVariant } from "../../successor/composition";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const variant = computed(() => fashionStoreProductSectionVariant(properties.instance.id));
</script>

<template>
  <FashionStoreLiveBestSellersSection v-if="variant === 'best-sellers'" v-bind="properties" />
  <FashionStoreLiveFeaturedProductsSection v-else v-bind="properties" />
</template>
