<script setup lang="ts">
import FashionStoreDecorHero from "../FashionStoreDecorHero.vue";
import type { FashionStoreHomeSectionProperties } from "./live-home-section-context";

defineProps<FashionStoreHomeSectionProperties>();
</script>

<template>
  <section
    data-home-section="hero"
    data-runtime-status="static"
    class="p-0 position-relative overflow-hidden"
  >
    <FashionStoreDecorHero :resolve-asset="resolveAsset" />
  </section>
</template>
