import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PreviewIntentRecorder,
  previewActionSchema,
  type PreviewAction,
} from "../app/theme-engine/actions";
import {
  experienceFixtureSchema,
  resolveFixtureBinding,
  resolveFixtureViewModel,
} from "../app/theme-engine/view-models";
import { coreBlockDefinitions, coreSectionDefinitions } from "../app/theme-engine/core-manifest";
import { experienceFixtureRegistry } from "../fixtures/experience";

describe("storefront experience fixtures", () => {
  test("validates representative fixtures for every page type and meaningful state", () => {
    const fixtures = Object.values(experienceFixtureRegistry).map((fixture) =>
      experienceFixtureSchema.parse(fixture),
    );
    const pageTypes = new Set(fixtures.flatMap(({ pageTypes }) => pageTypes));
    const states = new Set(
      fixtures.flatMap(({ viewModels }) => Object.values(viewModels).map(({ state }) => state)),
    );

    expect([...pageTypes].sort()).toEqual([
      "cart",
      "checkout",
      "collection",
      "home",
      "order",
      "policy",
      "product",
    ]);
    expect([...states].sort()).toEqual([
      "empty",
      "loading",
      "populated",
      "success",
      "unavailable",
      "validation-error",
    ]);
  });

  test("provides every required presentation surface with semantic content", () => {
    const kinds = new Set(
      Object.values(experienceFixtureRegistry).flatMap(({ viewModels }) =>
        Object.values(viewModels).map(({ kind }) => kind),
      ),
    );

    expect([...kinds].sort()).toEqual([
      "announcement",
      "cart",
      "checkout",
      "collection-grid",
      "editorial",
      "footer",
      "hero",
      "navigation",
      "order",
      "policy",
      "product",
      "product-grid",
      "promotion",
      "state",
      "trust-strip",
    ]);
  });

  test("resolves bindings by stable instance and fixture identifiers", () => {
    const binding = {
      fixtureId: "core-populated",
      id: "home-hero-binding",
      instanceId: "home-hero",
      kind: "fixture",
      resource: "home-hero",
      state: "populated",
    } as const;
    const viewModel = resolveFixtureViewModel(
      resolveFixtureBinding("home-hero", [binding]),
      experienceFixtureRegistry,
    );

    expect(viewModel.kind).toBe("hero");
    expect(viewModel.state).toBe("populated");
    expect(() => resolveFixtureBinding("missing", [binding])).toThrow("missing");
    expect(() => resolveFixtureBinding("home-hero", [binding, binding])).toThrow("ambiguous");
    expect(() =>
      resolveFixtureViewModel(
        {
          fixtureId: "core-populated",
          id: "missing-binding",
          instanceId: "home-hero",
          kind: "fixture",
          resource: "missing",
          state: "populated",
        },
        experienceFixtureRegistry,
      ),
    ).toThrow("missing");
  });

  test("defines required transaction, legal, focus, status, and error capabilities", () => {
    const capabilities = new Set(
      [...coreSectionDefinitions, ...coreBlockDefinitions].flatMap(
        ({ capabilities: values }) => values,
      ),
    );

    expect(capabilities).toEqual(
      new Set([
        "cart.error",
        "cart.summary",
        "checkout.error",
        "checkout.summary",
        "error.summary",
        "focus.skip-link",
        "legal.links",
        "navigation.primary",
        "order.error",
        "order.status",
        "policy.content",
        "product.action",
        "product.details",
        "status.feedback",
      ]),
    );
  });

  test("records only validated preview intents without invoking commerce", () => {
    const recorder = new PreviewIntentRecorder();
    const actions = [
      { id: "navigate", intent: "navigation", label: "View", target: "/collections/new" },
      { id: "variant", intent: "variant.select", label: "Small", value: "small" },
      { id: "add", intent: "cart.add-preview", label: "Add to preview bag" },
      { id: "quantity", intent: "cart.quantity-preview", label: "Increase", value: "2" },
      { id: "checkout", intent: "checkout.start-preview", label: "Preview checkout" },
    ] satisfies PreviewAction[];

    actions.forEach((action) => recorder.record(previewActionSchema.parse(action), "fixture-test"));

    expect(recorder.all().map(({ intent }) => intent)).toEqual([
      "navigation",
      "variant.select",
      "cart.add-preview",
      "cart.quantity-preview",
      "checkout.start-preview",
    ]);
    expect(recorder.all().every(({ recordedAt }) => recordedAt === null)).toBe(true);
  });

  test("keeps fixture presentation code free of network and live commerce imports", async () => {
    const roots = [
      resolve(import.meta.dir, "../app/components/sections"),
      resolve(import.meta.dir, "../app/components/blocks"),
      resolve(import.meta.dir, "../app/theme-engine/actions.ts"),
      resolve(import.meta.dir, "../fixtures/experience"),
    ];
    const sources: string[] = [];
    for (const root of roots) {
      if (root.endsWith(".ts")) {
        sources.push(await readFile(root, "utf8"));
        continue;
      }
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          sources.push(await readFile(resolve(entry.parentPath, entry.name), "utf8"));
        }
      }
    }
    const source = sources.join("\n");

    expect(source).not.toMatch(/\bfetch\s*\(|\$fetch|XMLHttpRequest|useCommerceApi|useGuestCart/);
    expect(source).not.toContain("@shoppp/db");
  });
});
