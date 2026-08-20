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

type MenuId = "collections" | "pages" | "shop";

const cartOpen = ref(false);
const languageOpen = ref(false);
const menuOpen = ref(false);
const openMenu = ref<MenuId | null>(null);
const searchOpen = ref(false);
const searchTrigger = ref<HTMLButtonElement>();

const shopCategories = [
  {
    items: [
      "Modern chair",
      "Luxurious sofa",
      "Sitting tables",
      "Century cabinet",
      "Wooden stool",
      "Dining tabl",
    ],
    title: "Furniture",
  },
  {
    items: [
      "Table lamps",
      "Wall lights",
      "Ceiling lights",
      "Chandeliers",
      "Smart lights",
      "Outdoor lights",
    ],
    title: "Lighting",
  },
  {
    items: [
      "Home decor",
      "Kitchen decor",
      "Office decor",
      "Wooden mirrors",
      "Designer clocks",
      "Spiritual",
    ],
    title: "Decor",
  },
  {
    items: [
      "Wardrobes",
      "Shoe racks",
      "Movable",
      "Folding storage",
      "Wooden units",
      "Kids storage",
    ],
    title: "Cabinetry",
  },
  {
    items: [
      "Hotel furniture",
      "Bar furniture",
      "School furniture",
      "Public furniture",
      "Office furniture",
      "Lab furniture",
    ],
    title: "Commercial",
  },
] as const;
const collections = [
  ["Designer stool", "images/demo-decor-store-menu-category-01.jpg"],
  ["Modern chair", "images/demo-decor-store-menu-category-02.jpg"],
  ["Table lamp", "images/demo-decor-store-menu-category-03.jpg"],
  ["Home decor", "images/demo-decor-store-menu-category-04.jpg"],
  ["Ceramic pots", "images/demo-decor-store-menu-category-05.jpg"],
  ["Wooden table", "images/demo-decor-store-menu-category-06.jpg"],
] as const;
const collectionBanners = [
  "images/demo-decor-store-menu-banner-03.jpg",
  "images/demo-decor-store-menu-banner-04.jpg",
] as const;
const pageLinks = [
  ["About", decorStoreRoutePaths.about],
  ["FAQs", decorStoreRoutePaths.faq],
  ["Wishlist", decorStoreRoutePaths.wishlist],
  ["Account", decorStoreRoutePaths.account],
  ["Cart", decorStoreRoutePaths.cart],
  ["Checkout", decorStoreRoutePaths.checkout],
] as const;
const languages = [
  ["English", "images/country-flag-16X16/usa.png"],
  ["France", "images/country-flag-16X16/france.png"],
  ["Russian", "images/country-flag-16X16/russian.png"],
  ["Spain", "images/country-flag-16X16/spain.png"],
] as const;
const shopBanners = [
  "images/demo-decor-store-menu-banner-01.jpg",
  "images/demo-decor-store-menu-banner-02.jpg",
] as const;

const asset = (path: string) => properties.resolveAsset(decorStoreAssetId(path));
const placeholder = asset("images/decor-store-placeholder.svg");

async function setSearch(open: boolean, restoreFocus = true): Promise<void> {
  searchOpen.value = open;
  emit("searchOpenChange", open);
  if (!open && restoreFocus) await nextTick(() => searchTrigger.value?.focus());
}

async function closeTransient(restoreFocus = false): Promise<void> {
  cartOpen.value = false;
  languageOpen.value = false;
  menuOpen.value = false;
  openMenu.value = null;
  await setSearch(false, restoreFocus);
}

function toggleMenu(menu: MenuId): void {
  openMenu.value = openMenu.value === menu ? null : menu;
}

