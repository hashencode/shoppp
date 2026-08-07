import type { PreviewAction } from "../../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";
import {
  fashionStoreCollectionData,
  type FashionStoreCollectionData,
} from "./collection";

export type FashionStoreShopFilterGroup = "category" | "color" | "size" | "tag";

export interface FashionStoreShopFilterOption {
  count?: string;
  label: string;
  swatch?: string;
}

export interface FashionStoreShopProduct {
  badge?: "Hot" | "New";
  categories: readonly string[];
  colors: readonly string[];
  id: string;
  name: string;
  originalPrice: string;
  price: string;
  sizes: readonly string[];
  sourceImage: string;
  tags: readonly string[];
}

export interface FashionStoreShopArrival {
  id: string;
  name: string;
  originalPrice: string;
  price: string;
  sourceImage: string;
}

export interface FashionStoreShopData {
  announcement: string;
  arrivals: readonly (readonly FashionStoreShopArrival[])[];
  collection: FashionStoreCollectionData;
  filters: Readonly<Record<FashionStoreShopFilterGroup, readonly FashionStoreShopFilterOption[]>>;
  productActions: {
    cart: PreviewAction;
    quickView: PreviewAction;
    wishlist: PreviewAction;
  };
  products: readonly FashionStoreShopProduct[];
}

const product = (
  id: string,
  name: string,
  sourceImage: string,
  originalPrice: string,
  price: string,
  options: Partial<
    Pick<FashionStoreShopProduct, "badge" | "categories" | "colors" | "sizes" | "tags">
  > = {},
): FashionStoreShopProduct => ({
  categories: ["Casual shirts"],
  colors: ["Black"],
  id,
  name,
  originalPrice,
  price,
  sizes: ["L"],
  sourceImage,
  tags: ["Shirts"],
  ...options,
});

