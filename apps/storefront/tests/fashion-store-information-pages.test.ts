import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  fashionStoreAboutBehaviorContract,
  fashionStoreAboutSourceContract,
  fashionStoreAboutSourcePage,
} from "../app/themes/fashion-store/contracts/pages/about";
import {
  fashionStoreContactBehaviorContract,
  fashionStoreContactSourceContract,
  fashionStoreContactSourcePage,
} from "../app/themes/fashion-store/contracts/pages/contact";
import {
  fashionStoreFaqBehaviorContract,
  fashionStoreFaqSourceContract,
  fashionStoreFaqSourcePage,
} from "../app/themes/fashion-store/contracts/pages/faq";
import { fashionStoreAboutData } from "../app/themes/fashion-store/fixtures/pages/about";
import { fashionStoreContactData } from "../app/themes/fashion-store/fixtures/pages/contact";
import { fashionStoreFaqData } from "../app/themes/fashion-store/fixtures/pages/faq";
import { resolveFashionStorePage } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store information pages", () => {
  test("pins three independent source pages and their source-visible inventories", () => {
    expect(fashionStoreAboutSourcePage.sourceSha256).toBe(
      "4672c84511fd86b8f3466e1d5cac52a49be7d03b09bd2d0804782171da0dec6d",
    );
    expect(fashionStoreFaqSourcePage.sourceSha256).toBe(
      "7849b03b3b3e19beb204897d1dcc18ef2d33e525f9b6322488ee8000812ea8fa",
    );
    expect(fashionStoreContactSourcePage.sourceSha256).toBe(
      "20c2fa93b6926d28e1683fe39e7acc36957bbfe4004dfec4b3772e9fdf41b668",
    );
    expect(fashionStoreAboutSourceContract.timelineCount).toBe(4);
    expect(fashionStoreAboutData.carouselImages).toHaveLength(6);
    expect(fashionStoreFaqSourceContract.categoryCount).toBe(6);
    expect(fashionStoreFaqData.categories).toHaveLength(6);
    expect(fashionStoreFaqData.categories.every(({ questions }) => questions.length === 6)).toBe(
      true,
    );
    expect(fashionStoreContactSourceContract.locationCount).toBe(2);
    expect(fashionStoreContactData.locations.map(({ city }) => city)).toEqual([
      "London",
      "New york",
    ]);
  });

  test("enables each information route with explicit behavior ownership", () => {
    expect(resolveFashionStorePage("/about")?.variant).toBe("about");
    expect(resolveFashionStorePage("/faq")?.variant).toBe("faq");
    expect(resolveFashionStorePage("/contact")?.variant).toBe("contact");
    expect(fashionStoreAboutBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "about-carousel-motion",
      "about-accordion-state",
    ]);
    expect(fashionStoreFaqBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "faq-category-tabs",
      "faq-accordion-state",
    ]);
    expect(fashionStoreContactBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "contact-map-fallback",
      "contact-form-validation",
    ]);
  });

  test("keeps Contact validation local and free of PHP, fetch, and remote-map dependencies", async () => {
    const source = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/pages/FashionStoreContactPage.vue",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\.php(?:["'?]|\b)/i);
    expect(source).not.toMatch(/\bfetch\s*\(|\$fetch\s*\(|useFetch\s*\(|axios/i);
    expect(source).not.toMatch(/googleapis|maps\.google|openstreetmap|mapbox/i);
    expect(source.match(/@submit\.prevent/g)?.length).toBe(1);
    expect(source).not.toMatch(/message sent|successfully|thanks for contacting/i);
  });
});
