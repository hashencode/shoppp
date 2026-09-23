<script setup lang="ts">
import type { PresentationShellViewModel } from "../../../../theme-engine/view-models";
import {
  isLegacyNavigationItemVisible,
  resolveLegacyNavigationHref,
} from "../../contracts/navigation-characterization";

const properties = defineProps<{
  accountVisible: boolean;
  navigation: NonNullable<PresentationShellViewModel["footer"]["legacyNavigation"]>;
  publishedRoutes?: readonly string[];
  section: "columns" | "primary";
}>();

function routeHref(path: string): string | undefined {
  return resolveLegacyNavigationHref(path, properties.publishedRoutes);
}
</script>

<template>
  <div v-if="section === 'primary'" class="col" data-legacy-footer-primary>
    <ul class="footer-navbar text-center text-md-end">
      <li v-for="item in navigation.primary" :key="item.id" class="nav-item">
        <a
          :href="routeHref(item.href)"
          :aria-disabled="routeHref(item.href) ? undefined : 'true'"
          data-fashion-store-route
          class="nav-link"
          >{{ item.label }}</a
        >
      </li>
    </ul>
  </div>
  <template v-else v-for="column in navigation.columns" :key="column.id">
    <div
      class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2"
      :data-legacy-footer-column="column.id"
    >
      <span class="fw-500 d-block text-white mb-5px fs-17">{{ column.label }}</span>
      <ul>
        <li
          v-for="item in column.items.filter(({ id }) =>
            isLegacyNavigationItemVisible(id, { account: accountVisible, wishlist: true }),
          )"
          :key="item.id"
        >
          <a
            v-if="'href' in item"
            :href="routeHref(item.href)"
            :aria-disabled="routeHref(item.href) ? undefined : 'true'"
            data-fashion-store-route
            :data-legacy-navigation-id="item.id"
            >{{ item.label }}</a
          >
          <a
            v-else
            data-fashion-store-route
            aria-disabled="true"
            :data-legacy-navigation-id="item.id"
            >{{ item.label }}</a
          >
        </li>
      </ul>
    </div>
  </template>
</template>
