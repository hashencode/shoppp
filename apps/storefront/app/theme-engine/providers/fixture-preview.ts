import type { FixtureBinding } from "@shoppp/contracts";

import {
  resolveFixtureBinding,
  resolveFixtureViewModel,
  type ExperienceFixtureRegistry,
} from "../view-models";
import type { PresentationProvider } from "./types";

export interface FixturePresentationProviderInput {
  bindings: readonly FixtureBinding[];
  fixtures: ExperienceFixtureRegistry;
}

export function createFixturePresentationProvider(
  input: FixturePresentationProviderInput,
): PresentationProvider {
  const provider: PresentationProvider = {
    resolve({ instanceId }) {
      return resolveFixtureViewModel(
        resolveFixtureBinding(instanceId, input.bindings),
        input.fixtures,
      );
    },
  };
  return Object.freeze(provider);
}
