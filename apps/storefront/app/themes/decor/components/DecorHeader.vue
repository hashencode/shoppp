<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import plusJakartaSansUrl from "../assets/fonts/plus-jakarta-sans-latin.woff2?url";

interface HeaderData {
  announcement: string;
  announcementAction?: string;
  brand: string;
  brandAssetId?: string;
  cart?: {
    count: number;
    items: readonly (readonly [string, string, string])[];
    subtotal: string;
  };
  collectionBanners?: readonly string[];
  collectionItems?: readonly (readonly [string, string])[];
  language?: {
    initial: string;
    options: readonly (readonly [string, string])[];
    persistence: "session-only";
  };
  navigation: readonly string[];
  pageItems?: readonly string[];
  shopBanners?: readonly string[];
  shopColumns?: readonly { heading: string; items: readonly string[] }[];
  utilityLinks?: readonly string[];
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
      href: plusJakartaSansUrl,
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
      announcement: "Private fixture preview",
      brand: properties.viewModel.brand,
      navigation: properties.viewModel.items.map(({ label }) => label),
    };
  return null;
});
const destinations = [
  "/",
  "/#decor-products",
  "/#decor-categories",
  "/#decor-footer",
  "/#decor-journal",
  "/#decor-contact",
] as const;
const menuLabels = new Set(["Shop", "Collections", "Pages"]);
const openMenu = ref<string | null>(null);
const utility = ref<"" | "search" | "bag" | "account">("");
const languageOpen = ref(false);
const currentLanguage = ref("");
const headerRoot = useTemplateRef<HTMLElement>("headerRoot");
const languageTrigger = useTemplateRef<HTMLButtonElement>("languageTrigger");
const languageMenu = useTemplateRef<HTMLElement>("languageMenu");
const navShell = useTemplateRef<HTMLElement>("navShell");
const searchInput = useTemplateRef<HTMLInputElement>("searchInput");
const router = useRouter();

function toggleMenu(label: string): void {
  openMenu.value = openMenu.value === label ? null : label;
}
function openDesktopMenu(label: string): void {
  if (menuLabels.has(label)) openMenu.value = label;
}
function closeDesktopMenu(label: string): void {
  if (openMenu.value === label) openMenu.value = null;
}
async function focusLanguage(index: number): Promise<void> {
  await nextTick();
  const items = languageMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
  items?.[Math.max(0, Math.min(index, items.length - 1))]?.focus();
}
async function openLanguage(focusCurrent = false): Promise<void> {
  languageOpen.value = true;
  if (!focusCurrent) return;
  const currentIndex = Math.max(
    0,
    data.value?.language?.options.findIndex(([label]) => label === currentLanguage.value) ?? 0,
  );
  await focusLanguage(currentIndex);
}
async function openLastLanguage(): Promise<void> {
  await openLanguage();
  await focusLanguage((data.value?.language?.options.length ?? 1) - 1);
}
async function closeLanguage(restoreFocus = false): Promise<void> {
  languageOpen.value = false;
  if (!restoreFocus) return;
  await nextTick();
  languageTrigger.value?.focus();
}
async function selectLanguage(label: string): Promise<void> {
  currentLanguage.value = label;
  await closeLanguage(true);
}
function languageKeydown(event: KeyboardEvent): void {
  const items = [
    ...(languageMenu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []),
  ];
  const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
  if (event.key === "Escape") {
    event.preventDefault();
    void closeLanguage(true);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    items[(currentIndex + 1) % items.length]?.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    items[(currentIndex - 1 + items.length) % items.length]?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    items[0]?.focus();
  } else if (event.key === "End") {
    event.preventDefault();
    items.at(-1)?.focus();
  }
}
async function closeAll(): Promise<void> {
  const label = openMenu.value;
  openMenu.value = null;
  utility.value = "";
  const restoreLanguage = languageOpen.value;
  languageOpen.value = false;
  await nextTick();
  if (label) document.querySelector<HTMLButtonElement>(`[data-decor-menu="${label}"]`)?.focus();
  else if (restoreLanguage) languageTrigger.value?.focus();
}
async function toggleUtility(value: typeof utility.value): Promise<void> {
  utility.value = utility.value === value ? "" : value;
  openMenu.value = null;
  await nextTick();
  if (utility.value === "search") searchInput.value?.focus();
}
function outsidePointer(event: PointerEvent): void {
  if (!headerRoot.value?.contains(event.target as Node)) {
    openMenu.value = null;
    utility.value = "";
    languageOpen.value = false;
  }
}
watch(
  () => router.currentRoute.value.fullPath,
  () => {
    openMenu.value = null;
    utility.value = "";
    languageOpen.value = false;
  },
);
onMounted(() => {
  currentLanguage.value =
    data.value?.language?.initial ?? data.value?.utilityLinks?.[2] ?? "English";
  document.addEventListener("pointerdown", outsidePointer);
});
onBeforeUnmount(() => document.removeEventListener("pointerdown", outsidePointer));
</script>

