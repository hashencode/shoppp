import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { deterministicCaptureCss } from "../apps/storefront/e2e/support/theme-capture-contract";
import { acquireCaptureLease } from "./theme-capture-resource-guard";

export type ReferenceThemeId = "decor" | "fashion";

export interface ReferenceCaptureConfig {
  entry: string;
  firstHero: string;
  themeId: ReferenceThemeId;
}

export const referenceCaptureConfigs = {
  decor: {
    entry: "demo-decor-store.html",
    firstHero: "images/demo-decor-store-slider-01-img-01.png",
    themeId: "decor",
  },
  fashion: {
    entry: "demo-fashion-store.html",
    firstHero: "images/demo-fashion-store-slider-01.jpg",
    themeId: "fashion",
  },
} as const satisfies Record<ReferenceThemeId, ReferenceCaptureConfig>;

export function resolveReferenceCaptureConfig(themeId: string): ReferenceCaptureConfig {
  if (themeId === "fashion-2") {
    throw new Error(
      "fashion-2 is an implementation identity; use the fashion source entry demo-fashion-store.html.",
    );
  }
  if (themeId !== "fashion" && themeId !== "decor") {
    throw new Error(`Unsupported reference theme: ${themeId}.`);
  }
  return referenceCaptureConfigs[themeId];
}

export const referenceCaptureViewports = [
  { height: 1_000, id: "desktop", width: 1_440 },
  { height: 900, id: "laptop", width: 1_024 },
  { height: 1_024, id: "tablet", width: 768 },
  { height: 844, id: "mobile", width: 390 },
] as const;

export async function validateReferenceSource(
  sourceRoot: string,
  config: ReferenceCaptureConfig,
): Promise<{ entryPath: string; heroPath: string }> {
  const root = resolve(sourceRoot);
  const entryPath = resolve(root, config.entry);
  const heroPath = resolve(root, config.firstHero);
  for (const [label, path] of [
    ["HTML entry point", entryPath],
    ["expected first hero", heroPath],
  ] as const) {
    const relativePath = relative(root, path);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
      throw new Error(`${label} escapes the supplied source root.`);
    }
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new Error(`${label} is missing: ${path}`);
  }
  const markup = await readFile(entryPath, "utf8");
  if (!markup.includes(config.firstHero)) {
    throw new Error(`HTML entry point does not reference expected first hero: ${config.firstHero}`);
  }
  return { entryPath, heroPath };
}

function contentType(path: string): string {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".gif": "image/gif",
      ".html": "text/html; charset=utf-8",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[extname(path).toLowerCase()] ?? "application/octet-stream"
  );
}

interface CapturePage {
  addStyleTag(options: { content: string }): Promise<unknown>;
  evaluate<T>(callback: () => T | Promise<T>): Promise<T>;
  getByRole(
    role: "button",
    options: { name: RegExp },
  ): { click(options: { timeout: number }): Promise<unknown> };
  waitForTimeout(milliseconds: number): Promise<void>;
}

interface ReferencePageDiagnostics {
  brokenImages: string[];
  documentHeight: number;
  imageCount: number;
}

async function stabilizeReferencePage(page: CapturePage): Promise<ReferencePageDiagnostics> {
  await page
    .getByRole("button", { name: /allow cookies/i })
    .click({ timeout: 1_000 })
    .catch(() => {});
  await page.addStyleTag({
    content: deterministicCaptureCss,
  });
  const diagnostics = await page.evaluate(async () => {
    const delay = (milliseconds: number) =>
      new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
    document.querySelectorAll("img").forEach((image) => {
      image.loading = "eager";
      const lazySource = image.getAttribute("data-src");
      if (lazySource && !image.getAttribute("src")) image.setAttribute("src", lazySource);
      const lazySourceSet = image.getAttribute("data-srcset");
      if (lazySourceSet && !image.getAttribute("srcset"))
        image.setAttribute("srcset", lazySourceSet);
    });
    if ("fonts" in document) await document.fonts.ready;

    let previousHeight = 0;
    let stablePasses = 0;
    for (let pass = 0; pass < 4 && stablePasses < 2; pass += 1) {
      const step = Math.max(360, Math.floor(innerHeight * 0.65));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        scrollTo(0, y);
        await delay(100);
      }
      scrollTo(0, document.documentElement.scrollHeight);
      await delay(180);
      const currentHeight = document.documentElement.scrollHeight;
      stablePasses = currentHeight === previousHeight ? stablePasses + 1 : 0;
      previousHeight = currentHeight;
    }

    const images = [...document.images];
    await Promise.all(
      images.map(async (image) => {
        if (!image.complete) {
          await Promise.race([
            new Promise<void>((resolvePromise) => {
              image.addEventListener("load", () => resolvePromise(), { once: true });
              image.addEventListener("error", () => resolvePromise(), { once: true });
            }),
            delay(5_000),
          ]);
        }
        await image.decode().catch(() => undefined);
      }),
    );
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
    document
      .querySelectorAll<HTMLElement>(
        ".swiper-pagination-bullet:first-child, .tp-bullet:first-child",
      )
      .forEach((control) => control.click());
    scrollTo(0, 0);
    await delay(250);
    return {
      brokenImages: images
        .filter((image) => image.currentSrc && image.naturalWidth === 0)
        .map((image) => image.currentSrc),
      documentHeight: document.documentElement.scrollHeight,
      imageCount: images.length,
    };
  });
  await page.waitForTimeout(250);
  if (diagnostics.brokenImages.length > 0) {
    throw new Error(
      `Reference page has ${diagnostics.brokenImages.length} broken images: ${diagnostics.brokenImages
        .slice(0, 5)
        .join(", ")}`,
    );
  }
  return diagnostics;
}

