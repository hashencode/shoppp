<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { liveCommerceModeKey } from "../../../../theme-engine/runtime-commerce";
import { fashionStoreLiveCapabilities } from "../../capability-matrix";
import { fashionStoreAssetId, resolveFashionStoreEditorMedia } from "../../resources";
import FashionStoreIcon from "./FashionStoreIcon.vue";
import FashionStoreLegacyHeaderNavigation from "./FashionStoreLegacyHeaderNavigation.vue";
import FashionStoreMiniCart from "./FashionStoreMiniCart.vue";
import FashionStoreSearchOverlay from "./FashionStoreSearchOverlay.vue";

type MiniCartHandle = { closeCart(): void };
type SearchOverlayHandle = { closeSearch(restoreFocus?: boolean): Promise<void> };
type LegacyNavigationHandle = { close(): void };
type HomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

const properties = defineProps<{
  announcement?: string;
  announcementLink?: HomeViewModel["announcementLink"];
  background?: "solid" | "transparent-overlay";
  brandName?: string;
  configuration?: HomeViewModel["shell"]["header"];
  publishedRoutes?: readonly string[];
  resolveAsset: ThemeAssetResolver;
}>();
const emit = defineEmits<{ searchOpenChange: [open: boolean] }>();

const highDensity = ref(false);
const liveMode = inject(liveCommerceModeKey, false);
const menuOpen = ref(false);
const menuToggle = ref<HTMLButtonElement>();
const legacyNavigation = ref<LegacyNavigationHandle>();
const miniCart = ref<MiniCartHandle>();
const searchOpen = ref(false);
const searchOverlay = ref<SearchOverlayHandle>();
const publicContact = computed(() =>
  liveMode ? properties.configuration?.publicContact : undefined,
);
const accountVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.account);
const wishlistVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.wishlist);
const searchVisible = computed(() => !liveMode || fashionStoreLiveCapabilities.catalogSearch);
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

const configuredBrandName = computed(
  () => properties.configuration?.logo?.alt.trim() || properties.brandName || "Lifestyle",
);

function routeHref(path: string): string | undefined {
  return properties.publishedRoutes && !properties.publishedRoutes.includes(path)
    ? undefined
    : path;
}

function fallbackLogo(): string {
  return densityAsset(
    "images/demo-fashion-store-logo-black.png",
    "images/demo-fashion-store-logo-black@2x.png",
  );
}

function fallbackLogoAt2x(): string {
  return sourceAsset("images/demo-fashion-store-logo-black@2x.png");
}

onMounted(() => {
  highDensity.value = window.devicePixelRatio > 1;
});

watch(searchOpen, (open) => {
  if (open) miniCart.value?.closeCart();
  emit("searchOpenChange", open);
});

const expandedMenuId = ref<string>();

function setExpanded(menuId: string, expanded: boolean): void {
  if (expanded) expandedMenuId.value = menuId;
  else if (expandedMenuId.value === menuId) expandedMenuId.value = undefined;
}

function setHovered(menuId: string, expanded: boolean): void {
  if (window.matchMedia("(min-width: 992px)").matches) setExpanded(menuId, expanded);
}

function handleDropdownToggle(event: Event, menuId: string): void {
  event.preventDefault();
  setExpanded(menuId, expandedMenuId.value !== menuId);
}

function handleHeaderNavigation(event: MouseEvent): void {
  const target = event.target;
  const link =
    target instanceof Element
      ? target.closest<HTMLAnchorElement>("a[data-fashion-store-route]")
      : null;
  if (link) {
    if (new URL(link.href, window.location.href).pathname === window.location.pathname) {
      event.preventDefault();
    }
    void closeTransient(true);
  }
}

async function closeTransient(restoreMenuFocus = false): Promise<void> {
  const restore = restoreMenuFocus && menuOpen.value;
  if (restore) menuToggle.value?.focus();
  menuOpen.value = false;
  expandedMenuId.value = undefined;
  legacyNavigation.value?.close();
  miniCart.value?.closeCart();
  await searchOverlay.value?.closeSearch(false);
  document
    .querySelectorAll("[data-fashion-store-header] .dropdown-menu.show")
    .forEach((element) => {
      element.classList.remove("show");
      element
        .closest(".nav-item.dropdown")
        ?.querySelector(".dropdown-toggle")
        ?.setAttribute("aria-expanded", "false");
    });
  if (restore) {
    await nextTick();
    menuToggle.value?.focus();
  }
}

defineExpose({ closeTransient });
</script>

