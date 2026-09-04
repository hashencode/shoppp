<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { liveCommerceModeKey } from "../../../../theme-engine/runtime-commerce";
import { fashionStoreLiveCapabilities } from "../../capability-matrix";
import { fashionStoreRoutePaths } from "../../page-contracts";
import { fashionStoreAssetId, resolveFashionStoreEditorMedia } from "../../resources";
import FashionStoreMiniCart from "./FashionStoreMiniCart.vue";
import FashionStoreSearchOverlay from "./FashionStoreSearchOverlay.vue";

type MiniCartHandle = { closeCart(): void };
type SearchOverlayHandle = {
  closeSearch(restoreFocus?: boolean): Promise<void>;
};
type HomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

const properties = defineProps<{
  homeLayout?: boolean;
  announcement?: string;
  announcementLink?: HomeViewModel["announcementLink"];
  configuration?: HomeViewModel["shell"]["header"];
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
const highDensity = ref(false);
const liveMode = inject(liveCommerceModeKey, false);
const accountVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.account);
const searchVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.catalogSearch);
const wishlistVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.wishlist);
const unavailableHref = undefined;

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function densityAsset(standardPath: string, highDensityPath: string): string {
  return sourceAsset(highDensity.value ? highDensityPath : standardPath);
}

function configuredLogo(): string | undefined {
  const logo = properties.configuration?.logo;
  return logo ? resolveFashionStoreEditorMedia(properties.resolveAsset, logo) : undefined;
}

onMounted(() => {
  highDensity.value = window.devicePixelRatio > 1;
});

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

function handleDropdownToggle(event: Event): void {
  if (innerWidth >= 992) return;
  const toggle = event.currentTarget;
  if (!(toggle instanceof HTMLElement)) return;
  event.preventDefault();
  toggleCompactDropdown(toggle);
}

function handleHeaderNavigation(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest("a[data-fashion-store-route]")) return;
  void closeTransient(true);
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

defineExpose({ closeTransient });
</script>

