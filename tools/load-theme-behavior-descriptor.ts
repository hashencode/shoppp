import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createThemeBehaviorDescriptor,
  type ThemeBehaviorDescriptor,
} from "../apps/storefront/e2e/support/theme-behavior-descriptor";
import type { ThemeBehaviorContract } from "../apps/storefront/e2e/support/theme-behavior-contract";
import type { ThemeBehaviorAdapter } from "../apps/storefront/e2e/support/theme-behavior-runner";

export interface ThemeBehaviorDescriptorPolicy {
  acceptanceAdapterExport: string;
  acceptanceAdapterPath: string;
  behaviorContractExport: string;
  behaviorContractPath: string;
  sourceContractPath: string;
  sourceRegionsExport: string;
}

async function loadExport(path: string, exportName: string, root: string): Promise<unknown> {
  const module = (await import(pathToFileURL(resolve(root, path)).href)) as Record<string, unknown>;
  if (!(exportName in module)) throw new Error(`${path}: missing export ${exportName}`);
  return module[exportName];
}

export async function loadThemeBehaviorDescriptor(
  policy: ThemeBehaviorDescriptorPolicy,
  root: string,
): Promise<ThemeBehaviorDescriptor> {
  const [contract, adapters, regions] = await Promise.all([
    loadExport(policy.behaviorContractPath, policy.behaviorContractExport, root),
    loadExport(policy.acceptanceAdapterPath, policy.acceptanceAdapterExport, root),
    loadExport(policy.sourceContractPath, policy.sourceRegionsExport, root),
  ]);
  if (!contract || typeof contract !== "object" || !("behaviors" in contract))
    throw new Error(`${policy.behaviorContractPath}: invalid behavior contract export`);
  if (!adapters || typeof adapters !== "object" || Array.isArray(adapters))
    throw new Error(`${policy.acceptanceAdapterPath}: invalid acceptance adapter export`);
  if (!Array.isArray(regions))
    throw new Error(`${policy.sourceContractPath}: invalid source regions export`);
  const sourceRegions = regions.map((region) => {
    if (!region || typeof region !== "object")
      throw new Error(`${policy.sourceContractPath}: source region must be an object`);
    const value = region as {
      id?: unknown;
      inventorySelector?: unknown;
      key?: unknown;
      selector?: unknown;
    };
    const id = typeof value.id === "string" ? value.id : value.key;
    if (typeof id !== "string" || !id.trim())
      throw new Error(`${policy.sourceContractPath}: source region is missing id/key`);
    const selector =
      typeof value.inventorySelector === "string" ? value.inventorySelector : value.selector;
    if (typeof selector !== "string" || !selector.trim())
      throw new Error(`${policy.sourceContractPath}: source region is missing selector`);
    return { id, selector };
  });
  return createThemeBehaviorDescriptor({
    adapters: adapters as Readonly<Record<string, ThemeBehaviorAdapter>>,
    contract: contract as ThemeBehaviorContract,
    sourceRegions,
  });
}
