import { describe, expect, test } from "bun:test";
import { themePackageSchema } from "@shoppp/contracts";
import { composeEditorExperienceRoute } from "../app/theme-engine/composer";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreSectionComposition } from "../app/themes/fashion-store/successor/composition";
import { fashionStoreEditorPackage } from "../app/themes/fashion-store/authoring/package";
import { editorDocument, editorRelease } from "./fixtures/editor-context";
import { themeStyleCss } from "../app/theme-engine/styles";
import { fashionStoreSuccessorPackage } from '../app/themes/fashion-store/package-registry';

function compose(document = editorDocument) {
  return composeEditorExperienceRoute({
    experience: { bindings: document.bindings, resolvedTemplates: document.templates, themeId: "fashion-store", themeVersion: "1.3.0", configurationSchemaVersion: 4 },
    release: editorRelease, route: { id: "home", pageType: "home", path: "/", variant: "home" }, path: "/", locale: "en",
    adapter: fashionStoreCompositionAdapter, sectionComposition: fashionStoreSectionComposition,
  });
}
describe("transient visual editor composition", () => {
  test('keeps the old asset reader while bounding new visual authoring to declared Theme assets', () => {
    const legacy = structuredClone(fashionStoreSuccessorPackage);
    const current = structuredClone(fashionStoreEditorPackage);
    for (const theme of [legacy, current]) {
      const block = theme.presets[0]!.templates[0]!.sections[0]!.blocks[0]!;
      block.settings['product-image'] = { kind: 'theme', path: 'assets/custom-valid-path.webp', alt: 'Historical media', width: 900, height: 900 };
    }
    expect(themePackageSchema.safeParse(legacy).success).toBe(true);
    expect(themePackageSchema.safeParse(current).success).toBe(false);
  });
  test("uses the canonical renderer projection without forging an approved Snapshot", () => {
    const result = compose();
    expect(result.diagnostics).toEqual([]);
    expect(result.shell?.siteName).toBe("Editor fixture store");
    expect(result.viewModels[editorDocument.templates[0]!.sections[0]!.id]).toBeDefined();
  });
  test("keeps the shared shell after removing Hero and gives a new section its own binding", () => {
    const document = structuredClone(editorDocument);
    const home = document.templates[0]!;
    home.sections = home.sections.filter(({ type }) => type !== "fashion-store.hero");
    const products = structuredClone(home.sections.find(({ type }) => type === "fashion-store.products")!);
    products.id = "new-products";
    home.sections.push(products);
    document.bindings.push({ id: "new-products-binding", instanceId: "new-products", kind: "catalog", settingId: "featured-collection", reference: { id: editorRelease.collections[0]!.id, kind: "collection" } });
    expect(compose(document).diagnostics).toEqual([]);
    expect(compose(document).shell?.siteName).toBe("Editor fixture store");
    expect(compose(document).viewModels["new-products"]).toBeDefined();
    expect(themePackageSchema.safeParse({ ...fashionStoreEditorPackage, presets: [{ ...fashionStoreEditorPackage.presets[0], templates: document.templates }] }).success).toBe(true);
  });
  test("applies bounded styles while leaving default parity untouched", () => {
    expect(themeStyleCss(undefined)).toBe("");
    const css = themeStyleCss({ accent: "#123456", font: "outfit", spacing: 24, buttonRadius: 12 });
    expect(css).toContain("--base-color:#123456");
    expect(css).toContain(".site-shell>*+*{margin-top:24px");
    expect(css).toContain("border-radius:12px");
    expect(css).toContain('h1{font-family:"Outfit", sans-serif!important}');
  });
});
