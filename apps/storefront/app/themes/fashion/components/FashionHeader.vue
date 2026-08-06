<script setup lang="ts">
import { ChevronDown } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import figtreeUrl from "../assets/fonts/figtree-latin.woff2?url";
import outfitUrl from "../assets/fonts/outfit-latin.woff2?url";

interface HeaderData {
  announcement: string;
  announcementAction?: string;
  brand: string;
  brandAssetId?: string;
  brandAsset2xId?: string;
  cart?: {
    count: number;
    items: readonly (readonly [string, string, string])[];
    subtotal: string;
  };
  collectionItems?: readonly (readonly [string, string])[];
  destinations?: {
    collection: string;
    navigation: readonly string[];
    pages: Readonly<Record<string, string>>;
    shop: Readonly<Record<string, string>>;
  };
  navigation: string[];
  pageItems?: readonly string[];
  shopBanners?: readonly string[];
  shopColumns?: readonly { heading: string; items: readonly string[] }[];
}

interface NavigationLink {
  href: string;
  label: string;
  menu?: boolean;
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
useHead({
  link: [
    {
      as: "font",
      crossorigin: "anonymous",
      href: figtreeUrl,
      rel: "preload",
      type: "font/woff2",
    },
    {
      as: "font",
      crossorigin: "anonymous",
      href: outfitUrl,
      rel: "preload",
      type: "font/woff2",
    },
  ],
});
const data = computed<HeaderData | null>(() => {
  if (properties.viewModel.kind === "theme-section")
    return properties.viewModel.data as unknown as HeaderData;
  if (properties.viewModel.kind === "navigation")
    return {
      announcement: "Private fixture preview · no live commerce activity",
      brand: properties.viewModel.brand,
      navigation: properties.viewModel.items.map(({ label }) => label),
    };
  return null;
});

const fallbackDestinations = [
  "/",
  "/collections/all",
  "/collections/new-arrivals",
  "/magazine",
  "/about",
  "/contact",
] as const;
const menuLabels = new Set(["Collection", "Pages", "Shop"]);
const links = computed<NavigationLink[]>(() =>
  (data.value?.navigation ?? []).map((label, index) => ({
    href: data.value?.destinations?.navigation[index] ?? fallbackDestinations[index] ?? "/",
    label,
    menu: menuLabels.has(label),
  })),
);
const leftLinks = computed(() => links.value.slice(0, 3));
const rightLinks = computed(() => links.value.slice(3, 6));
const openMenu = ref<string | null>(null);
const utilityMessage = ref("");
const removedCartItems = ref(new Set<string>());
const navShell = useTemplateRef<HTMLElement>("navShell");
const mobileMenu = useTemplateRef<HTMLDetailsElement>("mobileMenu");
const searchInput = useTemplateRef<HTMLInputElement>("searchInput");
const router = useRouter();
let cartCloseTimer = 0;
const visibleCartItems = computed(
  () => data.value?.cart?.items.filter(([assetId]) => !removedCartItems.value.has(assetId)) ?? [],
);

function shopHref(heading: string): string {
  return data.value?.destinations?.shop[heading] ?? "/collections/all";
}

function pageHref(label: string): string {
  return data.value?.destinations?.pages[label] ?? "/";
}

function collectionHref(): string {
  return data.value?.destinations?.collection ?? "/collections/all";
}

function removeCartItem(assetId: string): void {
  removedCartItems.value = new Set([...removedCartItems.value, assetId]);
}

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    openMenu.value = null;
    utilityMessage.value = "";
    if (mobileMenu.value) mobileMenu.value.open = false;
  },
);

function toggleMenu(label: string): void {
  utilityMessage.value = "";
  openMenu.value = openMenu.value === label ? null : label;
}

function openDesktopMenu(label: string): void {
  clearTimeout(cartCloseTimer);
  utilityMessage.value = "";
  openMenu.value = label;
}

function closeDesktopMenu(label: string): void {
  if (openMenu.value === label) openMenu.value = null;
}

async function closeMenu(): Promise<void> {
  const label = openMenu.value;
  openMenu.value = null;
  utilityMessage.value = "";
  if (mobileMenu.value) mobileMenu.value.open = false;
  if (!label) return;
  await nextTick();
  document.querySelector<HTMLButtonElement>(`[data-menu-toggle="${label}"]`)?.focus();
}

