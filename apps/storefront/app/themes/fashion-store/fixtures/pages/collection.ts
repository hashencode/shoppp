export interface FashionStoreCollectionCard {
  count: string;
  destination: "/shop";
  label: string;
  sourceImage: string;
}

export interface FashionStoreCollectionData {
  announcement: string;
  cards: readonly FashionStoreCollectionCard[];
}

export const fashionStoreCollectionData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  cards: [
    {
      count: "8 items",
      destination: "/shop",
      label: "Polo t-shirts",
      sourceImage: "images/demo-fashion-store-collections-01.jpg",
    },
    {
      count: "9 items",
      destination: "/shop",
      label: "Sunglasses",
      sourceImage: "images/demo-fashion-store-collections-02.jpg",
    },
    {
      count: "8 items",
      destination: "/shop",
      label: "Skinny blazer",
      sourceImage: "images/demo-fashion-store-collections-03.jpg",
    },
    {
      count: "5 items",
      destination: "/shop",
      label: "Casual shoes",
      sourceImage: "images/demo-fashion-store-collections-04.jpg",
    },
    {
      count: "7 items",
      destination: "/shop",
      label: "Winter jackets",
      sourceImage: "images/demo-fashion-store-collections-05.jpg",
    },
    {
      count: "3 items",
      destination: "/shop",
      label: "Men's shorts",
      sourceImage: "images/demo-fashion-store-collections-06.jpg",
    },
  ],
} as const satisfies FashionStoreCollectionData;
