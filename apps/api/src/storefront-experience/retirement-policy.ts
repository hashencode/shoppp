import { ApiError } from "../http/errors";

export const RETIRED_STOREFRONT_THEME_IDS = ["decor", "decor-store"] as const;

export function isRetiredStorefrontThemeId(themeId: string): boolean {
  return (RETIRED_STOREFRONT_THEME_IDS as readonly string[]).includes(themeId);
}

export function assertStorefrontThemeLifecycleWritable(themeId: string): void {
  if (!isRetiredStorefrontThemeId(themeId)) return;
  throw new ApiError(
    422,
    "storefront_theme_package_retired",
    "The retired theme package no longer accepts lifecycle writes.",
  );
}
