import type { PreviewAction } from "../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

interface SourceProduct {
  badge?: "Hot" | "New";
  name: string;
  originalPrice: string;
  price: string;
  sourceImage: string;
}

interface SourceImageCard {
  name: string;
  sourceImage: string;
}

type Three<T> = readonly [T, T, T];
type Four<T> = readonly [T, T, T, T];
type Five<T> = readonly [T, T, T, T, T];
type Six<T> = readonly [T, T, T, T, T, T];
type Eight<T> = readonly [T, T, T, T, T, T, T, T];
type Ten<T> = readonly [T, T, T, T, T, T, T, T, T, T];

export interface Fashion2HomeData {
  announcement: string;
  announcementAction: string;
  cartAction: PreviewAction;
  navigation: Six<string>;
  bestSellers: Ten<SourceProduct>;
  brands: Five<{ name: string; sourceImage: string }>;
  categories: Four<SourceImageCard & { itemCount: string }>;
  collection: Four<SourceImageCard & { subtitle: string }>;
  featuredProducts: Five<SourceProduct>;
  magazine: Four<SourceImageCard & { author: string; date: string }>;
  marquee: Eight<string>;
  product: {
    assetId: "fashion-2.product-01";
    badge: string;
    name: string;
    originalPrice: string;
    price: string;
  };
  services: Four<{ description: string; iconClass: string; title: string }>;
  slider: {
    options: {
      autoplayMs: 4000;
      breakpointPx: 1199;
      desktopDirection: "vertical";
      disableOnInteraction: false;
      effect: "slide";
      keyboard: true;
      loop: true;
      mobileDirection: "horizontal";
      parallaxPx: 500;
      speedMs: 1000;
    };
    slides: Three<{
      assetId: "fashion-2.slider-01" | "fashion-2.slider-02" | "fashion-2.slider-03";
      eyebrow: string;
      heading: string;
    }>;
  };
}

