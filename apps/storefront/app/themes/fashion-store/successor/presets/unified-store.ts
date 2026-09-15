import type { ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset } from "./source-parity";

export const fashionStoreUnifiedPreset = {
  ...fashionStorePreset,
  id: "unified-store",
  label: "Unified store",
  templates: fashionStorePreset.templates,
} as const satisfies ThemePreset;
