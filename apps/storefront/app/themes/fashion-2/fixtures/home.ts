import type { PreviewAction } from "../../../theme-engine/actions";
import type { ExperienceFixtureRegistry } from "../../../theme-engine/view-models";

export interface Fashion2HomeData {
  announcement: string;
  announcementAction: string;
  cartAction: PreviewAction;
  navigation: readonly string[];
  product: {
    assetId: "fashion-2.product-01";
    badge: string;
    name: string;
    originalPrice: string;
    price: string;
  };
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
    slides: readonly {
      assetId: "fashion-2.slider-01" | "fashion-2.slider-02" | "fashion-2.slider-03";
      eyebrow: string;
      heading: string;
    }[];
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
  navigation: ["Home", "Shop", "Collection", "Magazine", "Pages", "Contact"],
  product: {
    assetId: "fashion-2.product-01",
    badge: "New",
    name: "Textured sweater",
    originalPrice: "$200.00",
    price: "$189.00",
  },
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
