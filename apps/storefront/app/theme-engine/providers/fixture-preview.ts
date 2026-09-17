import type { FixtureBinding } from "@shoppp/contracts";

import {
  resolveFixtureViewModel,
  resolveFixtureShellViewModel,
  type ExperienceFixtureRegistry,
} from "../view-models";
import {
  requireExpectedViewModelKind,
  type FixtureBindingAliases,
  type PresentationProvider,
} from "./types";

export interface FixturePresentationProviderInput {
  bindings: readonly FixtureBinding[];
  bindingAliases?: FixtureBindingAliases;
  fixtures: ExperienceFixtureRegistry;
}

export function createFixturePresentationProvider(
  input: FixturePresentationProviderInput,
): PresentationProvider {
  const bindingsByInstance = new Map<string, FixtureBinding[]>();
  for (const binding of input.bindings) {
    const bindings = bindingsByInstance.get(binding.instanceId) ?? [];
    bindings.push(binding);
    bindingsByInstance.set(binding.instanceId, bindings);
  }
  const resolveBinding = (instanceId: string): FixtureBinding => {
    const matches = bindingsByInstance.get(instanceId) ?? [];
    if (matches.length === 0) {
      throw new Error(`Visible instance ${instanceId} is missing a fixture binding.`);
    }
    if (matches.length > 1) {
      throw new Error(`Visible instance ${instanceId} has ambiguous fixture bindings.`);
    }
    return matches[0]!;
  };
  const fixtureBinding = (instanceId: string): FixtureBinding => {
    if (bindingsByInstance.has(instanceId)) return resolveBinding(instanceId);
    const alias = input.bindingAliases?.[instanceId];
    if (!alias) return resolveBinding(instanceId);
    return {
      ...resolveBinding(alias.sourceInstanceId),
      instanceId,
      resource: alias.resource,
    };
  };
  const provider: PresentationProvider = {
    resolve({ expectedKind, instanceId, settings }) {
      const resolved = resolveFixtureViewModel(fixtureBinding(instanceId), input.fixtures);
      const viewModel =
        resolved.kind !== "theme-section"
          ? resolved
          : { ...resolved, data: { ...resolved.data, presentation: settings ?? {} } };
      return requireExpectedViewModelKind(viewModel, expectedKind);
    },
    resolveShell({ instanceId, resource }) {
      return resolveFixtureShellViewModel(resolveBinding(instanceId), input.fixtures, resource);
    },
  };
  return Object.freeze(provider);
}