<template>
  <header
    class="header-with-topbar"
    :class="{ 'fashion-store-header-home': homeLayout }"
    data-fashion-store-header="true"
    @click="handleHeaderNavigation"
  >
    <nav class="navbar navbar-expand-lg header-light bg-white disable-fixed center-logo">
      <div class="container-fluid">
        <div class="col-auto col-xxl-3 col-lg-2 menu-logo">
          <div class="header-icon d-none d-lg-flex">
            <div v-if="configuration" class="widget-text icon alt-font">
              <span>{{ configuration.contactCopy }}</span>
            </div>
            <div v-if="configuration?.highlightLink" class="widget-text icon alt-font">
              <a :href="configuration.highlightLink.href" data-fashion-store-route>{{
                configuration.highlightLink.label
              }}</a>
            </div>
            <div v-if="configuration?.legalLink" class="widget-text icon alt-font">
              <a :href="configuration.legalLink.href" data-fashion-store-route>{{
                configuration.legalLink.label
              }}</a>
            </div>
            <div v-if="configuration?.socialLink" class="widget-text icon alt-font">
              <a
                :href="configuration.socialLink.href"
                :target="
                  configuration.socialLink.targetBehavior === 'new-window' ? '_blank' : undefined
                "
                :rel="
                  configuration.socialLink.targetBehavior === 'new-window'
                    ? 'noopener noreferrer'
                    : undefined
                "
                >{{ configuration.socialLink.label }}</a
              >
            </div>
            <div class="widget-text icon alt-font">
              <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                ><FashionStoreIcon name="map-pin" class="d-inline-block me-5px" /><span
                  class="d-none d-xxl-inline-block"
                  >Find stores</span
                ></a
              >
            </div>
            <div class="widget-text icon alt-font">
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram, 100k followers"
                ><FashionStoreIcon name="instagram" class="d-inline-block me-5px" /><span
                  class="d-none d-xxl-inline-block"
                  >100k Followers</span
                ></a
              >
            </div>
          </div>
          <a class="navbar-brand" href="/" data-fashion-store-route aria-label="Lifestyle home">
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="default-logo"
              v-bind:src="
                configuredLogo() ??
                densityAsset(
                  'images/demo-fashion-store-logo-black.png',
                  'images/demo-fashion-store-logo-black@2x.png',
                )
              "
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="alt-logo"
              v-bind:src="
                configuredLogo() ??
                densityAsset(
                  'images/demo-fashion-store-logo-black.png',
                  'images/demo-fashion-store-logo-black@2x.png',
                )
              "
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="mobile-logo"
              v-bind:src="
                configuredLogo() ??
                densityAsset(
                  'images/demo-fashion-store-logo-black.png',
                  'images/demo-fashion-store-logo-black@2x.png',
                )
              "
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
                <NuxtLink to="/" data-fashion-store-route class="nav-link">Home</NuxtLink>
              </li>
              <li class="nav-item dropdown submenu">
                <a
                  :href="fashionStoreRoutePaths['shop-left']"
                  data-fashion-store-route
                  class="nav-link"
                  >Shop</a
                >
                <FashionStoreIcon
                  name="chevron-down"
                  class="dropdown-toggle"
                  id="navbarDropdownMenuLink1"
                  aria-hidden="false"
                  aria-label="Toggle Shop menu"
                  role="button"
                  tabindex="0"
                  @click="handleDropdownToggle"
                  @keydown.enter="handleDropdownToggle"
                  @keydown.space="handleDropdownToggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                />
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
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Jeans</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Trousers</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Swimwear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Casual shirts</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Rain jackets</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Loungewear</a
                            >
                          </li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Women</li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Dupattas</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Leggings</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Ethnic wear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Kurtas &amp; suits</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Western wear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Dress materials</a
                            >
                          </li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Kids</li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Dresses</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Jumpsuits</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Track pants</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Ethnic wear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Value packs</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Loungewear</a
                            >
                          </li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Divided</li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Tops</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Dresses</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Shorts</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Swimwear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Jeans</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Jackets</a
                            >
                          </li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Accessories</li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Shoes</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Scarves</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Watches</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Wristwear</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Backpacks</a
                            >
                          </li>
                          <li>
                            <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                              >Sunglasses</a
                            >
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div class="row row-cols-1 row-cols-sm-2">
                      <div class="col">
                        <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                          ><img
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-banner-01.jpg')
                            "
                        /></a>
                      </div>
                      <div class="col">
                        <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
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
                <a
                  :href="fashionStoreRoutePaths.collection"
                  data-fashion-store-route
                  class="nav-link"
                  >Collection</a
                >
                <FashionStoreIcon
                  name="chevron-down"
                  class="dropdown-toggle"
                  id="navbarDropdownMenuLink2"
                  aria-hidden="false"
                  aria-label="Toggle Collection menu"
                  role="button"
                  tabindex="0"
                  @click="handleDropdownToggle"
                  @keydown.enter="handleDropdownToggle"
                  @keydown.space="handleDropdownToggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                />
                <div
                  class="dropdown-menu submenu-content"
                  aria-labelledby="navbarDropdownMenuLink2"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-2 row-cols-lg-6 row-cols-md-3 row-cols-sm-2 md-mx-0 align-items-center justify-content-center"
                    >
                      <div class="col md-mb-25px">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-01.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Polo t-shirts</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-02.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Sunglasses</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-03.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Skinny blazer</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
                          </span>
                        </a>
                      </div>
                      <div class="col sm-mb-25px">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-04.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Casual shoes</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-05.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Winter jackets</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="justify-content-center mb-10px"
                        >
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-06.jpg')
                            "
                          />
                        </a>
                        <a
                          :href="unavailableHref"
                          data-fashion-store-route
                          aria-disabled="true"
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Men's shorts</span>
                            <span class="btn-icon"
                              ><FashionStoreIcon name="arrow-right" class="icon-very-small w-auto"
                            /></span>
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
                <a :href="fashionStoreRoutePaths.magazine" data-fashion-store-route class="nav-link"
                  >Magazine</a
                >
              </li>
              <li class="nav-item dropdown simple-dropdown">
                <button type="button" class="nav-link fashion-store-source-action">Pages</button>
                <FashionStoreIcon
                  name="chevron-down"
                  class="dropdown-toggle"
                  id="navbarDropdownMenuLink3"
                  aria-hidden="false"
                  aria-label="Toggle Pages menu"
                  role="button"
                  tabindex="0"
                  @click="handleDropdownToggle"
                  @keydown.enter="handleDropdownToggle"
                  @keydown.space="handleDropdownToggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                />
                <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink3">
                  <li>
                    <a :href="fashionStoreRoutePaths.about" data-fashion-store-route>About</a>
                  </li>
                  <li><a :href="fashionStoreRoutePaths.faq" data-fashion-store-route>Faq</a></li>
                  <li v-if="wishlistVisible">
                    <a :href="fashionStoreRoutePaths.wishlist" data-fashion-store-route>Wishlist</a>
                  </li>
                  <li v-if="accountVisible">
                    <a :href="fashionStoreRoutePaths.account" data-fashion-store-route>Account</a>
                  </li>
                  <li><a :href="fashionStoreRoutePaths.cart" data-fashion-store-route>Cart</a></li>
                  <li>
                    <a :href="fashionStoreRoutePaths.checkout" data-fashion-store-route>Checkout</a>
                  </li>
                </ul>
              </li>
              <li class="nav-item">
                <a :href="fashionStoreRoutePaths.contact" data-fashion-store-route class="nav-link"
                  >Contact</a
                >
              </li>
            </ul>
          </div>
        </div>
        <div class="col-auto col-xxl-3 col-lg-2 text-end">
          <div class="header-icon">
            <FashionStoreSearchOverlay
              v-if="searchVisible"
              ref="searchOverlay"
              v-model="searchOpen"
            />
            <div v-if="accountVisible" class="widget-text icon alt-font">
              <a
                :href="fashionStoreRoutePaths.account"
                data-fashion-store-route
                aria-label="Account"
                ><FashionStoreIcon name="user" class="d-inline-block me-5px" /><span
                  class="d-none d-xxl-inline-block"
                  >Account</span
                ></a
              >
            </div>
            <FashionStoreMiniCart
              ref="miniCart"
              :home-layout="homeLayout"
              :source-asset="sourceAsset"
            />
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.fashion-store-source-action {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  padding: 0;
}

