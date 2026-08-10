import type { AddCartLineRequest } from "@shoppp/contracts";

import type { PreviewAction } from "../../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import type { FashionStoreShopProduct } from "./shop";

export interface FashionStoreProductOption {
  color?: string;
  disabled?: boolean;
  id: string;
  label: string;
}

export interface FashionStoreProductReview {
  author: string;
  date: string;
  sourceImage: string;
  text: string;
}

export interface FashionStoreProductData {
  actions: {
    cart: PreviewAction;
    compare: PreviewAction;
    question: PreviewAction;
    share: PreviewAction;
    wishlist: PreviewAction;
  };
  announcement: string;
  description: {
    bullets: readonly string[];
    eyebrow: string;
    heading: string;
    sourceImage: string;
    text: string;
  };
  gallery: readonly string[];
  options: {
    colors: readonly FashionStoreProductOption[];
    sizes: readonly FashionStoreProductOption[];
  };
  payments: readonly string[];
  product: {
    brand: string;
    description: string;
    name: string;
    originalPrice: string;
    price: string;
    sku: string;
  };
  related: readonly FashionStoreShopProduct[];
  reviews: readonly FashionStoreProductReview[];
  shipping: {
    express: string;
    returnBody: string;
    standard: string;
  };
  specifications: readonly { label: string; value: string }[];
}

const related = (
  id: string,
  name: string,
  sourceImage: string,
  originalPrice: string,
  price: string,
  badge?: "Hot" | "New",
): FashionStoreShopProduct => ({
  ...(badge ? { badge } : {}),
  categories: [],
  colors: [],
  id,
  name,
  originalPrice,
  price,
  sizes: [],
  sourceImage,
  tags: [],
});

export const fashionStoreProductData = {
  actions: {
    cart: { id: "product-add-cart", intent: "cart.add-preview", label: "Add to cart" },
    compare: { id: "product-compare", intent: "navigation", label: "Compare", target: "/shop" },
    question: {
      id: "product-question",
      intent: "navigation",
      label: "Ask a question",
      target: "/contact",
    },
    share: {
      id: "product-share",
      intent: "navigation",
      label: "Share",
      target: "/products/relaxed-corduroy-shirt",
    },
    wishlist: {
      id: "product-toggle-wishlist",
      intent: "wishlist.toggle-preview",
      label: "Toggle product wishlist",
    },
  },
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  description: {
    bullets: [
      "Made from soft yet durable 100% organic cotton twill.",
      "Front and back yoke seams allow a full range of shoulder.",
      "Interior storm flap and zipper garage at chin for comfort.",
      "Color may slightly vary depending on your screen.",
    ],
    eyebrow: "We make you feel special",
    heading: "Unique and quirky designs for the latest trends product.",
    sourceImage: "images/demo-fashion-store-product-detail-07.jpg",
    text: "Lorem ipsum is simply dummy text of the printing and typesetting industry lorem ipsum has been the standard dummy text.",
  },
  gallery: [
    "images/demo-fashion-store-product-detail-01.jpg",
    "images/demo-fashion-store-product-detail-02.jpg",
    "images/demo-fashion-store-product-detail-03.jpg",
    "images/demo-fashion-store-product-detail-04.jpg",
    "images/demo-fashion-store-product-detail-05.jpg",
    "images/demo-fashion-store-product-detail-06.jpg",
  ],
  options: {
    colors: [
      { color: "#d4af37", id: "gold", label: "Gold" },
      { color: "#5881bf", id: "blue", label: "Blue" },
      { color: "#87a968", id: "green", label: "Green" },
    ],
    sizes: ["S", "M", "L", "XL"].map((label) => ({ id: label.toLowerCase(), label })),
  },
  payments: [
    "images/visa.svg",
    "images/mastercard.svg",
    "images/american-express.svg",
    "images/discover.svg",
    "images/diners-club.svg",
    "images/union-pay.svg",
  ],
  product: {
    brand: "Zalando",
    description:
      "Lorem ipsum is simply dummy text of the printing and typesetting industry lorem ipsum standard.",
    name: "Relaxed corduroy shirt",
    originalPrice: "$85.00",
    price: "$65.00",
    sku: "M492300",
  },
  related: [
    related(
      "related-textured-sweater",
      "Textured sweater",
      "images/demo-fashion-store-product-09.jpg",
      "$200.00",
      "$189.00",
      "New",
    ),
    related(
      "related-traveller-shirt",
      "Traveller shirt",
      "images/demo-fashion-store-product-10.jpg",
      "$350.00",
      "$289.00",
    ),
    related(
      "related-crewneck-sweatshirt",
      "Crewneck sweatshirt",
      "images/demo-fashion-store-product-11.jpg",
      "$220.00",
      "$199.00",
    ),
    related(
      "related-skinny-trousers",
      "Skinny trousers",
      "images/demo-fashion-store-product-12.jpg",
      "$300.00",
      "$259.00",
    ),
  ],
  reviews: [
    {
      author: "Herman miller",
      date: "06 April 2023",
      sourceImage: "images/avtar-27.jpg",
      text: "Lorem ipsum dolor sit sed do eiusmod tempor incididunt labore enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
    },
    {
      author: "Wilbur haddock",
      date: "26 April 2023",
      sourceImage: "images/avtar-28.jpg",
      text: "Lorem ipsum dolor sit sed do eiusmod tempor incididunt labore enim ad minim veniamnisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
    },
    {
      author: "Colene landin",
      date: "28 April 2023",
      sourceImage: "images/avtar-29.jpg",
      text: "Lorem ipsum dolor sit sed do eiusmod tempor incididunt labore enim adquis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.",
    },
  ],
  shipping: {
    express: "Arrives in 2-3 business days",
    returnBody:
      "Return or exchange any unused or defective merchandise by mail or at one of our US or Canada store locations. Returns made within 30 days of the order delivery date will be issued a full refund to the original form of payment.",
    standard: "Arrives in 5-8 business days",
  },
  specifications: [
    { label: "Color:", value: "Black, yellow" },
    { label: "Style/Type:", value: "Sports, Formal" },
    { label: "Lining:", value: "100% polyester taffeta with a DWR finish" },
    { label: "Material:", value: "Lather, Cotton, Silk" },
    { label: "Free shipping:", value: "On all orders over $50" },
  ],
} as const satisfies FashionStoreProductData;