async function showUtility(label: "bag" | "search"): Promise<void> {
  clearTimeout(cartCloseTimer);
  openMenu.value = null;
  utilityMessage.value = utilityMessage.value === label ? "" : label;
  if (utilityMessage.value !== "search") return;
  await nextTick();
  searchInput.value?.focus();
}

function closeSearch(): void {
  utilityMessage.value = "";
}

function openCart(): void {
  clearTimeout(cartCloseTimer);
  openMenu.value = null;
  utilityMessage.value = "bag";
}

function scheduleCartClose(): void {
  clearTimeout(cartCloseTimer);
  cartCloseTimer = window.setTimeout(() => {
    if (utilityMessage.value === "bag") utilityMessage.value = "";
  }, 90);
}

function closeCartAfterFocus(event: FocusEvent): void {
  const control = event.currentTarget as HTMLElement;
  const next = event.relatedTarget as Node | null;
  if (!next || !control.contains(next)) scheduleCartClose();
}

function outsidePointer(event: PointerEvent): void {
  if (!navShell.value?.contains(event.target as Node)) {
    openMenu.value = null;
    utilityMessage.value = "";
    if (mobileMenu.value) mobileMenu.value.open = false;
  }
}

onMounted(() => document.addEventListener("pointerdown", outsidePointer));
onBeforeUnmount(() => {
  clearTimeout(cartCloseTimer);
  document.removeEventListener("pointerdown", outsidePointer);
});
</script>

