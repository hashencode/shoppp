import type { ExperienceFixtureRegistry } from "./view-models";
import { experienceFixtureSchema } from "./view-models";

export type ThemeAssetMap = Readonly<Record<string, string>>;
export type ThemeAssetResolver = (assetId: string) => string;

function assetIdPattern(themeId: string): RegExp {
  return new RegExp(`^${themeId}\\.[a-z0-9]+(?:-[a-z0-9]+)*$`);
}

export function validateThemeAssets(
  themeId: string,
  assets: Readonly<Record<string, string>>,
): ThemeAssetMap {
  const pattern = assetIdPattern(themeId);
  const paths = new Set<string>();
  for (const [assetId, path] of Object.entries(assets)) {
    if (!pattern.test(assetId)) {
      throw new Error(`Theme asset ${assetId} does not use the ${themeId} namespace.`);
    }
    const isBuildLocal =
      path.startsWith("/") ||
      path.startsWith("file:") ||
      /^data:image\/(?:avif|jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(path);
    if (!isBuildLocal || path.startsWith("//") || path.includes("..")) {
      throw new Error(`Theme asset ${assetId} must resolve to a same-origin build asset.`);
    }
    if (paths.has(path)) throw new Error(`Theme assets contain a duplicate resolved path: ${path}`);
    paths.add(path);
  }
  return Object.freeze({ ...assets });
}

export function createThemeAssetResolver(
  themeId: string,
  assets: ThemeAssetMap,
): ThemeAssetResolver {
  const prefix = `${themeId}.`;
  return (assetId) => {
    if (!assetId.startsWith(prefix)) {
      throw new Error(`Theme asset ${assetId} is outside the selected ${themeId} namespace.`);
    }
    const path = assets[assetId];
    if (!path) throw new Error(`Selected theme asset ${assetId} is missing.`);
    return path;
  };
}

export function mergeExperienceFixtureRegistries(
  core: ExperienceFixtureRegistry,
  selected: ExperienceFixtureRegistry,
): ExperienceFixtureRegistry {
  const duplicates = Object.keys(core).filter((key) => key in selected);
  if (duplicates.length > 0) {
    throw new Error(`Selected theme fixture registry has duplicate IDs: ${duplicates.join(", ")}.`);
  }
  for (const [key, fixture] of Object.entries(selected)) {
    const parsed = experienceFixtureSchema.parse(fixture);
    if (parsed.id !== key) {
      throw new Error(`Theme fixture registry key ${key} does not match its stable ID.`);
    }
  }
  return Object.freeze({ ...core, ...selected });
}
