<script setup lang="ts">
import { Check } from "@lucide/vue";
import { paymentAssetName, type ThemeAssetResolver } from "../../../theme-engine/assets";
import { recordPreviewIntent } from "../../../theme-engine/actions";
import {
  createInteractionController,
  type InteractionSnapshot,
} from "../../../theme-engine/interaction-controller";
import ThemeProductLightbox from "../../../theme-engine/components/ThemeProductLightbox.vue";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface Product {
  assetId: string;
  badge?: string;
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
  detailOptions?: {
    actions: readonly string[];
    gallery: {
      assetIds?: readonly string[];
      autoplayMs: number;
      count: number;
      direction: string;
      lightbox: boolean;
      loop: boolean;
    };
    paymentAssets: readonly string[];
    product: Pick<
      Product,
      "category" | "comparePrice" | "description" | "name" | "price" | "sku" | "vendor"
    >;
    reviewCount: number;
    tabs: readonly string[];
    tags: readonly string[];
  };
  products: Product[];
  relatedHeading: string;
}

interface ProductGalleryOptions {
  assetIds?: readonly string[];
  autoplayMs: number;
  count: number;
  direction?: string;
  lightbox?: boolean;
  loop?: boolean;
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
  const routeProduct = data.value?.products.find((item) => item.slug === slug);
  if (!routeProduct) return null;
  return { ...routeProduct, ...data.value?.detailOptions?.product };
});
const galleryOptions = computed<ProductGalleryOptions>(
  () => data.value?.detailOptions?.gallery ?? { autoplayMs: 2_000, count: 6 },
);
const gallery = computed(() => {
  return product.value
    ? Array.from({ length: galleryOptions.value.count }, (_, index) => ({
        assetId: galleryOptions.value.assetIds?.[index] ?? product.value!.assetId,
        id: `${product.value!.slug}-view-${index + 1}`,
        label: `${product.value!.name} view ${index + 1}`,
      }))
    : [];
});
const relatedProducts = computed(() => {
  const products = data.value?.products ?? [];
  if (!product.value) return [];
  return products.slice(0, 4);
});
const galleryController = createInteractionController({
  autoplayDelayMs: galleryOptions.value.autoplayMs,
  count: galleryOptions.value.count,
  transitionDurationMs: 300,
});
const galleryMotion = shallowRef<InteractionSnapshot>(galleryController.snapshot());
const selectedGalleryIndex = computed(() =>
  galleryMotion.value.phase === "transitioning"
    ? galleryMotion.value.targetIndex
    : galleryMotion.value.currentIndex,
);
const selectedColor = ref("");
const selectedSize = ref("");
const quantity = ref(1);
const saved = ref(false);
const compared = ref(false);
const message = ref("");
const activeTab = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const lightbox = ref<InstanceType<typeof ThemeProductLightbox> | null>(null);
const tabs = computed(
  () =>
    data.value?.detailOptions?.tabs ?? [
      "Description",
      "Additional information",
      "Shipping and return",
      "Reviews (3)",
    ],
);
const detailActions = computed(
  () => data.value?.detailOptions?.actions ?? ["Compare", "Ask a question", "Share"],
);
const paymentAssets = computed(() => data.value?.detailOptions?.paymentAssets ?? []);
const productTags = computed(
  () => data.value?.detailOptions?.tags ?? ["Shirts", "Cotton", "Printed"],
);
const reviewCount = computed(() => data.value?.detailOptions?.reviewCount ?? 165);
const currentGallerySrc = computed(() =>
  properties.resolveAsset(
    gallery.value[selectedGalleryIndex.value]?.assetId ?? product.value?.assetId ?? "",
  ),
);

watch(
  product,
  (next) => {
    selectedColor.value = next?.colors.at(-1) ?? "";
    selectedSize.value = next?.sizes.at(-1) ?? "";
    quantity.value = 1;
    saved.value = false;
    compared.value = false;
    message.value = "";
  },
  { immediate: true },
);

let unsubscribeGallery: () => void = () => undefined;

onMounted(() => {
  unsubscribeGallery = galleryController.subscribe((snapshot) => {
    galleryMotion.value = snapshot;
  });
  galleryController.start();
});

