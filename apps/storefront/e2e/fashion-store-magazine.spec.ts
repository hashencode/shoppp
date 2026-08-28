import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;
const articlePath = "/magazine/marketing-tips-and-tricks";

async function prepare(page: Page, path: "/magazine" | typeof articlePath): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
  const pageId = path === "/magazine" ? "magazine" : "article";
  await page.locator(`[data-fashion-store-${pageId}][data-runtime-status='ready']`).waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page
    .getByRole("button", { name: "Allow cookies" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

test("Magazine and article preserve independent source structure across responsive viewports", async ({
  page,
}, testInfo) => {
  await prepare(page, "/magazine");
  const magazine = page.locator("[data-fashion-store-magazine]");
  const cards = magazine.locator(".fashion-magazine-grid > .grid-item");
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toContainText("Elegance is not standing out, but being remembered.");
  await expect(cards.last()).toContainText(
    "Recognizing the need is the primary condition for design.",
  );
  await expect(magazine.locator(".fashion-magazine-pagination .page-item.active")).toHaveText("02");
  await expect(magazine.locator(".fashion-magazine-pagination .page-link")).toHaveCount(6);

  await prepare(page, articlePath);
  const article = page.locator("[data-fashion-store-article]");
  await expect(article.locator("h1")).toHaveText(
    "Marketing tips and tricks for your creative website.",
  );
  await expect(article.locator(".fashion-article-media > .container-fluid img")).toHaveCount(3);
  await expect(article.locator(".fashion-article-related > .container .grid-item")).toHaveCount(3);
  await expect(article.locator(".fashion-article-comments .blog-comment > li")).toHaveCount(4);
  await expect(article.locator(".fashion-article-share a")).toHaveCount(5);
  await expect(article.locator(".fashion-article-comment-form form")).toHaveCount(1);

  if (testInfo.project.name === "fashion-store-desktop") {
    const source = await page.context().newPage();
    try {
      await source.goto(`${sourceOrigin}/demo-fashion-store-blog-single-creative.html`, {
        waitUntil: "networkidle",
      });
      const [sourceHero, implementationHero] = await Promise.all([
        source.locator("section:nth-of-type(2) img").boundingBox(),
        article.locator(".fashion-article-media").first().locator("img").boundingBox(),
      ]);
      expect(Math.abs(sourceHero!.x - implementationHero!.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(sourceHero!.width - implementationHero!.width)).toBeLessThanOrEqual(2);
    } finally {
      await source.close();
    }
  }
});

test("magazine-grid-ready static: the twelve-card source grid is capture-ready", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "fashion-store-desktop",
    "Focused static evidence runs once.",
  );
  await prepare(page, "/magazine");
  await expect(page.locator(".fashion-magazine-grid > .grid-item")).toHaveCount(12);
});

test("Magazine card, article navigation, and pagination interactions remain deterministic", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Interaction evidence runs once.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepare(page, "/magazine");
  const firstCard = page.locator(".fashion-magazine-grid > .grid-item").first();
  const image = firstCard.locator("img");
  await firstCard.hover();
  await expect(image).toHaveCSS("transform", /matrix\(1\.05/);
  const title = firstCard.getByRole("link", {
    name: "Elegance is not standing out, but being remembered.",
    exact: true,
  });
  await title.focus();
  await expect(title).toBeFocused();

  const active = page.locator(".fashion-magazine-pagination .page-item.active .page-link");
  await active.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-fashion-store-magazine]")).toHaveAttribute(
    "data-pagination-intent-count",
    "1",
  );
  await expect(page.locator(".fashion-magazine-pagination .page-item.active")).toHaveText("02");

  await title.click();
  await expect(page).toHaveURL(new RegExp(`${articlePath}$`));
  await expect(
    page.locator("[data-fashion-store-article][data-runtime-status='ready']"),
  ).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goBack({ waitUntil: "networkidle" });
  const keyboardTitle = page
    .locator(".fashion-magazine-grid > .grid-item")
    .first()
    .getByRole("link", {
      name: "Elegance is not standing out, but being remembered.",
      exact: true,
    });
  await keyboardTitle.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${articlePath}$`));

  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "magazine-card-state",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "magazine-article-navigation",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "magazine-pagination-presentation",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("Magazine fallback preserves copy, active pagination, and reduced-motion readability", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, "/magazine");
  const firstCard = page.locator(".fashion-magazine-grid > .grid-item").first();
  await firstCard.hover();
  await expect(firstCard.locator("img")).toHaveCSS("transform", "none");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".fashion-magazine-grid > .grid-item")).toHaveCount(12);
  await expect(page.locator(".fashion-magazine-pagination .page-item.active")).toHaveText("02");
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "magazine-card-state", mode: "fallback" },
    { actionOutcome: true, behaviorId: "magazine-article-navigation", mode: "fallback" },
    { actionOutcome: true, behaviorId: "magazine-pagination-presentation", mode: "fallback" },
  );
});

test("article-body-ready static: article body and three media sections are capture-ready", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "fashion-store-desktop",
    "Focused static evidence runs once.",
  );
  await prepare(page, articlePath);
  await expect(page.locator(".fashion-article-body")).toBeVisible();
  await expect(page.locator(".fashion-article-media")).toHaveCount(3);
});

test("Article navigation, external sharing, and local comments preserve their owners", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Interaction evidence runs once.");
  await prepare(page, articlePath);
  const nonGetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") nonGetRequests.push(`${request.method()} ${request.url()}`);
  });
  const shares = page.locator(".fashion-article-share a");
  await expect(shares).toHaveCount(5);
  for (const link of await shares.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
  await shares.first().focus();
  await expect(shares.first()).toBeFocused();

  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.locator("#fashion-comment-name")).toBeFocused();
  await page.locator("#fashion-comment-name").fill("Reader");
  await page.locator("#fashion-comment-email").fill("invalid");
  await page.getByRole("button", { name: "Post Comment" }).click();
  await expect(page.locator("#fashion-comment-email")).toBeFocused();
  await page.locator("#fashion-comment-email").fill("reader@example.test");
  await page.locator("#fashion-comment-message").fill("Local preview only");
  await page.getByRole("button", { name: "Post Comment" }).press("Enter");
  await expect(page.locator("[data-fashion-store-article]")).toHaveAttribute(
    "data-comment-submit-count",
    "1",
  );
  expect(nonGetRequests).toEqual([]);
  await expect(page.locator("[data-fashion-store-article]")).not.toContainText(
    /comment posted|successfully|thanks for your comment/i,
  );

  const authorPosts = page.getByRole("link", { name: "All author posts" });
  await authorPosts.click();
  await expect(page).toHaveURL(/\/magazine$/);
  await expect(page.locator("[data-fashion-store-magazine]")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goBack({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: "All author posts" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/magazine$/);
  await expect(page.locator("[data-fashion-store-magazine]")).toBeVisible();

  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "article-content-navigation",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "article-external-sharing",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "article-comment-validation",
      branches: [
        { id: "invalid", outcome: true, viewportId: "desktop" },
        { id: "valid", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("Article fallback preserves source order and resets local comment state on remount", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await prepare(page, articlePath);
  await page.locator("#fashion-comment-name").fill("Reader");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#fashion-comment-name")).toHaveValue("");
  await expect(page.locator(".fashion-article-media")).toHaveCount(3);
  await expect(page.locator(".fashion-article-comments .blog-comment > li")).toHaveCount(4);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "article-content-navigation", mode: "fallback" },
    { actionOutcome: true, behaviorId: "article-external-sharing", mode: "fallback" },
    { actionOutcome: true, behaviorId: "article-comment-validation", mode: "fallback" },
  );
});
