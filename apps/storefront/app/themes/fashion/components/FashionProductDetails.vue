<script setup lang="ts">
import { Heart, Minus, Plus, ShoppingBag, Star } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface Product {
  assetId: string;
  category: string;
  colors: string[];
  comparePrice?: string;
  description: string;
  name: string;
  price: string;
  sizes: string[];
  sku: string;
  slug: string;
  vendor: string;
}

interface ProductData {
  products: Product[];
  relatedHeading: string;
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const router = useRouter();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as ProductData)
    : null,
);
const product = computed(() => {
  const slug = String(router.currentRoute.value.params.slug ?? "");
  return data.value?.products.find((item) => item.slug === slug) ?? null;
});
const gallery = computed(() => {
  return product.value ? [product.value] : [];
});
const relatedProducts = computed(() => {
  const products = data.value?.products ?? [];
  if (!product.value) return [];
  const index = products.findIndex(({ slug }) => slug === product.value?.slug);
  return Array.from({ length: Math.min(3, products.length - 1) }, (_, offset) => {
    return products[(index + offset + 1) % products.length]!;
  });
});
const selectedAssetId = ref("");
const selectedColor = ref("");
const selectedSize = ref("");
const quantity = ref(1);
const saved = ref(false);
const message = ref("");
const activeTab = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const tabs = ["Description", "Additional information", "Shipping and return"] as const;

watch(
  product,
  (next) => {
    selectedAssetId.value = next?.assetId ?? "";
    selectedColor.value = next?.colors[0] ?? "";
    selectedSize.value = next?.sizes[0] ?? "";
    quantity.value = 1;
    saved.value = false;
    message.value = "";
  },
  { immediate: true },
);

function changeQuantity(delta: number): void {
  quantity.value = Math.min(9, Math.max(1, quantity.value + delta));
  if (!product.value) return;
  recordPreviewIntent(
    {
      id: `quantity-${product.value.slug}`,
      intent: "cart.quantity-preview",
      label: `Change ${product.value.name} quantity`,
      value: String(quantity.value),
    },
    "fashion.product-details",
  );
}

function addToPreviewBag(): void {
  if (!product.value) return;
  recordPreviewIntent(
    {
      id: `add-${product.value.slug}`,
      intent: "cart.add-preview",
      label: `Add ${product.value.name} to preview bag`,
    },
    "fashion.product-details",
  );
  message.value = `${quantity.value} × ${product.value.name} added to the preview bag.`;
}

function toggleSaved(): void {
  if (!product.value) return;
  saved.value = !saved.value;
  message.value = saved.value
    ? `${product.value.name} saved in this preview.`
    : `${product.value.name} removed from saved items.`;
}

async function selectTab(index: number, focus = false): Promise<void> {
  activeTab.value = index;
  if (!focus) return;
  await nextTick();
  tabButtons.value[index]?.focus();
}

