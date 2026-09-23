import type { BlockInstance, ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset as inheritedPreset } from "../../presets/source-parity";
import { fashionStoreHomeSections } from "../composition";
import {
  fashionStoreV11HomeSettings,
  homeSettingsByType,
  successorHomeSettings,
} from "../manifest";

const inheritedHome = inheritedPreset.templates.find(({ pageType }) => pageType === "home")!;
const inheritedHomeSection = inheritedHome.sections[0]!;
const successorHomeDefaults = Object.fromEntries(
  successorHomeSettings.flatMap((setting) =>
    "default" in setting && setting.default !== undefined
      ? [[setting.id, structuredClone(setting.default)]]
      : [],
  ),
) as BlockInstance["settings"];
const v11HomeDefaults = Object.fromEntries(
  fashionStoreV11HomeSettings.flatMap((setting) =>
    "default" in setting && setting.default !== undefined
      ? [[setting.id, structuredClone(setting.default)]]
      : [],
  ),
) as BlockInstance["settings"];

const legacyHomeClaimSettingIds = new Set([
  "header-logo",
  "footer-logo",
  "header-contact-copy",
  "footer-contact-copy",
  "header-social-link",
  "footer-social-link",
]);
const legacyProductClaimSettingIds = new Set([
  "delivery-summary",
  "shipping-returns-summary",
  "payment-brand-visa",
  "payment-brand-mastercard",
  "payment-brand-american-express",
  "payment-brand-discover",
  "payment-brand-diners-club",
  "payment-brand-union-pay",
]);
const fashionStoreV11ProductClaimDefaults = {
  "delivery-summary": "Delivery timing is confirmed for your destination at checkout.",
  "shipping-returns-summary": "Eligible unused items may be returned within 30 days of delivery.",
  "payment-brand-visa": true,
  "payment-brand-mastercard": true,
  "payment-brand-american-express": true,
  "payment-brand-discover": true,
  "payment-brand-diners-club": true,
  "payment-brand-union-pay": true,
} as const;

function homeSectionDefaults(type: string): BlockInstance["settings"] {
  const definitions = homeSettingsByType[type as keyof typeof homeSettingsByType] ?? [];
  return Object.fromEntries(
    definitions.map(({ default: value, id }) => [id, value]),
  ) as BlockInstance["settings"];
}

