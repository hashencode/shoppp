<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreWishlistData } from "../../fixtures/pages/product";
import { decorStoreAssetId } from "../../resources";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreProductCard from "../shared/DecorStoreProductCard.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

const properties = defineProps<{ resolveAsset: ThemeAssetResolver }>();
const items = ref([...decorStoreWishlistData.items]);
const placeholder = properties.resolveAsset(
  decorStoreAssetId("images/decor-store-placeholder.svg"),
);
function remove(id: string): void {
  items.value = items.value.filter((item) => item.id !== id);
}
</script>

<template>
  <DecorStoreShell
    active-page="wishlist"
    :announcement="decorStoreWishlistData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="wishlist" title="Wishlist" />
    <section class="pb-80px">
      <div class="container">
        <p v-if="items.length === 0" role="status">Your wishlist is empty.</p>
        <ul v-else class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 list-unstyled">
          <DecorStoreProductCard
            v-for="product in items"
            :key="product.id"
            :placeholder="placeholder"
            :product="product"
            wished
            @wishlist="remove"
          />
        </ul>
      </div>
    </section>
  </DecorStoreShell>
</template>
