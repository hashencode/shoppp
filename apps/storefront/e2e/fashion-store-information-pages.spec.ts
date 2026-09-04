import { isFashionStoreViewport } from "./support/fashion-store-project";
import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

type InformationPath = "/about" | "/contact" | "/faq";

async function prepare(
  page: Page,
  path: InformationPath,
  reducedMotion: "no-preference" | "reduce" = "reduce",
): Promise<void> {
  await page.emulateMedia({ reducedMotion });
  await page.goto(path, { waitUntil: "networkidle" });
  await page
    .locator(`[data-fashion-store-${path.slice(1)}][data-runtime-status='ready']`)
    .waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page
    .getByRole("button", { name: "Allow cookies" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

test("About, FAQ, and Contact preserve source inventories across responsive viewports", async ({
  page,
}) => {
  await prepare(page, "/about");
  await expect(page.locator(".fashion-about-hero img")).toHaveCount(3);
  await expect(page.locator(".fashion-about-carousel-slide img")).toHaveCount(6);
  await expect(page.locator(".fashion-about-timeline .feature-box")).toHaveCount(4);
  await expect(page.locator(".fashion-about-mission .accordion-item")).toHaveCount(3);
  await expect(
    page.locator(".fashion-about-brand-track > div:not([data-source-clone]) img"),
  ).toHaveCount(8);
  await expect(
    page.locator('.fashion-about-brand-track > div[data-source-clone="true"]'),
  ).toHaveCount(2);

  await prepare(page, "/faq");
  await expect(page.locator(".fashion-faq-content [role='tab']")).toHaveCount(6);
  await expect(page.locator(".fashion-faq-content .accordion-item")).toHaveCount(6);
  await expect(page.locator(".fashion-faq-content [role='tab'][aria-selected='true']")).toHaveText(
    "General",
  );

  await prepare(page, "/contact");
  await expect(
    page.locator(".fashion-contact-locations [data-fashion-store-location]"),
  ).toHaveCount(2);
  await expect(page.locator(".fashion-contact-marker")).toHaveCount(2);
  await expect(page.locator(".fashion-contact-form :is(input, textarea)")).toHaveCount(5);
  await expect(page.locator(".fashion-contact-parallax")).toHaveCSS(
    "background-image",
    /demo-fashion-store-contatc-02/,
  );
});

test("about-carousel-ready temporal: scoped autoplay advances and reports real elapsed motion", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Temporal evidence runs once.");
  await prepare(page, "/about", "no-preference");
  const about = page.locator("[data-fashion-store-about]");
  const before = Number(await about.getAttribute("data-carousel-index"));
  await expect
    .poll(async () => Number(await about.getAttribute("data-carousel-index")), { timeout: 3_000 })
    .not.toBe(before);
  const after = Number(await about.getAttribute("data-carousel-index"));
  recordThemeBehaviorEvidence(testInfo, {
    behaviorId: "about-carousel-motion",
    mode: "temporal",
    temporalSamples: { after, before, elapsedMs: 2_000 },
  });
});

test("about-carousel-ready interaction: carousel and mission controls support every input branch", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  await prepare(page, "/about", "no-preference");
  const about = page.locator("[data-fashion-store-about]");
  const carousel = page.locator(".fashion-about-carousel");
  const initial = Number(await about.getAttribute("data-carousel-index"));
  await carousel.focus();
  await page.keyboard.press("ArrowRight");
  await expect(about).toHaveAttribute("data-carousel-index", String((initial + 1) % 6));
  const dragStartIndex = await about.getAttribute("data-carousel-index");
  const carouselBox = (await carousel.boundingBox())!;
  await page.mouse.move(
    carouselBox.x + carouselBox.width * 0.8,
    carouselBox.y + carouselBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    carouselBox.x + carouselBox.width * 0.2,
    carouselBox.y + carouselBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect.poll(() => about.getAttribute("data-carousel-index")).not.toBe(dragStartIndex);

  const missionButtons = page.locator(".fashion-about-mission .fashion-accordion-trigger");
  await missionButtons.nth(1).click();
  await expect(about).toHaveAttribute("data-accordion-index", "1");
  await missionButtons.nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(about).toHaveAttribute("data-accordion-index", "2");
  await missionButtons.nth(1).dispatchEvent("click", { pointerType: "touch" });
  await expect(about).toHaveAttribute("data-accordion-index", "1");

  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "about-carousel-motion",
      branches: [
        { id: "timer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
        { id: "touch", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "about-accordion-state",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
        { id: "touch", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("About fallback freezes motion, retains content, and resets state on remount", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await prepare(page, "/about", "reduce");
  const about = page.locator("[data-fashion-store-about]");
  await page.waitForTimeout(2_200);
  await expect(about).toHaveAttribute("data-carousel-index", "0");
  await page.locator(".fashion-about-mission .fashion-accordion-trigger").nth(2).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-about]")).toHaveAttribute(
    "data-accordion-index",
    "0",
  );
  await expect(page.locator(".fashion-about-carousel-slide img")).toHaveCount(6);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "about-carousel-motion", mode: "fallback" },
    { actionOutcome: true, behaviorId: "about-accordion-state", mode: "fallback" },
  );
});

test("faq-secondary-tab interaction: tabs and accordions support pointer, keyboard, and touch", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  await prepare(page, "/faq");
  const faq = page.locator("[data-fashion-store-faq]");
  const tabs = page.locator(".fashion-faq-content [role='tab']");
  await tabs.nth(1).click();
  await expect(faq).toHaveAttribute("data-active-category", "1");
  await tabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(faq).toHaveAttribute("data-active-category", "2");
  await tabs.nth(3).dispatchEvent("click", { pointerType: "touch" });
  await expect(faq).toHaveAttribute("data-active-category", "3");

  const questions = page.locator(".fashion-faq-content .fashion-accordion-trigger");
  await questions.nth(1).click();
  await expect(faq).toHaveAttribute("data-active-question", "1");
  await questions.nth(2).focus();
  await page.keyboard.press("Enter");
  await expect(faq).toHaveAttribute("data-active-question", "2");
  await questions.nth(3).dispatchEvent("click", { pointerType: "touch" });
  await expect(faq).toHaveAttribute("data-active-question", "3");

  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "faq-category-tabs",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
        { id: "touch", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "faq-accordion-state",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
        { id: "touch", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("FAQ fallback keeps one source question set and resets local state on remount", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await prepare(page, "/faq", "reduce");
  await page.locator(".fashion-faq-content [role='tab']").nth(4).click();
  await page.locator(".fashion-faq-content .fashion-accordion-trigger").nth(2).click();
  await page.reload({ waitUntil: "networkidle" });
  const faq = page.locator("[data-fashion-store-faq]");
  await expect(faq).toHaveAttribute("data-active-category", "0");
  await expect(faq).toHaveAttribute("data-active-question", "0");
  await expect(page.locator(".fashion-faq-content .accordion-item")).toHaveCount(6);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "faq-category-tabs", mode: "fallback" },
    { actionOutcome: true, behaviorId: "faq-accordion-state", mode: "fallback" },
  );
});

test("contact-map-ready static: local map presentation loads without a remote map runtime", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Focused static evidence runs once.");
  await prepare(page, "/contact");
  await expect(page.locator(".fashion-contact-map > img")).toBeVisible();
  await expect(page.locator(".fashion-contact-marker")).toHaveCount(2);
  const remoteMapResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((name) => /googleapis|maps\.google|openstreetmap|mapbox/i.test(name)),
  );
  expect(remoteMapResources).toEqual([]);
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "contact-map-fallback",
    branches: [{ id: "default", outcome: true, viewportId: "desktop" }],
    mode: "static",
  });
});

