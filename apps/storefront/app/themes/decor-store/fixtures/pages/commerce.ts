import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import { decorStoreShopData } from "./shop";

export interface DecorStoreCartLine {
  color: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export const decorStoreCartData = {
  announcement: decorStoreShopData.announcement,
  lines: [
    { color: "Pink", id: "table-clock", name: "Table clock", price: 23, quantity: 1 },
    { color: "Brown", id: "designer-pot", name: "Designer pot", price: 35, quantity: 2 },
    { color: "White", id: "ceramic-mug", name: "Ceramic mug", price: 15, quantity: 1 },
  ] satisfies DecorStoreCartLine[],
  shipping: 5,
} as const;

export const decorStoreCheckoutData = {
  announcement: decorStoreShopData.announcement,
  countries: ["United Kingdom", "France", "United States"],
  paymentMethods: ["Direct bank transfer", "Check payments", "Cash on delivery"],
} as const;

export const decorStoreAccountData = {
  announcement: decorStoreShopData.announcement,
  title: "My account",
} as const;

const fixture = (pageType: "cart" | "checkout"): ExperienceFixtureRegistry[string] => ({
  id: `decor-store-${pageType}`,
  label: `Decor Store source-parity ${pageType}`,
  pageTypes: [pageType],
  viewModels: {
    [pageType]: {
      data:
        pageType === "cart" ? { cart: decorStoreCartData } : { checkout: decorStoreCheckoutData },
      kind: "theme-section",
      state: "populated",
    },
  },
});

export const decorStoreCommerceFixtures = {
  "decor-store-cart": fixture("cart"),
  "decor-store-checkout": fixture("checkout"),
} as const satisfies ExperienceFixtureRegistry;