onBeforeUnmount(() => {
  unsubscribeGallery();
  galleryController.dispose();
});

function galleryKeydown(event: KeyboardEvent): void {
  if (!galleryController.handleKey(event.key)) return;
  event.preventDefault();
}

function colorValue(color: string): string {
  return (
    {
      Indigo: "#5881bf",
      Ochre: "#d4af37",
      Sage: "#87a968",
    }[color] ?? "#828282"
  );
}

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
      target = (index + 1) % tabs.value.length;
      break;
    case "ArrowLeft":
      target = (index - 1 + tabs.value.length) % tabs.value.length;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = tabs.value.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  void selectTab(target, true);
}

async function runSecondaryAction(action: string): Promise<void> {
  if (!product.value) return;
  recordPreviewIntent(
    {
      id: `${action.toLowerCase().replaceAll(/[^a-z]+/g, "-")}-${product.value.slug}`,
      intent: "variant.select",
      label: `${action} ${product.value.name}`,
      value: action,
    },
    "fashion.product-details",
  );
  if (action === "Compare") {
    compared.value = !compared.value;
    message.value = compared.value
      ? `${product.value.name} added to comparison.`
      : `${product.value.name} removed from comparison.`;
    return;
  }
  if (action === "Ask a question") {
    message.value = `A product question form is ready for ${product.value.name}.`;
    return;
  }
  const shareData = { title: product.value.name, url: window.location.href };
  if (navigator.share) {
    await navigator.share(shareData).catch(() => undefined);
    message.value = `Share options opened for ${product.value.name}.`;
    return;
  }
  await navigator.clipboard?.writeText(shareData.url).catch(() => undefined);
  message.value = `Product link copied for ${product.value.name}.`;
}
</script>