:where(.fashion-store-header-home) .container,
:where(.fashion-store-header-home) .container-fluid,
:where(.fashion-store-header-home) .container-lg,
:where(.fashion-store-header-home) .container-md,
:where(.fashion-store-header-home) .container-sm,
:where(.fashion-store-header-home) .container-xl,
:where(.fashion-store-header-home) .container-xxl {
  padding-right: 15px;
  padding-left: 15px;
}

:where(.fashion-store-header-home) .row {
  margin-right: -15px;
  margin-left: -15px;
}

:where(.fashion-store-header-home) .row > * {
  padding-right: 15px;
  padding-left: 15px;
}

:where(.fashion-store-header-home) .navbar {
  line-height: 32px;
  padding: 0;
}

/* Preserve Crafto's breakpoint-specific navigation gutters after the scoped
   Bootstrap gutter normalization above. */
.fashion-store-header-home .navbar > .container-fluid {
  padding-right: 45px;
  padding-left: 45px;
}

@media (max-width: 1199px) {
  .fashion-store-header-home .navbar > .container-fluid {
    padding-right: 35px;
    padding-left: 35px;
  }
}

@media (min-width: 768px) and (max-width: 991px) {
  .fashion-store-header-home .navbar {
    padding-right: 15px;
    padding-left: 15px;
  }
}

@media (max-width: 991px) {
  .fashion-store-header-home .navbar > .container-fluid {
    padding-right: 0;
    padding-left: 0;
  }
}

.navbar.disable-fixed {
  top: 0 !important;
}
</style>
