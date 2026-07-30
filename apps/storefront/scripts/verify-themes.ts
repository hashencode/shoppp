import {
  storefrontThemeDescriptorSchema,
  themePackageSchema,
  type StorefrontThemeDescriptor,
  type ThemePackage,
} from "@shoppp/contracts";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { storefrontThemeCatalog } from "../app/generated/theme-catalog";
import { decorManifest, decorThemeDescriptor } from "../app/themes/decor/manifest";
import { decorPreset } from "../app/themes/decor/presets/layered";
import { fashionManifest, fashionThemeDescriptor } from "../app/themes/fashion/manifest";
import { fashionPreset } from "../app/themes/fashion/presets/editorial";

export const STOREFRONT_PLATFORM_CONTRACT_VERSION = "1.0.0";
export const REQUIRED_STOREFRONT_PAGE_TYPES = [
  "home",
  "collection",
  "product",
  "cart",
  "checkout",
  "order",
  "policy",
] as const;

export type ThemeConfigurationMigration = {
  fromSchemaVersion: number;
  toSchemaVersion: number;
};

export type ThemeMatrixEntry = {
  descriptor: StorefrontThemeDescriptor;
  migrations: readonly ThemeConfigurationMigration[];
  package: ThemePackage;
};

export const storefrontThemeMatrix: readonly ThemeMatrixEntry[] = [
  {
    descriptor: decorThemeDescriptor,
    migrations: [],
    package: { manifest: decorManifest, presets: [decorPreset] },
  },
  {
    descriptor: fashionThemeDescriptor,
    migrations: [],
    package: { manifest: fashionManifest, presets: [fashionPreset] },
  },
];

