import type { FashionStoreAccordionItem } from "../../components/shared/FashionStoreAccordion.vue";

export interface FashionStoreFaqCategory {
  label: string;
  questions: readonly FashionStoreAccordionItem[];
}

export interface FashionStoreFaqData {
  announcement: string;
  categories: readonly FashionStoreFaqCategory[];
}

const answer =
  "Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took galley of type and scrambled to make type.";
const general = [
  "Can i order over the phone?",
  "I am having difficulty placing an order?",
  "What payment methods does accept?",
  "Can i amend my order once placed?",
  "How do i know if my order was successful?",
  "What if my order is incorrect?",
] as const;
const returns = [
  "Can I return my order?",
  "What if my item is damaged or faulty?",
  "How long will it take to process a return?",
  "Why does the refund amount exclude delivery?",
  "Need more help?",
  "What if my item is damaged or faulty?",
] as const;
const questions = (titles: readonly string[]): readonly FashionStoreAccordionItem[] =>
  titles.map((title) => ({ body: answer, title }));

export const fashionStoreFaqData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  categories: [
    { label: "General", questions: questions(general) },
    { label: "Shopping information", questions: questions(general) },
    { label: "Payment information", questions: questions(returns) },
    { label: "Orders and returns", questions: questions(general) },
    { label: "Ordering from crafto", questions: questions(general) },
    { label: "Help and support", questions: questions(general) },
  ],
} as const satisfies FashionStoreFaqData;
