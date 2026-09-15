<script setup lang="ts">
import FashionStoreDecorHomeBody from "../home/FashionStoreDecorHomeBody.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import { buildFashionStoreLiveDecorHomeModel } from "../../contracts/decor-home";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const model = computed(() => buildFashionStoreLiveDecorHomeModel(properties.viewModel));
</script>

<template>
  <section
    class="fashion-store-product-merchandising py-0"
    data-home-section="product-merchandising"
  >
    <FashionStoreDecorHomeBody :model="model" :resolve-asset="resolveAsset" />
  </section>
</template>
