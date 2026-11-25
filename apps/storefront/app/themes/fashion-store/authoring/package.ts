import {
  themePackageSchema,
  type SectionDefinition,
  type StorefrontThemeDescriptor,
} from "@shoppp/contracts";
import { fashionStoreManifest } from "../successor/manifest";
import { fashionStorePreset } from "../successor/presets/source-parity";
import { fashionStoreUnifiedPreset } from "../successor/presets/unified-store";

// The 1.2.0 payload is left intact for exact historical reads.
const homeTypes = new Set(
  fashionStorePreset.templates
    .find(({ pageType }) => pageType === "home")!
    .sections.map(({ type }) => type),
);
const isShellSetting = (id: string) => /^(header-|footer-|identity-logo-|announcement)/.test(id);
const hero = fashionStorePreset.templates.find(({ pageType }) => pageType === "home")!.sections[0]!;
const shellSettings = fashionStoreManifest.componentRegistry.sections
  .find(({ type }) => type === "fashion-store.hero")!
  .settings.filter(({ id }) => isShellSetting(id));
const shell = {
  capabilities: [],
  settings: Object.fromEntries(Object.entries(hero.settings).filter(([id]) => isShellSetting(id))),
};
function withReferenceFields(section: SectionDefinition) {
  const settings = section.settings.filter(({ id }) => !isShellSetting(id));
  if (homeTypes.has(section.type)) {
    if (!settings.some(({ id }) => id === "featured-collection"))
      settings.push({
        id: "featured-collection",
        kind: "collection-reference",
        required: true,
        label: "Collection",
      });
    if (!settings.some(({ id }) => id === "featured-product"))
      settings.push({
        id: "featured-product",
        kind: "product-reference",
        required: false,
        label: "Featured product",
      });
  }
  return settings;
}
export const fashionStoreEditorPackage = themePackageSchema.parse({
  manifest: {
    ...structuredClone(fashionStoreManifest),
    themeVersion: "1.3.0",
    configurationSchemaVersion: 4,
    shellSettings: [
      ...shellSettings,
      { id: "header-menu", kind: "navigation-reference", required: false, label: "Header menu" },
      { id: "footer-menu", kind: "navigation-reference", required: false, label: "Footer menu" },
    ],
    shellCapabilities: [],
    componentRegistry: {
      ...structuredClone(fashionStoreManifest.componentRegistry),
      sections: fashionStoreManifest.componentRegistry.sections.map((section) => ({
        ...structuredClone(section),
        settings: withReferenceFields(section),
        ...(homeTypes.has(section.type)
          ? {
              authoring: {
                label: section.type.replace("fashion-store.", "").replaceAll("-", " "),
                maxInstances: section.type === "fashion-store.hero" ? 1 : 6,
                pageTypes: ["home"],
              },
            }
          : {}),
        ...(section.type === "fashion-store.products"
          ? {
              settings: [
                ...withReferenceFields(section),
                {
                  id: "product-layout",
                  kind: "select",
                  required: true,
                  default: "best-sellers",
                  label: "Product layout",
                  options: [
                    { label: "Best sellers", value: "best-sellers" },
                    { label: "Featured products", value: "featured-products" },
                  ],
                },
              ],
            }
          : {}),
      })),
    },
  },
  presets: [fashionStorePreset, fashionStoreUnifiedPreset].map((preset) => ({
    ...structuredClone(preset),
    templates: preset.templates.map((template) => ({
      ...structuredClone(template),
      shell: structuredClone(shell),
      sections: template.sections.map((section) => ({
        ...structuredClone(section),
        settings: Object.fromEntries(
          Object.entries(section.settings).filter(([id]) => !isShellSetting(id)),
        ),
        ...(section.type === "fashion-store.hero" ? { required: false } : {}),
        ...(section.type === "fashion-store.products"
          ? {
              settings: {
                ...Object.fromEntries(
                  Object.entries(section.settings).filter(([id]) => !isShellSetting(id)),
                ),
                "product-layout": section.id.includes("featured")
                  ? "featured-products"
                  : "best-sellers",
              },
            }
          : {}),
      })),
    })),
  })),
});

export const fashionStoreEditorDescriptor: StorefrontThemeDescriptor = {
  id: "fashion-store",
  themeVersion: "1.3.0",
  configurationSchemaVersion: 4,
  platformContractVersion: fashionStoreEditorPackage.manifest.platformContractVersion,
  platformCompatibility: fashionStoreEditorPackage.manifest.platformCompatibility,
  presets: fashionStoreEditorPackage.presets.map(({ id }) => id),
  supportedPageTemplates: fashionStoreEditorPackage.manifest.supportedPageTemplates,
};
