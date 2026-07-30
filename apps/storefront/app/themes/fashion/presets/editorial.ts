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
    type: "fashion.masthead",
  });
const footer = () =>
  section({
    capabilities: ["legal.links"],
    id: "site-footer",
    required: true,
    settings: { note: "Private fixture preview · no live commerce activity" },
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
        section({ capabilities: [], id: "announcement", type: "core.announcement" }),
        section({
          capabilities: [],
          id: "home-hero",
          settings: {
            alignment: "left",
            body: "A fixture-backed editorial storefront presentation.",
            heading: "Objects with a point of view.",
          },
          type: "fashion.editorial-hero",
        }),
        section({ capabilities: [], id: "home-products", type: "core.product-grid" }),
        section({
          capabilities: [],
          id: "home-story",
          settings: {
            body: "An optional editorial chapter controlled by a stable instance ID.",
            heading: "Material, form, and restraint.",
          },
          type: "fashion.story",
        }),
        section({ capabilities: [], id: "trust-strip", type: "core.trust-strip" }),
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
          type: "core.product",
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
