import type { ExperienceFixtureRegistry } from "../../../../theme-engine/view-models";

export type DecorStoreShopLayout = "left" | "none" | "right";
export type DecorStoreShopSort = "default" | "name" | "price-high" | "price-low";

export interface DecorStoreShopProduct {
  badge?: "New";
  category: "Decor" | "Furniture" | "Lighting";
  id: string;
  name: string;
  originalPrice?: number;
  price: number;
}

const product = (
  id: string,
  name: string,
  price: number,
  category: DecorStoreShopProduct["category"],
  options: Pick<DecorStoreShopProduct, "badge" | "originalPrice"> = {},
): DecorStoreShopProduct => ({ category, id, name, price, ...options });

export const decorStoreShopData = {
  announcement: "Free Delivery on orders over £120. Don't miss discount.",
  filters: ["All", "Decor", "Furniture", "Lighting"],
  layouts: {
    "shop-left": "left",
    "shop-none": "none",
    "shop-right": "right",
  },
  products: [
    product("table-clock", "Table clock", 23, "Decor", { badge: "New", originalPrice: 30 }),
    product("wood-stool", "Wood stool", 54, "Furniture"),
    product("ceramic-mug", "Ceramic mug", 15, "Decor", { badge: "New", originalPrice: 20 }),
    product("decorative-plants", "Decorative plants", 35, "Decor", { originalPrice: 30 }),
    product("ceramic-pot", "Ceramic pot", 23, "Decor", { originalPrice: 30 }),
    product("ceramic-plate", "Ceramic plate", 28, "Decor"),
    product("ceramic-container", "Ceramic container", 19, "Decor"),
    product("design-wall-clock", "Design wall clock", 42, "Decor"),
    product("watch-box", "Watch box", 32, "Decor"),
    product("modern-stool", "Modern stool", 64, "Furniture"),
    product("nutcracker", "Nutcracker", 26, "Decor"),
    product("decor-lamp", "Decor lamp", 48, "Lighting"),
  ],
  sortOptions: ["default", "name", "price-low", "price-high"],
} as const;

export const decorStoreCollectionData = {
  announcement: decorStoreShopData.announcement,
  items: [
    ["designer-stool", "Designer stool", "02"],
    ["modern-chair", "Modern chair", "03"],
    ["table-clock", "Table clock", "05"],
    ["home-decor", "Home decor", "07"],
    ["ceramic-pots", "Ceramic pots", "08"],
    ["table-lamp", "Table lamp", "04"],
    ["wooden-table", "Wooden table", "02"],
    ["designer-sofa", "Designer sofa", "05"],
  ].map(([id, name, count]) => ({ count, id, name })),
} as const;

export function pageDecorStoreProducts(options: {
  category: (typeof decorStoreShopData.filters)[number];
  page: number;
  sort: DecorStoreShopSort;
}): { items: DecorStoreShopProduct[]; totalPages: number } {
  const filtered = decorStoreShopData.products.filter(
    ({ category }) => options.category === "All" || category === options.category,
  );
  const sorted = [...filtered];
  if (options.sort === "name") sorted.sort((left, right) => left.name.localeCompare(right.name));
  if (options.sort === "price-low") sorted.sort((left, right) => left.price - right.price);
  if (options.sort === "price-high") sorted.sort((left, right) => right.price - left.price);
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, options.page), totalPages);
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), totalPages };
}

export const decorStoreShopFixtures = {
  "decor-store-collection": {
    id: "decor-store-collection",
    label: "Decor Store source-parity Shop and Collections",
    pageTypes: ["collection"],
    viewModels: {
      collection: {
        data: { collection: decorStoreCollectionData, shop: decorStoreShopData },
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
