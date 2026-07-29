<script setup lang="ts">
import { catalogRelease } from "~/generated/catalog";
import { breadcrumbStructuredData, canonicalUrl, productStructuredData } from "~/utils/seo";

const route = useRoute();
const product = catalogRelease.products.find((item) => item.slug === route.params.slug);
if (!product) throw createError({ statusCode: 404, statusMessage: "Product not found" });
const collection = catalogRelease.collections.find((item) =>
  product.collectionSlugs.includes(item.slug),
);
const selectedVariant = ref(product.variants[0]?.sku ?? "");
const selectedCurrency = ref(catalogRelease.site.defaultCurrency);
const liveMessage = ref(
  `Static catalog facts are refreshed within ${catalogRelease.site.freshnessHours} hours.`,
);
const variant = computed(
  () => product.variants.find((item) => item.sku === selectedVariant.value) ?? product.variants[0],
);
const price = computed(
  () =>
    variant.value?.prices.find((item) => item.currency === selectedCurrency.value) ??
    variant.value?.prices[0],
);
const currencies = [
  ...new Set(product.variants.flatMap((item) => item.prices.map((price) => price.currency))),
];
const canonical = canonicalUrl(catalogRelease.site.origin, `/products/${product.slug}`);
const image = product.media[0];

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 100);

useSeoMeta({
  title: product.seoTitle,
  description: product.seoDescription,
  ogTitle: product.seoTitle,
  ogDescription: product.seoDescription,
  ogUrl: canonical,
  ogImage: image ? canonicalUrl(catalogRelease.site.origin, image.src) : undefined,
  twitterCard: "summary_large_image",
});
useHead({
  link: [{ rel: "canonical", href: canonical }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(productStructuredData(product, catalogRelease.site.origin)),
    },
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(
        breadcrumbStructuredData(
          [
            { name: "Home", path: "/" },
            ...(collection
              ? [{ name: collection.name, path: `/collections/${collection.slug}` }]
              : []),
            { name: product.name, path: `/products/${product.slug}` },
          ],
          catalogRelease.site.origin,
        ),
      ),
    },
  ],
});

onMounted(async () => {
  try {
    const { getLiveProduct } = useCommerceApi();
    const live = await getLiveProduct(product.slug);
    liveMessage.value = live.data.variants.some((item) => item.available)
      ? "Available. Final price and delivery are confirmed when added to cart."
      : "Currently unavailable.";
  } catch {
    liveMessage.value = "Live availability will be confirmed when added to cart.";
  }
});
</script>

<template>
  <article class="product-page">
    <div class="product-media">
      <img
        v-if="image?.src.endsWith('.svg')"
        :src="image.src"
        :alt="image.alt"
        :width="image.width"
        :height="image.height"
      />
      <NuxtImg
        v-else-if="image"
        provider="cloudflare"
        :src="image.src"
        :alt="image.alt"
        :width="image.width"
        :height="image.height"
        sizes="xs:100vw md:55vw"
        preload
        format="webp"
      />
    </div>
    <div class="product-info">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <NuxtLink to="/">Home</NuxtLink><span aria-hidden="true">/</span>
        <NuxtLink v-if="collection" :to="`/collections/${collection.slug}`">
          {{ collection.name }}
        </NuxtLink>
      </nav>
      <p class="eyebrow">Designed for distance</p>
      <h1>{{ product.name }}</h1>
      <p class="hero-copy">{{ product.description }}</p>
      <p v-if="price" class="price">{{ formatMoney(price.amount, price.currency) }}</p>
      <div class="controls">
        <label>
          Variant
          <select v-model="selectedVariant">
            <option v-for="item in product.variants" :key="item.sku" :value="item.sku">
              {{ item.title }} · {{ item.optionValues.color }}
            </option>
          </select>
        </label>
        <label>
          Currency
          <select v-model="selectedCurrency">
            <option v-for="currency in currencies" :key="currency" :value="currency">
              {{ currency }}
            </option>
          </select>
        </label>
        <button class="buy-button" type="button">Add to bag</button>
        <p role="status">{{ liveMessage }}</p>
        <p>
          Weight: {{ variant?.weightGrams }} g. Delivery eligibility and stock are validated against
          the commerce API.
        </p>
      </div>
    </div>
  </article>
</template>
