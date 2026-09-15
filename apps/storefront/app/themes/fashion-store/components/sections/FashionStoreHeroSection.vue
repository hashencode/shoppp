<script setup lang="ts">
import FashionStoreDecorHero from "../FashionStoreDecorHero.vue";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
</script>

<template>
  <section class="p-0" data-home-section="hero">
    <FashionStoreDecorHero :resolve-asset="properties.resolveAsset" />
  </section>
</template>