function onTabKeydown(event: KeyboardEvent, index: number): void {
  let target: number;
  switch (event.key) {
    case "ArrowRight":
      target = (index + 1) % tabs.length;
      break;
    case "ArrowLeft":
      target = (index - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = tabs.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  void selectTab(target, true);
}
</script>

<template>
  <section v-if="product && data" class="fashion-product-detail">
    <nav class="fashion-product-breadcrumb" aria-label="Breadcrumb">
      <NuxtLink to="/">Home</NuxtLink><span aria-hidden="true">/</span>
      <NuxtLink to="/#fashion-bestsellers">Shop</NuxtLink><span aria-hidden="true">/</span>
      <span>{{ product.name }}</span>
    </nav>

    <div class="fashion-product-main">
      <div class="fashion-product-gallery">
        <div class="fashion-product-thumbs" aria-label="Product views">
          <button
            v-for="item in gallery"
            :key="item.assetId"
            type="button"
            :aria-label="`Show ${item.name} view`"
            :aria-pressed="selectedAssetId === item.assetId"
            @click="selectedAssetId = item.assetId"
          >
            <img :src="properties.resolveAsset(item.assetId)" alt="" width="90" height="115" />
          </button>
        </div>
        <img
          class="fashion-product-primary-image"
          :src="properties.resolveAsset(selectedAssetId || product.assetId)"
          :alt="product.name"
          width="600"
          height="765"
        />
      </div>

      <div class="fashion-product-info">
        <span class="fashion-product-vendor">{{ product.vendor }}</span>
        <h1>{{ product.name }}</h1>
        <div class="fashion-product-meta">
          <span aria-label="5 out of 5 stars">
            <Star
              v-for="index in 5"
              :key="index"
              aria-hidden="true"
              :size="15"
              fill="currentColor"
            />
          </span>
          <a href="#fashion-product-tabs">165 Reviews</a>
          <span><strong>SKU:</strong> {{ product.sku }}</span>
        </div>
        <p class="fashion-product-price">
          <del v-if="product.comparePrice">{{ product.comparePrice }}</del
          >{{ product.price }}
        </p>
        <p class="fashion-product-description">{{ product.description }}</p>

        <fieldset>
          <legend>Color</legend>
          <label v-for="color in product.colors" :key="color">
            <input v-model="selectedColor" type="radio" name="fashion-color" :value="color" />
            <span>{{ color }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Size</legend>
          <label v-for="size in product.sizes" :key="size">
            <input v-model="selectedSize" type="radio" name="fashion-size" :value="size" />
            <span>{{ size }}</span>
          </label>
        </fieldset>

        <div class="fashion-product-purchase">
          <div class="fashion-product-quantity" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" @click="changeQuantity(-1)">
              <Minus aria-hidden="true" :size="16" />
            </button>
            <output>{{ quantity }}</output>
            <button type="button" aria-label="Increase quantity" @click="changeQuantity(1)">
              <Plus aria-hidden="true" :size="16" />
            </button>
          </div>
          <button class="fashion-product-add" type="button" @click="addToPreviewBag">
            <ShoppingBag aria-hidden="true" :size="19" />Add to preview bag
          </button>
          <button
            class="fashion-product-save"
            type="button"
            aria-label="Save product"
            :aria-pressed="saved"
            @click="toggleSaved"
          >
            <Heart aria-hidden="true" :size="19" :fill="saved ? 'currentColor' : 'none'" />
          </button>
        </div>
        <p class="fashion-product-message" aria-live="polite">{{ message }}</p>
        <div class="fashion-product-delivery">
          <p><strong>Estimated delivery:</strong> March 03 – March 07</p>
          <p><strong>Free shipping & returns:</strong> On all orders over $50</p>
        </div>
        <div class="fashion-product-checkout">
          <strong>Guarantee safe and secure checkout</strong>
          <span>VISA · Mastercard · AMEX · Discover</span>
        </div>
        <p><strong>Category:</strong> {{ product.category }}</p>
      </div>
    </div>

    <section id="fashion-product-tabs" class="fashion-product-tabs">
      <div role="tablist" aria-label="Product information">
        <button
          v-for="(tab, index) in tabs"
          ref="tabButtons"
          :id="`fashion-product-tab-${index}`"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTab === index"
          :tabindex="activeTab === index ? 0 : -1"
          :aria-controls="`fashion-product-panel-${index}`"
          @click="selectTab(index)"
          @keydown="onTabKeydown($event, index)"
        >
          {{ tab }}
        </button>
      </div>
      <div
        :id="`fashion-product-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`fashion-product-tab-${activeTab}`"
      >
        <p v-if="activeTab === 0">{{ product.description }}</p>
        <dl v-else-if="activeTab === 1">
          <div>
            <dt>Material</dt>
            <dd>Soft-touch woven blend</dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>Relaxed, true to size</dd>
          </div>
          <div>
            <dt>Care</dt>
            <dd>Cold wash, line dry</dd>
          </div>
        </dl>
        <p v-else>Complimentary returns within 15 days in the original condition.</p>
      </div>
    </section>

    <section class="fashion-related-products" aria-labelledby="fashion-related-heading">
      <h2 id="fashion-related-heading">{{ data.relatedHeading }}</h2>
      <div>
        <article v-for="item in relatedProducts" :key="item.slug">
          <NuxtLink :to="`/products/${item.slug}`">
            <img
              :src="properties.resolveAsset(item.assetId)"
              :alt="item.name"
              width="600"
              height="765"
            />
            <strong>{{ item.name }}</strong>
            <span>{{ item.price }}</span>
          </NuxtLink>
        </article>
      </div>
    </section>
  </section>
  <section v-else class="fashion-product-not-found">
    <h1>Product not found</h1>
    <NuxtLink to="/#fashion-bestsellers">Return to the collection</NuxtLink>
  </section>
</template>
