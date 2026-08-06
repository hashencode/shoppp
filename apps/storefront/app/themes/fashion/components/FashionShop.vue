<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  ShoppingBag,
} from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { fashionSourceContract } from "../source-contract";

interface ShopProduct {
  assetId: string;
  badge: string;
  comparePrice: string;
  name: string;
  price: string;
  slug: string;
}

interface ShopData {
  categoryFilters: readonly (readonly [string, string])[];
  colorFilters: readonly (readonly [string, string, string])[];
  newArrivals: readonly ShopProduct[];
  products: readonly ShopProduct[];
  sizeFilters: readonly (readonly [string, string])[];
  tags: readonly string[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ShopData)
    : null,
);
const router = useRouter();
const collectionSlug = computed(() =>
  String(router.currentRoute.value.params.slug || "all").toLowerCase(),
);
const layoutMode = computed(() => {
  const requestedLayout = String(router.currentRoute.value.query.layout || "left-sidebar");
  return requestedLayout === "no-sidebar" || requestedLayout === "right-sidebar"
    ? requestedLayout
    : "left-sidebar";
});
const isCollectionShowcase = computed(() => collectionSlug.value === "new-arrivals");
const collectionHeadings: Readonly<Record<string, string>> = {
  accessories: "Accessories collection",
  divided: "Divided collection",
  kids: "Kids collection",
  men: "Men collection",
  women: "Women collection",
};
const pageHeading = computed(() => {
  if (isCollectionShowcase.value) return "Collection";
  return collectionHeadings[collectionSlug.value] ?? "Shop";
});
const selectedCategories = ref(new Set<string>());
const selectedColors = ref(new Set<string>());
const selectedSizes = ref(new Set<string>());
const savedProducts = ref(new Set<string>());
const arrivalPage = ref(0);
const activePage = ref(2);
const status = ref("");

function toggleSelection(kind: "category" | "color" | "size", value: string): void {
  const target =
    kind === "category" ? selectedCategories : kind === "color" ? selectedColors : selectedSizes;
  const next = new Set(target.value);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  target.value = next;
}

function toggleSaved(product: ShopProduct): void {
  const next = new Set(savedProducts.value);
  if (next.has(product.slug)) next.delete(product.slug);
  else next.add(product.slug);
  savedProducts.value = next;
  status.value = next.has(product.slug)
    ? `${product.name} saved in this preview.`
    : `${product.name} removed from saved items.`;
}

function addToBag(product: ShopProduct): void {
  status.value = `${product.name} added to the preview bag.`;
}

const arrivals = computed(() => {
  const products = data.value?.newArrivals ?? [];
  const start = arrivalPage.value * 3;
  return products.slice(start, start + 3);
});
</script>

