import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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

async function sweep(page: CapturePage): Promise<void> {
  await page
    .getByRole("button", { name: /allow cookies/i })
    .click({ timeout: 1_000 })
    .catch(() => {});
  await page.evaluate(async () => {
    const step = Math.max(500, Math.floor(innerHeight * 0.75));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 80));
    }
    scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition: none !important;
      }
      [data-anime], .appear, .anime-complete {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
      #cookies-model, .cookie-message, .scroll-progress { display: none !important; }
    `,
  });
  await page.waitForTimeout(250);
}

export async function captureReference(options: {
  outputRoot: string;
  sourceRoot: string;
  themeId: ReferenceThemeId;
}): Promise<void> {
  const { chromium } = await import("@playwright/test");
  const config = referenceCaptureConfigs[options.themeId];
  await validateReferenceSource(options.sourceRoot, config);
  const root = resolve(options.sourceRoot);
  const server = Bun.serve({
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
  const browser = await chromium.launch();
  const outputRoot = resolve(options.outputRoot, options.themeId);
  await mkdir(outputRoot, { recursive: true });
  const captures = [
    { height: 1_000, id: "desktop", width: 1_440 },
    { height: 915, id: "mobile", width: 412 },
  ] as const;
  try {
    for (const capture of captures) {
      const page = await browser.newPage({
        reducedMotion: "reduce",
        viewport: { height: capture.height, width: capture.width },
      });
      const response = await page.goto(`http://127.0.0.1:${server.port}/${config.entry}`, {
        waitUntil: "networkidle",
      });
      if (!response?.ok()) throw new Error(`Reference page failed to load: ${config.entry}`);
      await sweep(page);
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: join(outputRoot, `${capture.id}.png`),
      });
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
          themeId: config.themeId,
          viewports: captures,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await browser.close();
    server.stop(true);
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
  if (!sourceRoot || !outputRoot || (themeId !== "fashion" && themeId !== "decor")) {
    throw new Error(
      "Usage: bun tools/capture-storefront-theme-reference.ts --source=<html-root> --output=<artifact-root> --theme=<fashion|decor>",
    );
  }
  await captureReference({ outputRoot, sourceRoot, themeId });
  console.log(`Captured deterministic ${themeId} desktop and mobile references.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
