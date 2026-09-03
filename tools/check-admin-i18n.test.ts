import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { zhCNMessages } from "../apps/admin/src/shared/i18n/translations";
import {
  auditAdminI18n,
  checkMessages,
  isProductionSource,
  scanMessageCatalog,
  scanTranslationCalls,
} from "./check-admin-i18n";

describe("Admin translation coverage", () => {
  test("reports a missing key and its source instead of accepting English fallback", () => {
    expect(checkMessages([{ key: "New message", filePath: "page.tsx", line: 7 }], {})).toEqual([
      { key: "New message", filePath: "page.tsx", line: 7, type: "missing-key" },
    ]);
  });

  test("rejects missing and extra interpolation placeholders", () => {
    const uses = [{ key: "Hello {name}", filePath: "page.tsx", line: 3 }];
    for (const translation of ["你好", "你好 {name} {extra}"]) {
      expect(checkMessages(uses, { "Hello {name}": translation })[0]?.type).toBe(
        "placeholder-mismatch",
      );
    }
  });

  test("rejects empty translations but permits reordered placeholders and identical technical words", () => {
    const use = (key: string) => ({ key, filePath: "page.tsx", line: 1 });
    expect(checkMessages([use("Empty")], { Empty: "  " })[0]?.type).toBe("empty-translation");
    expect(
      checkMessages([use("UTC"), use("{first} then {second}")], {
        UTC: "UTC",
        "{first} then {second}": "{second}，{first}，{first}",
      }),
    ).toEqual([]);
  });

  test("finds hook aliases, translator aliases and static templates without confusing shadowed functions or comments", () => {
    const result = scanTranslationCalls(
      "page.tsx",
      `
      import { useI18n as useLanguage, useCurrentTranslate as useNow } from './shared/contexts/i18n-context'
      const Component = () => {
        const { t: translate } = useLanguage()
        const context = useLanguage()
        const alias = translate
        const now = useNow()
        translate('First'); alias(\`Template\`); now('Current'); context.t('Property')
        translate(dynamicKey); translate(\`Hello \${name}\`)
        const unrelated = (translate: (value: string) => string) => translate('Not a key')
        // translate('Comment is not a key')
      }
      const t = (value: string) => value
      t('Unrelated')
    `,
    );
    expect(result.messages.map(({ key }) => key)).toEqual([
      "First",
      "Template",
      "Current",
      "Property",
    ]);
    expect(result.unresolvedDynamic.map(({ expression }) => expression)).toEqual([
      "dynamicKey",
      "`Hello ${name}`",
    ]);
    expect(result.messages.every(({ line }) => line > 0)).toBe(true);
    expect(
      scanTranslationCalls(
        "other.ts",
        `import {useI18n} from 'unrelated'; const {t} = useI18n(); t('Ignore')`,
      ).messages,
    ).toEqual([]);
  });

  test("checks explicitly registered permission fields without treating permission keys as prose", () => {
    const uses = scanMessageCatalog(
      "permissions.ts",
      `const CATALOG = [{ category: 'catalog', key: 'catalog.read', label: 'View', description: 'New explanation' }]`,
      "CATALOG",
      ["category", "label", "description"],
    );
    expect(uses.map(({ key }) => key)).toEqual(["catalog", "View", "New explanation"]);
    expect(checkMessages(uses, { catalog: "目录", View: "查看" })).toEqual([
      { key: "New explanation", filePath: "permissions.ts", line: 1, type: "missing-key" },
    ]);
    expect(() => scanMessageCatalog("missing.ts", "const OTHER = {}", "CATALOG")).toThrow(
      "CATALOG",
    );
  });

  test("follows proven local translator arguments but does not assume every function parameter named t is a translator", () => {
    const result = scanTranslationCalls(
      "page.tsx",
      `
      import { useI18n } from './shared/contexts/i18n-context'
      const helper = (t: (message: string) => string) => t('Helper message')
      const ordinary = (t: (message: string) => string) => t('Not translated')
      const Component = () => { const {t} = useI18n(); return helper(t) }
    `,
    );
    expect(result.messages.map(({ key }) => key)).toEqual(["Helper message"]);
  });

  test("excludes tests, fixtures, declarations, helpers and unmounted scaffold pages, not shared production templates", () => {
    for (const file of [
      "src/test/helper.tsx",
      "src/fixtures/messages.ts",
      "src/page.test.tsx",
      "src/page.browser.test.tsx",
      "src/env.d.ts",
      "src/pages/templates/form/basic.tsx",
    ])
      expect(isProductionSource(file)).toBe(false);
    expect(isProductionSource("src/shared/template-kit/form.tsx")).toBe(true);
    expect(isProductionSource("src/pages/iam/users-page.tsx")).toBe(true);
  });

  test("covers every recognized production call and registered catalog with nonempty matching Chinese translations", () => {
    const audit = auditAdminI18n(fileURLToPath(new URL("..", import.meta.url)), zhCNMessages);
    expect(audit.messages.length).toBeGreaterThan(500);
    for (const key of [
      "{id} moved to position {position} of {count} on {pageType}.",
      "Unknown validation status ({code}).",
      "Unknown theme diagnostic. Review the technical code before continuing.",
      "{explanation} ({code})",
      "The exact draft package is not loaded.",
      "The catalog reference is missing from the selected Catalog Release.",
      "The target package removed a setting with local overrides.",
      "The private preview build failed. Review the build diagnostics and retry.",
    ]) {
      expect(audit.messages.some((message) => message.key === key)).toBe(true);
    }
    expect(audit.issues).toEqual([]);
    // Arbitrary dynamic calls remain visible as limitations, never counted as translated keys.
    expect(audit.unresolvedDynamic.some((entry) => entry.expression === "permission.label")).toBe(
      true,
    );
  });
});
