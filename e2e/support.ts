import type { Browser, BrowserContext, Page } from "@playwright/test";

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the staging proof suite.`);
  return value.replace(/\/$/, "");
}

export function accessHeaders(kind: "authorized" | "prohibited" = "authorized") {
  const prefix = kind === "authorized" ? "" : "PROHIBITED_";
  return {
    "CF-Access-Client-Id": requiredEnvironment(`E2E_${prefix}CF_ACCESS_CLIENT_ID`),
    "CF-Access-Client-Secret": requiredEnvironment(`E2E_${prefix}CF_ACCESS_CLIENT_SECRET`),
  };
}

export async function adminContext(
  browser: Browser,
  kind: "authorized" | "prohibited" = "authorized",
): Promise<BrowserContext> {
  const context = await browser.newContext({ extraHTTPHeaders: accessHeaders(kind) });
  await context.addInitScript((operator) => {
    window.localStorage.setItem("codex-admin-auth", "1");
    window.localStorage.setItem("codex-admin-account", operator);
  }, process.env.E2E_OPERATOR_EMAIL ?? kind);
  return context;
}

export async function fillShippingAddress(page: Page): Promise<void> {
  await page.getByLabel("Email").fill("release-buyer@example.test");
  await page.getByLabel("Name").fill("Release Buyer");
  await page.getByLabel("Address").fill("100 Market Street");
  await page.getByLabel("City").fill("Portland");
  await page.getByLabel("Region").fill("OR");
  await page.getByLabel("Postal code").fill("97205");
  await page.getByRole("button", { name: "Refresh delivery options" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("checkbox").check();
}