<template>
  <section v-if="product && data" class="fashion-product-detail">
    <nav class="fashion-product-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><NuxtLink to="/">Home</NuxtLink></li>
        <li><NuxtLink to="/collections/women">Shop</NuxtLink></li>
        <li>{{ product.name }}</li>
      </ol>
    </nav>

    <div class="fashion-product-main">
      <div class="fashion-product-gallery">
        <div class="fashion-product-thumbs" aria-label="Product views">
          <button
            v-for="(item, index) in gallery"
            :key="item.id"
            type="button"
            :aria-label="`Show ${item.label}`"
            :aria-pressed="selectedGalleryIndex === index"
            @click="galleryController.select(index)"
          >
            <img :src="properties.resolveAsset(item.assetId)" alt="" width="90" height="115" />
          </button>
        </div>
        <div
          class="fashion-product-gallery-stage"
          aria-label="Product image gallery"
          tabindex="0"
          :data-motion-active-index="selectedGalleryIndex"
          :data-motion-phase="galleryMotion.phase"
          @keydown="galleryKeydown"
          @mouseenter="galleryController.pause('hover')"
          @mouseleave="galleryController.resume('hover')"
          @focusin="galleryController.pause('focus')"
          @focusout="galleryController.resume('focus')"
        >
          <button
            type="button"
            class="fashion-product-image-preview"
            aria-label="Open product image preview"
            @click="lightbox?.open()"
          >
            <img
              class="fashion-product-primary-image"
              :src="currentGallerySrc"
              :alt="product.name"
              width="600"
              height="765"
              decoding="sync"
              fetchpriority="high"
            />
          </button>
        </div>
        <ThemeProductLightbox
          ref="lightbox"
          :src="currentGallerySrc"
          :alt="product.name"
          @opened="galleryController.pause('manual')"
          @closed="galleryController.resume('manual')"
          @previous="galleryController.previous()"
          @next="galleryController.next()"
        />
      </div>

      <div class="fashion-product-info">
        <span class="fashion-product-vendor">{{ product.vendor }}</span>
        <h1>{{ product.name }}</h1>
        <div class="fashion-product-meta">
          <span aria-label="5 out of 5 stars">
            <i v-for="index in 5" :key="index" class="fashion-product-star" aria-hidden="true" />
          </span>
          <a href="#fashion-product-tabs">{{ reviewCount }} Reviews</a>
          <span><strong>SKU:</strong> {{ product.sku }}</span>
        </div>
        <p class="fashion-product-price">
          <span
            ><del v-if="product.comparePrice">{{ product.comparePrice }}</del
            >{{ product.price }}</span
          >
        </p>
        <p class="fashion-product-description">{{ product.description }}</p>

        <div
          class="fashion-product-option fashion-product-colors"
          role="group"
          aria-labelledby="fashion-product-color-label"
        >
          <span id="fashion-product-color-label" class="fashion-product-option-label">Color</span>
          <div class="fashion-product-option-list fashion-product-color-list">
            <label v-for="color in product.colors" :key="color">
              <input v-model="selectedColor" type="radio" name="fashion-color" :value="color" />
              <span :style="{ '--fashion-swatch': colorValue(color) }">{{ color }}</span>
            </label>
          </div>
        </div>
        <div
          class="fashion-product-option fashion-product-sizes"
          role="group"
          aria-labelledby="fashion-product-size-label"
        >
          <span id="fashion-product-size-label" class="fashion-product-option-label">Size</span>
          <div class="fashion-product-option-list fashion-product-size-list">
            <label v-for="size in product.sizes" :key="size">
              <input v-model="selectedSize" type="radio" name="fashion-size" :value="size" />
              <span>{{ size }}</span>
            </label>
          </div>
        </div>

        <div class="fashion-product-purchase">
          <div class="fashion-product-quantity" aria-label="Quantity">
            <button
              type="button"
              aria-label="Decrease quantity"
              @click="changeQuantity(-1)"
            ></button>
            <output>{{ quantity }}</output>
            <button
              type="button"
              aria-label="Increase quantity"
              @click="changeQuantity(1)"
            ></button>
          </div>
          <button class="fashion-product-add" type="button" @click="addToPreviewBag">
            <i class="fashion-product-icon fashion-product-icon-bag" aria-hidden="true" />Add to
            cart
          </button>
          <button
            class="fashion-product-save"
            type="button"
            aria-label="Save product"
            :aria-pressed="saved"
            @click="toggleSaved"
          >
            <i class="fashion-product-icon fashion-product-icon-heart" aria-hidden="true" />
          </button>
        </div>
        <div class="fashion-product-secondary-actions" aria-label="Product actions">
          <button
            v-for="action in detailActions"
            :key="action"
            type="button"
            :aria-pressed="action === 'Compare' ? compared : undefined"
            @click="runSecondaryAction(action)"
          >
            <i
              v-if="action === 'Compare'"
              class="fashion-product-icon fashion-product-icon-repeat"
              aria-hidden="true"
            />
            <i
              v-else-if="action === 'Ask a question'"
              class="fashion-product-icon fashion-product-icon-mail"
              aria-hidden="true"
            />
            <i v-else class="fashion-product-icon fashion-product-icon-share" aria-hidden="true" />
            {{ action }}
          </button>
        </div>
        <p v-if="message" class="fashion-product-message" aria-live="polite">{{ message }}</p>
        <div class="fashion-product-delivery">
          <p>
            <i class="fashion-product-icon fashion-product-icon-truck" aria-hidden="true" /><span
              ><strong>Estimated delivery:</strong> March 03 - March 07</span
            >
          </p>
          <p>
            <i class="fashion-product-icon fashion-product-icon-archive" aria-hidden="true" /><span
              ><strong>Free shipping & returns:</strong> On all orders over $50</span
            >
          </p>
        </div>
        <div class="fashion-product-checkout">
          <strong>Guarantee safe and secure checkout</strong>
          <div class="fashion-product-payment-methods">
            <img
              v-for="assetId in paymentAssets"
              :key="assetId"
              :src="properties.resolveAsset(assetId)"
              :alt="paymentAssetName(assetId)"
              width="48"
              height="30"
            />
          </div>
        </div>
        <div class="fashion-product-taxonomy">
          <p>
            <strong>Category:</strong>{{ " " }} <NuxtLink to="/collections/all">Fashion</NuxtLink>,
            <NuxtLink to="/collections/women">{{ product.category }}</NuxtLink>
          </p>
          <p>
            <strong>Tags:</strong>{{ " " }}
            <template v-for="(tag, index) in productTags" :key="tag">
              <NuxtLink to="/collections/all">{{ tag }}</NuxtLink
              ><template v-if="index < productTags.length - 1">, </template>
            </template>
          </p>
        </div>
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
          <span class="fashion-product-tab-border" aria-hidden="true" />
        </button>
      </div>
      <div
        :id="`fashion-product-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`fashion-product-tab-${activeTab}`"
      >
        <div v-if="activeTab === 0" class="fashion-product-description-panel">
          <div>
            <p class="fashion-product-description-kicker">
              <i class="fashion-product-description-heart" aria-hidden="true" />We make you feel
              special
            </p>
            <h2>Unique and quirky designs for the latest trends product.</h2>
            <p>
              Lorem ipsum is simply dummy text of the printing and typesetting industry lorem ipsum
              has been the standard dummy text.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" :size="12" />Made from soft yet durable 100% organic
                cotton twill.
              </li>
              <li>
                <Check aria-hidden="true" :size="12" />Front and back yoke seams allow a full range
                of shoulder.
              </li>
              <li>
                <Check aria-hidden="true" :size="12" />Interior storm flap and zipper garage at chin
                for comfort.
              </li>
              <li>
                <Check aria-hidden="true" :size="12" />Color may slightly vary depending on your
                screen.
              </li>
            </ul>
          </div>
          <img
            :src="properties.resolveAsset(product.assetId)"
            :alt="`${product.name} detail`"
            width="580"
            height="555"
          />
        </div>
        <dl v-else-if="activeTab === 1" class="fashion-product-additional-panel">
          <div>
            <dt>Color:</dt>
            <dd>Black, yellow</dd>
          </div>
          <div>
            <dt>Style/Type:</dt>
            <dd>Sports, Formal</dd>
          </div>
          <div>
            <dt>Lining:</dt>
            <dd>100% polyester taffeta with a DWR finish</dd>
          </div>
          <div>
            <dt>Material:</dt>
            <dd>Leather, Cotton, Silk</dd>
          </div>
          <div>
            <dt>Free shipping:</dt>
            <dd>On all orders over $50</dd>
          </div>
        </dl>
        <div v-else-if="activeTab === 2" class="fashion-product-shipping-panel">
          <section>
            <h2>Shipping information</h2>
            <p><strong>Standard:</strong> Arrives in 5-8 business days</p>
            <p><strong>Express:</strong> Arrives in 2-3 business days</p>
            <p>
              Free Shipping applies only to merchandise; taxes and gift cards do not count toward
              the free shipping total.
            </p>
          </section>
          <section>
            <h2>Return information</h2>
            <p>
              Return or exchange unused or defective merchandise by mail or at a store location.
            </p>
            <p>
              Returns made within 30 days of delivery receive a full refund to the original payment
              method.
            </p>
          </section>
        </div>
        <div v-else class="fashion-product-reviews-panel">
          <h2><strong>25,000+</strong> people like our product and tell a good story.</h2>
          <div><strong>4.9</strong><span>★★★★★</span><small>2,488 Reviews</small></div>
          <ul aria-label="Average customer ratings">
            <li v-for="rating in [95, 66, 40, 25, 5]" :key="rating">
              <span :style="{ width: `${rating}%` }"></span><strong>{{ rating }}%</strong>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="fashion-related-products" aria-labelledby="fashion-related-heading">
      <h2 id="fashion-related-heading">
        Related <span>products<i aria-hidden="true" /></span>
      </h2>
      <div>
        <article v-for="item in relatedProducts" :key="item.slug">
          <NuxtLink :to="`/products/${item.slug}`">
            <span class="fashion-related-product-media">
              <img
                :src="properties.resolveAsset(item.assetId)"
                :alt="item.name"
                width="600"
                height="765"
              />
              <small v-if="item.badge" :class="item.badge.toLowerCase()">{{ item.badge }}</small>
            </span>
            <strong>{{ item.name }}</strong>
            <span class="fashion-related-product-price"
              ><del v-if="item.comparePrice">{{ item.comparePrice }}</del
              >{{ item.price }}</span
            >
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
