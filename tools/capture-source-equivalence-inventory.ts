import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  assertThemeSourceInventoryCovered,
  captureThemeSourceInventory,
} from "../apps/storefront/e2e/support/theme-source-inventory";
import { compareThemeVisibleCopy } from "../apps/storefront/e2e/support/theme-source-contract";
import { validateIndependentReferenceSource } from "./capture-storefront-theme-reference";
import { loadThemeBehaviorDescriptor } from "./load-theme-behavior-descriptor";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

export interface SourceInventoryEvidenceIdentity {
  entry: string;
  entrySha256: string;
  implementationRoute: string;
  implementationThemeRoot: string;
  implementationUrl: string;
  pageId: string;
  sourceRevision: string;
  sourceRoot: string;
  themeId: string;
}

export function assertAuthorizedSourceRoot(actual: string, expected: string): void {
  if (resolve(actual) !== resolve(expected))
    throw new Error(
      `source root must match the policy-authorized template root ${resolve(expected)}.`,
    );
}

export function assertSourceInventoryEvidenceIdentity(
  identity: SourceInventoryEvidenceIdentity,
  expected: Pick<
    SourceInventoryEvidenceIdentity,
    | "entry"
    | "entrySha256"
    | "implementationRoute"
    | "implementationThemeRoot"
    | "pageId"
    | "sourceRoot"
    | "themeId"
  >,
): void {
  const issues: string[] = [];
  if (resolve(identity.sourceRoot) !== resolve(expected.sourceRoot))
    issues.push("source root does not match the authorized template root");
  if (identity.entry !== expected.entry) issues.push("source entry does not match policy");
  if (identity.entrySha256 !== expected.entrySha256)
    issues.push("source digest does not match policy");
  if (identity.pageId !== expected.pageId) issues.push("page id does not match policy");
  if (identity.implementationRoute !== expected.implementationRoute)
    issues.push("implementation route does not match policy");
  if (identity.themeId !== expected.themeId)
    issues.push("implementation theme id does not match policy");
  if (resolve(identity.implementationThemeRoot) !== resolve(expected.implementationThemeRoot))
    issues.push("implementation theme root does not match policy");
  try {
    new URL(identity.implementationUrl);
  } catch {
    issues.push("implementation URL is invalid");
  }
  if (identity.sourceRevision !== `sha256:${identity.entrySha256}`)
    issues.push("source revision does not match the captured digest");
  if (issues.length > 0)
    throw new Error(`Invalid source inventory identity:\n${issues.join("\n")}`);
}