<template>
  <header v-if="data" ref="headerRoot" class="decor-header">
    <a class="decor-skip-link" href="#preview-content">Skip to content</a>
    <div class="decor-utility">
      <span
        >{{ data.announcement }}
        <a href="/#decor-products">{{ data.announcementAction ?? "Shop now" }}</a></span
      >
      <nav aria-label="Store information">
        <a href="/#decor-contact"
          ><i class="decor-feather decor-feather-phone-call" aria-hidden="true"></i
          >{{ data.utilityLinks?.[0] }}</a
        >
        <a href="/#decor-contact"
          ><i class="decor-feather decor-feather-map-pin" aria-hidden="true"></i
          >{{ data.utilityLinks?.[1] }}</a
        >
        <div
          v-if="data.language"
          class="decor-language"
          @mouseenter="openLanguage()"
          @mouseleave="languageOpen = false"
        >
          <button
            ref="languageTrigger"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="languageOpen"
            aria-controls="decor-language-menu"
            :aria-label="`Select language, current ${currentLanguage}`"
            @click="languageOpen ? closeLanguage() : openLanguage()"
            @keydown.down.prevent="openLanguage(true)"
            @keydown.up.prevent="openLastLanguage"
          >
            <i class="decor-feather decor-feather-globe" aria-hidden="true"></i>
            <span>{{ currentLanguage }}</span>
            <i class="decor-bootstrap-icon decor-bootstrap-chevron-down" aria-hidden="true"></i>
          </button>
          <div
            v-show="languageOpen"
            id="decor-language-menu"
            ref="languageMenu"
            class="decor-language-menu"
            role="menu"
            aria-label="Languages"
            @keydown="languageKeydown"
          >
            <button
              v-for="[label, assetId] in data.language.options"
              :key="label"
              type="button"
              role="menuitemradio"
              :aria-checked="currentLanguage === label"
              @click="selectLanguage(label)"
            >
              <img :src="properties.resolveAsset(assetId)" alt="" width="16" height="16" />
              <span>{{ label }}</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
    <div ref="navShell" class="decor-nav" @keydown.esc.prevent.stop="closeAll">
      <NuxtLink to="/" class="decor-brand" :aria-label="`${data.brand} home`">
        <img
          v-if="data.brandAssetId"
          :src="properties.resolveAsset(data.brandAssetId)"
          alt=""
          width="167"
          height="36"
        />
        <template v-else>{{ data.brand }}</template>
      </NuxtLink>
      <nav aria-label="Primary navigation">
        <div
          v-for="(item, index) in data.navigation"
          :key="item"
          class="decor-nav-item"
          @mouseenter="openDesktopMenu(item)"
          @mouseleave="closeDesktopMenu(item)"
        >
          <a :href="destinations[index] ?? '/#decor-categories'"
            >{{ item }}<span v-if="item === 'Shop'" class="decor-nav-hot">Hot</span></a
          >
          <button
            v-if="menuLabels.has(item)"
            type="button"
            :data-decor-menu="item"
            :aria-label="`Open ${item} menu`"
            :aria-expanded="openMenu === item"
            :aria-controls="`decor-menu-${item.toLowerCase()}`"
            @click="toggleMenu(item)"
          >
            <i class="decor-bootstrap-icon decor-bootstrap-chevron-down" aria-hidden="true"></i>
          </button>
          <div
            v-if="menuLabels.has(item)"
            v-show="openMenu === item"
            :id="`decor-menu-${item.toLowerCase()}`"
            class="decor-submenu"
          >
            <template v-if="item === 'Shop'">
              <div class="decor-shop-columns">
                <section v-for="column in data.shopColumns" :key="column.heading">
                  <h2>{{ column.heading }}</h2>
                  <a v-for="link in column.items" :key="link" href="/#decor-products">{{ link }}</a>
                </section>
              </div>
              <div class="decor-menu-banners">
                <a v-for="assetId in data.shopBanners" :key="assetId" href="/#decor-products">
                  <img :src="properties.resolveAsset(assetId)" alt="" width="580" height="175" />
                </a>
              </div>
            </template>
            <template v-else-if="item === 'Collections'">
              <div class="decor-collection-menu">
                <a
                  v-for="[assetId, label] in data.collectionItems"
                  :key="assetId"
                  href="/#decor-categories"
                >
                  <img
                    :src="properties.resolveAsset(assetId)"
                    :alt="label"
                    width="170"
                    height="165"
                  /><span>{{ label }} →</span>
                </a>
              </div>
              <div class="decor-menu-banners">
                <a
                  v-for="assetId in data.collectionBanners"
                  :key="assetId"
                  href="/#decor-categories"
                >
                  <img :src="properties.resolveAsset(assetId)" alt="" width="580" height="240" />
                </a>
              </div>
            </template>
            <a v-else v-for="link in data.pageItems" :key="link" href="/#decor-footer">{{
              link
            }}</a>
          </div>
        </div>
      </nav>
      <div class="decor-actions" aria-label="Store utilities">
        <button type="button" aria-label="Search" @click="toggleUtility('search')">
          <i class="decor-feather decor-feather-search" aria-hidden="true"></i></button
        ><button type="button" aria-label="Preview bag" @click="toggleUtility('bag')">
          <i class="decor-feather decor-feather-shopping-bag" aria-hidden="true"></i
          ><sup>{{ data.cart?.count ?? 0 }}</sup></button
        ><button
          class="decor-account-action"
          type="button"
          aria-label="Account"
          @click="toggleUtility('account')"
        >
          <i class="decor-account-icon decor-feather decor-feather-user" aria-hidden="true"></i>
          <span>My account</span>
        </button>
      </div>
      <form v-if="utility === 'search'" class="decor-search-panel" role="search" @submit.prevent>
        <label
          ><span class="sr-only">Search</span
          ><input ref="searchInput" type="search" placeholder="What are you looking for?" autofocus
        /></label>
        <button type="submit" aria-label="Submit search">
          <i class="decor-feather decor-feather-search" aria-hidden="true"></i>
        </button>
      </form>
      <aside v-else-if="utility === 'bag' && data.cart" class="decor-cart-panel">
        <header>
          <strong>Shopping bag</strong><span>{{ data.cart.count }}</span>
        </header>
        <article v-for="[assetId, name, detail] in data.cart.items" :key="assetId">
          <img :src="properties.resolveAsset(assetId)" :alt="name" width="80" height="100" />
          <p>
            <strong>{{ name }}</strong
            ><span>{{ detail }}</span>
          </p>
        </article>
        <p class="decor-cart-subtotal">
          <span>Subtotal:</span><strong>{{ data.cart.subtotal }}</strong>
        </p>
        <div class="decor-cart-actions">
          <NuxtLink to="/cart">View cart</NuxtLink>
          <NuxtLink to="/checkout">Checkout</NuxtLink>
        </div>
      </aside>
      <p v-else-if="utility === 'account'" class="decor-utility-message" role="status">
        Account access is disabled in this private preview.
      </p>
      <details class="decor-mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <div v-for="(item, index) in data.navigation" :key="item">
            <a :href="destinations[index] ?? '/#decor-categories'"
              >{{ item }}<span v-if="item === 'Shop'" class="decor-nav-hot">Hot</span></a
            >
            <template v-if="item === 'Pages'">
              <a v-for="link in data.pageItems" :key="link" href="/#decor-footer">{{ link }}</a>
            </template>
          </div>
        </nav>
      </details>
    </div>
  </header>
</template>
