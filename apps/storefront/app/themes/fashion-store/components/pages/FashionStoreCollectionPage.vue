<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import type { FashionStoreShopData } from "../../fixtures/pages/shop";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId } from "../../resources";
import FashionStorePageTitle from "../shared/FashionStorePageTitle.vue";
import FashionStoreShell from "../shared/FashionStoreShell.vue";
import FashionStoreShopPage from "./FashionStoreShopPage.vue";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

const router = useRouter();
const data = computed(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Collection requires a theme-section fixture.");
  }
  return (properties.viewModel.data as unknown as FashionStoreShopData).collection;
});
const isLanding = computed(
  () => router.currentRoute.value.path === fashionStoreRoutePaths.collection,
);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}
</script>

<template>
  <FashionStoreShopPage
    v-if="!isLanding"
    :resolve-asset="resolveAsset"
    :view-model="viewModel"
  />
  <FashionStoreShell
    v-else
    :announcement="data.announcement"
    body-class=""
    :resolve-asset="resolveAsset"
    :show-sticky-socials="false"
  >
    <main
      id="fashion-store-main"
      data-fashion-store-collection
      data-runtime-status="ready"
    >
      <FashionStorePageTitle title="Collection" />
      <section class="pt-0">
        <div class="container">
          <div class="row row-cols-1 row-cols-xl-3 row-cols-md-2 row-cols-sm-1 fashion-collection-grid">
            <div
              v-for="(card, index) in data.cards"
              :key="card.label"
              class="col categories-style-02"
              :class="{
                'mb-30px': index < 3,
                'lg-mb-30px': index === 3,
                'sm-mb-30px': index === 4,
              }"
            >
              <div class="categories-box">
                <a :href="card.destination" data-fashion-store-route :aria-label="card.label">
                  <img
                    class="sm-w-100"
                    :src="sourceAsset(card.sourceImage)"
                    alt=""
                    width="600"
                    height="450"
                  />
                </a>
                <div
                  class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
                >
                  {{ card.count }}
                </div>
                <div class="absolute-bottom-center bottom-40px md-bottom-25px">
                  <a
                    :href="card.destination"
                    data-fashion-store-route
                    class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
                  >
                    <span>
                      <span class="btn-double-text ls-0px" :data-text="card.label">{{
                        card.label
                      }}</span>
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </FashionStoreShell>
</template>
