<script setup lang="ts">
import { Plus } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
interface Data {
  categories: string[];
  products: { assetId: string; name: string; price: string }[];
}
const p = defineProps<{ resolveAsset: ThemeAssetResolver; viewModel: PresentationViewModel }>();
const data = computed(() =>
  p.viewModel.kind === "theme-section" ? (p.viewModel.data as unknown as Data) : null,
);
const active = ref(0);
const tabButtons = ref<HTMLButtonElement[]>([]);
const shown = computed(() => {
  const products = data.value?.products ?? [];
  return [...products.slice(active.value * 2), ...products.slice(0, active.value * 2)].slice(0, 8);
});
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
</script>
<template>
  <section v-if="data" id="decor-products" class="decor-products">
    <header>
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
        </button>
      </div>
    </header>
    <div
      id="decor-product-panel"
      class="decor-product-grid"
      role="tabpanel"
      :aria-labelledby="`decor-tab-${active}`"
      tabindex="0"
    >
      <article v-for="product in shown" :key="product.assetId">
        <a href="/products/atlas-carry-on"
          ><img
            :src="p.resolveAsset(product.assetId)"
            :alt="product.name"
            width="620"
            height="720"
            loading="lazy"
        /></a>
        <h3>{{ product.name }}</h3>
        <p>{{ product.price }}</p>
        <button type="button" aria-label="Add to preview bag">
          <Plus aria-hidden="true" :size="18" :stroke-width="1.7" />
        </button>
      </article>
    </div>
  </section>
</template>