export const fashion2HomeData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  announcementAction: "Shop now",
  cartAction: {
    id: "add-textured-sweater",
    intent: "cart.add-preview",
    label: "Add Textured sweater to cart",
  },
  bestSellers: [
    {
      badge: "New",
      name: "Textured sweater",
      originalPrice: "$200.00",
      price: "$189.00",
      sourceImage: "images/demo-fashion-store-product-01.jpg",
    },
    {
      name: "Traveller shirt",
      originalPrice: "$350.00",
      price: "$289.00",
      sourceImage: "images/demo-fashion-store-product-02.jpg",
    },
    {
      name: "Crewneck sweatshirt",
      originalPrice: "$220.00",
      price: "$199.00",
      sourceImage: "images/demo-fashion-store-product-03.jpg",
    },
    {
      name: "Skinny trousers",
      originalPrice: "$300.00",
      price: "$259.00",
      sourceImage: "images/demo-fashion-store-product-04.jpg",
    },
    {
      name: "Sleeve sweater",
      originalPrice: "$250.00",
      price: "$239.00",
      sourceImage: "images/demo-fashion-store-product-05.jpg",
    },
    {
      badge: "Hot",
      name: "Pocket sweatshirt",
      originalPrice: "$200.00",
      price: "$189.00",
      sourceImage: "images/demo-fashion-store-product-06.jpg",
    },
    {
      name: "Cotton sweater",
      originalPrice: "$150.00",
      price: "$129.00",
      sourceImage: "images/demo-fashion-store-product-07.jpg",
    },
    {
      name: "Texture regular",
      originalPrice: "$170.00",
      price: "$120.00",
      sourceImage: "images/demo-fashion-store-product-08.jpg",
    },
    {
      name: "Sequined dress",
      originalPrice: "$190.00",
      price: "$150.00",
      sourceImage: "images/demo-fashion-store-product-09.jpg",
    },
    {
      name: "Bermuda shorts",
      originalPrice: "$120.00",
      price: "$100.00",
      sourceImage: "images/demo-fashion-store-product-10.jpg",
    },
  ],
  brands: [
    { name: "ASOS", sourceImage: "images/logo-asos.svg" },
    { name: "Chanel", sourceImage: "images/logo-chanel.svg" },
    { name: "Gucci", sourceImage: "images/logo-gucci.svg" },
    { name: "Celine", sourceImage: "images/logo-celine.svg" },
    { name: "Adidas", sourceImage: "images/logo-adidas.svg" },
  ],
  categories: [
    {
      itemCount: "8 items",
      name: "Women",
      sourceImage: "images/demo-fashion-store-banner-01.jpg",
    },
    {
      itemCount: "9 items",
      name: "Men",
      sourceImage: "images/demo-fashion-store-banner-02.jpg",
    },
    {
      itemCount: "8 items",
      name: "Accessories",
      sourceImage: "images/demo-fashion-store-banner-03.jpg",
    },
    {
      itemCount: "8 items",
      name: "Kids",
      sourceImage: "images/demo-fashion-store-banner-04.jpg",
    },
  ],
  collection: [
    {
      name: "Ethnic wear",
      sourceImage: "images/demo-fashion-store-collection-slider-01.jpg",
      subtitle: "Outfits matching",
    },
    {
      name: "Dress materials",
      sourceImage: "images/demo-fashion-store-collection-slider-02.jpg",
      subtitle: "Explore a variety",
    },
    {
      name: "Western wear",
      sourceImage: "images/demo-fashion-store-collection-slider-03.jpg",
      subtitle: "Traditional attires",
    },
    {
      name: "Loungewear",
      sourceImage: "images/demo-fashion-store-collection-slider-04.jpg",
      subtitle: "Women branded",
    },
  ],
  featuredProducts: [
    {
      badge: "New",
      name: "Textured sweater",
      originalPrice: "$200.00",
      price: "$189.00",
      sourceImage: "images/demo-fashion-store-product-09.jpg",
    },
    {
      name: "Traveller shirt",
      originalPrice: "$350.00",
      price: "$289.00",
      sourceImage: "images/demo-fashion-store-product-10.jpg",
    },
    {
      name: "Crewneck sweatshirt",
      originalPrice: "$220.00",
      price: "$199.00",
      sourceImage: "images/demo-fashion-store-product-11.jpg",
    },
    {
      name: "Skinny trousers",
      originalPrice: "$300.00",
      price: "$259.00",
      sourceImage: "images/demo-fashion-store-product-12.jpg",
    },
    {
      name: "Sleeve sweater",
      originalPrice: "$250.00",
      price: "$239.00",
      sourceImage: "images/demo-fashion-store-product-08.jpg",
    },
  ],
  magazine: [
    {
      author: "Den viliamson",
      date: "26 December 2023",
      name: "Elegance is not standing out, but being remembered.",
      sourceImage: "images/demo-fashion-store-blog-01.jpg",
    },
    {
      author: "Hugh macleod",
      date: "20 December 2023",
      name: "Fashion is the armor to survive the reality of everyday life.",
      sourceImage: "images/demo-fashion-store-blog-02.jpg",
    },
    {
      author: "Walton smith",
      date: "10 December 2023",
      name: "In order to be irreplaceable one must always be different.",
      sourceImage: "images/demo-fashion-store-blog-06.jpg",
    },
    {
      author: "Walton smith",
      date: "10 December 2023",
      name: "Gucci has represented design and contemporary lifestyle.",
      sourceImage: "images/demo-fashion-store-blog-07.jpg",
    },
  ],
  marquee: [
    "Get 20% off for your first order",
    "The fashion core collection",
    "100% secure protected payment",
    "Free shipping for orders over $130",
    "Pay with multiple credit cards",
    "Get 20% off for your first order",
    "The fashion core collection",
    "100% secure protected payment",
  ],
  navigation: ["Home", "Shop", "Collection", "Magazine", "Pages", "Contact"],
  product: {
    assetId: "fashion-2.product-01",
    badge: "New",
    name: "Textured sweater",
    originalPrice: "$200.00",
    price: "$189.00",
  },
  services: [
    {
      description: "Free shipping on first order",
      iconClass: "line-icon-Box-Open",
      title: "Free shipping",
    },
    { description: "Moneyback guarantee", iconClass: "line-icon-Wallet", title: "15 days returns" },
    {
      description: "100% protected payment",
      iconClass: "line-icon-Credit-Card2",
      title: "Secure payment",
    },
    {
      description: "24/7 days a week support",
      iconClass: "line-icon-Headset",
      title: "Online support",
    },
  ],
  slider: {
    options: {
      autoplayMs: 4000,
      breakpointPx: 1199,
      desktopDirection: "vertical",
      disableOnInteraction: false,
      effect: "slide",
      keyboard: true,
      loop: true,
      mobileDirection: "horizontal",
      parallaxPx: 500,
      speedMs: 1000,
    },
    slides: [
      {
        assetId: "fashion-2.slider-01",
        eyebrow: "Discount on selected collection!",
        heading: "Women's collection",
      },
      {
        assetId: "fashion-2.slider-02",
        eyebrow: "Discount on selected collection!",
        heading: "Men's collection",
      },
      {
        assetId: "fashion-2.slider-03",
        eyebrow: "Discount on selected collection!",
        heading: "Children's collection",
      },
    ],
  },
} as const satisfies Fashion2HomeData;

export const fashion2HomeFixtures = {
  "fashion-2-home": {
    id: "fashion-2-home",
    label: "Fashion 2 source-parity home",
    pageTypes: ["home"],
    viewModels: {
      home: {
        data: fashion2HomeData,
        kind: "theme-section",
        state: "populated",
      },
    },
  },
} as const satisfies ExperienceFixtureRegistry;
