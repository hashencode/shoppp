import { catalogReleaseV3Schema, type EditorDocument, type ExperienceResourceBinding } from "@shoppp/contracts";
import fixture from "../../fixtures/release.json";
import { fashionStoreEditorPackage } from "../../app/themes/fashion-store/authoring/package";

export const editorRelease = catalogReleaseV3Schema.parse({
  ...fixture,
  site: { ...fixture.site, name: "Editor fixture store" },
  environment: "staging", purpose: "private-preview", schemaVersion: 3,
  commerce: { payment: { brands: ["visa"], enabled: true, provider: "stripe" }, shippingMethods: [] },
  identity: { id: "identity.primary", storefrontName: "Editor fixture store", tagline: "", version: 1, faviconAssetId: null, socialShareAssetId: null, logoAssets: [], seo: {} },
  content: [], navigation: [], routeOutput: fixture.routes,
  sourceVersionVector: [{ digest: "a".repeat(64), id: "identity.primary", kind: "store-identity", version: 1 }],
});

const templates = structuredClone(fashionStoreEditorPackage.presets[0]!.templates);
export const editorBindings: ExperienceResourceBinding[] = templates.flatMap(template => template.sections.flatMap(section => {
  const kind = template.pageType === "product" ? "product" : "collection";
  const id = kind === "product" ? editorRelease.products[0]!.id : editorRelease.collections[0]!.id;
  const settingId = template.pageType === "home" ? "featured-collection" : template.pageType === "collection" ? "default-collection" : "default-product";
  return ["home", "collection"].includes(template.pageType) ? [{ id: `binding-${section.id}`, kind: "catalog" as const, instanceId: section.id, settingId, reference: { kind, id } }] : [];
}));
export const editorDocument: EditorDocument = { templates, bindings: editorBindings };
export const editorContext = {
  id: "01a00000-0000-4000-8000-000000000001", nonce: "01a00000-0000-4000-8000-000000000002", expiresAt: "2099-01-01T00:00:00.000Z",
  package: fashionStoreEditorPackage, release: editorRelease,
  draft: { id: "draft-editor", name: "Autumn store", version: 1, presetId: "source-parity", configurationSchemaVersion: 4, themeId: "fashion-store", themeVersion: "1.3.0", bindings: editorBindings, overrides: [], validations: [], validation: null, experienceId: "storefront-editor", createdAt: "2026-10-31T00:00:00.000Z", updatedAt: "2026-10-31T00:00:00.000Z", createdBy: "fixture", updatedBy: "fixture" },
};
