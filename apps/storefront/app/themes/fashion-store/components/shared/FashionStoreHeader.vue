<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreMiniCart from "./FashionStoreMiniCart.vue";
import FashionStoreSearchOverlay from "./FashionStoreSearchOverlay.vue";

type MiniCartHandle = { closeCart(): void };
type SearchOverlayHandle = {
  closeSearch(restoreFocus?: boolean): Promise<void>;
};

const properties = defineProps<{
  announcement: string;
  resolveAsset: ThemeAssetResolver;
}>();
const emit = defineEmits<{
  searchOpenChange: [open: boolean];
}>();

const menuOpen = ref(false);
const menuToggle = ref<HTMLButtonElement>();
const miniCart = ref<MiniCartHandle>();
const searchOpen = ref(false);
const searchOverlay = ref<SearchOverlayHandle>();

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

watch(searchOpen, (open) => {
  if (open) miniCart.value?.closeCart();
  emit("searchOpenChange", open);
});

function toggleCompactDropdown(toggle: HTMLElement): void {
  const dropdown = toggle.closest<HTMLElement>(".nav-item.dropdown");
  if (!dropdown) return;
  const menu = dropdown.querySelector<HTMLElement>(".dropdown-menu");
  const expanded = !menu?.classList.contains("show");
  menu?.classList.toggle("show", expanded);
  toggle.classList.toggle("show", expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && searchOpen.value) {
    void searchOverlay.value?.closeSearch(true);
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const toggle = target.closest<HTMLElement>(".navbar-left .dropdown-toggle");
  if (!toggle || innerWidth >= 992) return;
  event.preventDefault();
  toggleCompactDropdown(toggle);
}

function handleInternalClick(event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const dropdownToggle = target.closest<HTMLElement>(".navbar-left .dropdown-toggle");
  if (!dropdownToggle || innerWidth >= 992) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  toggleCompactDropdown(dropdownToggle);
  return true;
}

async function closeTransient(restoreMenuFocus = false): Promise<void> {
  const shouldRestoreMenuFocus = restoreMenuFocus && menuOpen.value;
  menuOpen.value = false;
  miniCart.value?.closeCart();
  await searchOverlay.value?.closeSearch(false);
  document.querySelectorAll(".navbar-left .nav-item.open").forEach((element) => {
    element.classList.remove("open");
    element.querySelector(".dropdown-toggle")?.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll(".navbar-left .dropdown-menu.show").forEach((element) => {
    element.classList.remove("show");
    const dropdown = element.closest(".nav-item.dropdown");
    dropdown?.querySelector(".dropdown-toggle")?.classList.remove("show");
    dropdown?.querySelector(".dropdown-toggle")?.setAttribute("aria-expanded", "false");
  });
  if (shouldRestoreMenuFocus) {
    await nextTick();
    menuToggle.value?.focus();
  }
}

defineExpose({ closeTransient, handleDocumentKeydown, handleInternalClick });
</script>

<template>
  <header class="header-with-topbar" data-fashion-store-header="true">
    <div
      class="header-top-bar top-bar-light bg-base-color disable-fixed md-border-bottom border-color-transparent-dark-very-light"
    >
      <div class="container-fluid">
        <div class="row h-40px align-items-center m-0">
          <div class="col-12 justify-content-center alt-font fs-13 fw-500 text-uppercase">
            <div class="text-dark-gray">{{ announcement }}</div>
            <a
              href="/"
              data-fashion-store-route
              class="text-dark-gray fw-600 ms-5px text-dark-gray-hover"
              ><span class="text-decoration-line-bottom">Shop now</span></a
            >
          </div>
        </div>
      </div>
    </div>

    <nav class="navbar navbar-expand-lg header-light bg-white disable-fixed center-logo">
      <div class="container-fluid">
        <div class="col-auto col-xxl-3 col-lg-2 menu-logo">
          <div class="header-icon d-none d-lg-flex">
            <div class="widget-text icon alt-font">
              <a href="/" data-fashion-store-route
                ><i class="feather icon-feather-map-pin d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">Find stores</span></a
              >
            </div>
            <div class="widget-text icon alt-font">
              <a href="https://www.instagram.com/" target="_blank"
                ><i class="feather icon-feather-instagram d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">100k Followers</span></a
              >
            </div>
          </div>
          <a class="navbar-brand" href="/" data-fashion-store-route aria-label="Lifestyle home">
            <img
              alt=""
              class="default-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              alt=""
              class="alt-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              alt=""
              class="mobile-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
          </a>
        </div>
        <div class="col-auto col-xxl-6 col-lg-8 menu-order">
          <button
            ref="menuToggle"
            class="navbar-toggler float-end"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-label="Toggle navigation"
            v-bind:aria-expanded="menuOpen"
            v-on:click="menuOpen = !menuOpen"
          >
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
          </button>
          <div
            class="collapse navbar-collapse justify-content-between"
            id="navbarNav"
            v-bind:class="{ show: menuOpen }"
          >
            <ul class="navbar-nav alt-font navbar-left justify-content-end">
              <li class="nav-item">
                <a href="/" data-fashion-store-route class="nav-link">Home</a>
              </li>
              <li class="nav-item dropdown submenu">
                <a href="/" data-fashion-store-route class="nav-link">Shop</a>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink1"
                  role="button"
                  tabindex="0"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <div
                  class="dropdown-menu submenu-content"
                  aria-labelledby="navbarDropdownMenuLink1"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-1 row-cols-lg-5 row-cols-md-3 row-cols-sm-3 mb-50px md-mb-25px xs-mb-15px"
                    >
                      <div class="col">
                        <ul>
                          <li class="sub-title">Men</li>
                          <li><a href="/" data-fashion-store-route>Jeans</a></li>
                          <li><a href="/" data-fashion-store-route>Trousers</a></li>
                          <li><a href="/" data-fashion-store-route>Swimwear</a></li>
                          <li><a href="/" data-fashion-store-route>Casual shirts</a></li>
                          <li><a href="/" data-fashion-store-route>Rain jackets</a></li>
                          <li><a href="/" data-fashion-store-route>Loungewear</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Women</li>
                          <li><a href="/" data-fashion-store-route>Dupattas</a></li>
                          <li><a href="/" data-fashion-store-route>Leggings</a></li>
                          <li><a href="/" data-fashion-store-route>Ethnic wear</a></li>
                          <li><a href="/" data-fashion-store-route>Kurtas &amp; suits</a></li>
                          <li><a href="/" data-fashion-store-route>Western wear</a></li>
                          <li><a href="/" data-fashion-store-route>Dress materials</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Kids</li>
                          <li><a href="/" data-fashion-store-route>Dresses</a></li>
                          <li><a href="/" data-fashion-store-route>Jumpsuits</a></li>
                          <li><a href="/" data-fashion-store-route>Track pants</a></li>
                          <li><a href="/" data-fashion-store-route>Ethnic wear</a></li>
                          <li><a href="/" data-fashion-store-route>Value packs</a></li>
                          <li><a href="/" data-fashion-store-route>Loungewear</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Divided</li>
                          <li><a href="/" data-fashion-store-route>Tops</a></li>
                          <li><a href="/" data-fashion-store-route>Dresses</a></li>
                          <li><a href="/" data-fashion-store-route>Shorts</a></li>
                          <li><a href="/" data-fashion-store-route>Swimwear</a></li>
                          <li><a href="/" data-fashion-store-route>Jeans</a></li>
                          <li><a href="/" data-fashion-store-route>Jackets</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Accessories</li>
                          <li><a href="/" data-fashion-store-route>Shoes</a></li>
                          <li><a href="/" data-fashion-store-route>Scarves</a></li>
                          <li><a href="/" data-fashion-store-route>Watches</a></li>
                          <li><a href="/" data-fashion-store-route>Wristwear</a></li>
                          <li><a href="/" data-fashion-store-route>Backpacks</a></li>
                          <li><a href="/" data-fashion-store-route>Sunglasses</a></li>
                        </ul>
                      </div>
                    </div>
                    <div class="row row-cols-1 row-cols-sm-2">
                      <div class="col">
                        <a href="/" data-fashion-store-route
                          ><img
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-banner-01.jpg')
                            "
                        /></a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-store-route
                          ><img
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-banner-02.jpg')
                            "
                        /></a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li class="nav-item dropdown submenu">
                <a href="/" data-fashion-store-route class="nav-link">Collection</a>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink2"
                  role="button"
                  tabindex="0"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <div
                  class="dropdown-menu submenu-content"
                  aria-labelledby="navbarDropdownMenuLink2"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-2 row-cols-lg-6 row-cols-md-3 row-cols-sm-2 md-mx-0 align-items-center justify-content-center"
                    >
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-01.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Polo t-shirts</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-02.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Sunglasses</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-03.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Skinny blazer</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col sm-mb-25px">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-04.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Casual shoes</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-05.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Winter jackets</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-store-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-06.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-store-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Men's shorts</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
            <ul class="navbar-nav alt-font navbar-right justify-content-start">
              <li class="nav-item">
                <a href="/" data-fashion-store-route class="nav-link">Magazine</a>
              </li>
              <li class="nav-item dropdown simple-dropdown">
                <button type="button" class="nav-link fashion-store-source-action">Pages</button>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink3"
                  role="button"
                  tabindex="0"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink3">
                  <li><a href="/" data-fashion-store-route>About</a></li>
                  <li><a href="/" data-fashion-store-route>Faq</a></li>
                  <li><a href="/" data-fashion-store-route>Wishlist</a></li>
                  <li><a href="/" data-fashion-store-route>Account</a></li>
                  <li><a href="/" data-fashion-store-route>Cart</a></li>
                  <li><a href="/" data-fashion-store-route>Checkout</a></li>
                </ul>
              </li>
              <li class="nav-item">
                <a href="/" data-fashion-store-route class="nav-link">Contact</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="col-auto col-xxl-3 col-lg-2 text-end">
          <div class="header-icon">
            <FashionStoreSearchOverlay ref="searchOverlay" v-model="searchOpen" />
            <div class="widget-text icon alt-font">
              <a href="/" data-fashion-store-route aria-label="Account"
                ><i class="feather icon-feather-user d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">Account</span></a
              >
            </div>
            <FashionStoreMiniCart ref="miniCart" :source-asset="sourceAsset" />
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>
