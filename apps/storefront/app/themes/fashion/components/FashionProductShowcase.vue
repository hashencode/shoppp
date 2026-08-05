<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useFashionSourceReveal } from "../composables/useFashionSourceReveal";
interface ProductData {
  heading: string;
  products: {
    assetId: string;
    badge?: string;
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
const productGrid = useTemplateRef<HTMLElement>("productGrid");
useFashionSourceReveal(productGrid, {
  delayMs: 0,
  durationMs: 300,
  initialTransform: "translate3d(0, -15px, 0)",
  itemSelector: ":scope > article",
  staggerMs: 100,
});

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

function headingLead(heading: string): string {
  return heading.split(" ").slice(0, -1).join(" ");
}

function headingHighlight(heading: string): string {
  return heading.split(" ").at(-1) ?? heading;
}
</script>
<template>
  <section v-if="data" :id="sectionId" class="fashion-products">
    <h2>
      {{ headingLead(data.heading) }}
      <strong>{{ headingHighlight(data.heading) }}</strong>
    </h2>
    <div ref="productGrid" class="fashion-product-grid">
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
              height="765"
              loading="lazy"
            />
            <span class="fashion-product-overlay" aria-hidden="true"></span>
          </NuxtLink>
          <span
            v-if="product.badge"
            class="fashion-product-badge"
            :data-kind="product.badge.toLowerCase()"
            aria-hidden="true"
            >{{ product.badge }}</span
          >
          <div class="fashion-product-hover">
            <button
              type="button"
              :aria-label="`Save ${product.name}`"
              :aria-pressed="savedProducts.has(product.slug)"
              @click="toggleSaved(product)"
            >
              <span
                class="fashion-feather-icon fashion-feather-heart"
                :data-filled="savedProducts.has(product.slug)"
                aria-hidden="true"
              />
            </button>
            <NuxtLink :to="`/products/${product.slug}`" :aria-label="`Quick shop ${product.name}`">
              <span class="fashion-feather-icon fashion-feather-eye" aria-hidden="true" />
            </NuxtLink>
          </div>
          <button
            class="fashion-product-cart"
            type="button"
            :aria-label="`Add ${product.name} to preview bag`"
            @click="addToPreviewBag(product)"
          >
            <span class="fashion-feather-icon fashion-feather-shopping-bag" aria-hidden="true" />
            <span>Add to cart</span>
          </button>
        </div>
        <span v-if="product.badge" class="sr-only">Product status: {{ product.badge }}</span>
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
