<script setup lang="ts">
import { Check, ChevronLeft, ChevronRight, Heart } from "@lucide/vue";
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
      autoplayMs: number;
      count: number;
      direction: string;
      lightbox: boolean;
      loop: boolean;
    };
    paymentAssets: readonly string[];
    reviewCount: number;
    tabs: readonly string[];
    tags: readonly string[];
  };
  products: Product[];
  relatedProducts?: Product[];
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
  const count = data.value?.detailOptions?.gallery.count ?? 7;
  return product.value
    ? Array.from({ length: count }, (_, index) => ({
        assetId: product.value!.assetId,
        id: `${product.value!.slug}-view-${index + 1}`,
        label: `${product.value!.name} view ${index + 1}`,
      }))
    : [];
});
const relatedProducts = computed(() => {
  if (data.value?.relatedProducts?.length) return data.value.relatedProducts.slice(0, 4);
  const products = data.value?.products ?? [];
  if (!product.value) return [];
  const index = products.findIndex(({ slug }) => slug === product.value?.slug);
  return Array.from({ length: Math.min(4, products.length - 1) }, (_, offset) => {
    return products[(index + offset + 1) % products.length]!;
  });
});
const selectedColor = ref("");
const quantity = ref(1);
const saved = ref(false);
const compared = ref(false);
const message = ref("");
const activeTab = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const thumbButtons = ref<HTMLButtonElement[]>([]);
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
  () => data.value?.detailOptions?.tags ?? ["Chair", "Modern", "Wooden"],
);
const reviewCount = computed(() => data.value?.detailOptions?.reviewCount ?? 165);
const galleryController = createInteractionController({
  autoplayDelayMs: 0,
  count: data.value?.detailOptions?.gallery.count ?? 7,
  transitionDurationMs: 300,
});
const galleryMotion = shallowRef<InteractionSnapshot>(galleryController.snapshot());
const selectedGalleryIndex = computed(() =>
  galleryMotion.value.phase === "transitioning"
    ? galleryMotion.value.targetIndex
    : galleryMotion.value.currentIndex,
);
const currentGallerySrc = computed(() =>
  properties.resolveAsset(
    gallery.value[selectedGalleryIndex.value]?.assetId ?? product.value?.assetId ?? "",
  ),
);

watch(
  product,
  (next) => {
    selectedColor.value = next?.colors.at(-1) ?? "";
    quantity.value = 1;
    saved.value = false;
    compared.value = false;
    message.value = "";
  },
  { immediate: true },
);

