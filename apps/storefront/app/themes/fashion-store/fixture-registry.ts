import type { ThemeRegistry } from "../../theme-engine/registry";
import { fashionStoreHomeFixtures } from "./fixtures/home";
import { fashionStoreCartFixtures } from "./fixtures/pages/cart";
import { fashionStoreCheckoutFixtures } from "./fixtures/pages/checkout";
import { fashionStoreContentFixtures } from "./fixtures/pages/content";
import { fashionStoreShopFixtures } from "./fixtures/pages/shop";
import { fashionStoreProductFixtures } from "./fixtures/pages/product";
import { fashionStorePageSections } from "./page-registry";

export const themeFixtures = {
  ...fashionStoreCartFixtures,
  ...fashionStoreCheckoutFixtures,
  ...fashionStoreContentFixtures,
  ...fashionStoreHomeFixtures,
  ...fashionStoreProductFixtures,
  ...fashionStoreShopFixtures,
};

export const fixtureThemeRegistry = {
  blocks: {},
  sections: fashionStorePageSections,
} as const satisfies ThemeRegistry;