export async function verifyThemeAssetSources(themeIds: readonly string[]): Promise<void> {
  const allowedImageExtensions = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);
  for (const themeId of themeIds) {
    const themeRoot = resolve(import.meta.dir, `../app/themes/${themeId}`);
    const [fonts, images, provenance] = await Promise.all([
      readdir(resolve(themeRoot, "assets/fonts")),
      readdir(resolve(themeRoot, "assets/images")),
      readFile(resolve(themeRoot, "UPSTREAM.md"), "utf8"),
    ]);
    assert(fonts.length > 0, `${themeId} does not contain a self-hosted font.`);
    assert(images.length > 0, `${themeId} does not contain reference images.`);
    for (const font of fonts) {
      assert(extname(font) === ".woff2", `${themeId} contains a non-WOFF2 font asset: ${font}.`);
      assert(
        provenance.includes(`assets/fonts/${font}`),
        `${themeId} font provenance is missing for ${font}.`,
      );
    }
    for (const image of images) {
      assert(
        allowedImageExtensions.has(extname(image).toLowerCase()),
        `${themeId} contains an unsupported image asset: ${image}.`,
      );
      assert(
        provenance.includes(`assets/images/${image}`),
        `${themeId} image provenance is missing for ${image}.`,
      );
    }
    assert(
      ![...fonts, ...images].some((file) => /\.(?:css|html?|js|mjs|php)$/i.test(file)),
      `${themeId} assets contain an executable upstream runtime.`,
    );
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function assertMigrations(entry: ThemeMatrixEntry): void {
  const target = entry.package.manifest.configurationSchemaVersion;
  const bySource = new Map<number, number>();
  for (const migration of entry.migrations) {
    assert(
      Number.isInteger(migration.fromSchemaVersion) &&
        migration.fromSchemaVersion > 0 &&
        migration.toSchemaVersion === migration.fromSchemaVersion + 1,
      `${entry.package.manifest.id} has a non-contiguous configuration migration.`,
    );
    assert(
      !bySource.has(migration.fromSchemaVersion),
      `${entry.package.manifest.id} has duplicate configuration migrations.`,
    );
    bySource.set(migration.fromSchemaVersion, migration.toSchemaVersion);
  }
  for (let version = 1; version < target; version += 1) {
    assert(
      bySource.get(version) === version + 1,
      `${entry.package.manifest.id} is missing configuration migration ${version} -> ${version + 1}.`,
    );
  }
  assert(
    [...bySource.keys()].every((version) => version < target),
    `${entry.package.manifest.id} declares a migration beyond its current schema.`,
  );
}

export function verifyThemeMatrix(
  entries: readonly ThemeMatrixEntry[],
  catalog: readonly StorefrontThemeDescriptor[],
): void {
  const identities = new Set<string>();
  const themeIds = new Set<string>();
  for (const entry of entries) {
    const parsedPackage = themePackageSchema.safeParse(entry.package);
    if (!parsedPackage.success) {
      throw new Error(
        `${entry.package.manifest.id} theme package is invalid: ${parsedPackage.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    const descriptor = storefrontThemeDescriptorSchema.parse(entry.descriptor);
    const { manifest, presets } = parsedPackage.data;
    const identity = `${manifest.id}@${manifest.themeVersion}`;
    assert(!themeIds.has(manifest.id), `Duplicate storefront theme ID: ${manifest.id}.`);
    assert(!identities.has(identity), `Duplicate storefront theme identity: ${identity}.`);
    themeIds.add(manifest.id);
    identities.add(identity);

    assert(
      compareVersions(STOREFRONT_PLATFORM_CONTRACT_VERSION, manifest.platformCompatibility.min) >=
        0 &&
        compareVersions(
          STOREFRONT_PLATFORM_CONTRACT_VERSION,
          manifest.platformCompatibility.maxExclusive,
        ) < 0,
      `${identity} does not support storefront platform ${STOREFRONT_PLATFORM_CONTRACT_VERSION}.`,
    );
    assert(
      !Object.values(manifest.provenance).some((value) => /pending|unknown/i.test(value)),
      `${identity} has incomplete provenance.`,
    );

    const supported = new Set(manifest.supportedPageTemplates);
    for (const pageType of REQUIRED_STOREFRONT_PAGE_TYPES) {
      assert(supported.has(pageType), `${identity} is missing required ${pageType} support.`);
    }
    for (const preset of presets) {
      const pageTypes = preset.templates.map(({ pageType }) => pageType);
      for (const pageType of REQUIRED_STOREFRONT_PAGE_TYPES) {
        assert(
          pageTypes.filter((candidate) => candidate === pageType).length === 1,
          `${identity} preset ${preset.id} must provide exactly one ${pageType} template.`,
        );
      }
    }

    const expectedDescriptor = {
      configurationSchemaVersion: manifest.configurationSchemaVersion,
      id: manifest.id,
      platformCompatibility: manifest.platformCompatibility,
      platformContractVersion: manifest.platformContractVersion,
      presets: presets.map(({ id }) => id),
      supportedPageTemplates: manifest.supportedPageTemplates,
      themeVersion: manifest.themeVersion,
    };
    assert(
      stable(descriptor) === stable(expectedDescriptor),
      `${identity} descriptor has drifted from its manifest or presets.`,
    );
    assertMigrations(entry);
  }

  const normalizedCatalog = [...catalog].sort((left, right) => left.id.localeCompare(right.id));
  const normalizedDescriptors = entries
    .map(({ descriptor }) => descriptor)
    .sort((left, right) => left.id.localeCompare(right.id));
  assert(
    stable(normalizedCatalog) === stable(normalizedDescriptors),
    "Generated storefront theme catalog has drifted from the verified theme matrix.",
  );
}

if (import.meta.main) {
  verifyThemeMatrix(storefrontThemeMatrix, storefrontThemeCatalog);
  await verifyThemeAssetSources(storefrontThemeMatrix.map(({ descriptor }) => descriptor.id));
  console.log(
    `Verified ${storefrontThemeMatrix.length} storefront themes against platform ${STOREFRONT_PLATFORM_CONTRACT_VERSION}.`,
  );
}
