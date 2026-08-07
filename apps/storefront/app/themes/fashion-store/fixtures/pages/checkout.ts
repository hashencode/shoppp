import type { PreviewAction } from "../../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";

export interface FashionStoreCheckoutData {
  action: PreviewAction;
  announcement: string;
  countries: readonly { code: string; label: string }[];
  lines: readonly {
    color: string;
    name: string;
    quantity: number;
    total: string;
    variantId: string;
  }[];
  payment: readonly {
    detail: string;
    id: string;
    label: string;
    sourceImage?: string;
  }[];
  shipping: readonly { amount: string; id: string; label: string }[];
  totals: { subtotal: string; tax: string; total: string };
}

export const fashionStoreCheckoutData = {
  action: {
    id: "checkout-start-session",
    intent: "checkout.start-preview",
    label: "Start secure checkout session",
  },
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  countries: [{ code: "US", label: "United States of America" }],
  lines: [
    {
      color: "Pink",
      name: "Textured sweater",
      quantity: 1,
      total: "$23.00",
      variantId: "var_01J00000000000000000000000",
    },
    {
      color: "Brown",
      name: "Bermuda shorts",
      quantity: 2,
      total: "$70.00",
      variantId: "var_01J00000000000000000000001",
    },
    {
      color: "White",
      name: "Pocket sweatshirt",
      quantity: 1,
      total: "$15.00",
      variantId: "var_01J00000000000000000000002",
    },
  ],
  payment: [
    {
      detail:
        "Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.",
      id: "bank",
      label: "Direct bank transfer",
    },
    {
      detail:
        "Please send a check to store name, store street, store town, store state / county, store postcode.",
      id: "check",
      label: "Check payments",
    },
    { detail: "Pay with cash upon delivery.", id: "cash", label: "Cash on delivery" },
    {
      detail: "You can pay with your credit card if you don't have a PayPal account.",
      id: "paypal",
      label: "PayPal",
      sourceImage: "images/paypal-logo.jpg",
    },
  ],
  shipping: [
    { amount: "$0.00", id: "ship_01J00000000000000000000000", label: "Free shipping" },
    { amount: "$12.00", id: "ship_01J00000000000000000000001", label: "Flat" },
    { amount: "$0.00", id: "ship_01J00000000000000000000002", label: "Local pickup" },
  ],
  totals: {
    subtotal: "$405.00",
    tax: "(Includes $19.29 tax)",
    total: "$405.00",
  },
} as const satisfies FashionStoreCheckoutData;

export const fashionStoreCheckoutFixtures = {
  "fashion-store-checkout": {
    id: "fashion-store-checkout",
    label: "Fashion Store source-parity populated checkout",
    pageTypes: ["checkout"],
    viewModels: {
      checkout: { data: fashionStoreCheckoutData, kind: "theme-section", state: "populated" },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
