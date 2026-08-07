export interface FashionStoreMagazinePost {
  author: string;
  date: string;
  sourceImage: string;
  title: string;
}

export interface FashionStoreMagazineData {
  announcement: string;
  pagination: {
    active: string;
    pages: readonly string[];
  };
  posts: readonly FashionStoreMagazinePost[];
}

const post = (
  title: string,
  author: string,
  date: string,
  image: number,
): FashionStoreMagazinePost => ({
  author,
  date,
  sourceImage: `images/demo-fashion-store-blog-${String(image).padStart(2, "0")}.jpg`,
  title,
});

export const fashionStoreMagazineData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  pagination: { active: "02", pages: ["01", "02", "03", "04"] },
  posts: [
    post(
      "Elegance is not standing out, but being remembered.",
      "Den viliamson",
      "26 December 2023",
      1,
    ),
    post(
      "Fashion is the armor to survive the reality of everyday life.",
      "Katie mcgrath",
      "24 December 2023",
      2,
    ),
    post(
      "In order to be irreplaceable one must always be different.",
      "Rosald smith",
      "20 December 2023",
      3,
    ),
    post(
      "Gucci has represented design and contemporary lifestyle.",
      "Elizabeth taylor",
      "18 December 2023",
      4,
    ),
    post(
      "A designer is only as good as star who wears her clothes.",
      "Rosald smith",
      "16 December 2023",
      5,
    ),
    post(
      "Trying to design the perfect plan is the recipe for style.",
      "Elizabeth taylor",
      "14 December 2023",
      6,
    ),
    post(
      "Cruelty is fashion statement we can all do without.",
      "Den viliamson",
      "12 December 2023",
      7,
    ),
    post(
      "Music and fashion have to have their own styles It's a must.",
      "Katie mcgrath",
      "12 December 2023",
      8,
    ),
    post(
      "The best accessories to add wardrobe before summer.",
      "Elizabeth taylor",
      "10 December 2023",
      9,
    ),
    post(
      "The best accessories to add wardrobe before summer.",
      "Den viliamson",
      "08 December 2023",
      10,
    ),
    post(
      "Fashion is architecture it is design proportions.",
      "Elizabeth taylor",
      "08 December 2023",
      11,
    ),
    post(
      "Recognizing the need is the primary condition for design.",
      "Den viliamson",
      "26 December 2023",
      12,
    ),
  ],
} as const satisfies FashionStoreMagazineData;
