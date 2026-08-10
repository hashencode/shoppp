import type { Page } from "@playwright/test";

export interface SemanticReadinessDiagnostics {
  brokenImages: string[];
  documentHeight: number;
  documentWidth: number;
  fontsReady: boolean;
  imageCount: number;
  runtimeReady: boolean;
  stableLayout: boolean;
}

export interface SemanticReadinessOptions {
  allowedRuntimeStatuses?: readonly string[];
  failOnBrokenImages?: boolean;
  imageTimeoutMs?: number;
  runtimeStatusSelector?: string;
  stableSamples?: number;
  timeoutMs?: number;
}

export function semanticReadinessIssues(
  diagnostics: SemanticReadinessDiagnostics,
  options: Pick<SemanticReadinessOptions, "failOnBrokenImages" | "runtimeStatusSelector"> = {},
): string[] {
  const issues: string[] = [];
  if (options.runtimeStatusSelector && !diagnostics.runtimeReady)
    issues.push(`runtime did not become ready at ${options.runtimeStatusSelector}`);
  if (!diagnostics.fontsReady) issues.push("document fonts did not become ready");
  if (!diagnostics.stableLayout) issues.push("document geometry did not stabilize");
  if (options.failOnBrokenImages && diagnostics.brokenImages.length > 0)
    issues.push(
      `${diagnostics.brokenImages.length} image(s) failed to decode: ${diagnostics.brokenImages
        .slice(0, 5)
        .join(", ")}`,
    );
  return issues;
}

export async function resetTransientAcceptanceState(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    document.body.style.setProperty("scroll-behavior", "auto", "important");
    scrollTo({ behavior: "auto", left: 0, top: 0 });
    await new Promise<void>((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
    );
  });
}

export async function waitForSemanticReadiness(
  page: Page,
  options: SemanticReadinessOptions = {},
): Promise<SemanticReadinessDiagnostics> {
  const allowedRuntimeStatuses = [...(options.allowedRuntimeStatuses ?? ["ready", "static"])];
  const runtimeStatusSelector = options.runtimeStatusSelector;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (runtimeStatusSelector) {
    await page.waitForFunction(
      ({ allowedStatuses, selector }) =>
        [...document.querySelectorAll<HTMLElement>(selector)].some((element) =>
          allowedStatuses.includes(element.getAttribute("data-runtime-status") ?? ""),
        ),
      { allowedStatuses: allowedRuntimeStatuses, selector: runtimeStatusSelector },
      { timeout: timeoutMs },
    );
  }

  const diagnostics = await page.evaluate(
    async ({ imageTimeout, requiredStableSamples, runtimeSelector, statuses, timeout }) => {
      const delay = (milliseconds: number) =>
        new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
      document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        image.loading = "eager";
        const lazySource = image.getAttribute("data-src");
        if (lazySource && !image.getAttribute("src")) image.setAttribute("src", lazySource);
        const lazySourceSet = image.getAttribute("data-srcset");
        if (lazySourceSet && !image.getAttribute("srcset"))
          image.setAttribute("srcset", lazySourceSet);
      });
      const fontsReady =
        !("fonts" in document) ||
        (await Promise.race([
          document.fonts.ready.then(() => true),
          delay(timeout).then(() => false),
        ]));

      const images = [...document.images];
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await Promise.race([
              new Promise<void>((resolvePromise) => {
                image.addEventListener("load", () => resolvePromise(), { once: true });
                image.addEventListener("error", () => resolvePromise(), { once: true });
              }),
              delay(imageTimeout),
            ]);
          }
          await image.decode().catch(() => undefined);
        }),
      );

      let previousGeometry = "";
      let stablePasses = 0;
      const deadline = performance.now() + timeout;
      while (performance.now() < deadline && stablePasses < requiredStableSamples) {
        await new Promise<void>((resolvePromise) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
        );
        const geometry = `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`;
        stablePasses = geometry === previousGeometry ? stablePasses + 1 : 0;
        previousGeometry = geometry;
      }

      scrollTo({ behavior: "auto", left: 0, top: 0 });
      await new Promise<void>((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
      );
      return {
        brokenImages: images
          .filter((image) => image.currentSrc && image.naturalWidth === 0)
          .map((image) => image.currentSrc),
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        fontsReady,
        imageCount: images.length,
        runtimeReady: runtimeSelector
          ? [...document.querySelectorAll<HTMLElement>(runtimeSelector)].some((element) =>
              statuses.includes(element.getAttribute("data-runtime-status") ?? ""),
            )
          : true,
        stableLayout: stablePasses >= requiredStableSamples,
      };
    },
    {
      imageTimeout: options.imageTimeoutMs ?? 5_000,
      requiredStableSamples: options.stableSamples ?? 2,
      runtimeSelector: runtimeStatusSelector,
      statuses: allowedRuntimeStatuses,
      timeout: timeoutMs,
    },
  );
  const issues = semanticReadinessIssues(diagnostics, options);
  if (issues.length > 0) throw new Error(`Semantic readiness failed: ${issues.join("; ")}`);
  return diagnostics;
}
