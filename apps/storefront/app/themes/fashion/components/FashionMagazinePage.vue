<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { fashionSourceContract } from "../source-contract";

defineProps<{ resolveAsset: ThemeAssetResolver }>();
</script>

<template>
  <section class="fashion-magazine-page">
    <article
      v-for="(item, index) in fashionSourceContract.magazinePage"
      :key="`${item[3]}-${index}`"
    >
      <NuxtLink class="fashion-magazine-page-image" :to="`/magazine/${index + 1}`">
        <img :src="resolveAsset(item[0])" :alt="item[3]" width="600" height="455" />
      </NuxtLink>
      <p>
        By <strong>{{ item[1] }}</strong
        ><span>{{ item[2] }}</span>
      </p>
      <h2>
        <NuxtLink :to="`/magazine/${index + 1}`">{{ item[3] }}</NuxtLink>
      </h2>
    </article>
    <nav class="fashion-magazine-pagination" aria-label="Magazine pages">
      <button type="button" aria-label="Previous page">←</button><button type="button">01</button
      ><button class="is-active" type="button">02</button><button type="button">03</button
      ><button type="button">04</button><button type="button" aria-label="Next page">→</button>
    </nav>
  </section>
</template>
