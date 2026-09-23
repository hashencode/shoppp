import type { SectionInstance } from "@shoppp/contracts";

import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { fashionStoreRoutePaths } from "../page-contracts";

type LiveHomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

export function fashionStoreBlockReferenceId(
  block: SectionInstance["blocks"][number],
  key: string,
  kind: "article" | "collection",
): string | undefined {
  const value = block.settings[key];
  return typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === kind &&
    "id" in value &&
    typeof value.id === "string"
    ? value.id
    : undefined;
}

export function resolveFashionStoreBlockReferenceHref(
  data: LiveHomeViewModel | null,
  block: SectionInstance["blocks"][number],
  key: string,
  kind: "article" | "collection",
): string | undefined {
  const id = fashionStoreBlockReferenceId(block, key, kind);
  if (!id) {
    return data
      ? undefined
      : kind === "article"
        ? fashionStoreRoutePaths.article
        : fashionStoreRoutePaths.collection;
  }
  if (!data) {
    return kind === "article" ? fashionStoreRoutePaths.article : fashionStoreRoutePaths.collection;
  }
  return data.resourceDestinations.find(
    (destination) => destination.id === id && destination.kind === kind,
  )?.href;
}
