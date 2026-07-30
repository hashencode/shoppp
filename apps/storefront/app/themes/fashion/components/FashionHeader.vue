<script setup lang="ts">
import { ChevronDown, MapPin, Search, ShoppingBag, UserRound, UsersRound } from "@lucide/vue";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

interface HeaderData {
  announcement: string;
  brand: string;
  brandAssetId?: string;
  navigation: string[];
}

interface NavigationLink {
  href: string;
  label: string;
  menu?: { href: string; label: string }[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
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

const destinations = [
  "/",
  "#fashion-bestsellers",
  "#fashion-categories",
  "#fashion-magazine",
  "#fashion-footer",
  "#fashion-contact",
] as const;
const menus: Record<string, NavigationLink["menu"]> = {
  Collection: [
    { href: "#fashion-categories", label: "Shop categories" },
    { href: "#fashion-collection", label: "New arrivals" },
  ],
  Pages: [
    { href: "#fashion-magazine", label: "Magazine" },
    { href: "#fashion-footer", label: "Store information" },
  ],
  Shop: [
    { href: "#fashion-bestsellers", label: "Best sellers" },
    { href: "#fashion-featured", label: "Featured products" },
  ],
};
const links = computed<NavigationLink[]>(() =>
  (data.value?.navigation ?? []).map((label, index) => ({
    href: destinations[index] ?? "/",
    label,
    menu: menus[label],
  })),
);
const leftLinks = computed(() => links.value.slice(0, 3));
const rightLinks = computed(() => links.value.slice(3, 6));
const openMenu = ref<string | null>(null);

function toggleMenu(label: string): void {
  openMenu.value = openMenu.value === label ? null : label;
}

async function closeMenu(): Promise<void> {
  const label = openMenu.value;
  openMenu.value = null;
  if (!label) return;
  await nextTick();
  document.querySelector<HTMLButtonElement>(`[data-menu-toggle="${label}"]`)?.focus();
}
</script>

<template>
  <header v-if="data" class="fashion-header">
    <a class="fashion-skip-link" href="#preview-content">Skip to content</a>
    <p class="fashion-announcement">{{ data.announcement }} <strong>Shop now</strong></p>
    <div class="fashion-nav-shell" @keydown.esc.prevent.stop="closeMenu">
      <div class="fashion-nav-meta" aria-hidden="true">
        <span
          ><MapPin :size="14" :stroke-width="1.7" />
          <span class="fashion-meta-label">Find stores</span></span
        ><span
          ><UsersRound :size="14" :stroke-width="1.7" />
          <span class="fashion-meta-label">100k followers</span></span
        >
      </div>

      <nav aria-label="Primary navigation" class="fashion-desktop-nav">
        <div class="fashion-nav-group fashion-nav-left">
          <div v-for="link in leftLinks" :key="link.label" class="fashion-nav-item">
            <a class="fashion-nav-link" :href="link.href">{{ link.label }}</a>
            <button
              v-if="link.menu"
              type="button"
              :data-menu-toggle="link.label"
              :aria-label="`Open ${link.label} menu`"
              :aria-expanded="openMenu === link.label"
              :aria-controls="`fashion-menu-${link.label.toLowerCase()}`"
              @click="toggleMenu(link.label)"
            >
              <ChevronDown aria-hidden="true" :size="12" :stroke-width="1.8" />
            </button>
            <div
              v-if="link.menu"
              v-show="openMenu === link.label"
              :id="`fashion-menu-${link.label.toLowerCase()}`"
              class="fashion-submenu"
            >
              <a v-for="child in link.menu" :key="child.label" :href="child.href">{{
                child.label
              }}</a>
            </div>
          </div>
        </div>

        <NuxtLink class="fashion-brand" to="/" :aria-label="`${data.brand} home`">
          <img
            v-if="data.brandAssetId"
            :src="properties.resolveAsset(data.brandAssetId)"
            alt=""
            width="155"
            height="34"
          />
          <template v-else><span>ML</span>{{ data.brand }}</template>
        </NuxtLink>

        <div class="fashion-nav-group fashion-nav-right">
          <div v-for="link in rightLinks" :key="link.label" class="fashion-nav-item">
            <a class="fashion-nav-link" :href="link.href">{{ link.label }}</a>
            <button
              v-if="link.menu"
              type="button"
              :data-menu-toggle="link.label"
              :aria-label="`Open ${link.label} menu`"
              :aria-expanded="openMenu === link.label"
              :aria-controls="`fashion-menu-${link.label.toLowerCase()}`"
              @click="toggleMenu(link.label)"
            >
              <ChevronDown aria-hidden="true" :size="12" :stroke-width="1.8" />
            </button>
            <div
              v-if="link.menu"
              v-show="openMenu === link.label"
              :id="`fashion-menu-${link.label.toLowerCase()}`"
              class="fashion-submenu"
            >
              <a v-for="child in link.menu" :key="child.label" :href="child.href">{{
                child.label
              }}</a>
            </div>
          </div>
        </div>
      </nav>

      <NuxtLink class="fashion-mobile-brand" to="/" :aria-label="`${data.brand} home`">
        <img
          v-if="data.brandAssetId"
          :src="properties.resolveAsset(data.brandAssetId)"
          alt=""
          width="155"
          height="34"
        />
        <template v-else><span>ML</span>{{ data.brand }}</template>
      </NuxtLink>

      <div class="fashion-nav-actions" aria-label="Store utilities">
        <button type="button" aria-label="Search">
          <Search aria-hidden="true" :size="19" :stroke-width="1.7" /></button
        ><button type="button" aria-label="Account">
          <UserRound aria-hidden="true" :size="19" :stroke-width="1.7" /></button
        ><button type="button" aria-label="Preview bag">
          <ShoppingBag aria-hidden="true" :size="19" :stroke-width="1.7" /><sup>0</sup>
        </button>
      </div>

      <details class="fashion-mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <a v-for="link in links" :key="link.label" :href="link.href">{{ link.label }}</a>
        </nav>
      </details>
    </div>
  </header>
</template>
