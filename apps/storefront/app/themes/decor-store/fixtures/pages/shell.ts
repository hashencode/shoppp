import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";

const fixture = (
  pageType: "cart" | "checkout",
): ExperienceFixtureRegistry[string] => ({
  id: `decor-store-${pageType}`,
  label: `Decor Store internal ${pageType} shell probe`,
  pageTypes: [pageType],
  viewModels: {
    [pageType]: {
      data: {
        announcement: "Free Delivery on orders over £120. Don't miss discount.",
        internalProbe: true,
      },
      kind: "theme-section",
      state: "populated",
    },
  },
});

export const decorStoreSecondaryShellFixtures = {
  "decor-store-cart": fixture("cart"),
  "decor-store-checkout": fixture("checkout"),
} as const satisfies ExperienceFixtureRegistry;
