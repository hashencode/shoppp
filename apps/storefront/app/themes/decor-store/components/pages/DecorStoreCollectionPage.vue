<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { decorStoreCollectionData } from "../../fixtures/pages/shop";
import { decorStoreRoutePaths } from "../../page-contracts";
import { decorStoreAssetId } from "../../resources";
import DecorStorePageTitle from "../shared/DecorStorePageTitle.vue";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

const properties = defineProps<{ resolveAsset: ThemeAssetResolver }>();
const placeholder = properties.resolveAsset(
  decorStoreAssetId("images/decor-store-placeholder.svg"),
);
</script>

<template>
  <DecorStoreShell
    active-page="collection"
    :announcement="decorStoreCollectionData.announcement"
    :resolve-asset="resolveAsset"
  >
    <DecorStorePageTitle breadcrumb="collections" title="Collections" />
    <section class="ps-6 pe-6 lg-ps-3 lg-pe-3 sm-ps-0 sm-pe-0">
      <div class="container-fluid">
        <ul class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 list-unstyled">
          <li
            v-for="item in decorStoreCollectionData.items"
            :key="item.id"
            class="col mb-50px text-center"
          >
            <div class="position-relative overflow-hidden mb-20px">
              <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route
                ><img :src="placeholder" alt=""
              /></a>
              <div
                class="count-circle d-flex align-items-center justify-content-center w-35px h-35px bg-base-color text-white rounded-circle alt-font fw-600 fs-12"
              >
                {{ item.count }}
              </div>
            </div>
            <a
              :href="decorStoreRoutePaths['shop-left']"
              data-decor-store-route
              class="alt-font fw-600 fs-17 text-dark-gray"
              >{{ item.name }}</a
            >
          </li>
        </ul>
      </div>
    </section>
  </DecorStoreShell>
</template>
