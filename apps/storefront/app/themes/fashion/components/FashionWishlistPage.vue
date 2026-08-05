<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";

defineProps<{
  products: { assetId: string; name: string; price: string; slug: string }[];
  resolveAsset: ThemeAssetResolver;
}>();
const emit = defineEmits<{ submit: [label: string] }>();
</script>

<template>
  <section class="fashion-wishlist-page">
    <article v-for="(product, index) in products.slice(0, 8)" :key="product.slug">
      <div class="fashion-wishlist-media">
        <NuxtLink :to="`/products/${product.slug}`"
          ><img :src="resolveAsset(product.assetId)" :alt="product.name" width="600" height="765"
        /></NuxtLink>
        <button type="button" :aria-label="`Remove ${product.name} from wishlist`">×</button>
        <span v-if="index === 0" class="fashion-wishlist-badge">New</span>
        <span v-if="index === 5" class="fashion-wishlist-badge is-hot">Hot</span>
        <button
          class="fashion-wishlist-add"
          type="button"
          @click="emit('submit', `${product.name} cart action`)"
        >
          Add to cart
        </button>
      </div>
      <h2>
        <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink>
      </h2>
      <p>{{ product.price }}</p>
    </article>
  </section>
</template>
