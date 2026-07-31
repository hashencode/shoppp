<script setup lang="ts">
import { Eye, Heart, ShoppingBag } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface ProductData {
  heading: string;
  products: {
    assetId: string;
    comparePrice?: string;
    name: string;
    price: string;
    slug: string;
  }[];
}
const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ProductData)
    : null,
);
const sectionId = computed(() =>
  data.value?.heading.toLowerCase().includes("best") ? "fashion-bestsellers" : "fashion-featured",
);
const savedProducts = ref(new Set<string>());
const message = ref("");

function toggleSaved(product: ProductData["products"][number]): void {
  const next = new Set(savedProducts.value);
  if (next.has(product.slug)) next.delete(product.slug);
  else next.add(product.slug);
  savedProducts.value = next;
  message.value = next.has(product.slug)
    ? `${product.name} saved in this preview.`
    : `${product.name} removed from saved items.`;
}

function addToPreviewBag(product: ProductData["products"][number]): void {
  recordPreviewIntent(
    {
      id: `add-${product.slug}`,
      intent: "cart.add-preview",
      label: `Add ${product.name} to preview bag`,
    },
    "fashion.product-showcase",
  );
  message.value = `${product.name} added to the preview bag.`;
}
</script>
<template>
  <section v-if="data" :id="sectionId" class="fashion-products">
    <h2>{{ data.heading }}</h2>
    <div class="fashion-product-grid">
      <article v-for="product in data.products" :key="product.assetId" class="fashion-product-card">
        <div class="fashion-product-media">
          <NuxtLink
            class="fashion-product-link"
            :to="`/products/${product.slug}`"
            :aria-label="`View ${product.name}`"
          >
            <img
              :src="properties.resolveAsset(product.assetId)"
              :alt="product.name"
              width="600"
              height="760"
              loading="lazy"
            />
            <span class="fashion-product-overlay" aria-hidden="true"></span>
          </NuxtLink>
          <div class="fashion-product-hover">
            <button
              type="button"
              :aria-label="`Save ${product.name}`"
              :aria-pressed="savedProducts.has(product.slug)"
              @click="toggleSaved(product)"
            >
              <Heart
                aria-hidden="true"
                :size="16"
                :fill="savedProducts.has(product.slug) ? 'currentColor' : 'none'"
              />
            </button>
            <NuxtLink :to="`/products/${product.slug}`" :aria-label="`Quick shop ${product.name}`">
              <Eye aria-hidden="true" :size="16" />
            </NuxtLink>
          </div>
          <button
            class="fashion-product-cart"
            type="button"
            :aria-label="`Add ${product.name} to preview bag`"
            @click="addToPreviewBag(product)"
          >
            <ShoppingBag aria-hidden="true" :size="17" />
            <span>Add to cart</span>
          </button>
        </div>
        <h3>
          <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink>
        </h3>
        <p>
          <del v-if="product.comparePrice">{{ product.comparePrice }}</del
          >{{ product.price }}
        </p>
      </article>
    </div>
    <p class="fashion-preview-message" aria-live="polite">{{ message }}</p>
  </section>
</template>
