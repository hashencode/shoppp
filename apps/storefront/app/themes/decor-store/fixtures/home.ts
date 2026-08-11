import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

export const decorStoreHomeFixtures = {
  "decor-store-home": {
    id: "decor-store-home",
    label: "Decor Store source-parity home shell",
    pageTypes: ["home"],
    viewModels: {
      home: {
        data: { implementationUnit: "U2", sourcePage: "demo-decor-store.html" },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
