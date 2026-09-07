import {
  themePackageMigrationBoundarySchema,
  themePackageRegistrationSchema,
  type ThemePackage,
} from "@shoppp/contracts";

import historicalV1PackagePayload from "./historical/1.0.0/theme-package.json";
import { fashionStoreManifest, fashionStoreThemeDescriptor } from "./successor/manifest";
import { fashionStoreFixtureBindingAliases } from "./successor/composition";
import { fashionStorePreset } from "./successor/presets/source-parity";
import { fashionStoreUnifiedPreset } from "./successor/presets/unified-store";

export const FASHION_STORE_HISTORICAL_V1_PACKAGE_SHA256 =
  "95bb721577646c46c460e8a98e1e15f4c5c6a53d723e05f9147b3a678b352120";

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
  successorRegistration,
] as const);
export const fashionStoreHistoricalPackages = deepFreeze([
  historicalV1Registration.package,
] as const);
export const fashionStoreSuccessorPackage = successorRegistration.package;

export function fashionStoreFixtureBindingAliasesForPackage(
  themePackage: ThemePackage,
): typeof fashionStoreFixtureBindingAliases | undefined {
  const manifest = themePackage.manifest;
  return manifest.id === fashionStoreSuccessorPackage.manifest.id &&
    manifest.themeVersion === fashionStoreSuccessorPackage.manifest.themeVersion &&
    manifest.configurationSchemaVersion ===
      fashionStoreSuccessorPackage.manifest.configurationSchemaVersion
    ? fashionStoreFixtureBindingAliases
    : undefined;
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
          fashionStoreSuccessorPackage.manifest.configurationSchemaVersion,
        themeVersion: fashionStoreSuccessorPackage.manifest.themeVersion,
      },
      themeId: fashionStoreSuccessorPackage.manifest.id,
    },
  ]),
);

const exactPackageKey = (themePackage: ThemePackage): string =>
  `${themePackage.manifest.id}@${themePackage.manifest.themeVersion}/schema-${themePackage.manifest.configurationSchemaVersion}`;
const exactBoundaryKey = (
  boundary: (typeof fashionStoreDirectMigrationBoundaries)[number],
): string =>
  `${boundary.themeId}@${boundary.source.themeVersion}/schema-${boundary.source.configurationSchemaVersion}`;
const historicalKeys = fashionStoreHistoricalPackages.map(exactPackageKey).sort();
const mappedSourceKeys = fashionStoreDirectMigrationBoundaries.map(exactBoundaryKey).sort();
if (JSON.stringify(historicalKeys) !== JSON.stringify(mappedSourceKeys)) {
  throw new Error(
    "Every historical Fashion Store package must have one direct successor boundary.",
  );
}
if (
  fashionStoreDirectMigrationBoundaries.some(
    ({ target, themeId }) =>
      themeId !== fashionStoreSuccessorPackage.manifest.id ||
      target.themeVersion !== fashionStoreSuccessorPackage.manifest.themeVersion ||
      target.configurationSchemaVersion !==
        fashionStoreSuccessorPackage.manifest.configurationSchemaVersion,
  )
) {
  throw new Error("Every Fashion Store source boundary must target the exact successor package.");
}

export { fashionStoreThemeDescriptor };
