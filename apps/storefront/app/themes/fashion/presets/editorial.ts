import type { SectionInstance, ThemePreset } from "@shoppp/contracts";

type SectionOptions = Pick<SectionInstance, "capabilities" | "id" | "type"> &
  Partial<Pick<SectionInstance, "required" | "settings" | "visible">>;

function section({
  capabilities,
  id,
  required,
  settings = {},
  type,
  visible = true,
}: SectionOptions): SectionInstance {
  return {
    blocks: [],
    capabilities,
    id,
    required,
    settings,
    type,
    visible,
  };
}

const navigation = () =>
  section({
    capabilities: ["navigation.primary", "focus.skip-link"],
    id: "site-navigation",
    required: true,
    type: "fashion.header",
  });
const footer = () =>
  section({
    capabilities: ["legal.links"],
    id: "site-footer",
    required: true,
    type: "fashion.footer",
  });

export const fashionPreset = {
  id: "editorial",
  label: "Editorial",
  templates: [
    {
      id: "fashion-home",
      pageType: "home",
      requiredCapabilities: ["navigation.primary", "focus.skip-link", "legal.links"],
      sections: [
        navigation(),
        section({ capabilities: [], id: "fashion-hero", type: "fashion.hero-carousel" }),
        section({ capabilities: [], id: "fashion-services", type: "fashion.service-strip" }),
        section({ capabilities: [], id: "fashion-categories", type: "fashion.category-tiles" }),
        section({ capabilities: [], id: "fashion-bestsellers", type: "fashion.product-showcase" }),
        section({ capabilities: [], id: "fashion-promotion", type: "fashion.promo-band" }),
        section({
          capabilities: [],
          id: "fashion-collection",
          type: "fashion.collection-carousel",
        }),
        section({ capabilities: [], id: "fashion-brands", type: "fashion.brand-strip" }),
        section({ capabilities: [], id: "fashion-featured", type: "fashion.product-showcase" }),
        section({ capabilities: [], id: "fashion-promises", type: "fashion.promise-strip" }),
        section({ capabilities: [], id: "fashion-magazine", type: "fashion.magazine" }),
        footer(),
      ],
    },
    {
      id: "fashion-collection",
      pageType: "collection",
      requiredCapabilities: ["navigation.primary", "focus.skip-link", "legal.links"],
      sections: [
        navigation(),
        section({ capabilities: [], id: "collection-grid", type: "core.collection-grid" }),
        section({ capabilities: [], id: "collection-products", type: "core.product-grid" }),
        footer(),
      ],
    },
    {
      id: "fashion-product",
      pageType: "product",
      requiredCapabilities: [
        "navigation.primary",
        "focus.skip-link",
        "product.details",
        "product.action",
        "legal.links",
      ],
      sections: [
        navigation(),
        section({
          capabilities: ["product.details", "product.action"],
          id: "product-main",
          required: true,
          type: "fashion.product-details",
        }),
        section({ capabilities: [], id: "trust-strip", type: "core.trust-strip" }),
        footer(),
      ],
    },
    {
      id: "fashion-cart",
      pageType: "cart",
      requiredCapabilities: [
        "navigation.primary",
        "focus.skip-link",
        "cart.summary",
        "cart.error",
        "legal.links",
      ],
      sections: [
        navigation(),
        section({
          capabilities: ["cart.summary", "cart.error"],
          id: "cart-main",
          required: true,
          type: "core.cart",
        }),
        footer(),
      ],
    },
    {
      id: "fashion-checkout",
      pageType: "checkout",
      requiredCapabilities: [
        "navigation.primary",
        "focus.skip-link",
        "checkout.summary",
        "checkout.error",
        "legal.links",
      ],
      sections: [
        navigation(),
        section({
          capabilities: ["checkout.summary", "checkout.error"],
          id: "checkout-main",
          required: true,
          type: "core.checkout",
        }),
        footer(),
      ],
    },
    {
      id: "fashion-order",
      pageType: "order",
      requiredCapabilities: [
        "navigation.primary",
        "focus.skip-link",
        "order.status",
        "order.error",
        "legal.links",
      ],
      sections: [
        navigation(),
        section({
          capabilities: ["order.status", "order.error"],
          id: "order-main",
          required: true,
          type: "core.order",
        }),
        footer(),
      ],
    },
    {
      id: "fashion-policy",
      pageType: "policy",
      requiredCapabilities: [
        "navigation.primary",
        "focus.skip-link",
        "policy.content",
        "legal.links",
      ],
      sections: [
        navigation(),
        section({
          capabilities: ["policy.content"],
          id: "policy-main",
          required: true,
          type: "core.policy",
        }),
        footer(),
      ],
    },
  ],
} as const satisfies ThemePreset;
