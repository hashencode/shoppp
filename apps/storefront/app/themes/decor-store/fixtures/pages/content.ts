import { decorStoreShopData } from "./shop";

const titles = [
  "The best influencers to follow for sartorial inspiration",
  "Everything you need to know about decor's big night out",
  "All the best looks & moments from the met gala 2023",
  "Find a colour palettes that reflects your passion",
  "The 7 biggest trends of the oscars red carpet",
  "Our new beach house tour with before photos!",
  "Standing desk for working from home in a small space",
  "Simple strawberry crisp recipe with easter pie crust cutouts",
  "Spring inspiration for charming yard and exterior spaces!",
  "Our kitchen and dining room remodeling plans",
  "A classic white kitchen with colorful patterned",
  "Three simple updates to make your bedroom your winter",
] as const;

export const decorStoreBlogData = {
  announcement: decorStoreShopData.announcement,
  posts: titles.map((title, index) => ({
    category: index % 3 === 1 ? "Design" : "Decor",
    date: `${String(8 + (index % 4) * 6).padStart(2, "0")} August 2023`,
    id: `post-${index + 1}`,
    title,
  })),
} as const;

export const decorStoreArticleData = {
  announcement: decorStoreShopData.announcement,
  author: "Charlene carberry",
  category: "Decor",
  paragraphs: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse fringilla, sapien luctus fermentum cursus, risus arcu tristique libero.",
    "Diversity lasts when it no longer has to be the subject of a story.",
    "Fashion is what you're offered four times a year by designers.",
  ],
  title: titles[0],
} as const;

export const decorStoreAboutData = {
  announcement: decorStoreShopData.announcement,
  milestones: ["Business founded", "Build new office", "Relocates headquarter"],
  slides: ["Commitment to quality product", "Classic products", "Designed for everyday living"],
} as const;

export const decorStoreFaqData = {
  announcement: decorStoreShopData.announcement,
  answer:
    "Lorem Ipsum is simply dummy text of the printing and typesetting industry, used as standard sample copy.",
  questions: [
    "Can i order over the phone?",
    "I am having difficulty placing an order?",
    "What payment methods does accept?",
    "Can i amend my order once placed?",
    "How do i know if my order was successful?",
    "What if my order is incorrect?",
  ],
} as const;

export const decorStoreContactData = {
  announcement: decorStoreShopData.announcement,
  details: ["Customer service", "Find our store", "Join our team"],
} as const;
