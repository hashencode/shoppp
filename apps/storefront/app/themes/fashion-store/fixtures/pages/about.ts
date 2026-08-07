import type { FashionStoreAccordionItem } from "../../components/shared/FashionStoreAccordion.vue";

export interface FashionStoreAboutData {
  accordion: readonly FashionStoreAccordionItem[];
  announcement: string;
  brandLogos: readonly string[];
  carouselImages: readonly string[];
  story: {
    body: readonly string[];
    eyebrow: string;
  };
  timeline: readonly { body: string; number: string; title: string }[];
}

const accordionBody =
  "We deliver customized marketing campaign to use your audience to make a positive move.";

export const fashionStoreAboutData = {
  accordion: [
    { body: accordionBody, title: "Fashions fade style is eternal" },
    { body: accordionBody, title: "I make clothes. Women make fashion" },
    { body: accordionBody, title: "Something new fashion for everyone" },
  ],
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  brandLogos: [
    "images/logo-asos.svg",
    "images/logo-chanel.svg",
    "images/logo-gucci.svg",
    "images/logo-celine.svg",
    "images/logo-adidas.svg",
    "images/logo-asos.svg",
    "images/logo-chanel.svg",
    "images/logo-gucci.svg",
  ],
  carouselImages: Array.from(
    { length: 6 },
    (_, index) => `images/demo-fashion-store-about-${String(index + 4).padStart(2, "0")}.jpg`,
  ),
  story: {
    body: [
      "Lorem ipsum is simply dummy text of the printing and typesetting industry. lorem ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown.",
      "Lorem ipsum is simply dummy text of the printing and typesetting industry. lorem ipsum has been the industry's standard be dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.",
    ],
    eyebrow: "The fashion core collection!",
  },
  timeline: [
    {
      body: "Lorem ipsum is simply text the printing typesetting standard dummy.",
      number: "01",
      title: "Business founded",
    },
    {
      body: "Lorem ipsum is simply text the printing typesetting standard dummy.",
      number: "02",
      title: "Build new office",
    },
    {
      body: "Lorem ipsum is simply text the printing typesetting standard dummy.",
      number: "03",
      title: "Relocates headquarter",
    },
    {
      body: "Lorem ipsum is simply text the printing typesetting standard dummy.",
      number: "04",
      title: "Revenues of millions",
    },
  ],
} as const satisfies FashionStoreAboutData;
