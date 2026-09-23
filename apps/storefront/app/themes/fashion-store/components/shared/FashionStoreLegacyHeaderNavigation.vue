<script setup lang="ts">
import type { PresentationShellViewModel } from "../../../../theme-engine/view-models";
import {
  isLegacyNavigationItemVisible,
  resolveLegacyNavigationHref,
} from "../../contracts/navigation-characterization";
import FashionStoreIcon from "./FashionStoreIcon.vue";

const properties = defineProps<{
  accountVisible: boolean;
  navigation: NonNullable<PresentationShellViewModel["header"]["legacyNavigation"]>;
  publishedRoutes?: readonly string[];
  sourceAsset: (sourcePath: string) => string;
  wishlistVisible: boolean;
}>();

const expandedMenuId = ref<string>();

function routeHref(path: string): string | undefined {
  return resolveLegacyNavigationHref(path, properties.publishedRoutes);
}

function itemVisible(id: string): boolean {
  return isLegacyNavigationItemVisible(id, {
    account: properties.accountVisible,
    wishlist: properties.wishlistVisible,
  });
}

function setExpanded(menuId: string, expanded: boolean): void {
  if (expanded) expandedMenuId.value = menuId;
  else if (expandedMenuId.value === menuId) expandedMenuId.value = undefined;
}

function setHovered(menuId: string, expanded: boolean): void {
  if (window.matchMedia("(min-width: 992px)").matches) setExpanded(menuId, expanded);
}

function toggleDropdown(event: Event, menuId: string): void {
  event.preventDefault();
  setExpanded(menuId, expandedMenuId.value !== menuId);
}

function close(): void {
  expandedMenuId.value = undefined;
}

defineExpose({ close });
</script>

<template>
  <ul class="navbar-nav alt-font navbar-left justify-content-end" data-legacy-header-left>
    <li
      v-for="item in navigation.left"
      :key="item.id"
      class="nav-item"
      :class="{
        dropdown: item.kind !== 'link',
        submenu: item.kind !== 'link',
        open: expandedMenuId === item.id,
      }"
      :data-legacy-navigation-id="item.id"
      @mouseenter="item.kind !== 'link' && setHovered(item.id, true)"
      @mouseleave="item.kind !== 'link' && setHovered(item.id, false)"
    >
      <a
        :href="routeHref(item.href)"
        :aria-disabled="routeHref(item.href) ? undefined : 'true'"
        data-fashion-store-route
        class="nav-link"
        >{{ item.label }}</a
      >
      <template v-if="item.kind === 'grouped-menu'">
        <button
          :id="`${item.id}-toggle`"
          type="button"
          class="dropdown-toggle"
          :class="{ show: expandedMenuId === item.id }"
          :aria-controls="`${item.id}-menu`"
          :aria-label="`Toggle ${item.label} menu`"
          :aria-expanded="expandedMenuId === item.id"
          @click="toggleDropdown($event, item.id)"
        >
          <FashionStoreIcon name="chevron-down" aria-hidden="true" />
        </button>
        <div
          :id="`${item.id}-menu`"
          class="dropdown-menu submenu-content"
          :class="{ show: expandedMenuId === item.id }"
          :aria-labelledby="`${item.id}-toggle`"
        >
          <div class="d-lg-flex mega-menu m-auto flex-column">
            <div
              class="row row-cols-1 row-cols-lg-5 row-cols-md-3 row-cols-sm-3 mb-50px md-mb-25px xs-mb-15px"
            >
              <div v-for="group in item.groups" :key="group.id" class="col">
                <ul>
                  <li class="sub-title">{{ group.label }}</li>
                  <li v-for="entry in group.items" :key="entry.id">
                    <a data-fashion-store-route aria-disabled="true">{{ entry.label }}</a>
                  </li>
                </ul>
              </div>
            </div>
            <div class="row row-cols-1 row-cols-sm-2">
              <div v-for="banner in item.banners" :key="banner.id" class="col">
                <a data-fashion-store-route aria-disabled="true"
                  ><img alt="" :src="sourceAsset(banner.assetPath)"
                /></a>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="item.kind === 'card-menu'">
        <button
          :id="`${item.id}-toggle`"
          type="button"
          class="dropdown-toggle"
          :class="{ show: expandedMenuId === item.id }"
          :aria-controls="`${item.id}-menu`"
          :aria-label="`Toggle ${item.label} menu`"
          :aria-expanded="expandedMenuId === item.id"
          @click="toggleDropdown($event, item.id)"
        >
          <FashionStoreIcon name="chevron-down" aria-hidden="true" />
        </button>
        <div
          :id="`${item.id}-menu`"
          class="dropdown-menu submenu-content"
          :class="{ show: expandedMenuId === item.id }"
          :aria-labelledby="`${item.id}-toggle`"
        >
          <div class="d-lg-flex mega-menu m-auto flex-column">
            <div
              class="row row-cols-2 row-cols-lg-6 row-cols-md-3 row-cols-sm-2 md-mx-0 align-items-center justify-content-center"
            >
              <div v-for="card in item.cards" :key="card.id" class="col md-mb-25px">
                <a
                  data-fashion-store-route
                  aria-disabled="true"
                  class="justify-content-center mb-10px"
                >
                  <img class="border-radius-4px w-100" alt="" :src="sourceAsset(card.assetPath)" />
                </a>
                <a
                  data-fashion-store-route
                  aria-disabled="true"
                  class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                >
                  <span
                    ><span class="btn-text text-dark-gray fs-17">{{ card.label }}</span></span
                  >
                </a>
              </div>
            </div>
          </div>
        </div>
      </template>
    </li>
  </ul>
  <ul class="navbar-nav alt-font navbar-right justify-content-start" data-legacy-header-right>
    <li
      v-for="item in navigation.right"
      :key="item.id"
      class="nav-item"
      :class="{
        dropdown: item.kind === 'menu',
        'simple-dropdown': item.kind === 'menu',
        open: expandedMenuId === item.id,
      }"
      :data-legacy-navigation-id="item.id"
      @mouseenter="item.kind === 'menu' && setHovered(item.id, true)"
      @mouseleave="item.kind === 'menu' && setHovered(item.id, false)"
    >
      <a
        v-if="item.kind === 'link'"
        :href="routeHref(item.href)"
        :aria-disabled="routeHref(item.href) ? undefined : 'true'"
        data-fashion-store-route
        class="nav-link"
        >{{ item.label }}</a
      >
      <template v-else>
        <button type="button" class="nav-link fashion-store-source-action">{{ item.label }}</button>
        <button
          :id="`${item.id}-toggle`"
          type="button"
          class="dropdown-toggle"
          :class="{ show: expandedMenuId === item.id }"
          :aria-controls="`${item.id}-menu`"
          :aria-label="`Toggle ${item.label} menu`"
          :aria-expanded="expandedMenuId === item.id"
          @click="toggleDropdown($event, item.id)"
        >
          <FashionStoreIcon name="chevron-down" aria-hidden="true" />
        </button>
        <ul
          :id="`${item.id}-menu`"
          class="dropdown-menu"
          :class="{ show: expandedMenuId === item.id }"
          :aria-labelledby="`${item.id}-toggle`"
        >
          <li v-for="entry in item.items.filter(({ id }) => itemVisible(id))" :key="entry.id">
            <a
              :href="routeHref(entry.href)"
              :aria-disabled="routeHref(entry.href) ? undefined : 'true'"
              data-fashion-store-route
              >{{ entry.label }}</a
            >
          </li>
        </ul>
      </template>
    </li>
  </ul>
</template>
