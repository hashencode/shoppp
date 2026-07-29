<script setup lang="ts">
defineProps<{
  product: {
    slug: string;
    name: string;
    media: ReadonlyArray<{ src: string; alt: string; width: number; height: number }>;
    variants: ReadonlyArray<{
      prices: ReadonlyArray<{ amount: number; currency: string }>;
    }>;
  };
}>();

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);
</script>

<template>
  <NuxtLink class="product-card" :to="`/products/${product.slug}`">
    <img
      v-if="product.media[0]?.src.endsWith('.svg')"
      :src="product.media[0]?.src"
      :alt="product.media[0]?.alt"
      :width="product.media[0]?.width"
      :height="product.media[0]?.height"
      loading="lazy"
    />
    <NuxtImg
      v-else
      provider="cloudflare"
      :src="product.media[0]?.src"
      :alt="product.media[0]?.alt"
      :width="product.media[0]?.width"
      :height="product.media[0]?.height"
      sizes="xs:100vw sm:50vw lg:33vw"
      loading="lazy"
      format="webp"
    />
    <div>
      <h3>{{ product.name }}</h3>
      <span v-if="product.variants[0]?.prices[0]">
        {{
          formatMoney(product.variants[0].prices[0].amount, product.variants[0].prices[0].currency)
        }}
      </span>
    </div>
  </NuxtLink>
</template>
