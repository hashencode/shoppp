import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

interface ExactTupleReceipt {
  artifactDigest: string;
  approvalAuditArtifactDigest: string;
  callbackArtifactDigest: string;
  candidateReleaseId: string;
  contactVersion: string;
  environment: string;
  exactValues: {
    collectionId: string;
    collectionName: string;
    collectionSlug: string;
    productId: string;
    productName: string;
    productSlug: string;
    supportEmail: string;
  };
  previewSnapshotId: string;
  themeId: string;
  themeVersion: string;
}

const receipt = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../test-results/u9-exact-tuple-receipt.json"), "utf8"),
) as ExactTupleReceipt;
const artifact = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../test-results/u9-exact-tuple-artifact.json"), "utf8"),
) as {
  artifactDigest: string;
  candidateReleaseId: string;
  contactVersion: string;
  environment: string;
  previewSnapshotId: string;
  themeId: string;
  themeVersion: string;
};
const buildInput = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../test-results/u9-exact-tuple-build-input.json"), "utf8"),
) as {
  catalogRelease: { content: Array<{ kind: string; title: string }> };
  snapshot: { resolvedTemplates: Array<{ pageType: string; sections: Array<{ blocks: Array<{ settings: { title?: string } }> }> }> };
};
const generatedExperience = await readFile(
  resolve(import.meta.dirname, "../app/generated/active-experience.ts"),
  "utf8",
);
const generatedTheme = await readFile(
  resolve(import.meta.dirname, "../app/generated/active-theme.ts"),
  "utf8",
);

test("renders the durable exact control-plane tuple across released Fashion surfaces", async ({
  page,
}) => {
  expect(receipt.artifactDigest).toBe(artifact.artifactDigest);
  expect(receipt.callbackArtifactDigest).toBe(artifact.artifactDigest);
  expect(receipt.approvalAuditArtifactDigest).toBe(artifact.artifactDigest);
  expect(artifact.candidateReleaseId).toBe(receipt.candidateReleaseId);
  expect(artifact.previewSnapshotId).toBe(receipt.previewSnapshotId);
  expect(artifact.contactVersion).toBe(receipt.contactVersion);
  expect(artifact.environment).toBe(receipt.environment);
  expect(artifact.themeId).toBe(receipt.themeId);
  expect(artifact.themeVersion).toBe(receipt.themeVersion);
  expect(buildInput.catalogRelease.content.map(({ kind }) => kind)).toEqual([
    "policy", "policy", "policy", "policy",
  ]);
  expect(buildInput.catalogRelease.content.map(({ title }) => title)).toEqual([
    "Privacy policy", "Returns policy", "Shipping policy", "Terms policy",
  ]);
  expect(generatedExperience).toContain(receipt.candidateReleaseId);
  expect(generatedExperience).toContain(receipt.previewSnapshotId);
  expect(generatedTheme).toContain(receipt.previewSnapshotId);
  expect(generatedTheme).toContain(receipt.exactValues.supportEmail);
  expect(generatedExperience).toContain('mode: "live"');

  await page.goto("/");
  await expect(page.locator("[data-fashion-store-header] .navbar-brand")).toHaveAttribute(
    "aria-label",
    "Shoppp home",
  );
  await expect(page.locator("[data-fashion-store-header]")).toContainText(
    receipt.exactValues.supportEmail,
  );
  const homeCards = page.locator("[data-fashion-store-product-card]");
  expect(
    await homeCards.evaluateAll((cards) => [
      ...new Set(cards.map((card) => card.getAttribute("data-product-id"))),
    ]),
  ).toEqual([receipt.exactValues.productId]);
  await expect(homeCards.first()).toContainText(
    receipt.exactValues.productName,
  );
  await expect(page.locator("[data-released-header-navigation] > li")).toHaveCount(0);
  await expect(page.locator("[data-released-footer-navigation] li")).toHaveCount(0);
  await expect(page.locator("footer")).toContainText(receipt.exactValues.supportEmail);
  await expect(page.locator("footer .footer-logo")).toHaveAttribute("aria-label", "Shoppp home");
  expect(
    buildInput.snapshot.resolvedTemplates
      .find(({ pageType }) => pageType === "home")!
      .sections.flatMap(({ blocks }) => blocks)
      .map(({ settings }) => settings.title)
      .filter(Boolean)
      .slice(0, 3),
  ).toEqual(["Featured lounge", "Modern comfort", "Everyday design"]);

  await page.goto(`/collections/${receipt.exactValues.collectionSlug}`);
  await expect(page.getByRole("heading", { name: receipt.exactValues.collectionName })).toBeVisible();
  await expect(page.locator("[data-fashion-store-product-card]")).toHaveCount(1);

  await page.goto(`/products/${receipt.exactValues.productSlug}`);
  await expect(page.locator("[data-fashion-store-product] .product-info > h4").first()).toHaveText(
    receipt.exactValues.productName,
  );

  await page.goto("/contact");
  await expect(
    page.locator('[data-contact-channel="support-email"]').getByRole("link"),
  ).toHaveText(receipt.exactValues.supportEmail);

  await page.goto("/policies/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText("privacy policy text", { exact: true }).first()).toBeVisible();

  await page.goto("/magazine");
  await expect(page.locator("[data-fashion-store-content-state]")).toHaveAttribute(
    "data-content-state",
    "populated",
  );
  await expect(page.locator("[data-fashion-store-magazine-card]")).toHaveCount(0);
  expect((await page.request.get("/magazine/u9-no-article")).status()).toBe(404);
  expect((await page.request.get("/pages/u9-no-page")).status()).toBe(404);
});
