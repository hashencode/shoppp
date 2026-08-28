import type { CanonicalCatalogRelease } from "@shoppp/contracts";

import { themeRoutePaths } from "../app/theme-engine/routes";
import { decorThemeRoutes } from "../app/themes/decor/page-contracts";
import { decorStoreEnabledPageContracts } from "../app/themes/decor-store/page-contracts";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";

export const previewPlatformRoutes = ["/checkout/complete"] as const;
export const productionPlatformRoutes = [
  "/cart",
  "/checkout",
  "/checkout/complete",
  "/orders/access",
] as const;

export interface PrerenderExperienceInput {
  catalogRelease?: CanonicalCatalogRelease;
  environment: "preview" | "production";
  presentationMode?: "live";
  themeId?: string;
}

export function resolveStorefrontPrerenderRoutes(input: {
  experience?: PrerenderExperienceInput;
  previewBuild: boolean;
  productionRoutes: readonly string[];
}): string[] {
  if (!input.previewBuild) {
    return [...input.productionRoutes, ...productionPlatformRoutes];
  }
  const routes =
    input.experience?.themeId === "decor"
      ? decorThemeRoutes
      : input.experience?.themeId === "decor-store"
        ? decorStoreEnabledPageContracts
        : fashionStoreThemeRoutes;
  const liveRelease =
    input.experience?.presentationMode === "live" && input.experience.catalogRelease
      ? input.experience.catalogRelease
      : undefined;
  const previewRoutes = liveRelease
    ? themeRoutePaths(routes, "live", liveRelease)
    : themeRoutePaths(routes, "fixture-preview");
  const policyRoutes = liveRelease?.policies.map(({ slug }) => `/policies/${slug}`) ?? [];
  return [...new Set([...previewRoutes, ...policyRoutes, ...previewPlatformRoutes])];
}
