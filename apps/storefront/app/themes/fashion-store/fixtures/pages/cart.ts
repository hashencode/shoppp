import type { PreviewAction } from "../../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";

export interface FashionStoreCartLine {
  color: string;
  name: string;
  price: string;
  quantity: number;
  sourceImage: string;
  total: string;
  variantId: string;
}

export interface FashionStoreCartData {
  actions: {
    coupon: PreviewAction;
    remove: PreviewAction;
    shipping: PreviewAction;
    update: PreviewAction;
  };
  announcement: string;
  countries: readonly { code: string; label: string }[];
  lines: readonly FashionStoreCartLine[];
  shipping: readonly { id: string; label: string }[];
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
}

export const fashionStoreCartData = {
  actions: {
    coupon: {
      id: "cart-validate-coupon",
      intent: "coupon.validate-local",
      label: "Validate coupon locally",
    },
    remove: {
      id: "cart-remove-line",
      intent: "cart.remove-preview",
      label: "Remove cart line",
    },
    shipping: {
      id: "cart-quote-shipping",
      intent: "cart.shipping-preview",
      label: "Quote cart shipping",
    },
    update: {
      id: "cart-update-line",
      intent: "cart.update-preview",
      label: "Update cart line",
    },
  },
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  countries: [
    { code: "US", label: "United States" },
    { code: "CA", label: "Canada" },
    { code: "GB", label: "United Kingdom" },
  ],
  lines: [
    {
      color: "Pink",
      name: "Textured sweater",
      price: "$23.00",
      quantity: 1,
      sourceImage: "images/demo-fashion-store-product-01.jpg",
      total: "$23.00",
      variantId: "var_01J00000000000000000000000",
    },
    {
      color: "Brown",
      name: "Bermuda shorts",
      price: "$35.00",
      quantity: 1,
      sourceImage: "images/demo-fashion-store-product-10.jpg",
      total: "$70.00",
      variantId: "var_01J00000000000000000000001",
    },
    {
      color: "White",
      name: "Pocket sweatshirt",
      price: "$15.00",
      quantity: 1,
      sourceImage: "images/demo-fashion-store-product-06.jpg",
      total: "$15.00",
      variantId: "var_01J00000000000000000000002",
    },
  ],
  shipping: [
    { id: "ship_01J00000000000000000000000", label: "Free shipping" },
    { id: "ship_01J00000000000000000000001", label: "Flat: $12.00" },
    { id: "ship_01J00000000000000000000002", label: "Local pickup" },
  ],
  totals: {
    subtotal: "$405.00",
    tax: "(Includes $19.29 tax)",
    total: "$405.00",
  },
} as const satisfies FashionStoreCartData;

export const fashionStoreCartFixtures = {
  "fashion-store-cart": {
    id: "fashion-store-cart",
    label: "Fashion Store source-parity populated cart",
    pageTypes: ["cart"],
    viewModels: {
      cart: { data: fashionStoreCartData, kind: "theme-section", state: "populated" },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
