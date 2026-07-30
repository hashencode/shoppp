import type { ExperienceFixtureRegistry } from "../../app/theme-engine/view-models";

const media = {
  alt: "Black Atlas carry-on suitcase standing upright",
  height: 1200,
  src: "/media/atlas-carry-on.svg",
  width: 1200,
} as const;

export const experienceFixtureRegistry = {
  "core-populated": {
    id: "core-populated",
    label: "Representative populated storefront presentation",
    pageTypes: ["home", "collection", "product", "cart", "checkout", "order", "policy"],
    viewModels: {
      "site-navigation": {
        brand: "Shoppp",
        items: [
          {
            id: "new-arrivals",
            intent: "navigation",
            label: "New arrivals",
            target: "/collections/travel-essentials",
          },
          {
            id: "shipping",
            intent: "navigation",
            label: "Shipping",
            target: "/policies/shipping",
          },
        ],
        kind: "navigation",
        state: "populated",
      },
      announcement: {
        kind: "announcement",
        message: "Fixture preview · no live inventory, checkout, or payment activity",
        state: "populated",
      },
      "home-hero": {
        body: "A fixture-backed presentation for evaluating theme structure and visual language.",
        eyebrow: "Preview edition",
        heading: "Objects with a point of view.",
        kind: "hero",
        media,
        primaryAction: {
          id: "explore",
          intent: "navigation",
          label: "Explore the fixture collection",
          target: "/collections/travel-essentials",
        },
        state: "populated",
      },
      collections: {
        collections: [
          {
            action: {
              id: "travel",
              intent: "navigation",
              label: "View Travel",
              target: "/collections/travel-essentials",
            },
            id: "travel",
            name: "Travel",
          },
          {
            action: {
              id: "home",
              intent: "navigation",
              label: "View Home",
              target: "/collections/home-objects",
            },
            id: "home",
            name: "Home objects",
          },
        ],
        heading: "Curated collections",
        kind: "collection-grid",
        state: "populated",
      },
      products: {
        heading: "Fixture products",
        kind: "product-grid",
        products: [
          {
            href: "/products/atlas-carry-on",
            id: "atlas-carry-on",
            media,
            name: "Atlas carry-on",
            priceLabel: "$129 fixture price",
          },
        ],
        state: "populated",
      },
      promotion: {
        action: {
          id: "promotion",
          intent: "navigation",
          label: "Read the fixture story",
          target: "/policies/shipping",
        },
        body: "A bounded promotional region with no submission or account behavior.",
        heading: "Made for considered movement.",
        kind: "promotion",
        state: "populated",
      },
      editorial: {
        body: "Structured editorial copy remains separate from visual component code.",
        heading: "Material, form, and restraint.",
        kind: "editorial",
        media,
        state: "populated",
      },
      trust: {
        items: ["Fixture-backed facts", "No live commerce mutation", "Accessible by default"],
        kind: "trust-strip",
        state: "populated",
      },
      footer: {
        brand: "Shoppp",
        kind: "footer",
        legalLinks: [
          {
            id: "terms",
            intent: "navigation",
            label: "Terms",
            target: "/policies/terms",
          },
          {
            id: "privacy",
            intent: "navigation",
            label: "Privacy",
            target: "/policies/privacy",
          },
        ],
        state: "populated",
        summary: "A private fixture preview. Production storefront behavior is unchanged.",
      },
      product: {
        actions: [
          {
            id: "variant-small",
            intent: "variant.select",
            label: "Select cabin size",
            value: "cabin",
          },
          {
            id: "add-preview",
            intent: "cart.add-preview",
            label: "Add to preview bag",
          },
        ],
        description: "A representative product ViewModel with no API DTO dependency.",
        heading: "Atlas carry-on",
        kind: "product",
        media: [media],
        priceLabel: "$129 fixture price",
        state: "populated",
        variants: [
          { id: "cabin", label: "Cabin", selected: true },
          { id: "checked", label: "Checked", selected: false },
        ],
      },
      cart: {
        checkoutAction: {
          id: "checkout-preview",
          intent: "checkout.start-preview",
          label: "Preview checkout",
        },
        heading: "Preview bag",
        kind: "cart",
        lines: [
          {
            id: "atlas-line",
            name: "Atlas carry-on",
            priceLabel: "$129 fixture price",
            quantity: 1,
            quantityActions: [
              {
                id: "quantity-one",
                intent: "cart.quantity-preview",
                label: "Set quantity to one",
                value: "1",
              },
              {
                id: "quantity-two",
                intent: "cart.quantity-preview",
                label: "Set quantity to two",
                value: "2",
              },
            ],
          },
        ],
        state: "populated",
        subtotalLabel: "$129 fixture subtotal",
      },
      checkout: {
        action: {
          id: "continue-preview",
          intent: "checkout.start-preview",
          label: "Record checkout preview intent",
        },
        heading: "Checkout presentation preview",
        kind: "checkout",
        state: "populated",
        steps: ["Contact", "Delivery", "Review"],
        summaryLines: ["Atlas carry-on · quantity 1", "$129 fixture total"],
      },
      order: {
        heading: "Order status presentation",
        kind: "order",
        lines: ["Atlas carry-on · quantity 1"],
        reference: "FIXTURE-ORDER",
        state: "success",
        statusLabel: "Fixture order confirmed",
        totalLabel: "$129 fixture total",
      },
      policy: {
        heading: "Fixture policy",
        kind: "policy",
        paragraphs: [
          "This content demonstrates policy typography and required legal navigation.",
          "It is not a production legal claim.",
        ],
        state: "populated",
      },
    },
  },
  "core-states": {
    id: "core-states",
    label: "Meaningful presentation states",
    pageTypes: ["home", "collection", "product", "cart", "checkout", "order", "policy"],
    viewModels: {
      loading: {
        heading: "Loading preview",
        kind: "state",
        message: "Fixture content is being prepared.",
        state: "loading",
      },
      empty: {
        action: {
          id: "return-home",
          intent: "navigation",
          label: "Return to preview home",
          target: "/",
        },
        heading: "Nothing here yet",
        kind: "state",
        message: "The fixture contains no items for this presentation.",
        state: "empty",
      },
      unavailable: {
        heading: "Preview unavailable",
        kind: "state",
        message: "This fixture resource is intentionally unavailable.",
        state: "unavailable",
      },
      "validation-error": {
        heading: "Check the preview configuration",
        kind: "state",
        message: "A required fixture value is invalid.",
        state: "validation-error",
      },
      success: {
        heading: "Preview action recorded",
        kind: "state",
        message: "No live commerce request was made.",
        state: "success",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