<template>
  <header
    class="header-with-topbar fashion-store-header-canonical"
    :class="`fashion-store-header-surface-${background ?? 'solid'}`"
    data-fashion-store-header="true"
    @click="handleHeaderNavigation"
  >
    <nav
      class="navbar navbar-expand-lg header-light bg-white disable-fixed"
      :data-header-hover="background === 'transparent-overlay' ? 'light' : undefined"
    >
      <div class="container-fluid">
        <div class="col-auto col-xxl-3 col-lg-2 menu-logo">
          <div class="header-icon d-none d-lg-flex">
            <div v-if="publicContact?.supportEmail" class="widget-text icon alt-font">
              <a :href="`mailto:${publicContact.supportEmail}`">{{ publicContact.supportEmail }}</a>
            </div>
            <div v-else-if="publicContact?.publicPhone" class="widget-text icon alt-font">
              <a :href="`tel:${publicContact.publicPhone}`">{{ publicContact.publicPhone }}</a>
            </div>
            <div v-else-if="publicContact?.privacyEmail" class="widget-text icon alt-font">
              <a :href="`mailto:${publicContact.privacyEmail}`">{{ publicContact.privacyEmail }}</a>
            </div>
            <div
              v-else-if="!publicContact && configuration?.contactCopy"
              class="widget-text icon alt-font"
            >
              <span>{{ configuration.contactCopy }}</span>
            </div>
            <div v-if="configuration?.highlightLink" class="widget-text icon alt-font">
              <a :href="configuration.highlightLink.href" data-fashion-store-route>
                {{ configuration.highlightLink.label }}
              </a>
            </div>
            <div v-if="configuration?.legalLink" class="widget-text icon alt-font">
              <a :href="configuration.legalLink.href" data-fashion-store-route>
                {{ configuration.legalLink.label }}
              </a>
            </div>
            <div
              v-for="social in publicContact?.socials ?? []"
              :key="social.id"
              class="widget-text icon alt-font fashion-store-header-social"
            >
              <a
                :href="social.url"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`${social.label} (opens in a new tab)`"
                >{{ social.label }}</a
              >
            </div>
            <div
              v-if="!publicContact && configuration?.socialLink"
              class="widget-text icon alt-font"
            >
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
            <div v-if="!liveMode" class="widget-text icon alt-font">
              <a :href="unavailableHref" data-fashion-store-route aria-disabled="true"
                ><FashionStoreIcon name="map-pin" class="d-inline-block me-5px" /><span
                  class="d-none d-xxl-inline-block"
                  >Find stores</span
                ></a
              >
            </div>
            <div v-if="!liveMode" class="widget-text icon alt-font">
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
          <a
            class="navbar-brand"
            href="/"
            data-fashion-store-route
            :aria-label="`${configuredBrandName} home`"
          >
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="default-logo"
              :src="configuredLogo() ?? fallbackLogo()"
              v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"
            />
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="alt-logo"
              :src="configuredLogo() ?? fallbackLogo()"
              v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"
            />
            <img
              :alt="configuration?.logo?.alt ?? ''"
              class="mobile-logo"
              :src="configuredLogo() ?? fallbackLogo()"
              v-bind:data-at2x="configuredLogo() ?? fallbackLogoAt2x()"
            />
          </a>
        </div>
        <div class="col-auto col-xxl-6 col-lg-8 menu-order position-static">
          <button
            ref="menuToggle"
            class="navbar-toggler float-end"
            type="button"
            aria-controls="navbarNav"
            aria-label="Toggle navigation"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <span class="navbar-toggler-line"></span><span class="navbar-toggler-line"></span
            ><span class="navbar-toggler-line"></span><span class="navbar-toggler-line"></span>
          </button>
          <div
            id="navbarNav"
            class="collapse navbar-collapse justify-content-between"
            :class="{ show: menuOpen }"
          >
            <FashionStoreLegacyHeaderNavigation
              v-if="configuration?.legacyNavigation"
              ref="legacyNavigation"
              :account-visible="accountVisible"
              :navigation="configuration.legacyNavigation"
              :published-routes="publishedRoutes"
              :source-asset="sourceAsset"
              :wishlist-visible="wishlistVisible"
            />
            <ul v-else class="navbar-nav alt-font navbar-left" data-released-header-navigation>
              <li
                v-for="item in configuration?.navigation?.items ?? []"
                :key="item.id"
                class="nav-item"
                :class="{
                  dropdown: item.children.length,
                  submenu: item.children.length,
                  open: expandedMenuId === item.id,
                }"
                @mouseenter="item.children.length && setHovered(item.id, true)"
                @mouseleave="item.children.length && setHovered(item.id, false)"
              >
                <a
                  :href="item.href"
                  data-fashion-store-route
                  class="nav-link"
                  :target="item.targetBehavior === 'new-window' ? '_blank' : undefined"
                  :rel="item.targetBehavior === 'new-window' ? 'noopener noreferrer' : undefined"
                  >{{ item.label }}</a
                >
                <template v-if="item.children.length">
                  <button
                    :id="`navigation-toggle-${item.id}`"
                    type="button"
                    class="dropdown-toggle"
                    :aria-controls="`navigation-menu-${item.id}`"
                    :aria-label="`Toggle ${item.label} menu`"
                    :aria-expanded="expandedMenuId === item.id"
                    @click="handleDropdownToggle($event, item.id)"
                  >
                    <FashionStoreIcon name="chevron-down" aria-hidden="true" />
                  </button>
                  <ul
                    :id="`navigation-menu-${item.id}`"
                    class="dropdown-menu"
                    :class="{ show: expandedMenuId === item.id }"
                    :aria-labelledby="`navigation-toggle-${item.id}`"
                  >
                    <li v-for="child in item.children" :key="child.id">
                      <a
                        :href="child.href"
                        data-fashion-store-route
                        :target="child.targetBehavior === 'new-window' ? '_blank' : undefined"
                        :rel="
                          child.targetBehavior === 'new-window' ? 'noopener noreferrer' : undefined
                        "
                        >{{ child.label }}</a
                      >
                    </li>
                  </ul>
                </template>
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
                :href="routeHref('/account')"
                :aria-disabled="routeHref('/account') ? undefined : 'true'"
                class="fashion-store-header-labeled-action"
                data-fashion-store-route
                aria-label="Account"
                ><FashionStoreIcon name="user" class="d-inline-block me-5px" /><span
                  class="d-none d-xxl-inline-block"
                  >Account</span
                ></a
              >
            </div>
            <FashionStoreMiniCart ref="miniCart" :source-asset="sourceAsset" />
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.fashion-store-header-surface-transparent-overlay {
  position: absolute;
  inset: 0 0 auto;
  z-index: 20;
}
.fashion-store-header-surface-transparent-overlay .navbar {
  background: transparent !important;
}
.fashion-store-header-surface-solid .navbar,
.fashion-store-header-surface-transparent-overlay .navbar.submenu-light {
  background: #fff !important;
}
.fashion-store-header-canonical {
  --alt-font: "Plus Jakarta Sans", sans-serif;
  --primary-font: "Plus Jakarta Sans", sans-serif;
}
.fashion-store-header-canonical :deep(.fashion-store-header-labeled-action) {
  font-weight: 600;
}
.fashion-store-header-canonical .navbar {
  line-height: 32px;
  padding: 0;
}
.fashion-store-header-canonical .navbar > .container-fluid {
  min-height: 96px;
  padding-right: 45px;
  padding-left: 45px;
}
.fashion-store-header-canonical .menu-logo {
  display: flex;
  align-items: center;
}
.fashion-store-header-canonical .navbar-brand {
  display: flex;
  max-width: 167px;
  margin: 0;
}
.fashion-store-header-canonical .navbar-brand img {
  max-width: 100%;
  max-height: 36px;
  object-fit: contain;
}
.fashion-store-header-canonical .navbar-nav .nav-link {
  padding-right: 20px;
  padding-left: 20px;
  font-size: 17px;
  font-weight: 600;
}
@media (max-width: 1199px) {
  .fashion-store-header-canonical .navbar > .container-fluid {
    padding-right: 35px;
    padding-left: 35px;
  }
}
@media (max-width: 991px) {
  .fashion-store-header-canonical .navbar {
    min-height: 80px;
  }
  .fashion-store-header-surface-transparent-overlay .navbar {
    background: #fff !important;
  }
  .fashion-store-header-canonical .navbar > .container-fluid {
    min-height: 80px;
    padding-right: 15px;
    padding-left: 15px;
    flex-wrap: nowrap;
  }
  .fashion-store-header-canonical .menu-order {
    order: 3;
    margin-left: 12px;
  }
  .fashion-store-header-canonical .navbar-collapse {
    position: absolute;
    top: 80px;
    right: 0;
    left: 0;
    background: #fff;
    padding: 12px 20px;
  }
}
</style>
