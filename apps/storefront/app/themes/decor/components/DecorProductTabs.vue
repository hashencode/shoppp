<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { recordPreviewIntent } from "../../../theme-engine/actions";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorRevealMotion } from "../composables/useDecorRevealMotion";
interface Data {
  categories: string[];
  productGroups: {
    assetId: string;
    badge?: string;
    comparePrice?: string;
    name: string;
    price: string;
    slug: string;
  }[][];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const active = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const savedProducts = ref(new Set<string>());
const message = ref("");
const shown = computed(() => data.value?.productGroups[active.value] ?? []);
const revealRoot = useDecorRevealMotion(["product-tabs", "product-grid"]);
async function selectAndFocus(index: number): Promise<void> {
  const count = data.value?.categories.length ?? 1;
  active.value = (index + count) % count;
  await nextTick();
  tabButtons.value[active.value]?.focus();
}
function onTabKeydown(event: KeyboardEvent, index: number): void {
  const count = data.value?.categories.length ?? 1;
  let target: number;
  switch (event.key) {
    case "ArrowRight":
      target = (index + 1) % count;
      break;
    case "ArrowLeft":
      target = (index - 1 + count) % count;
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = count - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  void selectAndFocus(target);
}
function toggleSaved(product: Data["productGroups"][number][number]): void {
  const next = new Set(savedProducts.value);
  if (next.has(product.slug)) next.delete(product.slug);
  else next.add(product.slug);
  savedProducts.value = next;
  message.value = next.has(product.slug)
    ? `${product.name} saved in this preview.`
    : `${product.name} removed from saved items.`;
}
function addToPreviewBag(product: Data["productGroups"][number][number]): void {
  recordPreviewIntent(
    {
      id: `add-${product.slug}`,
      intent: "cart.add-preview",
      label: `Add ${product.name} to preview bag`,
    },
    "decor.product-tabs",
  );
  message.value = `${product.name} added to the preview bag.`;
}
</script>
<template>
  <section
    v-if="data"
    id="decor-products"
    ref="revealRoot"
    class="decor-products"
    data-source-reveal="product-tabs"
    data-reveal-state="pending"
  >
    <header data-reveal-group="product-tabs" data-reveal-item>
      <div role="tablist" aria-label="Product groups">
        <button
          v-for="(category, index) in data.categories"
          ref="tabButtons"
          :id="`decor-tab-${index}`"
          :key="category"
          type="button"
          role="tab"
          aria-controls="decor-product-panel"
          :aria-selected="active === index"
          :tabindex="active === index ? 0 : -1"
          @click="active = index"
          @keydown="onTabKeydown($event, index)"
        >
          {{ category }}
          <span class="decor-tab-border" aria-hidden="true"></span>
        </button>
      </div>
    </header>
    <div
      id="decor-product-panel"
      class="decor-product-grid"
      data-reveal-group="product-grid"
      role="tabpanel"
      :aria-labelledby="`decor-tab-${active}`"
      tabindex="0"
    >
      <article
        v-for="product in shown"
        :key="product.assetId"
        class="decor-product-card"
        data-reveal-item
      >
        <div class="decor-product-box">
          <div class="decor-product-media">
            <NuxtLink
              class="decor-product-link"
              :to="`/products/${product.slug}`"
              :aria-label="`View ${product.name}`"
            >
              <img
                :src="p.resolveAsset(product.assetId)"
                :alt="product.name"
                width="620"
                height="720"
                loading="lazy"
              />
              <span class="decor-product-overlay" aria-hidden="true"></span>
            </NuxtLink>
            <div class="decor-product-hover">
              <button
                type="button"
                :aria-label="`Save ${product.name}`"
                :aria-pressed="savedProducts.has(product.slug)"
                @click="toggleSaved(product)"
              >
                <i class="decor-feather decor-feather-heart" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                :aria-label="`Add ${product.name} to preview bag`"
                @click="addToPreviewBag(product)"
              >
                <i class="decor-feather decor-feather-shopping-bag" aria-hidden="true"></i>
              </button>
              <NuxtLink
                :to="`/products/${product.slug}`"
                :aria-label="`Quick shop ${product.name}`"
              >
                <i class="decor-feather decor-feather-eye" aria-hidden="true"></i>
              </NuxtLink>
            </div>
            <span
              v-if="product.badge"
              class="decor-product-badge"
              :class="{ 'decor-product-badge-hot': product.badge.toLowerCase() === 'hot' }"
              >{{ product.badge }}</span
            >
          </div>
          <h3>
            <NuxtLink :to="`/products/${product.slug}`">{{ product.name }}</NuxtLink>
          </h3>
          <p>
            <del v-if="product.comparePrice">{{ product.comparePrice }}</del
            >{{ product.price }}
          </p>
        </div>
      </article>
    </div>
    <p class="decor-preview-message" aria-live="polite">{{ message }}</p>
  </section>
</template>