const block = (id: string, type: string, settings: Record<string, unknown>) => ({
  actions: [],
  capabilities: [],
  id,
  settings,
  type,
  visible: true,
});
const heroMedia = (index: 1 | 2 | 3) => ({
  "background-color": ["mist", "peach", "aqua"][index - 1],
  "foreground-color": "ink",
  "pattern-desktop": {
    alt: index === 3 ? "Hero desktop pattern" : `Hero desktop pattern ${index}`,
    height: 900,
    kind: "theme",
    path: `assets/hero/fashion-store-decor-hero-0${index}-pattern-desktop.jpg`,
    width: 900,
  },
  "pattern-mobile": {
    alt: index === 3 ? "Hero mobile pattern" : `Hero mobile pattern ${index}`,
    height: 900,
    kind: "theme",
    path: `assets/hero/fashion-store-decor-hero-0${index}-pattern-mobile.jpg`,
    width: 900,
  },
  "product-image": {
    alt: index === 3 ? "Hero product" : `Hero product ${index}`,
    height: 900,
    kind: "theme",
    path: `assets/hero/fashion-store-decor-hero-0${index}-product.png`,
    width: 900,
  },
  thumbnail: {
    alt: index === 3 ? "Hero thumbnail" : `Hero thumbnail ${index}`,
    height: 900,
    kind: "theme",
    path: `assets/hero/fashion-store-decor-hero-0${index}-thumb.jpg`,
    width: 900,
  },
});
const homeBlocks: Readonly<Record<string, readonly ReturnType<typeof block>[]>> = {
  "fashion-store.hero": [
    block("hero-slide-1", "fashion-store.hero-slide", {
      price: "$199.00",
      title: "Featured lounge",
      ...heroMedia(1),
    }),
    block("hero-slide-2", "fashion-store.hero-slide", {
      price: "$259.00",
      title: "Modern comfort",
      ...heroMedia(2),
    }),
    block("hero-slide-3", "fashion-store.hero-slide", {
      price: "$259.00",
      title: "Everyday design",
      ...heroMedia(3),
    }),
  ],
  "fashion-store.services": [
    block("service-delivery", "fashion-store.service", {
      description: "On qualifying orders",
      title: "Free delivery",
      variant: "package",
    }),
    block("service-payment", "fashion-store.service", {
      description: "Protected checkout",
      title: "Secure payment",
      variant: "credit-card",
    }),
    block("service-returns", "fashion-store.service", {
      description: "Straightforward support",
      title: "Easy returns",
      variant: "refresh-cw",
    }),
    block("service-support", "fashion-store.service", {
      description: "Help when you need it",
      title: "Real support",
      variant: "phone",
    }),
  ],
  "fashion-store.categories": ["Women", "Men", "Accessories", "Kids"].map((name, index) =>
    block(`category-${index + 1}`, "fashion-store.category", {
      image: {
        alt: name,
        height: 900,
        kind: "theme",
        path: `assets/images/demo-fashion-store-banner-0${index + 1}.jpg`,
        width: 900,
      },
      name,
    }),
  ),
  "fashion-store.promotion": [
    block("promotion-primary", "fashion-store.promotion-item", {
      label: "Shop the collection",
      message: "New-season pieces are available now.",
    }),
  ],
  "fashion-store.brand-strip": ["asos", "chanel", "gucci", "celine", "adidas"].map((name) =>
    block(`brand-${name}`, "fashion-store.brand", {
      image: {
        alt: name.toUpperCase(),
        height: 120,
        kind: "theme",
        path: `assets/images/logo-${name}.svg`,
        width: 360,
      },
      name: name.toUpperCase(),
    }),
  ),
  "fashion-store.marquee": [
    "New arrivals",
    "Selected essentials",
    "Modern classics",
    "Everyday layers",
  ].map((message, index) =>
    block(`marquee-${index + 1}`, "fashion-store.marquee-item", { message }),
  ),
  "fashion-store.editorial": [1, 2, 6, 7].map((image, index) =>
    block(`editorial-${index + 1}`, "fashion-store.editorial-card", {
      image: {
        alt: `Editorial story ${index + 1}`,
        height: 900,
        kind: "theme",
        path: `assets/images/demo-fashion-store-blog-0${image}.jpg`,
        width: 900,
      },
      title: [
        "The new season edit",
        "How to build a lasting wardrobe",
        "Materials worth knowing",
        "Inside the latest collection",
      ][index],
    }),
  ),
};

function splitPreset(options: { configurationSchemaVersion: 2 | 3 }) {
  const canonical = options.configurationSchemaVersion === 3;
  return {
    ...inheritedPreset,
    templates: inheritedPreset.templates.map((template) =>
      template.pageType === "home"
        ? {
            ...template,
            sections: fashionStoreHomeSections.map(({ id, required, type }) => ({
              blocks: structuredClone(homeBlocks[type] ?? []) as unknown as BlockInstance[],
              capabilities: [],
              id,
              required,
              settings:
                id === "fashion-store-home"
                  ? {
                      ...Object.fromEntries(
                        Object.entries(inheritedHomeSection.settings).filter(([settingId]) =>
                          canonical
                            ? !legacyHomeClaimSettingIds.has(settingId)
                            : settingId !== "header-logo" && settingId !== "footer-logo",
                        ),
                      ),
                      ...(canonical ? successorHomeDefaults : v11HomeDefaults),
                    }
                  : homeSectionDefaults(type),
              type,
              visible: type !== "fashion-store.product-merchandising",
            })),
          }
        : template.pageType === "product"
          ? canonical
            ? {
                ...template,
                sections: template.sections.map((section) => ({
                  ...section,
                  settings: Object.fromEntries(
                    Object.entries(section.settings).filter(
                      ([settingId]) => !legacyProductClaimSettingIds.has(settingId),
                    ),
                  ),
                })),
              }
            : {
                ...template,
                sections: template.sections.map((section) => ({
                  ...section,
                  settings: {
                    ...fashionStoreV11ProductClaimDefaults,
                    ...section.settings,
                  },
                })),
              }
          : template,
    ),
  } as const satisfies ThemePreset;
}

export const fashionStoreV11Preset = splitPreset({ configurationSchemaVersion: 2 });
export const fashionStorePreset = splitPreset({ configurationSchemaVersion: 3 });
