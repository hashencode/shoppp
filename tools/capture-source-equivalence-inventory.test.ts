import { describe, expect, test } from "bun:test";
import type { ThemeBehaviorContract } from "../apps/storefront/e2e/support/theme-behavior-contract";
import {
  assertThemeSourceInventoryCovered,
  compareThemeBehaviorCandidates,
  type ThemeSourceInventorySnapshot,
} from "../apps/storefront/e2e/support/theme-source-inventory";
import {
  assertThemeVisibleCopyEquivalent,
  compareThemeVisibleCopy,
} from "../apps/storefront/e2e/support/theme-source-contract";
import {
  assertAuthorizedSourceRoot,
  assertSourceInventoryEvidenceIdentity,
} from "./capture-source-equivalence-inventory";

const contract = {
  behaviors: [],
  customAdapters: [],
  routeId: "fixture-home",
  suppressions: [{ candidate: ".decorative", reason: "Static decoration has no behavior." }],
  themeId: "fixture",
} as const satisfies ThemeBehaviorContract;

const snapshot = (
  changes: Partial<ThemeSourceInventorySnapshot> = {},
): ThemeSourceInventorySnapshot => ({
  accessibilityCopy: [],
  candidates: [
    {
      behaviorIds: ["search"],
      fingerprint: "header:a:search",
      href: "#",
      region: "header",
      selector: ".header-search-form",
      signals: ["actionable"],
      suppressionCandidates: [],
      tag: "a",
      text: "Search",
    },
    {
      behaviorIds: [],
      fingerprint: "promo:div:decorative",
      href: null,
      region: "promo",
      selector: ".decorative",
      signals: ["loop"],
      suppressionCandidates: [".decorative"],
      tag: "div",
      text: "",
    },
  ],
  visibleCopy: [],
  ...changes,
});

describe("source equivalence inventory", () => {
  test("accepts candidates covered by behavior rows or reasoned suppressions", () => {
    expect(() => assertThemeSourceInventoryCovered(snapshot(), contract)).not.toThrow();
  });

  test("rejects unresolved candidates and stale suppressions", () => {
    const unresolved = snapshot();
    unresolved.candidates[0]!.behaviorIds = [];
    expect(() => assertThemeSourceInventoryCovered(unresolved, contract)).toThrow(
      /header.*unresolved candidate/,
    );

    expect(() =>
      assertThemeSourceInventoryCovered(
        snapshot({ candidates: snapshot().candidates.slice(0, 1) }),
        contract,
      ),
    ).toThrow(/stale suppression/);
  });

  test("separates removed, added, and rewritten visible copy", () => {
    const source = [
      { fingerprint: "hero:text:0", region: "hero", text: "New collection" },
      { fingerprint: "hero:text:1", region: "hero", text: "Shop now" },
    ];
    const implementation = [
      { fingerprint: "hero:text:0", region: "hero", text: "Approximate collection" },
      { fingerprint: "hero:text:2", region: "hero", text: "Product added" },
    ];
    expect(compareThemeVisibleCopy(source, implementation)).toEqual({
      changed: [
        {
          actual: "Approximate collection",
          expected: "New collection",
          fingerprint: "hero:text:0",
          region: "hero",
        },
      ],
      implementationOnly: [implementation[1]!],
      sourceOnly: [source[1]!],
    });
    expect(() => assertThemeVisibleCopyEquivalent(source, implementation)).toThrow(
      /source-only.*implementation-only.*changed/s,
    );
  });

  test("separates removed, added, and changed behavior candidates", () => {
    const source = snapshot().candidates;
    const changed = structuredClone(source[0]!);
    changed.signals = ["actionable", "sticky"];
    const added = {
      ...structuredClone(source[0]!),
      fingerprint: "footer:button:subscribe",
      region: "footer",
      text: "Subscribe",
    };
    expect(compareThemeBehaviorCandidates(source, [changed, added])).toEqual({
      changed: [
        {
          fingerprint: source[0]!.fingerprint,
          implementation: changed,
          source: source[0]!,
        },
      ],
      implementationOnly: [added],
      sourceOnly: [source[1]!],
    });
  });

  test("rejects evidence with the wrong source or implementation identity", () => {
    expect(() =>
      assertSourceInventoryEvidenceIdentity(
        {
          entry: "demo-fashion-store.html",
          entrySha256: "a".repeat(64),
          implementationRoute: "/alternate",
          implementationThemeRoot: "/themes/fashion-2",
          implementationUrl: "not-a-url",
          pageId: "alternate",
          sourceRevision: `sha256:${"b".repeat(64)}`,
          sourceRoot: "/implementation/upstream",
          themeId: "fashion-2",
        },
        {
          entry: "demo-fashion-store.html",
          entrySha256: "b".repeat(64),
          implementationRoute: "/",
          implementationThemeRoot: "/themes/fashion-store",
          pageId: "home",
          sourceRoot: "/templates/crafto/html",
          themeId: "fashion-store",
        },
      ),
    ).toThrow(/root.*digest.*page id.*route.*theme id.*theme root.*URL.*revision/s);
  });

  test("rejects a caller-selected copy of the authorized source tree", () => {
    expect(() =>
      assertAuthorizedSourceRoot("/tmp/copied-template", "/templates/crafto/html"),
    ).toThrow(/policy-authorized template root/);
    expect(() =>
      assertAuthorizedSourceRoot("/templates/crafto/html", "/templates/crafto/html"),
    ).not.toThrow();
  });
});
