export interface FashionStoreContactData {
  announcement: string;
  locations: readonly {
    address: readonly string[];
    city: string;
    email: string;
    name: string;
    phone: string;
  }[];
  privacyCopy: string;
}

export const fashionStoreContactData = {
  announcement: "Enjoy FREE standard delivery on orders over $100.",
  locations: [
    {
      address: ["401 Broadway, 24th Floor,", "Orchard View, London, UK"],
      city: "London",
      email: "info@domain.com",
      name: "Crafto - UK",
      phone: "+1 234 567 8910",
    },
    {
      address: ["27 Eden Walk Eden Centre,", "Orchard, New York, USA"],
      city: "New york",
      email: "info@domain.com",
      name: "Crafto - USA",
      phone: "+1 234 567 8910",
    },
  ],
  privacyCopy:
    "We are committed to protecting your privacy. We will never collect information about you without your explicit consent.",
} as const satisfies FashionStoreContactData;