<template>
  <section
    v-if="data"
    class="fashion-shop-page"
    :data-collection="collectionSlug"
    aria-labelledby="fashion-shop-heading"
  >
    <header class="fashion-shop-breadcrumb">
      <div class="fashion-shop-breadcrumb-inner">
        <div class="fashion-shop-breadcrumb-title">
          <h1 id="fashion-shop-heading">{{ pageHeading }}</h1>
        </div>
        <nav aria-label="Breadcrumb">
          <NuxtLink to="/">Home</NuxtLink><span>{{ pageHeading }}</span>
        </nav>
      </div>
    </header>

    <div v-if="isCollectionShowcase" class="fashion-collection-page-grid">
      <article v-for="[assetId, label, count] in fashionSourceContract.collectionPage" :key="label">
        <NuxtLink to="/collections/all" class="fashion-collection-page-media">
          <img :src="properties.resolveAsset(assetId)" :alt="label" width="600" height="450" />
          <small>{{ count }}</small>
          <span>{{ label }}</span>
        </NuxtLink>
      </article>
    </div>

    <div v-else class="fashion-shop-layout" :data-layout="layoutMode">
      <div class="fashion-shop-products">
        <div class="fashion-shop-grid">
          <article v-for="product in data.products" :key="product.slug">
            <div class="fashion-shop-product-media">
              <NuxtLink :to="`/products/${product.slug}`" :aria-label="`View ${product.name}`">
                <img
                  :src="properties.resolveAsset(product.assetId)"
                  :alt="product.name"
                  width="600"
                  height="765"
                />
                <span
                  v-if="product.badge"
                  class="fashion-shop-badge"
                  :data-kind="product.badge.toLowerCase()"
                >
                  {{ product.badge }}
                </span>
                <span class="fashion-shop-overlay" aria-hidden="true" />
              </NuxtLink>
              <div class="fashion-shop-card-actions">
                <button
                  type="button"
                  :aria-label="`Save ${product.name}`"
                  :aria-pressed="savedProducts.has(product.slug)"
                  @click="toggleSaved(product)"
                >
                  <Heart aria-hidden="true" :size="16" />
                </button>
                <NuxtLink
                  :to="`/products/${product.slug}`"
                  :aria-label="`Quick shop ${product.name}`"
                >
                  <Eye aria-hidden="true" :size="16" />
                </NuxtLink>
              </div>
              <button class="fashion-shop-add" type="button" @click="addToBag(product)">
                <ShoppingBag aria-hidden="true" :size="16" />Add to cart
              </button>
            </div>
            <h2>
              <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink>
            </h2>
            <p>
              <del>{{ product.comparePrice }}</del
              >{{ product.price }}
            </p>
          </article>
        </div>
        <nav class="fashion-shop-pagination" aria-label="Product pages">
          <button
            type="button"
            aria-label="Previous page"
            @click="activePage = Math.max(1, activePage - 1)"
          >
            <ChevronLeft aria-hidden="true" :size="18" />
          </button>
          <button
            v-for="page in 4"
            :key="page"
            type="button"
            :aria-current="activePage === page ? 'page' : undefined"
            @click="activePage = page"
          >
            {{ String(page).padStart(2, "0") }}
          </button>
          <button
            type="button"
            aria-label="Next page"
            @click="activePage = Math.min(4, activePage + 1)"
          >
            <ChevronRight aria-hidden="true" :size="18" />
          </button>
        </nav>
      </div>

      <aside
        v-if="layoutMode !== 'no-sidebar'"
        class="fashion-shop-sidebar"
        aria-label="Shop filters"
      >
        <section>
          <h2>Filter by categories</h2>
          <ul>
            <li v-for="[label, count] in data.categoryFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedCategories.has(label)"
                @click="toggleSelection('category', label)"
              >
                <span class="fashion-shop-filter-dot" />{{ label }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section>
          <h2>Filter by color</h2>
          <ul>
            <li v-for="[label, color, count] in data.colorFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedColors.has(label)"
                @click="toggleSelection('color', label)"
              >
                <span
                  class="fashion-shop-filter-dot fashion-shop-color-dot"
                  :style="{ backgroundColor: color }"
                />{{ label }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section>
          <h2>Filter by size</h2>
          <ul>
            <li v-for="[label, count] in data.sizeFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedSizes.has(label)"
                @click="toggleSelection('size', label)"
              >
                <span class="fashion-shop-filter-dot" />{{ label }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section class="fashion-shop-arrivals">
          <div class="fashion-shop-sidebar-heading">
            <h2>New arrivals</h2>
            <span>
              <button
                type="button"
                aria-label="Previous arrivals"
                @click="arrivalPage = arrivalPage === 0 ? 1 : 0"
              >
                <ArrowLeft aria-hidden="true" :size="14" />
              </button>
              <button
                type="button"
                aria-label="Next arrivals"
                @click="arrivalPage = arrivalPage === 0 ? 1 : 0"
              >
                <ArrowRight aria-hidden="true" :size="14" />
              </button>
            </span>
          </div>
          <article v-for="product in arrivals" :key="product.slug">
            <NuxtLink :to="`/products/${product.slug}`"
              ><img
                :src="properties.resolveAsset(product.assetId)"
                :alt="product.name"
                width="80"
                height="102"
            /></NuxtLink>
            <p>
              <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink
              ><span
                ><del>{{ product.comparePrice }}</del
                >{{ product.price }}</span
              >
            </p>
          </article>
        </section>
        <section class="fashion-shop-tags">
          <h2>Filter by tags</h2>
          <NuxtLink
            v-for="tag in data.tags"
            :key="tag"
            :to="`/collections/${collectionSlug}?tag=${encodeURIComponent(tag.toLowerCase())}`"
            >{{ tag }}</NuxtLink
          >
        </section>
      </aside>
    </div>
    <p v-if="status" class="sr-only" aria-live="polite">{{ status }}</p>
  </section>
</template>
