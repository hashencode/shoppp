<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { DecorStorePageId } from "../../page-contracts";
import { decorStoreRoutePaths } from "../../page-contracts";
import { decorStoreAssetId } from "../../resources";
import DecorStoreMiniCart from "./DecorStoreMiniCart.vue";
import DecorStoreSearchOverlay from "./DecorStoreSearchOverlay.vue";

const properties = defineProps<{
  activePage: DecorStorePageId;
  announcement: string;
  resolveAsset: ThemeAssetResolver;
}>();
const emit = defineEmits<{ searchOpenChange: [open: boolean] }>();

const cartOpen = ref(false);
const menuOpen = ref(false);
const searchOpen = ref(false);
const searchTrigger = ref<HTMLButtonElement>();

const asset = (path: string) => properties.resolveAsset(decorStoreAssetId(path));
const placeholder = asset("images/decor-store-placeholder.svg");

async function setSearch(open: boolean, restoreFocus = true): Promise<void> {
  searchOpen.value = open;
  emit("searchOpenChange", open);
  if (!open && restoreFocus) await nextTick(() => searchTrigger.value?.focus());
}

async function closeTransient(restoreFocus = false): Promise<void> {
  cartOpen.value = false;
  menuOpen.value = false;
  await setSearch(false, restoreFocus);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && (cartOpen.value || menuOpen.value || searchOpen.value)) {
    event.preventDefault();
    void closeTransient(true);
  }
}

defineExpose({ closeTransient, handleKeydown });
</script>

<template>
  <header class="header-with-topbar" data-decor-secondary-header>
    <div
      class="header-top-bar top-bar-light bg-white disable-fixed border-bottom border-color-transparent-dark-very-light"
    >
      <div class="container-fluid">
        <div class="row h-45px align-items-center m-0">
          <div class="col-lg-7 col-md-8 text-center text-md-start">
            <div class="fs-13 text-dark-gray alt-font fw-600">
              {{ announcement }}
              <a
                :href="decorStoreRoutePaths['shop-left']"
                data-decor-store-route
                class="text-dark-gray fw-700 text-decoration-line-bottom"
                >Shop now</a
              >
            </div>
          </div>
          <div class="col-lg-5 col-md-4 text-end d-none d-md-flex">
            <a
              :href="decorStoreRoutePaths.contact"
              data-decor-store-route
              class="widget fs-13 text-dark-gray fw-600 me-25px"
            >
              <i class="feather icon-feather-phone-call"></i>Customer service
            </a>
            <a
              :href="decorStoreRoutePaths.contact"
              data-decor-store-route
              class="widget fs-13 text-dark-gray alt-font fw-600"
            >
              <i class="feather icon-feather-map-pin"></i>Find our store
            </a>
          </div>
        </div>
      </div>
    </div>
    <nav class="navbar navbar-expand-lg header-light bg-transparent disable-fixed">
      <div class="container-fluid">
        <div class="col-auto">
          <a class="navbar-brand" href="/" data-decor-store-route aria-label="Decor Store home">
            <img
              :src="asset('images/demo-decor-store-logo-black.png')"
              :data-at2x="asset('images/demo-decor-store-logo-black@2x.png')"
              alt=""
              class="default-logo"
            />
          </a>
        </div>
        <div class="col-auto menu-order position-static xs-ps-0">
          <button
            type="button"
            class="navbar-toggler float-start"
            aria-controls="decor-secondary-navbar"
            :aria-expanded="menuOpen"
            aria-label="Toggle navigation"
            @click="menuOpen = !menuOpen"
          >
            <span v-for="line in 4" :key="line" class="navbar-toggler-line"></span>
          </button>
          <div
            id="decor-secondary-navbar"
            class="collapse navbar-collapse justify-content-center"
            :class="{ show: menuOpen }"
          >
            <ul class="navbar-nav alt-font">
              <li
                v-for="item in [
                  ['home', 'Home', '/'],
                  ['shop-left', 'Shop', decorStoreRoutePaths['shop-left']],
                  ['collection', 'Collections', decorStoreRoutePaths.collection],
                  ['blog', 'Blog', decorStoreRoutePaths.blog],
                  ['contact', 'Contact', decorStoreRoutePaths.contact],
                ]"
                :key="item[0]"
                class="nav-item"
              >
                <a
                  :href="item[2]"
                  data-decor-store-route
                  class="nav-link"
                  :class="{ active: activePage === item[0] }"
                  >{{ item[1] }}</a
                >
              </li>
            </ul>
          </div>
        </div>
        <div class="col-auto ms-auto">
          <div class="header-icon">
            <div class="header-search-icon icon">
              <button
                ref="searchTrigger"
                type="button"
                class="search-form-icon header-search-form"
                :aria-expanded="searchOpen"
                aria-label="Open search"
                @click="setSearch(true)"
              >
                <i class="feather icon-feather-search"></i>
              </button>
              <DecorStoreSearchOverlay v-if="searchOpen" @close="setSearch(false)" />
            </div>
            <div class="header-cart-icon icon">
              <div class="header-cart dropdown">
                <button
                  type="button"
                  :aria-expanded="cartOpen"
                  aria-label="Open cart preview"
                  @click="cartOpen = !cartOpen"
                >
                  <i class="feather icon-feather-shopping-bag"></i
                  ><span class="cart-count alt-font">2</span>
                </button>
                <DecorStoreMiniCart v-if="cartOpen" :placeholder="placeholder" />
              </div>
            </div>
            <div class="widget-text ms-25px md-ms-20px alt-font">
              <a :href="decorStoreRoutePaths.account" data-decor-store-route class="fs-17 fw-600"
                >My account</a
              >
            </div>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>
