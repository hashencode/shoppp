import { describe, expect, test } from "bun:test";

import {
  decorStoreAboutData,
  decorStoreArticleData,
  decorStoreBlogData,
  decorStoreContactData,
  decorStoreFaqData,
} from "../app/themes/decor-store/fixtures/pages/content";
import {
  decorStorePageContracts,
  resolveDecorStorePage,
} from "../app/themes/decor-store/page-contracts";

describe("Decor Store editorial and information pages", () => {
  test("makes all fourteen secondary source routes ready", () => {
    expect(decorStorePageContracts.filter(({ id, ready }) => id !== "home" && ready)).toHaveLength(
      14,
    );
    for (const path of [
      "/blog",
      "/blog/best-influencers-for-decor-inspiration",
      "/about",
      "/faq",
      "/contact",
    ])
      expect(resolveDecorStorePage(path)).toBeDefined();
  });

  test("freezes Blog and Article source copy", () => {
    expect(decorStoreBlogData.posts).toHaveLength(12);
    expect(decorStoreBlogData.posts[0]?.title).toBe(decorStoreArticleData.title);
    expect(decorStoreArticleData.author).toBe("Charlene carberry");
  });

  test("freezes About carousel, FAQ accordion, and inert Contact content", () => {
    expect(decorStoreAboutData.slides).toHaveLength(3);
    expect(decorStoreFaqData.questions[0]).toBe("Can i order over the phone?");
    expect(decorStoreContactData.details).toEqual([
      "Customer service",
      "Find our store",
      "Join our team",
    ]);
    expect(decorStoreContactData).not.toHaveProperty("endpoint");
    expect(decorStoreContactData).not.toHaveProperty("mapUrl");
  });
});
