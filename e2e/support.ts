import type { Browser, BrowserContext, Page } from "@playwright/test";

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the staging proof suite.`);
  return value.replace(/\/$/, "");
}

export function accessHeaders(kind: "authorized" | "prohibited" = "authorized") {
  const prefix = kind === "authorized" ? "" : "PROHIBITED_";
  return {
    Authorization: `Bearer ${requiredEnvironment(`E2E_${prefix}ADMIN_SERVICE_TOKEN`)}`,
  };
}

export function adminApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${requiredEnvironment("ADMIN_E2E_BASE_URL")}/api${normalizedPath}`;
}

export async function adminContext(
  browser: Browser,
  kind: "authorized" | "prohibited" = "authorized",
): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: accessHeaders(kind) });
}

export async function fillShippingAddress(page: Page): Promise<void> {
  await page.getByLabel("Email").fill(requiredEnvironment("E2E_BUYER_EMAIL"));
  await page.getByLabel("Name").fill("Release Buyer");
  await page.getByLabel("Address").fill("100 Market Street");
  await page.getByLabel("City").fill("Portland");
  await page.getByLabel("Region").fill("OR");
  await page.getByLabel("Postal code").fill("97205");
  await page.getByRole("button", { name: "Refresh delivery options" }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("checkbox").check();
}