export async function captureReference(options: {
  outputRoot: string;
  sourceRoot: string;
  themeId: ReferenceThemeId;
}): Promise<void> {
  const { chromium } = await import("@playwright/test");
  const config = resolveReferenceCaptureConfig(options.themeId);
  await validateReferenceSource(options.sourceRoot, config);
  const root = resolve(options.sourceRoot);
  const outputRoot = resolve(options.outputRoot, options.themeId);
  await mkdir(outputRoot, { recursive: true });
  const lease = await acquireCaptureLease({ origins: [], outputRoot, requestedWorkers: 1 });
  let server: ReturnType<typeof Bun.serve> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const captures: Array<(typeof referenceCaptureViewports)[number] & ReferencePageDiagnostics> = [];
  try {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const requestUrl = new URL(request.url);
        const requestPath =
          decodeURIComponent(requestUrl.pathname.replace(/^\/+/, "")) || config.entry;
        const normalized = normalize(requestPath);
        const filePath = resolve(root, normalized);
        const relativePath = relative(root, filePath);
        if (
          normalized.startsWith("..") ||
          relativePath === ".." ||
          relativePath.startsWith(`..${sep}`)
        ) {
          return new Response("Not found", { status: 404 });
        }
        const contents = await Bun.file(filePath)
          .arrayBuffer()
          .catch(() => null);
        if (!contents) return new Response("Not found", { status: 404 });
        return new Response(contents, { headers: { "content-type": contentType(filePath) } });
      },
    });
    browser = await chromium.launch();
    for (const viewport of referenceCaptureViewports) {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        viewport: { height: viewport.height, width: viewport.width },
      });
      const response = await page.goto(`http://127.0.0.1:${server.port}/${config.entry}`, {
        waitUntil: "load",
      });
      if (!response?.ok()) throw new Error(`Reference page failed to load: ${config.entry}`);
      const diagnostics = await stabilizeReferencePage(page);
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: join(outputRoot, `${viewport.id}.png`),
      });
      captures.push({ ...viewport, ...diagnostics });
      await page.close();
    }
    await writeFile(
      join(outputRoot, "metadata.json"),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          entry: config.entry,
          firstHero: config.firstHero,
          sourceRoot: root,
          state: "initial-home",
          themeId: config.themeId,
          viewports: captures.map((capture) => ({ ...capture, dpr: 1 })),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser?.close();
    server?.stop(true);
    await lease.release();
  }
}

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const arguments_ = Bun.argv.slice(2);
  const sourceRoot = argumentValue(arguments_, "--source");
  const outputRoot = argumentValue(arguments_, "--output");
  const themeId = argumentValue(arguments_, "--theme");
  if (!sourceRoot || !outputRoot || !themeId) {
    throw new Error(
      "Usage: bun tools/capture-storefront-theme-reference.ts --source=<html-root> --output=<artifact-root> --theme=<fashion|decor>",
    );
  }
  const config = resolveReferenceCaptureConfig(themeId);
  await captureReference({ outputRoot, sourceRoot, themeId: config.themeId });
  console.log(`Captured deterministic ${themeId} references at 1440, 1024, 768, and 390px.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
