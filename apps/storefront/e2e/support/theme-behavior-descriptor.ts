import type { ThemeBehaviorContract } from "./theme-behavior-contract";
import {
  fidelityStatesByRegionFromBehaviorContract,
  namedStatesFromBehaviorContract,
} from "./theme-behavior-contract";
import type { ThemeBehaviorAdapter } from "./theme-behavior-runner";

export interface ThemeBehaviorDescriptor {
  adapters: Readonly<Record<string, ThemeBehaviorAdapter>>;
  contract: ThemeBehaviorContract;
  fidelityStatesByRegion: ReturnType<typeof fidelityStatesByRegionFromBehaviorContract>;
  namedStates: ReturnType<typeof namedStatesFromBehaviorContract>;
  sourceRegions: readonly {
    id: string;
    selector: string;
  }[];
  structuralRegionIds: readonly string[];
}

export function createThemeBehaviorDescriptor(options: {
  adapters: Readonly<Record<string, ThemeBehaviorAdapter>>;
  contract: ThemeBehaviorContract;
  sourceRegions: readonly { id: string; selector: string }[];
}): ThemeBehaviorDescriptor {
  return {
    ...options,
    fidelityStatesByRegion: fidelityStatesByRegionFromBehaviorContract(options.contract),
    namedStates: namedStatesFromBehaviorContract(options.contract),
    structuralRegionIds: options.sourceRegions.map(({ id }) => id),
  };
}