<template>
  <header v-if="data" class="fashion-header">
    <a class="fashion-skip-link" href="#preview-content">Skip to content</a>
    <p class="fashion-announcement">
      {{ data.announcement }} <strong>{{ data.announcementAction ?? "Shop now" }}</strong>
    </p>
    <div ref="navShell" class="fashion-nav-shell" @keydown.esc.prevent.stop="closeMenu">
      <div class="fashion-nav-meta" aria-hidden="true">
        <span
          ><span class="fashion-feather-icon fashion-feather-map-pin" aria-hidden="true" />
          <span class="fashion-meta-label">Find stores</span></span
        ><span
          ><span class="fashion-feather-icon fashion-feather-instagram" aria-hidden="true" />
          <span class="fashion-meta-label">100k Followers</span></span
        >
      </div>

      <nav aria-label="Primary navigation" class="fashion-desktop-nav">
        <div class="fashion-nav-group fashion-nav-left">
          <div
            v-for="link in leftLinks"
            :key="link.label"
            class="fashion-nav-item"
            @mouseenter="link.menu && openDesktopMenu(link.label)"
            @mouseleave="link.menu && closeDesktopMenu(link.label)"
          >
            <NuxtLink class="fashion-nav-link" :to="link.href">{{ link.label }}</NuxtLink>
            <button
              v-if="link.menu"
              type="button"
              :data-menu-toggle="link.label"
              :aria-label="`Open ${link.label} menu`"
              :aria-expanded="openMenu === link.label"
              :aria-controls="`fashion-menu-${link.label.toLowerCase()}`"
              @click="openDesktopMenu(link.label)"
            >
              <ChevronDown aria-hidden="true" :size="12" :stroke-width="1.8" />
            </button>
            <div
              v-if="link.menu"
              v-show="openMenu === link.label"
              :id="`fashion-menu-${link.label.toLowerCase()}`"
              class="fashion-submenu fashion-mega-menu"
              :class="`fashion-${link.label.toLowerCase()}-menu-panel`"
            >
              <template v-if="link.label === 'Shop'">
                <div class="fashion-shop-columns">
                  <section v-for="column in data.shopColumns" :key="column.heading">
                    <h2>{{ column.heading }}</h2>
                    <NuxtLink
                      v-for="item in column.items"
                      :key="item"
                      :to="shopHref(column.heading)"
                    >
                      {{ item }}
                    </NuxtLink>
                  </section>
                </div>
                <div class="fashion-shop-banners">
                  <NuxtLink
                    v-for="assetId in data.shopBanners"
                    :key="assetId"
                    :to="collectionHref()"
                  >
                    <img
                      :src="properties.resolveAsset(assetId)"
                      alt=""
                      width="636"
                      height="240"
                      loading="lazy"
                    />
                  </NuxtLink>
                </div>
              </template>
              <div v-else-if="link.label === 'Collection'" class="fashion-collection-menu">
                <NuxtLink
                  v-for="[assetId, label] in data.collectionItems"
                  :key="assetId"
                  :to="collectionHref()"
                >
                  <img
                    :src="properties.resolveAsset(assetId)"
                    :alt="label"
                    width="200"
                    height="200"
                    loading="lazy"
                  />
                  <span class="fashion-collection-label">
                    <span>{{ label }}</span>
                    <span class="fashion-menu-collection-arrow" aria-hidden="true">→</span>
                  </span>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <NuxtLink class="fashion-brand" to="/" :aria-label="`${data.brand} home`">
          <img
            v-if="data.brandAssetId"
            :src="properties.resolveAsset(data.brandAssetId)"
            :srcset="
              data.brandAsset2xId
                ? `${properties.resolveAsset(data.brandAssetId)} 1x, ${properties.resolveAsset(data.brandAsset2xId)} 2x`
                : undefined
            "
            alt=""
            width="155"
            height="34"
          />
          <template v-else><span>ML</span>{{ data.brand }}</template>
        </NuxtLink>

        <div class="fashion-nav-group fashion-nav-right">
          <div
            v-for="link in rightLinks"
            :key="link.label"
            class="fashion-nav-item"
            @mouseenter="link.menu && openDesktopMenu(link.label)"
            @mouseleave="link.menu && closeDesktopMenu(link.label)"
          >
            <NuxtLink class="fashion-nav-link" :to="link.href">{{ link.label }}</NuxtLink>
            <button
              v-if="link.menu"
              type="button"
              :data-menu-toggle="link.label"
              :aria-label="`Open ${link.label} menu`"
              :aria-expanded="openMenu === link.label"
              :aria-controls="`fashion-menu-${link.label.toLowerCase()}`"
              @click="openDesktopMenu(link.label)"
            >
              <ChevronDown aria-hidden="true" :size="12" :stroke-width="1.8" />
            </button>
            <div
              v-if="link.menu"
              v-show="openMenu === link.label"
              :id="`fashion-menu-${link.label.toLowerCase()}`"
              class="fashion-submenu fashion-pages-menu"
            >
              <NuxtLink v-for="item in data.pageItems" :key="item" :to="pageHref(item)">
                {{ item }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </nav>

      <NuxtLink class="fashion-mobile-brand" to="/" :aria-label="`${data.brand} home`">
        <img
          v-if="data.brandAssetId"
          :src="properties.resolveAsset(data.brandAssetId)"
          :srcset="
            data.brandAsset2xId
              ? `${properties.resolveAsset(data.brandAssetId)} 1x, ${properties.resolveAsset(data.brandAsset2xId)} 2x`
              : undefined
          "
          alt=""
          width="155"
          height="34"
        />
        <template v-else><span>ML</span>{{ data.brand }}</template>
      </NuxtLink>

      <div class="fashion-nav-actions" aria-label="Store utilities">
        <button type="button" aria-label="Search" @click="showUtility('search')">
          <span class="fashion-feather-icon fashion-feather-search" aria-hidden="true" />
          <span class="fashion-action-label">Search</span></button
        ><NuxtLink class="fashion-account-link" to="/account" aria-label="Account">
          <span class="fashion-feather-icon fashion-feather-user" aria-hidden="true" />
          <span class="fashion-action-label">Account</span></NuxtLink
        >
        <div
          class="fashion-cart-control"
          @mouseenter="openCart"
          @mouseleave="scheduleCartClose"
          @focusin="openCart"
          @focusout="closeCartAfterFocus"
        >
          <button
            type="button"
            aria-label="Preview bag"
            :aria-expanded="utilityMessage === 'bag'"
            @click="showUtility('bag')"
          >
            <span
              class="fashion-feather-icon fashion-feather-shopping-bag"
              aria-hidden="true"
            /><sup>{{ data.cart?.count ?? 0 }}</sup>
          </button>
          <aside
            v-if="data.cart"
            v-show="utilityMessage === 'bag'"
            class="fashion-cart-panel"
            @mouseenter="openCart"
          >
            <article v-for="[assetId, name, detail] in visibleCartItems" :key="assetId">
              <button
                class="fashion-cart-remove"
                type="button"
                :aria-label="`Remove ${name}`"
                @click="removeCartItem(assetId)"
              >
                ×
              </button>
              <img
                :src="properties.resolveAsset(assetId)"
                :alt="name"
                width="80"
                height="100"
                loading="lazy"
              />
              <p>
                <strong>{{ name }}</strong
                ><span>{{ detail }}</span>
              </p>
            </article>
            <p class="fashion-cart-subtotal">
              <span>Subtotal:</span><strong>{{ data.cart.subtotal }}</strong>
            </p>
            <div class="fashion-cart-actions">
              <NuxtLink to="/cart">View cart</NuxtLink>
              <NuxtLink to="/checkout">Checkout</NuxtLink>
            </div>
          </aside>
        </div>
      </div>
      <Transition name="fashion-search">
        <form
          v-if="utilityMessage === 'search'"
          class="fashion-search-panel"
          role="search"
          @pointerdown.self="closeSearch"
          @submit.prevent
        >
          <div class="fashion-search-surface">
            <div class="fashion-search-box">
              <h2>What are you looking for?</h2>
              <label>
                <span class="sr-only">Search</span>
                <input
                  ref="searchInput"
                  type="text"
                  autocomplete="off"
                  placeholder="Enter your keywords..."
                  autofocus
                />
              </label>
              <button class="fashion-search-submit" type="submit" aria-label="Submit search">
                <span class="fashion-feather-icon fashion-feather-search" aria-hidden="true" />
              </button>
            </div>
          </div>
          <button
            class="fashion-search-close"
            type="button"
            aria-label="Close search"
            @click="closeSearch"
          >
            <span aria-hidden="true">×</span>
          </button>
        </form>
      </Transition>

      <details ref="mobileMenu" class="fashion-mobile-menu">
        <summary aria-label="Toggle navigation">
          <span></span><span></span><span></span><span></span>
        </summary>
        <nav aria-label="Mobile navigation">
          <div v-for="link in links" :key="link.label">
            <NuxtLink :to="link.href">{{ link.label }}</NuxtLink>
            <button
              v-if="link.menu"
              class="fashion-mobile-submenu-toggle"
              type="button"
              :aria-label="`Open ${link.label} mobile menu`"
              :aria-expanded="openMenu === link.label"
              @click="toggleMenu(link.label)"
            >
              <ChevronDown aria-hidden="true" :size="14" :stroke-width="2" />
            </button>
            <div
              v-if="link.menu"
              v-show="openMenu === link.label"
              class="fashion-mobile-submenu"
              :class="`fashion-mobile-${link.label.toLowerCase()}-submenu`"
            >
              <template v-if="link.label === 'Shop'">
                <section v-for="column in data.shopColumns" :key="column.heading">
                  <strong>{{ column.heading }}</strong>
                  <NuxtLink v-for="item in column.items" :key="item" :to="shopHref(column.heading)">
                    {{ item }}
                  </NuxtLink>
                </section>
                <div class="fashion-mobile-shop-banners">
                  <NuxtLink
                    v-for="assetId in data.shopBanners"
                    :key="assetId"
                    :to="collectionHref()"
                  >
                    <img
                      :src="properties.resolveAsset(assetId)"
                      alt=""
                      width="580"
                      height="175"
                      loading="lazy"
                    />
                  </NuxtLink>
                </div>
              </template>
              <template v-else-if="link.label === 'Collection'">
                <NuxtLink
                  v-for="[assetId, label] in data.collectionItems"
                  :key="label"
                  :to="collectionHref()"
                >
                  <img
                    :src="properties.resolveAsset(assetId)"
                    :alt="label"
                    width="200"
                    height="200"
                    loading="lazy"
                  />
                  <span>{{ label }}</span>
                </NuxtLink>
              </template>
              <template v-else>
                <NuxtLink v-for="item in data.pageItems" :key="item" :to="pageHref(item)">
                  {{ item }}
                </NuxtLink>
              </template>
            </div>
          </div>
        </nav>
      </details>
    </div>
  </header>
</template>