export function clampFashionStoreProductQuantity(quantity: number): number {
  return Math.min(20, Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1)));
}

const fashionStoreProductVariants = {
  "blue:l": "var_01JFSHIRTBLUEL00000000001",
  "blue:m": "var_01JFSHIRTBLUEM00000000001",
  "blue:s": "var_01JFSHIRTBLUES00000000001",
  "blue:xl": "var_01JFSHIRTBLUEXL0000000001",
  "gold:l": "var_01JFSHIRTGOLDL00000000001",
  "gold:m": "var_01JFSHIRTGOLDM00000000001",
  "gold:s": "var_01JFSHIRTGOLDS00000000001",
  "gold:xl": "var_01JFSHIRTGOLDXL0000000001",
  "green:l": "var_01JFSHIRTGREENL0000000001",
  "green:m": "var_01JFSHIRTGREENM0000000001",
  "green:s": "var_01JFSHIRTGREENS0000000001",
  "green:xl": "var_01JFSHIRTGREENXL000000001",
} as const;

export function buildFashionStoreProductCartRequest(
  quantity: number,
  selectedColor = "blue",
  selectedSize = "m",
): AddCartLineRequest {
  const variantId =
    fashionStoreProductVariants[
      `${selectedColor}:${selectedSize}` as keyof typeof fashionStoreProductVariants
    ];
  if (!variantId)
    throw new Error(`Unavailable Fashion Store option: ${selectedColor}/${selectedSize}`);
  return {
    expectedUnitPrice: { amount: 6_500, currency: "USD" },
    quantity: clampFashionStoreProductQuantity(quantity),
    releaseId: "representative-release-2026-07-30",
    variantId,
  };
}

export const fashionStoreProductFixtures = {
  "fashion-store-product": {
    id: "fashion-store-product",
    label: "Fashion Store source-parity product detail",
    pageTypes: ["product"],
    viewModels: {
      product: { data: fashionStoreProductData, kind: "theme-section", state: "populated" },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
