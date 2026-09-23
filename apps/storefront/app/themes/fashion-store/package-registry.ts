import {
  themePackageMigrationBoundarySchema,
  themePackageRegistrationSchema,
  type ThemePackage,
} from "@shoppp/contracts";

import historicalV1PackagePayload from "./historical/1.0.0/theme-package.json";
import {
  fashionStoreManifest,
  fashionStoreThemeDescriptor,
  fashionStoreV11Manifest,
} from "./successor/manifest";
import { fashionStoreFixtureBindingAliases } from "./successor/composition";
import { fashionStorePreset, fashionStoreV11Preset } from "./successor/presets/source-parity";
import {
  fashionStoreUnifiedPreset,
  fashionStoreV11UnifiedPreset,
} from "./successor/presets/unified-store";

export const FASHION_STORE_HISTORICAL_V1_PACKAGE_SHA256 =
  "95bb721577646c46c460e8a98e1e15f4c5c6a53d723e05f9147b3a678b352120";
export const FASHION_STORE_V11_PACKAGE_SHA256 =
  "3871b7c7ea520aff9e4f35349e07803c1a799cf6d702238f867398bacba8b3d7";

function deepFreeze<Value>(value: Value): Readonly<Value> {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const historicalV1Registration = deepFreeze(
  themePackageRegistrationSchema.parse({
    lifecycle: "historical",
    package: historicalV1PackagePayload,
  }),
);
const legacyV11Registration = deepFreeze(
  themePackageRegistrationSchema.parse({
    lifecycle: "successor",
    package: {
      manifest: fashionStoreV11Manifest,
      presets: [fashionStoreV11Preset, fashionStoreV11UnifiedPreset],
    },
  }),
);
const successorRegistration = deepFreeze(
  themePackageRegistrationSchema.parse({
    lifecycle: "successor",
    package: {
      manifest: fashionStoreManifest,
      presets: [fashionStorePreset, fashionStoreUnifiedPreset],
    },
  }),
);

export const fashionStorePackageRegistrations = deepFreeze([
  historicalV1Registration,
  legacyV11Registration,
  successorRegistration,
] as const);
export const fashionStoreHistoricalPackages = deepFreeze([
  historicalV1Registration.package,
] as const);
export const fashionStoreV11Package = legacyV11Registration.package;
export const fashionStoreSuccessorPackage = successorRegistration.package;

export function fashionStoreFixtureBindingAliasesForPackage(
  themePackage: ThemePackage,
): typeof fashionStoreFixtureBindingAliases | undefined {
  const manifest = themePackage.manifest;
  const supportsSplitHomeFixtures = [
    legacyV11Registration.package.manifest,
    fashionStoreSuccessorPackage.manifest,
  ].some(
    (supported) =>
      manifest.id === supported.id &&
      manifest.themeVersion === supported.themeVersion &&
      manifest.configurationSchemaVersion === supported.configurationSchemaVersion,
  );
  return supportsSplitHomeFixtures ? fashionStoreFixtureBindingAliases : undefined;
}

export const fashionStoreDirectMigrationBoundaries = deepFreeze(
  themePackageMigrationBoundarySchema.array().parse([
    {
      source: {
        configurationSchemaVersion:
          historicalV1Registration.package.manifest.configurationSchemaVersion,
        themeVersion: historicalV1Registration.package.manifest.themeVersion,
      },
      target: {
        configurationSchemaVersion:
          legacyV11Registration.package.manifest.configurationSchemaVersion,
        themeVersion: legacyV11Registration.package.manifest.themeVersion,
      },
      themeId: fashionStoreSuccessorPackage.manifest.id,
    },
    {
      source: {
        configurationSchemaVersion:
          legacyV11Registration.package.manifest.configurationSchemaVersion,
        themeVersion: legacyV11Registration.package.manifest.themeVersion,
      },
      target: {
        configurationSchemaVersion:
          fashionStoreSuccessorPackage.manifest.configurationSchemaVersion,
        themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
      },
      themeId: fashionStoreSuccessorPackage.manifest.id,
    },
  ]),
);

export const fashionStoreReaderCompatibilityMatrix = deepFreeze([
  {
    experienceSchemaVersion: 1,
    packageVersion: "1.0.0",
    reader: "legacy" as const,
    releaseSchemaVersion: 2,
  },
  {
    experienceSchemaVersion: 2,
    packageVersion: "1.1.0",
    reader: "legacy" as const,
    releaseSchemaVersion: 2,
  },
  {
    experienceSchemaVersion: 2,
    packageVersion: "1.1.0",
    reader: "legacy" as const,
    releaseSchemaVersion: 3,
  },
  {
    experienceSchemaVersion: 3,
    packageVersion: "1.2.0",
    reader: "canonical" as const,
    releaseSchemaVersion: 3,
  },
] as const);

export function resolveFashionStoreReader(input: {
  experienceSchemaVersion: number;
  packageVersion: string;
  releaseSchemaVersion: number;
}): "canonical" | "legacy" | undefined {
  return fashionStoreReaderCompatibilityMatrix.find(
    (entry) =>
      entry.experienceSchemaVersion === input.experienceSchemaVersion &&
      entry.packageVersion === input.packageVersion &&
      entry.releaseSchemaVersion === input.releaseSchemaVersion,
  )?.reader;
}

const exactPackageKey = (themePackage: ThemePackage): string =>
  `${themePackage.manifest.id}@${themePackage.manifest.themeVersion}/schema-${themePackage.manifest.configurationSchemaVersion}`;
const exactBoundaryKey = (
  boundary: (typeof fashionStoreDirectMigrationBoundaries)[number],
): string =>
  `${boundary.themeId}@${boundary.source.themeVersion}/schema-${boundary.source.configurationSchemaVersion}`;
const historicalKeys = [historicalV1Registration.package, legacyV11Registration.package]
  .map(exactPackageKey)
  .sort();
const mappedSourceKeys = fashionStoreDirectMigrationBoundaries.map(exactBoundaryKey).sort();
if (JSON.stringify(historicalKeys) !== JSON.stringify(mappedSourceKeys)) {
  throw new Error(
    "Every historical Fashion Store package must have one direct successor boundary.",
  );
}

export { fashionStoreThemeDescriptor };
