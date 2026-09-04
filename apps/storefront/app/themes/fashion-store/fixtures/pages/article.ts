import type { FashionStoreIconName } from "../../icons/ui";
import type { FashionStoreMagazinePost } from "./magazine";

export interface FashionStoreArticleComment {
  author: string;
  date: string;
  depth: 0 | 1;
  sourceImage: string;
  text: string;
}

export interface FashionStoreArticleData {
  announcement: string;
  author: {
    bio: string;
    name: string;
    role: string;
    sourceImage: string;
  };
  comments: readonly FashionStoreArticleComment[];
  lead: {
    author: string;
    category: string;
    date: string;
    title: string;
  };
  media: readonly string[];
  related: readonly FashionStoreMagazinePost[];
  shareLinks: readonly { href: string; icon: FashionStoreIconName; label: string }[];
}

const related = (
  title: string,
  author: string,
  date: string,
  sourceImage: string,
): FashionStoreMagazinePost => ({ author, date, sourceImage, title });

export const fashionStoreArticleData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  author: {
    bio: "Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has been the industry's standard dummy text ever since the 1500s when an unknown printer took a galley of type.",
    name: "Colene Landin",
    role: "Co-founder",
    sourceImage: "images/avtar-07.jpg",
  },
  comments: [
    {
      author: "Herman Miller",
      date: "17 July 2020, 6:05 PM",
      depth: 0,
      sourceImage: "images/avtar-18.jpg",
      text: "Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has been the industry's standard dummy text ever since the make book.",
    },
    {
      author: "Wilbur Haddock",
      date: "18 July 2020, 10:19 PM",
      depth: 1,
      sourceImage: "images/avtar-19.jpg",
      text: "Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has been the industry's standard dummy text ever since.",
    },
    {
      author: "Colene Landin",
      date: "18 July 2020, 12:39 PM",
      depth: 1,
      sourceImage: "images/avtar-17.jpg",
      text: "Lorem ipsum is simply dummy text of the printing and typesetting industry. Ipsum has been the industry's standard dummy text.",
    },
    {
      author: "Jennifer Freeman",
      date: "19 July 2020, 8:25 PM",
      depth: 0,
      sourceImage: "images/avtar-18.jpg",
      text: "Lorem ipsum is simply dummy text of the printing and typesetting industry. Lorem ipsum has been the industry's standard dummy text ever since the make a type specimen book.",
    },
  ],
  lead: {
    author: "Jackson",
    category: "Marketing",
    date: "26 November 2021",
    title: "Marketing tips and tricks for your creative website.",
  },
  media: [
    "images/blog-single-creative-01.jpg",
    "images/blog-single-creative-02.jpg",
    "images/blog-single-creative-07.jpg",
  ],
  related: [
    related(
      "Elegance is not standing out, but being remembered.",
      "Den viliamson",
      "26 December 2023",
      "images/demo-fashion-store-blog-01.jpg",
    ),
    related(
      "Fashion is the armor to survive the reality of everyday life.",
      "Hugh macleod",
      "20 December 2023",
      "images/demo-fashion-store-blog-02.jpg",
    ),
    related(
      "In order to be irreplaceable one must always be different.",
      "Walton smith",
      "10 December 2023",
      "images/demo-fashion-store-blog-06.jpg",
    ),
  ],
  shareLinks: [
    { href: "https://www.facebook.com/", icon: "facebook", label: "Facebook" },
    { href: "https://twitter.com/", icon: "twitter", label: "Twitter" },
    { href: "https://www.instagram.com/", icon: "instagram", label: "Instagram" },
    { href: "https://www.linkedin.com/", icon: "linkedin", label: "LinkedIn" },
    { href: "https://www.behance.net/", icon: "behance", label: "Behance" },
  ],
} as const satisfies FashionStoreArticleData;
