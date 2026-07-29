<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { canonicalUrl } from "~/utils/seo";

const route = useRoute();
const collection = catalogRelease.collections.find((item) => item.slug === route.params.slug);
if (!collection) throw createError({ statusCode: 404, statusMessage: "Collection not found" });
const products = catalogRelease.products.filter((product) =>
  collection.productSlugs.includes(product.slug),
);
const canonical = canonicalUrl(catalogRelease.site.origin, `/collections/${collection.slug}`);
useSeoMeta({
  title: collection.seoTitle,
  description: collection.seoDescription,
  ogTitle: collection.seoTitle,
  ogDescription: collection.seoDescription,
  ogUrl: canonical,
});
useHead({ link: [{ rel: "canonical", href: canonical }] });
</script>

<template>
  <section class="section">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Collection</p>
        <h1>{{ collection.name }}</h1>
        <p class="hero-copy">{{ collection.description }}</p>
      </div>
    </div>
    <div class="product-grid">
      <CommerceProductCard v-for="product in products" :key="product.slug" :product="product" />
    </div>
  </section>
</template>