function handleKeydown(event: KeyboardEvent): void {
  if (
    event.key === "Escape" &&
    (cartOpen.value || languageOpen.value || menuOpen.value || openMenu.value || searchOpen.value)
  ) {
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
              class="widget fs-13 text-dark-gray alt-font fw-600 me-25px d-none d-lg-inline-block"
            >
              <i class="feather icon-feather-map-pin"></i>Find our store
            </a>
            <div class="header-language-icon widget fs-13 alt-font fw-600">
              <div class="header-language dropdown" :class="{ open: languageOpen }">
                <button
                  type="button"
                  class="text-dark-gray"
                  aria-label="Toggle language menu"
                  :aria-expanded="languageOpen"
                  @click="languageOpen = !languageOpen"
                >
                  <i class="feather icon-feather-globe"></i>English
                </button>
                <ul class="language-dropdown alt-font">
                  <li v-for="language in languages" :key="language[0]">
                    <a href="#" data-decor-local-action :title="language[0]" @click.prevent>
                      <span class="icon-country"><img :src="asset(language[1])" alt="" /></span>
                      {{ language[0] }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
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
              <li class="nav-item"><a href="/" data-decor-store-route class="nav-link">Home</a></li>
              <li class="nav-item dropdown submenu" :class="{ open: openMenu === 'shop' }">
                <a
                  :href="decorStoreRoutePaths['shop-left']"
                  data-decor-store-route
                  class="nav-link"
                  :class="{ active: activePage.startsWith('shop-') }"
                  >Shop<span
                    class="label bg-base-color text-white text-uppercase border-radius-26px"
                    >Hot</span
                  ></a
                >
                <button
                  type="button"
                  class="dropdown-toggle"
                  aria-label="Toggle Shop menu"
                  :aria-expanded="openMenu === 'shop'"
                  @click="toggleMenu('shop')"
                >
                  <i class="fa-solid fa-angle-down"></i>
                </button>
                <div class="dropdown-menu submenu-content" :class="{ show: openMenu === 'shop' }">
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div class="row row-cols-1 row-cols-lg-5 mb-60px md-mb-30px sm-mb-20px">
                      <div v-for="category in shopCategories" :key="category.title" class="col">
                        <ul>
                          <li class="sub-title">{{ category.title }}</li>
                          <li v-for="item in category.items" :key="item">
                            <a href="#" data-decor-local-action @click.prevent>{{ item }}</a>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div class="row row-cols-1 row-cols-md-2">
                      <div v-for="banner in shopBanners" :key="banner" class="col">
                        <a :href="decorStoreRoutePaths['shop-left']" data-decor-store-route>
                          <img class="w-100" :src="asset(banner)" alt="" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li class="nav-item dropdown submenu" :class="{ open: openMenu === 'collections' }">
                <a
                  :href="decorStoreRoutePaths.collection"
                  data-decor-store-route
                  class="nav-link"
                  :class="{ active: activePage === 'collection' }"
                  >Collections</a
                >
                <button
                  type="button"
                  class="dropdown-toggle"
                  aria-label="Toggle Collections menu"
                  :aria-expanded="openMenu === 'collections'"
                  @click="toggleMenu('collections')"
                >
                  <i class="fa-solid fa-angle-down"></i>
                </button>
                <div
                  class="dropdown-menu submenu-content"
                  :class="{ show: openMenu === 'collections' }"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-2 row-cols-lg-6 row-cols-sm-3 md-pt-15px align-items-center justify-content-center mb-60px md-mb-30px sm-mb-0"
                    >
                      <div
                        v-for="collection in collections"
                        :key="collection[0]"
                        class="col md-mb-30px"
                      >
                        <a
                          :href="decorStoreRoutePaths.collection"
                          data-decor-store-route
                          class="text-center"
                          ><img :src="asset(collection[1])" alt=""
                        /></a>
                        <a
                          :href="decorStoreRoutePaths.collection"
                          data-decor-store-route
                          class="btn btn-hover-animation text-uppercase-inherit fw-600 ls-0px justify-content-center"
                          ><span class="btn-text text-dark-gray fs-16">{{ collection[0] }}</span></a
                        >
                      </div>
                    </div>
                    <div class="row row-cols-1 row-cols-md-2">
                      <div v-for="banner in collectionBanners" :key="banner" class="col">
                        <a :href="decorStoreRoutePaths.collection" data-decor-store-route>
                          <img class="w-100" :src="asset(banner)" alt="" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li class="nav-item dropdown simple-dropdown" :class="{ open: openMenu === 'pages' }">
                <a
                  href="#"
                  data-decor-local-action
                  class="nav-link"
                  @click.prevent="toggleMenu('pages')"
                  >Pages</a
                >
                <button
                  type="button"
                  class="dropdown-toggle"
                  aria-label="Toggle Pages menu"
                  :aria-expanded="openMenu === 'pages'"
                  @click="toggleMenu('pages')"
                >
                  <i class="fa-solid fa-angle-down"></i>
                </button>
                <ul class="dropdown-menu" :class="{ show: openMenu === 'pages' }">
                  <li v-for="item in pageLinks" :key="item[0]">
                    <a :href="item[1]" data-decor-store-route>{{ item[0] }}</a>
                  </li>
                </ul>
              </li>
              <li class="nav-item">
                <a
                  :href="decorStoreRoutePaths.blog"
                  data-decor-store-route
                  class="nav-link"
                  :class="{ active: activePage === 'blog' || activePage === 'article' }"
                  >Blog</a
                >
              </li>
              <li class="nav-item">
                <a
                  :href="decorStoreRoutePaths.contact"
                  data-decor-store-route
                  class="nav-link"
                  :class="{ active: activePage === 'contact' }"
                  >Contact</a
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
