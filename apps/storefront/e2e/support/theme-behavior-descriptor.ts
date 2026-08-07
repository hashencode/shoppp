import type { ThemeBehaviorContract } from "./theme-behavior-contract";
import { namedStatesFromBehaviorContract } from "./theme-behavior-contract";
import type { ThemeBehaviorAdapter } from "./theme-behavior-runner";

export interface ThemeBehaviorDescriptor {
  adapters: Readonly<Record<string, ThemeBehaviorAdapter>>;
  contract: ThemeBehaviorContract;
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
    namedStates: namedStatesFromBehaviorContract(options.contract),
    structuralRegionIds: options.sourceRegions.map(({ id }) => id),
  };
}
