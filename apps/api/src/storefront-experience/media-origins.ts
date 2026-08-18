import type { CanonicalCatalogRelease } from "@shoppp/contracts";

import { ApiError } from "../http/errors";

export const MAX_STOREFRONT_MEDIA_ORIGINS = 8;

function exactCredentialFreeHttpsOrigin(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function catalogMediaOrigins(release: CanonicalCatalogRelease): string[] {
  const origins = new Set<string>();
  for (const product of release.products) {
    for (const media of product.media) {
      if (media.src.startsWith("/")) continue;
      const origin = new URL(media.src).origin;
      if (!exactCredentialFreeHttpsOrigin(origin)) {
        throw new ApiError(
          422,
          "catalog_release_media_origins_invalid",
          "The Catalog Release contains an invalid external media origin.",
        );
      }
      origins.add(origin);
      if (origins.size > MAX_STOREFRONT_MEDIA_ORIGINS) {
        throw new ApiError(
          422,
          "catalog_release_media_origins_invalid",
          `The Catalog Release exceeds the ${MAX_STOREFRONT_MEDIA_ORIGINS}-origin preview media limit.`,
        );
      }
    }
  }
  return [...origins].sort();
}

export function parsePersistedMediaOrigins(value: string | null): string[] | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > MAX_STOREFRONT_MEDIA_ORIGINS ||
    new Set(parsed).size !== parsed.length ||
    !parsed.every(exactCredentialFreeHttpsOrigin)
  ) {
    return null;
  }
  return parsed;
}
