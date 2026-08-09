import type { FidelityViewportId } from "../../../../tools/theme-fidelity-report";
import { fashionStoreNamedStateContracts } from "../../app/themes/fashion-store/behavior-contract";
import type { NamedStateContract } from "./theme-behavior-contract";

export type { NamedStateAction, NamedStateContract } from "./theme-behavior-contract";

export function namedStatePixelThreshold(state: NamedStateContract): number {
  if (["cart-open", "search-open"].includes(state.id)) return 0.001;
  return 0.005;
}

export const fashionStoreNamedStates: readonly NamedStateContract[] =
  fashionStoreNamedStateContracts;

export const namedStateViewportIds: readonly FidelityViewportId[] = [
  "desktop",
  "laptop",
  "tablet",
  "mobile",
];
