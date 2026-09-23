import type { ThemePreset } from "@shoppp/contracts";

import { fashionStorePreset, fashionStoreV11Preset } from "./source-parity";

export const fashionStoreV11UnifiedPreset = {
  ...fashionStoreV11Preset,
  id: "unified-store",
  label: "Unified store",
  templates: fashionStoreV11Preset.templates,
} as const satisfies ThemePreset;

export const fashionStoreUnifiedPreset = {
  ...fashionStorePreset,
  id: "unified-store",
  label: "Unified store",
  templates: fashionStorePreset.templates,
} as const satisfies ThemePreset;
