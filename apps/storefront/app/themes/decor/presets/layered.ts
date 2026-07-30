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
    id: "decor-navigation",
    required: true,
    type: "decor.header",
  });
const footer = () =>
  section({
    capabilities: ["legal.links"],
    id: "decor-footer",
    required: true,
    type: "decor.footer",
  });

export const decorPreset = {
  id: "layered",
  label: "Layered living",
  templates: [
    {
      id: "decor-home",
      pageType: "home",
      requiredCapabilities: ["navigation.primary", "focus.skip-link", "legal.links"],
      sections: [
        navigation(),
        section({ capabilities: [], id: "decor-hero", type: "decor.hero-carousel" }),
        section({ capabilities: [], id: "decor-categories", type: "decor.category-showcase" }),
        section({ capabilities: [], id: "decor-products", type: "decor.product-tabs" }),
        section({ capabilities: [], id: "decor-marquee", type: "decor.marquee" }),
        section({ capabilities: [], id: "decor-collection", type: "decor.collection-feature" }),
        section({ capabilities: [], id: "decor-clients", type: "decor.client-strip" }),
        section({ capabilities: [], id: "decor-journal", type: "decor.journal" }),
        section({ capabilities: [], id: "decor-services", type: "decor.service-strip" }),
        footer(),
      ],
    },
    {
      id: "decor-collection",
      pageType: "collection",
      requiredCapabilities: ["navigation.primary", "focus.skip-link", "legal.links"],
      sections: [
        navigation(),
        section({ capabilities: [], id: "decor-collections", type: "core.collection-grid" }),
        section({
          capabilities: [],
          id: "decor-collection-products",
          type: "core.product-grid",
        }),
        footer(),
      ],
    },
    {
      id: "decor-product",
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
          id: "decor-product",
          required: true,
          type: "core.product",
        }),
        section({ capabilities: [], id: "decor-trust", type: "core.trust-strip" }),
        footer(),
      ],
    },
    {
      id: "decor-cart",
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
          id: "decor-cart",
          required: true,
          type: "core.cart",
        }),
        footer(),
      ],
    },
    {
      id: "decor-checkout",
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
          id: "decor-checkout",
          required: true,
          type: "core.checkout",
        }),
        footer(),
      ],
    },
    {
      id: "decor-order",
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
          id: "decor-order",
          required: true,
          type: "core.order",
        }),
        footer(),
      ],
    },
    {
      id: "decor-policy",
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
          id: "decor-policy",
          required: true,
          type: "core.policy",
        }),
        footer(),
      ],
    },
  ],
} as const satisfies ThemePreset;
