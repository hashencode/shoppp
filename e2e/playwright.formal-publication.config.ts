import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";
import {
  assertFormalPublicationProofAuthority,
  readFormalPublicationContext,
} from "./formal-publication-context";
import { requiredEnvironment } from "./support";

const context = readFormalPublicationContext();
assertFormalPublicationProofAuthority(
  context,
  process.env,
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
);
export default defineConfig({
  testDir: ".",
  outputDir: `../.artifacts/screenshots/${new Date().toISOString().slice(0, 10)}-formal-publication/${process.env.GITHUB_RUN_ID}-attempt-${process.env.GITHUB_RUN_ATTEMPT}`,
  forbidOnly: true,
  fullyParallel: false,
  retries: 0,
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  projects: [
    { name: "public-provider-purchase", testMatch: "formal-publication-purchase.spec.ts" },
    {
      name: "release-operations",
      dependencies: ["public-provider-purchase"],
      testMatch: [
        "publication.spec.ts",
        "payment-recovery.spec.ts",
        "admin-fulfillment.spec.ts",
        "admin-access.spec.ts",
        "accessibility.spec.ts",
      ],
    },
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: requiredEnvironment("STOREFRONT_E2E_BASE_URL"),
    screenshot: "only-on-failure",
    trace: "off",
    video: "retain-on-failure",
  },
});
