<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { canonicalUrl } from "~/utils/seo";

const route = useRoute();
const slug = String(route.params.slug);
const { data: page } = await useAsyncData(`catalog-collection:${slug}`, async () => {
  if (import.meta.client) return undefined;
  const { loadCollectionPage } = await import("~/utils/catalog-loader.server");
  return loadCollectionPage(slug);
});
if (!page.value) throw createError({ statusCode: 404, statusMessage: "Collection not found" });
const { collection, products } = page.value;
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
