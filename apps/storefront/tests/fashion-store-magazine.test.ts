import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  fashionStoreArticleBehaviorContract,
  fashionStoreArticleSourceContract,
  fashionStoreArticleSourcePage,
} from "../app/themes/fashion-store/contracts/pages/article";
import {
  fashionStoreMagazineBehaviorContract,
  fashionStoreMagazineSourceContract,
  fashionStoreMagazineSourcePage,
} from "../app/themes/fashion-store/contracts/pages/magazine";
import { fashionStoreArticleData } from "../app/themes/fashion-store/fixtures/pages/article";
import { fashionStoreMagazineData } from "../app/themes/fashion-store/fixtures/pages/magazine";
import { resolveFashionStorePage } from "../app/themes/fashion-store/page-contracts";

describe("Fashion Store Magazine and article", () => {
  test("pins independent source identities and the twelve-card editorial order", () => {
    expect(fashionStoreMagazineSourcePage).toEqual({
      id: "magazine",
      route: "/magazine",
      sourceEntry: "demo-fashion-store-magazine.html",
      sourceSha256: "86283e48d94e8cd9de658b258690ad3a1b0f8b08b2c796e5a59f961d63a6e7fe",
    });
    expect(fashionStoreArticleSourcePage).toEqual({
      id: "article",
      route: "/magazine/marketing-tips-and-tricks",
      sourceEntry: "demo-fashion-store-blog-single-creative.html",
      sourceSha256: "48c7213781db41be93fe6ec46611995f308e3fef93bfef596a15fb8b01ad5c3a",
    });
    expect(fashionStoreMagazineSourceContract.cardCount).toBe(12);
    expect(fashionStoreMagazineData.posts).toHaveLength(12);
    expect(fashionStoreMagazineData.posts[0]?.title).toBe(
      "Elegance is not standing out, but being remembered.",
    );
    expect(fashionStoreMagazineData.posts[11]?.title).toBe(
      "Recognizing the need is the primary condition for design.",
    );
    expect(fashionStoreMagazineData.pagination.active).toBe("02");
  });

  test("keeps article structure, comments, related posts, and route ownership distinct", () => {
    expect(resolveFashionStorePage("/magazine")?.variant).toBe("magazine");
    expect(resolveFashionStorePage("/magazine/marketing-tips-and-tricks")?.variant).toBe("article");
    expect(fashionStoreArticleSourceContract.mediaCount).toBe(3);
    expect(fashionStoreArticleData.related).toHaveLength(3);
    expect(fashionStoreArticleData.comments).toHaveLength(4);
    expect(fashionStoreMagazineBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "magazine-card-state",
      "magazine-article-navigation",
      "magazine-pagination-presentation",
    ]);
    expect(fashionStoreArticleBehaviorContract.behaviors.map(({ id }) => id)).toEqual([
      "article-content-navigation",
      "article-external-sharing",
      "article-comment-validation",
    ]);
  });

  test("keeps the comment form local and free of source submission endpoints", async () => {
    const source = await readFile(
      resolve(
        import.meta.dir,
        "../app/themes/fashion-store/components/pages/FashionStoreArticlePage.vue",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\.php(?:["'?]|\b)/i);
    expect(source).not.toMatch(/\bfetch\s*\(|\$fetch\s*\(|useFetch\s*\(|axios/i);
    expect(source.match(/@submit\.prevent/g)?.length).toBe(1);
    expect(source).not.toMatch(/comment posted|successfully|thanks for your comment/i);
  });
});