export const fashionStoreShopData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  arrivals: [
    [
      {
        id: "arrival-textured-sweater-01",
        name: "Textured sweater",
        originalPrice: "$30.00",
        price: "$23.00",
        sourceImage: "images/demo-fashion-store-product-01.jpg",
      },
      {
        id: "arrival-traveller-shirt-02",
        name: "Traveller shirt",
        originalPrice: "$50.00",
        price: "$43.00",
        sourceImage: "images/demo-fashion-store-product-02.jpg",
      },
      {
        id: "arrival-crewneck-tshirt-03",
        name: "Crewneck tshirt",
        originalPrice: "$20.00",
        price: "$15.00",
        sourceImage: "images/demo-fashion-store-product-03.jpg",
      },
    ],
    [
      {
        id: "arrival-skinny-trousers-04",
        name: "Skinny trousers",
        originalPrice: "$15.00",
        price: "$10.00",
        sourceImage: "images/demo-fashion-store-product-04.jpg",
      },
      {
        id: "arrival-sleeve-sweater-05",
        name: "Sleeve sweater",
        originalPrice: "$35.00",
        price: "$30.00",
        sourceImage: "images/demo-fashion-store-product-05.jpg",
      },
      {
        id: "arrival-pocket-white-06",
        name: "Pocket white",
        originalPrice: "$20.00",
        price: "$15.00",
        sourceImage: "images/demo-fashion-store-product-06.jpg",
      },
    ],
  ],
  collection: fashionStoreCollectionData,
  filters: {
    category: [
      { count: "22", label: "Jeans" },
      { count: "28", label: "Trousers" },
      { count: "36", label: "Swimwear" },
      { count: "24", label: "Casual shirts" },
      { count: "26", label: "Winter jackets" },
      { count: "33", label: "Leggings" },
      { count: "22", label: "Dupattas" },
    ],
    color: [
      { count: "05", label: "Black", swatch: "#232323" },
      { count: "24", label: "Blue", swatch: "#5881bf" },
      { count: "32", label: "Brown", swatch: "#9f684f" },
      { count: "22", label: "Green", swatch: "#87a968" },
      { count: "09", label: "Maroon", swatch: "#b14141" },
      { count: "06", label: "Orange", swatch: "#d9653e" },
    ],
    size: [
      { count: "08", label: "S" },
      { count: "05", label: "M" },
      { count: "25", label: "L" },
      { count: "18", label: "XL" },
      { count: "36", label: "XXL" },
    ],
    tag: [
      "Coats",
      "Cotton",
      "Dresses",
      "Jackets",
      "Polyester",
      "Printed",
      "Shirts",
      "Shorts",
      "Tops",
    ].map((label) => ({ label })),
  },
  productActions: {
    cart: { id: "shop-add-product", intent: "cart.add-preview", label: "Add product to cart" },
    quickView: {
      id: "shop-quick-view",
      intent: "product.quick-view-preview",
      label: "Quick shop product",
    },
    wishlist: {
      id: "shop-toggle-wishlist",
      intent: "wishlist.toggle-preview",
      label: "Toggle product wishlist",
    },
  },
  products: [
    product(
      "textured-sweater-01",
      "Textured sweater",
      "images/demo-fashion-store-product-01.jpg",
      "$200.00",
      "$189.00",
      { badge: "New", categories: ["Jeans"], colors: ["Blue"], sizes: ["M"], tags: ["Cotton"] },
    ),
    product(
      "traveller-shirt-02",
      "Traveller shirt",
      "images/demo-fashion-store-product-02.jpg",
      "$350.00",
      "$289.00",
      { colors: ["Brown"], sizes: ["XL"] },
    ),
    product(
      "crewneck-sweatshirt-03",
      "Crewneck sweatshirt",
      "images/demo-fashion-store-product-03.jpg",
      "$220.00",
      "$199.00",
      { categories: ["Winter jackets"], colors: ["Green"], tags: ["Cotton"] },
    ),
    product(
      "skinny-trousers-04",
      "Skinny trousers",
      "images/demo-fashion-store-product-04.jpg",
      "$300.00",
      "$259.00",
      { categories: ["Trousers"], colors: ["Black"], sizes: ["S"] },
    ),
    product(
      "sleeve-sweater-05",
      "Sleeve sweater",
      "images/demo-fashion-store-product-05.jpg",
      "$250.00",
      "$239.00",
      { categories: ["Winter jackets"], colors: ["Orange"], sizes: ["XXL"], tags: ["Tops"] },
    ),
    product(
      "pocket-sweatshirt-06",
      "Pocket sweatshirt",
      "images/demo-fashion-store-product-06.jpg",
      "$200.00",
      "$189.00",
      { badge: "Hot", colors: ["Maroon"], tags: ["Printed"] },
    ),
    product(
      "cotton-sweater-07",
      "Cotton sweater",
      "images/demo-fashion-store-product-07.jpg",
      "$150.00",
      "$129.00",
      { categories: ["Leggings"], colors: ["Green"], sizes: ["M"], tags: ["Cotton"] },
    ),
    product(
      "texture-regular-08",
      "Texture regular",
      "images/demo-fashion-store-product-08.jpg",
      "$170.00",
      "$120.00",
      { categories: ["Dupattas"], colors: ["Blue"], tags: ["Polyester"] },
    ),
    product(
      "sequined-dress-09",
      "Sequined dress",
      "images/demo-fashion-store-product-09.jpg",
      "$190.00",
      "$150.00",
      { categories: ["Swimwear"], colors: ["Maroon"], sizes: ["S"], tags: ["Dresses"] },
    ),
    product(
      "bermuda-shorts-10",
      "Bermuda shorts",
      "images/demo-fashion-store-product-10.jpg",
      "$120.00",
      "$100.00",
      { categories: ["Swimwear"], colors: ["Orange"], tags: ["Shorts"] },
    ),
    product(
      "traveller-shirt-11",
      "Traveller shirt",
      "images/demo-fashion-store-product-11.jpg",
      "$300.00",
      "$259.00",
      { colors: ["Black"], sizes: ["XL"], tags: ["Coats"] },
    ),
    product(
      "textured-sweater-12",
      "Textured sweater",
      "images/demo-fashion-store-product-12.jpg",
      "$300.00",
      "$259.00",
      { categories: ["Jeans"], colors: ["Brown"], sizes: ["XXL"], tags: ["Jackets"] },
    ),
  ],
} as const satisfies FashionStoreShopData;

export function filterFashionStoreShopProducts(
  products: readonly FashionStoreShopProduct[],
  filters: Partial<Record<FashionStoreShopFilterGroup, string>>,
): readonly FashionStoreShopProduct[] {
  return products.filter((item) =>
    Object.entries(filters).every(([group, value]) => {
      if (!value) return true;
      const values =
        group === "category"
          ? item.categories
          : group === "color"
            ? item.colors
            : group === "size"
              ? item.sizes
              : item.tags;
      return values.includes(value);
    }),
  );
}

export const fashionStoreShopFixtures = {
  "fashion-store-shop": {
    id: "fashion-store-shop",
    label: "Fashion Store source-parity Shop family",
    pageTypes: ["collection"],
    viewModels: {
      shop: { data: fashionStoreShopData, kind: "theme-section", state: "populated" },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
