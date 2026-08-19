<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import FashionStoreProductCard from "../shared/FashionStoreProductCard.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";
import { resolveFashionStoreEditorMedia } from "../../resources";

type StateViewModel = Extract<PresentationViewModel, { kind: "state" }>;
type RecoveryViewModel = Extract<PresentationViewModel, { kind: "collection-grid" }>;

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: StateViewModel | RecoveryViewModel;
}>();

function mediaSource(): string | undefined {
  if (properties.viewModel.kind !== "state" || !properties.viewModel.media) return undefined;
  return resolveFashionStoreEditorMedia(properties.resolveAsset, properties.viewModel.media);
}
</script>

<template>
  <FashionStoreShell body-class="" :resolve-asset="resolveAsset" :show-sticky-socials="false">
    <main
      id="fashion-store-main"
      data-fashion-store-live-content
      :data-content-state="viewModel.state"
      :data-content-style="viewModel.kind === 'state' ? viewModel.presentationStyle : undefined"
    >
      <section class="top-space-margin half-section bg-gradient-very-light-gray">
        <div class="container text-center">
          <h1 class="alt-font fw-600 text-dark-gray mb-15px">{{ viewModel.heading }}</h1>
          <img
            v-if="viewModel.kind === 'state' && viewModel.media"
            :src="mediaSource()"
            :alt="viewModel.media.alt"
            :width="viewModel.media.width"
            :height="viewModel.media.height"
            class="w-100 mb-25px"
          />
          <p
            class="mx-auto mb-25px"
            :role="viewModel.state === 'unavailable' ? 'status' : undefined"
          >
            {{
              viewModel.kind === "state"
                ? viewModel.message
                : viewModel.products.length > 0
                  ? "Saved wishlists are not available yet. Browse these published products instead."
                  : "Saved wishlists are not available yet, and no recovery products are currently published."
            }}
          </p>
          <div class="d-flex gap-15px justify-content-center flex-wrap">
            <a
              v-if="viewModel.kind === 'state' && viewModel.action?.target"
              :href="viewModel.action.target"
              data-fashion-store-route
              class="btn btn-dark-gray btn-medium btn-round-edge"
            >
              {{ viewModel.action.label }}
            </a>
            <a
              v-if="viewModel.kind === 'state' && viewModel.relatedAction?.target"
              :href="viewModel.relatedAction.target"
              data-fashion-store-route
              class="btn btn-transparent-dark-gray btn-medium"
              >{{ viewModel.relatedAction.label }}</a
            >
            <a
              v-else-if="viewModel.kind === 'collection-grid'"
              href="/shop"
              data-fashion-store-route
              class="btn btn-dark-gray btn-medium btn-round-edge"
            >
              Continue shopping
            </a>
            <a href="/" data-fashion-store-route class="btn btn-transparent-dark-gray btn-medium">
              Return home
            </a>
          </div>
        </div>
      </section>
      <section
        v-if="viewModel.kind === 'collection-grid' && viewModel.products.length > 0"
        class="pt-0 pb-70px"
        aria-labelledby="fashion-store-wishlist-recovery"
      >
        <div class="container">
          <h2 id="fashion-store-wishlist-recovery" class="alt-font text-dark-gray fw-600 mb-30px">
            Continue shopping
          </h2>
          <ul
            class="shop-modern shop-wrapper grid grid-4col xl-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
          >
            <FashionStoreProductCard
              v-for="product in viewModel.products"
              :key="product.productId"
              :product="product"
              :resolve-asset="resolveAsset"
            />
          </ul>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