test("Contact form validates required, email, and phone fields without transmitting data", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  await prepare(page, "/contact");
  const nonGetRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") nonGetRequests.push(`${request.method()} ${request.url()}`);
  });
  const submit = page.getByRole("button", { name: "Send message" });
  await submit.click();
  await expect(page.locator("#fashion-contact-name")).toBeFocused();
  await page.locator("#fashion-contact-name").fill("Reader");
  await page.locator("#fashion-contact-email").fill("invalid");
  await submit.click();
  await expect(page.locator("#fashion-contact-email")).toBeFocused();
  await page.locator("#fashion-contact-email").fill("reader@example.test");
  await page.locator("#fashion-contact-phone").fill("12");
  await submit.click();
  await expect(page.locator("#fashion-contact-phone")).toBeFocused();
  await page.locator("#fashion-contact-phone").fill("+1 234 567 8910");
  await submit.press("Enter");
  await expect(page.locator("[data-fashion-store-contact]")).toHaveAttribute(
    "data-contact-submit-count",
    "1",
  );
  expect(nonGetRequests).toEqual([]);
  await expect(page.locator("[data-fashion-store-contact]")).not.toContainText(
    /message sent|successfully|thanks for contacting/i,
  );
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "contact-form-validation",
    branches: [
      { id: "invalid", outcome: true, viewportId: "desktop" },
      { id: "valid", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Contact fallback preserves map, fields, and empty remount state", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await prepare(page, "/contact", "reduce");
  await page.locator("#fashion-contact-name").fill("Reader");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#fashion-contact-name")).toHaveValue("");
  await expect(page.locator(".fashion-contact-marker")).toHaveCount(2);
  await expect(page.locator(".fashion-contact-form :is(input, textarea)")).toHaveCount(5);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "contact-map-fallback", mode: "fallback" },
    { actionOutcome: true, behaviorId: "contact-form-validation", mode: "fallback" },
  );
});
