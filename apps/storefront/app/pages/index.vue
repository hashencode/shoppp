<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { canonicalUrl } from "~/utils/seo";

const canonical = canonicalUrl(catalogRelease.site.origin, "/");
useSeoMeta({
  title: "Shoppp — Objects for moving well",
  description:
    "Purposeful travel objects designed for movement, durability, and a lighter footprint.",
  ogTitle: "Shoppp — Objects for moving well",
  ogDescription: "Purposeful travel objects designed for movement and durability.",
  ogUrl: canonical,
});
useHead({ link: [{ rel: "canonical", href: canonical }] });
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <p class="eyebrow">Edition 01 · Built to move</p>
        <h1>GO FAR.<br />PACK LIGHT.</h1>
        <p class="hero-copy">
          A focused collection of durable travel objects, designed to cross borders without excess.
        </p>
        <NuxtLink class="cta" to="/collections/travel-essentials">Explore the collection</NuxtLink>
      </div>
      <p class="eyebrow">One global catalog · Currency clarified before purchase</p>
    </section>
    <section class="section" aria-labelledby="featured-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Featured objects</p>
          <h2 id="featured-heading">Ready for departure.</h2>
        </div>
      </div>
      <div class="product-grid">
        <CommerceProductCard
          v-for="product in catalogRelease.products"
          :key="product.slug"
          :product="product"
        />
      </div>
    </section>
  </div>
</template>
