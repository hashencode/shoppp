import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

export const decorStoreHomeFixtures = {
  "decor-store-home": {
    id: "decor-store-home",
    label: "Decor Store source-parity home shell",
    pageTypes: ["home"],
    viewModels: {
      home: {
        data: {
          hero: {
            gridHeight: [900, 1000, 960, 720],
            gridWidth: [1220, 1024, 778, 480],
            runtime: "revolution-5.4.5",
            slides: ["rs-73", "rs-72", "rs-74"],
          },
          implementationUnit: "U3",
          representativeProduct: {
            name: "Table clock",
            price: "$23.00",
            sourceImage: "images/demo-decor-store-product-01.jpg",
          },
          sourcePage: "demo-decor-store.html",
        },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
