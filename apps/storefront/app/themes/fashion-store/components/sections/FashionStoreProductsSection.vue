<script setup lang="ts">
import { recordPreviewIntent } from "../../../../theme-engine/actions";
import { storefrontPreviewIntentCountKey } from "../../../../theme-engine/presentation-context";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import { fashionStoreProductSectionVariant } from "../../successor/composition";
import type { FashionStoreHomeSectionProperties } from "./home-section-context";
import {
  resolveFashionStoreHomeProductActions,
  resolveFashionStoreHomeSectionContext,
} from "./home-section-context";

const properties = defineProps<FashionStoreHomeSectionProperties>();
const context = computed(() => resolveFashionStoreHomeSectionContext(properties.viewModel));
const variant = computed(() => fashionStoreProductSectionVariant(properties.instance.id));
const actions = computed(() => resolveFashionStoreHomeProductActions(properties.viewModel));
const actionIntentCount = inject(storefrontPreviewIntentCountKey, ref(0));
const group = computed(() => {
  const merchandising = context.value.merchandising;
  if (merchandising?.state !== "populated") return undefined;
  const id = variant.value === "best-sellers" ? "best-sellers" : "featured";
  return merchandising.data.groups.find((candidate) => candidate.id === id);
});
const products = computed(() => group.value?.products ?? []);
const stateMessage = computed(() => {
  const merchandising = context.value.merchandising;
  if (!merchandising || merchandising.state === "validation-error") {
    return "Products could not be loaded.";
  }
  if (merchandising.state === "loading") return "Products are loading…";
  if (merchandising.state === "unavailable") return "Products are temporarily unavailable.";
  return "This collection does not have published products yet.";
});

function recordProductIntent(kind: "cart" | "quickView" | "wishlist"): void {
  const action = actions.value[kind];
  if (!action) return;
  recordPreviewIntent(action, "fashion-store.home.product");
  actionIntentCount.value += 1;
}
</script>

<template>
  <section
    class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 xs-px-0"
    :class="variant === 'best-sellers' ? 'sm-pb-6' : 'md-pb-5'"
    :data-home-section="variant"
    :data-preview-intent-count="actionIntentCount"
  >
    <div class="container">
      <div class="row mb-5 xs-mb-8">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            {{ variant === "best-sellers" ? "Best seller" : "Featured" }}
            <span class="text-highlight fw-600"
              >products<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <p v-if="products.length === 0" class="text-dark-gray" role="status">
            {{ stateMessage }}
          </p>
          <ul
            v-else
            class="shop-modern shop-wrapper grid-loading grid grid-5col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
            :class="variant === 'best-sellers' ? 'lg-grid-4col md-grid-3col' : 'lg-grid-3col'"
            data-anime='{ "el": "childs", "translateY": [-15, 0], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer" aria-hidden="true"></li>
            <FashionStoreProductCard
              v-for="product in products"
              :key="`${variant}-${product.productId}`"
              :product="product"
              :resolve-asset="resolveAsset"
              @intent="recordProductIntent"
            />
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
