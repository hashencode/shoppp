import type { TestInfo } from "@playwright/test";
import type { ThemeViewportId } from "./theme-viewports";

type FashionStoreProjectMetadata = {
  fashionStoreViewport?: ThemeViewportId;
};

export function fashionStoreViewport(testInfo: TestInfo): ThemeViewportId {
  const metadata = testInfo.project.metadata as FashionStoreProjectMetadata;
  if (metadata.fashionStoreViewport) return metadata.fashionStoreViewport;

  const viewport = testInfo.project.name.match(/(?:^|-)(desktop|laptop|tablet|mobile)(?:-|$)/)?.[1];
  if (
    viewport === "desktop" ||
    viewport === "laptop" ||
    viewport === "tablet" ||
    viewport === "mobile"
  ) {
    return viewport;
  }
  throw new Error(`Fashion Store project has no viewport metadata: ${testInfo.project.name}`);
}

export function isFashionStoreViewport(
  testInfo: TestInfo,
  ...viewports: ThemeViewportId[]
): boolean {
  return viewports.includes(fashionStoreViewport(testInfo));
}
