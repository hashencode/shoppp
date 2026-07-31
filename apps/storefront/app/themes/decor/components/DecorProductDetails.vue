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
    "decor.product-details",
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
    "decor.product-details",
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
  <section v-if="product && data" class="decor-product-detail">
    <nav class="decor-product-breadcrumb" aria-label="Breadcrumb">
      <NuxtLink to="/">Home</NuxtLink><span aria-hidden="true">/</span>
      <NuxtLink to="/#decor-products">Shop</NuxtLink><span aria-hidden="true">/</span>
      <span>{{ product.name }}</span>
    </nav>

    <div class="decor-product-main">
      <div class="decor-product-gallery">
        <div class="decor-product-thumbs" aria-label="Product views">
          <button
            v-for="item in gallery"
            :key="item.assetId"
            type="button"
            :aria-label="`Show ${item.name} view`"
            :aria-pressed="selectedAssetId === item.assetId"
            @click="selectedAssetId = item.assetId"
          >
            <img :src="properties.resolveAsset(item.assetId)" alt="" width="90" height="105" />
          </button>
        </div>
        <img
          class="decor-product-primary-image"
          :src="properties.resolveAsset(selectedAssetId || product.assetId)"
          :alt="product.name"
          width="620"
          height="720"
        />
      </div>

      <div class="decor-product-info">
        <span class="decor-product-vendor">{{ product.vendor }}</span>
        <h1>{{ product.name }}</h1>
        <div class="decor-product-meta">
          <span aria-label="5 out of 5 stars">
            <Star
              v-for="index in 5"
              :key="index"
              aria-hidden="true"
              :size="15"
              fill="currentColor"
            />
          </span>
          <a href="#decor-product-tabs">128 Reviews</a>
          <span><strong>SKU:</strong> {{ product.sku }}</span>
        </div>
        <p class="decor-product-price">
          <del v-if="product.comparePrice">{{ product.comparePrice }}</del
          >{{ product.price }}
        </p>
        <p class="decor-product-description">{{ product.description }}</p>

        <fieldset>
          <legend>Finish</legend>
          <label v-for="color in product.colors" :key="color">
            <input v-model="selectedColor" type="radio" name="decor-color" :value="color" />
            <span>{{ color }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>Size</legend>
          <label v-for="size in product.sizes" :key="size">
            <input v-model="selectedSize" type="radio" name="decor-size" :value="size" />
            <span>{{ size }}</span>
          </label>
        </fieldset>

        <div class="decor-product-purchase">
          <div class="decor-product-quantity" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" @click="changeQuantity(-1)">
              <Minus aria-hidden="true" :size="16" />
            </button>
            <output>{{ quantity }}</output>
            <button type="button" aria-label="Increase quantity" @click="changeQuantity(1)">
              <Plus aria-hidden="true" :size="16" />
            </button>
          </div>
          <button class="decor-product-add" type="button" @click="addToPreviewBag">
            <ShoppingBag aria-hidden="true" :size="19" />Add to preview bag
          </button>
          <button
            class="decor-product-save"
            type="button"
            aria-label="Save product"
            :aria-pressed="saved"
            @click="toggleSaved"
          >
            <Heart aria-hidden="true" :size="19" :fill="saved ? 'currentColor' : 'none'" />
          </button>
        </div>
        <p class="decor-product-message" aria-live="polite">{{ message }}</p>
        <div class="decor-product-delivery">
          <p><strong>Estimated delivery:</strong> March 03 – March 07</p>
          <p><strong>Free shipping & returns:</strong> On all orders over $50</p>
        </div>
        <div class="decor-product-checkout">
          <strong>Guarantee safe and secure checkout</strong>
          <span>VISA · Mastercard · AMEX · Discover</span>
        </div>
        <p><strong>Category:</strong> {{ product.category }}</p>
      </div>
    </div>

    <section id="decor-product-tabs" class="decor-product-tabs">
      <div role="tablist" aria-label="Product information">
        <button
          v-for="(tab, index) in tabs"
          ref="tabButtons"
          :id="`decor-product-tab-${index}`"
          :key="tab"
          type="button"
          role="tab"
          :aria-selected="activeTab === index"
          :tabindex="activeTab === index ? 0 : -1"
          :aria-controls="`decor-product-panel-${index}`"
          @click="selectTab(index)"
          @keydown="onTabKeydown($event, index)"
        >
          {{ tab }}
        </button>
      </div>
      <div
        :id="`decor-product-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`decor-product-tab-${activeTab}`"
      >
        <p v-if="activeTab === 0">{{ product.description }}</p>
        <dl v-else-if="activeTab === 1">
          <div>
            <dt>Material</dt>
            <dd>Natural mixed materials</dd>
          </div>
          <div>
            <dt>Finish</dt>
            <dd>Low-sheen protective finish</dd>
          </div>
          <div>
            <dt>Care</dt>
            <dd>Wipe clean with a soft cloth</dd>
          </div>
        </dl>
        <p v-else>Complimentary returns within 15 days in the original condition.</p>
      </div>
    </section>

    <section class="decor-related-products" aria-labelledby="decor-related-heading">
      <span>You may also like</span>
      <h2 id="decor-related-heading">{{ data.relatedHeading }}</h2>
      <div>
        <article v-for="item in relatedProducts" :key="item.slug">
          <NuxtLink :to="`/products/${item.slug}`">
            <img
              :src="properties.resolveAsset(item.assetId)"
              :alt="item.name"
              width="620"
              height="720"
            />
            <strong>{{ item.name }}</strong>
            <span>{{ item.price }}</span>
          </NuxtLink>
        </article>
      </div>
    </section>
  </section>
  <section v-else class="decor-product-not-found">
    <h1>Product not found</h1>
    <NuxtLink to="/#decor-products">Return to the collection</NuxtLink>
  </section>
</template>
