import { expect, test } from "@playwright/test";

test("hero-slide-1 temporal and hero-slide-1 interaction: Decor Hero keeps the full layer timeline busy and ignores re-entry", async ({
  page,
}) => {
  await page.goto("/");

  const hero = page.locator(".decor-hero");
  await expect(hero).toHaveAttribute("data-motion-ready", "true");
  await expect(hero).toHaveAttribute("data-motion-autoplay-ms", "9000");
  await expect(hero).toHaveAttribute("data-layer-timeline-duration-ms", "2700");
  await expect(hero).toHaveAttribute("data-motion-phase", "layer-timeline");
  await expect(hero.locator("[data-motion-layer]")).not.toHaveCount(0);
  const nextCard = page.locator(".decor-hero-next-card");

  await page.waitForTimeout(350);
  await nextCard.dispatchEvent("click");
  await expect(hero).toHaveAttribute("data-current-index", "0");
  await expect(hero).toHaveAttribute("data-target-index", "0");

  await expect(hero).toHaveAttribute("data-motion-phase", "idle", { timeout: 3_000 });
  await nextCard.dispatchEvent("click");
  await expect(hero).toHaveAttribute("data-target-index", "1");
  await expect(hero).toHaveAttribute("data-motion-phase", "layer-timeline");
});

test("Decor source reveals complete once and source carousels do not pause on hover", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-ready", "true");
  const categories = page.locator('[data-source-reveal="categories"]');
  await categories.scrollIntoViewIfNeeded();
  await expect(categories).toHaveAttribute("data-reveal-state", "complete");
  await page.locator(".decor-hero").hover();
  await expect(page.locator(".decor-hero")).not.toHaveAttribute("data-motion-paused", /hover/);
  await page.locator(".decor-collection").hover();
  await expect(page.locator(".decor-collection")).not.toHaveAttribute(
    "data-motion-paused",
    /hover/,
  );
});

test("Decor reduced-motion fallback exposes content and stops autoplay", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-ready", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-phase", "idle");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-paused", /reduced-motion/);
  const journal = page.locator('[data-source-reveal="journal"]');
  await journal.scrollIntoViewIfNeeded();
  await expect(journal).toHaveAttribute("data-reveal-state", "complete");
});

test("Decor source stop-loop keeps autoplay idle while manual navigation remains available", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  const hero = page.locator(".decor-hero");
  await expect(hero).toHaveAttribute("data-motion-ready", "true");
  await expect(hero).toHaveAttribute("data-motion-phase", "idle", { timeout: 3_000 });
  await page.waitForTimeout(9_300);
  await expect(hero).toHaveAttribute("data-current-index", "0");
  await page.locator(".decor-hero-next-card").dispatchEvent("click");
  await expect(hero).toHaveAttribute("data-target-index", "1");
});
