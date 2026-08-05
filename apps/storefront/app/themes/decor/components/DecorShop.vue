<script setup lang="ts">
import { ArrowLeft, ArrowRight, Eye, Heart, ShoppingBag } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface ShopProduct {
  assetId: string;
  badge?: string;
  comparePrice?: string;
  name: string;
  price: string;
  slug: string;
}

interface ShopData {
  categoryFilters: readonly (readonly [string, string])[];
  colorFilters: readonly (readonly [string, string, string])[];
  fabricFilters: readonly (readonly [string, string, string])[];
  newArrivals: readonly ShopProduct[];
  priceFilters: readonly (readonly [string, string])[];
  products: readonly ShopProduct[];
  tags: readonly string[];
  titleAssetId: string;
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
const selectedFilters = ref(new Set<string>());
const savedProducts = ref(new Set<string>());
const arrivalPage = ref(0);
const activePage = ref(2);
const status = ref("");
const layoutIconAssetIds = [
  "decor.shop-two-column",
  "decor.shop-three-column",
  "decor.shop-four-column",
  "decor.shop-list",
] as const;

const arrivals = computed(() => {
  const products = data.value?.newArrivals ?? [];
  const start = arrivalPage.value * 3;
  return products.slice(start, start + 3);
});

function toggleFilter(value: string): void {
  const next = new Set(selectedFilters.value);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  selectedFilters.value = next;
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
</script>

<template>
  <section v-if="data" class="decor-shop-page" aria-labelledby="decor-shop-heading">
    <header
      class="decor-shop-title"
      :style="{ backgroundImage: `url(${properties.resolveAsset(data.titleAssetId)})` }"
    >
      <h1 id="decor-shop-heading">Shop</h1>
      <nav aria-label="Breadcrumb"><NuxtLink to="/">Home</NuxtLink><span>shop</span></nav>
    </header>

    <div class="decor-shop-layout">
      <div class="decor-shop-products">
        <div class="decor-shop-toolbar">
          <div class="decor-shop-layout-icons" aria-hidden="true">
            <img
              v-for="assetId in layoutIconAssetIds"
              :key="assetId"
              :src="properties.resolveAsset(assetId)"
              alt=""
            />
          </div>
          <span>Showing 1–12 of 48 results</span>
          <label>
            <span class="sr-only">Sort products</span>
            <select aria-label="Default sorting">
              <option>Default sorting</option>
              <option>Sort by popularity</option>
              <option>Sort by average rating</option>
              <option>Sort by latest</option>
              <option>Sort by price: low to high</option>
              <option>Sort by price: high to low</option>
            </select>
          </label>
        </div>

        <div class="decor-shop-grid">
          <article v-for="product in data.products" :key="product.slug">
            <div class="decor-shop-media">
              <NuxtLink :to="`/products/${product.slug}`" :aria-label="`View ${product.name}`">
                <img
                  :src="properties.resolveAsset(product.assetId)"
                  :alt="product.name"
                  width="600"
                  height="700"
                />
                <span v-if="product.badge" class="decor-shop-badge">{{ product.badge }}</span>
                <span class="decor-shop-overlay" aria-hidden="true" />
              </NuxtLink>
              <div class="decor-shop-actions">
                <button
                  type="button"
                  :aria-label="`Save ${product.name}`"
                  :aria-pressed="savedProducts.has(product.slug)"
                  @click="toggleSaved(product)"
                >
                  <Heart aria-hidden="true" :size="15" />
                </button>
                <button
                  type="button"
                  :aria-label="`Add ${product.name} to bag`"
                  @click="addToBag(product)"
                >
                  <ShoppingBag aria-hidden="true" :size="15" />
                </button>
                <NuxtLink
                  :to="`/products/${product.slug}`"
                  :aria-label="`Quick shop ${product.name}`"
                >
                  <Eye aria-hidden="true" :size="15" />
                </NuxtLink>
              </div>
            </div>
            <h2>
              <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink>
            </h2>
            <p>
              <del v-if="product.comparePrice">{{ product.comparePrice }}</del
              >{{ product.price }}
            </p>
          </article>
        </div>

        <nav class="decor-shop-pagination" aria-label="Product pages">
          <button
            type="button"
            aria-label="Previous page"
            @click="activePage = Math.max(1, activePage - 1)"
          >
            <ArrowLeft aria-hidden="true" :size="18" />
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
            <ArrowRight aria-hidden="true" :size="18" />
          </button>
        </nav>
      </div>

      <aside class="decor-shop-sidebar" aria-label="Shop filters">
        <section>
          <h2>Filter by categories</h2>
          <ul>
            <li v-for="[label, count] in data.categoryFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedFilters.has(label)"
                @click="toggleFilter(label)"
              >
                <i />{{ label }}</button
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
                :aria-pressed="selectedFilters.has(label)"
                @click="toggleFilter(label)"
              >
                <i class="decor-shop-color" :style="{ backgroundColor: color }" />{{
                  label
                }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section>
          <h2>Filter by fabric</h2>
          <ul>
            <li v-for="[label, assetId, count] in data.fabricFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedFilters.has(label)"
                @click="toggleFilter(label)"
              >
                <i class="decor-shop-fabric"
                  ><img :src="properties.resolveAsset(assetId)" alt="" width="30" height="30" /></i
                >{{ label }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section>
          <h2>Filter by price</h2>
          <ul>
            <li v-for="[label, count] in data.priceFilters" :key="label">
              <button
                type="button"
                :aria-pressed="selectedFilters.has(label)"
                @click="toggleFilter(label)"
              >
                <i />{{ label }}</button
              ><small>{{ count }}</small>
            </li>
          </ul>
        </section>
        <section class="decor-shop-arrivals">
          <header>
            <h2>New arrivals</h2>
            <span>
              <button
                type="button"
                aria-label="Previous arrivals"
                @click="arrivalPage = arrivalPage === 0 ? 1 : 0"
              >
                <ArrowLeft aria-hidden="true" :size="13" />
              </button>
              <button
                type="button"
                aria-label="Next arrivals"
                @click="arrivalPage = arrivalPage === 0 ? 1 : 0"
              >
                <ArrowRight aria-hidden="true" :size="13" />
              </button>
            </span>
          </header>
          <article v-for="product in arrivals" :key="product.slug">
            <NuxtLink :to="`/products/${product.slug}`"
              ><img
                :src="properties.resolveAsset(product.assetId)"
                :alt="product.name"
                width="80"
                height="93"
            /></NuxtLink>
            <p>
              <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink
              ><span
                ><del v-if="product.comparePrice">{{ product.comparePrice }}</del
                >{{ product.price }}</span
              >
            </p>
          </article>
        </section>
        <section class="decor-shop-tags">
          <h2>Filter by tags</h2>
          <NuxtLink
            v-for="tag in data.tags"
            :key="tag"
            :to="`/collections/all?tag=${encodeURIComponent(tag)}`"
            >{{ tag }}</NuxtLink
          >
        </section>
      </aside>
    </div>
    <p v-if="status" class="sr-only" aria-live="polite">{{ status }}</p>
  </section>
</template>