export async function captureSourceEquivalenceInventory(options: {
  implementationThemeRoot: string;
  implementationUrl: string;
  outputPath: string;
  pageId: string;
  sourceRoot: string;
  sourceUrl: string;
  themeId: string;
}): Promise<void> {
  const policy = await loadSourceEquivalencePolicy();
  const theme = policy.themes.find(({ id }) => id === options.themeId);
  if (!theme) throw new Error(`Unknown source-equivalence theme: ${options.themeId}.`);
  const pagePolicy = theme.pages.find(({ id }) => id === options.pageId);
  if (!pagePolicy)
    throw new Error(`Unknown source-equivalence page: ${options.themeId}/${options.pageId}.`);
  const root = resolve(import.meta.dir, "..");
  const authorizedSourceRoot = resolve(root, theme.authorizedSourceRoot);
  const authorizedImplementationThemeRoot = resolve(root, "apps/storefront/app/themes", theme.id);
  assertAuthorizedSourceRoot(options.sourceRoot, authorizedSourceRoot);
  if (resolve(options.implementationThemeRoot) !== authorizedImplementationThemeRoot)
    throw new Error(`implementation theme root must match ${authorizedImplementationThemeRoot}.`);
  const descriptor = await loadThemeBehaviorDescriptor(pagePolicy, root);
  const referenceConfig = {
    entry: pagePolicy.sourceEntry,
    firstHero: pagePolicy.sourceFirstHero,
    themeId: theme.id,
  };
  const validated = await validateIndependentReferenceSource({
    config: referenceConfig,
    expectedEntrySha256: pagePolicy.sourceEntrySha256,
    implementationThemeRoot: options.implementationThemeRoot,
    sourceRoot: options.sourceRoot,
  });
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  );
  try {
    const context = await browser.newContext({ viewport: { height: 1_000, width: 1_440 } });
    const source = await context.newPage();
    const implementation = await context.newPage();
    await Promise.all([
      source.goto(options.sourceUrl, { waitUntil: "domcontentloaded" }),
      implementation.goto(options.implementationUrl, { waitUntil: "domcontentloaded" }),
    ]);
    const waitForRuntime = async (page: Page, selector: string) => {
      await page.waitForFunction((readySelector: string) => {
        const element = document.querySelector(readySelector) as
          (HTMLElement & { swiper?: unknown }) | null;
        return Boolean(element?.swiper || element?.dataset.runtimeStatus === "ready");
      }, selector);
    };
    await Promise.all([
      waitForRuntime(source, pagePolicy.sourceRuntimeReadySelector),
      waitForRuntime(implementation, pagePolicy.implementationRuntimeReadySelector),
    ]);
    await Promise.all([
      source
        .locator("[data-accept-btn]")
        .click({ timeout: 2_000 })
        .catch(() => undefined),
      implementation
        .getByRole("button", { name: "Allow cookies" })
        .click({ timeout: 2_000 })
        .catch(() => undefined),
    ]);
    await Promise.all(
      [source, implementation].map((page) =>
        page.addStyleTag({
          content: `
            [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
              opacity: 1 !important;
              transform: none !important;
              visibility: visible !important;
            }
          `,
        }),
      ),
    );
    await Promise.all(
      [source, implementation].map((page) =>
        page.evaluate(async () => {
          document.querySelectorAll<HTMLElement>(".swiper").forEach((element) => {
            const swiper = (
              element as HTMLElement & {
                swiper?: {
                  autoplay?: { stop(): void };
                  slideToLoop?(index: number, speed: number): void;
                };
              }
            ).swiper;
            swiper?.autoplay?.stop();
            swiper?.slideToLoop?.(0, 0);
          });
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
        }),
      ),
    );
    const regions = descriptor.sourceRegions;
    const [sourceInventory, implementationInventory] = await Promise.all([
      captureThemeSourceInventory({
        contract: descriptor.contract,
        page: source,
        regions,
        side: "source",
      }),
      captureThemeSourceInventory({
        contract: descriptor.contract,
        page: implementation,
        regions,
        side: "implementation",
      }),
    ]);
    assertThemeSourceInventoryCovered(sourceInventory, descriptor.contract);
    const visibleCopy = compareThemeVisibleCopy(
      sourceInventory.visibleCopy,
      implementationInventory.visibleCopy,
    );
    const sourceEntry = await readFile(validated.entryPath);
    const entrySha256 = createHash("sha256").update(sourceEntry).digest("hex");
    const identity = {
      entry: pagePolicy.sourceEntry,
      entrySha256,
      implementationRoute: pagePolicy.implementationRoute,
      implementationThemeRoot: authorizedImplementationThemeRoot,
      implementationUrl: options.implementationUrl,
      pageId: pagePolicy.id,
      sourceRevision: `sha256:${entrySha256}`,
      sourceRoot: validated.sourceRoot,
      themeId: theme.id,
    };
    assertSourceInventoryEvidenceIdentity(identity, {
      entry: pagePolicy.sourceEntry,
      entrySha256: pagePolicy.sourceEntrySha256,
      implementationRoute: pagePolicy.implementationRoute,
      implementationThemeRoot: authorizedImplementationThemeRoot,
      pageId: pagePolicy.id,
      sourceRoot: authorizedSourceRoot,
      themeId: theme.id,
    });
    const report = {
      capturedAt: new Date().toISOString(),
      identity,
      implementation: implementationInventory,
      source: sourceInventory,
      visibleCopy,
    };
    const outputPath = resolve(options.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    if (
      visibleCopy.changed.length > 0 ||
      visibleCopy.implementationOnly.length > 0 ||
      visibleCopy.sourceOnly.length > 0
    )
      throw new Error("Visible-copy parity failed; inspect the generated inventory report.");
    await context.close();
  } finally {
    await browser.close();
  }
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv
    .find((candidate) => candidate.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) throw new Error(`${prefix}<value> is required.`);
  return value;
}

if (import.meta.main) {
  await captureSourceEquivalenceInventory({
    implementationThemeRoot: argument("implementation-theme-root"),
    implementationUrl: argument("implementation-url"),
    outputPath: argument("output"),
    pageId: argument("page"),
    sourceRoot: argument("source-root"),
    sourceUrl: argument("source-url"),
    themeId: argument("theme"),
  });
}