watch(selectedGalleryIndex, async (index) => {
  await nextTick();
  thumbButtons.value[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
});

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

function galleryKeydown(event: KeyboardEvent): void {
  if (!galleryController.handleKey(event.key)) return;
  event.preventDefault();
}

function colorValue(color: string, index: number): string {
  return (
    ["#232323", "#8e412e", "#bab9b8", "#9da693"][index] ??
    ({ Natural: "#bab9b8", Blue: "#9da693", Walnut: "#8e412e" }[color] || "#232323")
  );
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
    "decor.product-details",
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
  <section v-if="product && data" class="decor-product-detail">
    <nav class="decor-product-breadcrumb" aria-label="Breadcrumb">
      <ul>
        <li><NuxtLink to="/">Home</NuxtLink></li>
        <li><NuxtLink to="/#decor-products">Shop</NuxtLink></li>
        <li>{{ product.name }}</li>
      </ul>
    </nav>

    <div class="decor-product-main">
      <div class="decor-product-gallery">
        <div
          class="decor-product-gallery-stage"
          aria-label="Product image gallery"
          tabindex="0"
          :data-motion-active-index="selectedGalleryIndex"
          :data-motion-phase="galleryMotion.phase"
          @keydown="galleryKeydown"
        >
          <button
            type="button"
            class="decor-product-image-preview"
            aria-label="Open product image preview"
            @click="lightbox?.open()"
          >
            <img
              class="decor-product-primary-image"
              :src="currentGallerySrc"
              :alt="product.name"
              width="600"
              height="650"
              decoding="sync"
              fetchpriority="high"
            />
          </button>
          <button
            type="button"
            class="decor-product-gallery-prev"
            aria-label="Previous product image"
            @click="galleryController.previous()"
          >
            <ChevronLeft aria-hidden="true" :size="14" />
          </button>
          <button
            type="button"
            class="decor-product-gallery-next"
            aria-label="Next product image"
            @click="galleryController.next()"
          >
            <ChevronRight aria-hidden="true" :size="14" />
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
        <div class="decor-product-thumbs" aria-label="Product views">
          <button
            v-for="(item, index) in gallery"
            ref="thumbButtons"
            :key="item.id"
            type="button"
            :aria-label="`Show ${item.label}`"
            :aria-pressed="selectedGalleryIndex === index"
            @click="galleryController.select(index)"
          >
            <img :src="properties.resolveAsset(item.assetId)" alt="" width="96" height="104" />
          </button>
        </div>
      </div>

      <div class="decor-product-info">
        <span class="decor-product-vendor">{{ product.vendor }}</span>
        <h1>{{ product.name }}</h1>
        <div class="decor-product-meta">
          <span aria-label="5 out of 5 stars">
            <i
              v-for="index in 5"
              :key="index"
              class="decor-bootstrap-icon decor-bootstrap-star-fill"
              aria-hidden="true"
            />
          </span>
          <a href="#decor-product-tabs">{{ reviewCount }} Reviews</a>
          <span><strong>SKU:</strong> {{ product.sku }}</span>
        </div>
        <p class="decor-product-price">
          <del v-if="product.comparePrice">{{ product.comparePrice }}</del
          >{{ product.price }}
        </p>
        <p class="decor-product-description">{{ product.description }}</p>

        <div
          class="decor-product-option decor-product-colors"
          role="group"
          aria-labelledby="decor-product-color-label"
        >
          <span id="decor-product-color-label" class="decor-product-option-label">Color</span>
          <label v-for="(color, index) in product.colors" :key="color" :aria-label="color">
            <input v-model="selectedColor" type="radio" name="decor-color" :value="color" />
            <span aria-hidden="true" :style="{ '--decor-swatch': colorValue(color, index) }"></span>
          </label>
        </div>

        <div class="decor-product-purchase">
          <div class="decor-product-quantity" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" @click="changeQuantity(-1)">
              <span aria-hidden="true">-</span>
            </button>
            <input :value="quantity" type="text" aria-label="Quantity value" readonly />
            <button type="button" aria-label="Increase quantity" @click="changeQuantity(1)">
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <button class="decor-product-add" type="button" @click="addToPreviewBag">
            <span class="decor-product-add-inner"
              ><i class="decor-feather decor-feather-shopping-bag" aria-hidden="true"></i
              ><span>Add to cart</span></span
            >
          </button>
          <button
            class="decor-product-save"
            type="button"
            aria-label="Save product"
            :aria-pressed="saved"
            @click="toggleSaved"
          >
            <i class="decor-feather decor-feather-heart" aria-hidden="true"></i>
          </button>
        </div>
        <div class="decor-product-secondary-actions" aria-label="Product actions">
          <button
            v-for="action in detailActions"
            :key="action"
            type="button"
            :aria-pressed="action === 'Compare' ? compared : undefined"
            @click="runSecondaryAction(action)"
          >
            <i
              v-if="action === 'Compare'"
              class="decor-feather decor-feather-repeat"
              aria-hidden="true"
            ></i>
            <i
              v-else-if="action === 'Ask a question'"
              class="decor-feather decor-feather-mail"
              aria-hidden="true"
            ></i>
            <i v-else class="decor-feather decor-feather-share" aria-hidden="true"></i>
            {{ action }}
          </button>
        </div>
        <p v-if="message" class="decor-product-message" aria-live="polite">{{ message }}</p>
        <div class="decor-product-delivery">
          <p>
            <i class="decor-feather decor-feather-truck" aria-hidden="true"></i
            ><span><strong>Estimated delivery:</strong> March 03 - March 07</span>
          </p>
          <p>
            <i class="decor-feather decor-feather-archive" aria-hidden="true"></i
            ><span><strong>Free shipping & returns:</strong> On all orders over $50</span>
          </p>
        </div>
        <div class="decor-product-checkout">
          <strong>Guarantee safe and secure checkout</strong>
          <div class="decor-product-payment-methods">
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
        <div class="decor-product-taxonomy">
          <p>
            <strong>Category:</strong>{{ " "
            }}<NuxtLink to="/collections/home-objects">Decor</NuxtLink>,
            <NuxtLink to="/collections/home-objects">Minimalist</NuxtLink>
          </p>
          <p>
            <strong>Tags:</strong>{{ " " }}
            <template v-for="(tag, index) in productTags" :key="tag"
              ><NuxtLink to="/collections/home-objects">{{ tag }}</NuxtLink
              ><template v-if="index < productTags.length - 1">, </template></template
            >
          </p>
        </div>
      </div>
    </div>

    <section id="decor-product-tabs" class="decor-product-tabs">
      <div role="tablist" aria-label="Product information">
        <div
          v-for="(tab, index) in tabs"
          :key="tab"
          class="decor-product-tab-item"
          role="presentation"
        >
          <button
            ref="tabButtons"
            :id="`decor-product-tab-${index}`"
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
      </div>
      <div
        :id="`decor-product-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`decor-product-tab-${activeTab}`"
      >
        <div v-if="activeTab === 0" class="decor-product-description-panel">
          <div class="decor-product-description-intro">
            <div>
              <p class="decor-product-description-kicker">
                <Heart aria-hidden="true" :size="14" fill="currentColor" />Designer thoughts
              </p>
              <h2>Minimalist design and modern chair.</h2>
              <p>
                Lorem ipsum is simply dummy text of the printing and typesetting industry lorem
                ipsum has been the standard dummy text typesetting.
              </p>
              <ul>
                <li>
                  <Check aria-hidden="true" :size="12" />FSC certified natural wood teak product.
                </li>
                <li>
                  <Check aria-hidden="true" :size="12" />Removable cushion with polypropylene.
                </li>
                <li>
                  <Check aria-hidden="true" :size="12" />Durability wood & lightweight modern.
                </li>
                <li>
                  <Check aria-hidden="true" :size="12" />Topstitch detailing along back of seat.
                </li>
              </ul>
            </div>
            <img
              :src="properties.resolveAsset(product.assetId)"
              :alt="`${product.name} detail`"
              width="682"
              height="480"
            />
          </div>
          <img
            class="decor-product-description-wide"
            :src="properties.resolveAsset(relatedProducts[0]?.assetId ?? product.assetId)"
            alt=""
            width="1190"
            height="500"
          />
          <div class="decor-product-description-story">
            <h3>The dining chair design for those looking for a new level of comfort.</h3>
            <img
              :src="properties.resolveAsset(relatedProducts[1]?.assetId ?? product.assetId)"
              alt=""
              width="500"
              height="570"
            />
            <p>
              Lorem ipsum is simply dummy text printing typesetting industry lorem ipsum has been
              standard dummy text lorem ipsum.
            </p>
          </div>
          <div class="decor-product-material-grid">
            <article
              v-for="(label, index) in ['Wooden', 'Fabric', 'Strength', 'Comfort']"
              :key="label"
            >
              <img
                :src="
                  properties.resolveAsset(
                    relatedProducts[index % relatedProducts.length]?.assetId ?? product.assetId,
                  )
                "
                alt=""
                width="140"
                height="140"
              />
              <strong>{{ label }}</strong>
              <p>Lorem ipsum simply dummy text printing typesetting.</p>
            </article>
          </div>
          <p class="decor-product-quality">
            <span aria-hidden="true"
              ><i class="decor-bootstrap-icon decor-bootstrap-patch-check-fill"></i
            ></span>
            <span>Premium quality solid wood finish product materials.</span>
          </p>
        </div>
        <dl v-else-if="activeTab === 1" class="decor-product-additional-panel">
          <div>
            <dt>Color:</dt>
            <dd>Black, natural</dd>
          </div>
          <div>
            <dt>Style/Type:</dt>
            <dd>Minimalist, Modern</dd>
          </div>
          <div>
            <dt>Finish:</dt>
            <dd>Low-sheen protective finish</dd>
          </div>
          <div>
            <dt>Material:</dt>
            <dd>Natural wood, Cotton</dd>
          </div>
          <div>
            <dt>Free shipping:</dt>
            <dd>On all orders over $50</dd>
          </div>
        </dl>
        <div v-else-if="activeTab === 2" class="decor-product-shipping-panel">
          <section>
            <h2>Shipping information</h2>
            <p><strong>Standard:</strong> Arrives in 5-8 business days</p>
            <p><strong>Express:</strong> Arrives in 2-3 business days</p>
            <p>Some oversized items may require an additional shipping charge.</p>
          </section>
          <section>
            <h2>Return information</h2>
            <p>
              Return or exchange unused or defective merchandise by mail or at a store location.
            </p>
            <p>Returns made within 30 days receive a full refund to the original payment method.</p>
          </section>
        </div>
        <div v-else class="decor-product-reviews-panel">
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

    <section class="decor-related-products" aria-labelledby="decor-related-heading">
      <div class="decor-related-container">
        <div class="decor-related-heading">
          <span>You may also like</span>
          <h2 id="decor-related-heading">{{ data.relatedHeading }}</h2>
        </div>
        <div class="decor-related-grid">
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
      </div>
    </section>
  </section>
  <section v-else class="decor-product-not-found">
    <h1>Product not found</h1>
    <NuxtLink to="/#decor-products">Return to the collection</NuxtLink>
  </section>
</template>
