import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { storefrontInteractionContractRowSchema } from "@shoppp/contracts";

import { fashionStorePageBehaviorContracts } from "../app/themes/fashion-store/behavior-contract";
import { fashionStoreDestinations } from "../app/themes/fashion-store/destinations";
import {
  assertFashionStoreInteractionContractComplete,
  assertFashionStoreRenderedInteractionCoverage,
  fashionStoreInteractionContract,
} from "../app/themes/fashion-store/interaction-contract";

const componentsRoot = fileURLToPath(
  new URL("../app/themes/fashion-store/components/", import.meta.url),
);

function componentSources(directory = componentsRoot): Array<{ path: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentSources(path);
    return entry.name.endsWith(".vue") ? [{ path, source: readFileSync(path, "utf8") }] : [];
  });
}

describe("Fashion Store semantic interaction contract", () => {
  test("maps every source-parity behavior row to one or more non-overlapping semantic rows", () => {
    expect(() =>
      assertFashionStoreInteractionContractComplete(
        fashionStoreInteractionContract,
        fashionStorePageBehaviorContracts,
      ),
    ).not.toThrow();

    const behaviorKeys = fashionStorePageBehaviorContracts.flatMap((contract) =>
      contract.behaviors.map((behavior) => `${contract.routeId}:${behavior.id}`),
    );
    const interactionKeys = fashionStoreInteractionContract.map(
      ({ behaviorId, routeId }) => `${routeId}:${behaviorId}`,
    );
    for (const key of behaviorKeys) {
      expect(interactionKeys.filter((candidate) => candidate === key).length).toBeGreaterThan(0);
    }
    expect(new Set(fashionStoreInteractionContract.map(({ id }) => id)).size).toBe(
      fashionStoreInteractionContract.length,
    );
    expect(
      new Set(
        fashionStoreInteractionContract.map(({ candidate, routeId }) => `${routeId}:${candidate}`),
      ).size,
    ).toBe(fashionStoreInteractionContract.length);
  });

  test("requires observable outcomes, all fallback modes, and named evidence", () => {
    for (const interaction of fashionStoreInteractionContract) {
      expect(storefrontInteractionContractRowSchema.parse(interaction)).toEqual(interaction);
      expect(interaction.inputModes).toEqual(
        expect.arrayContaining(["pointer", "keyboard", "touch", "reduced-motion", "no-js"]),
      );
      expect(interaction.breakpoints.length).toBeGreaterThan(0);
      expect(interaction.evidence.length).toBeGreaterThan(0);
      expect(Object.values(interaction.inputOutcomes).every(Boolean)).toBe(true);
      expect(interaction.outcome.length).toBeGreaterThan(0);
      expect(interaction.fallback.length).toBeGreaterThan(0);
    }
  });

  test("rejects rendered candidates without exactly one known semantic row", () => {
    expect(() =>
      assertFashionStoreRenderedInteractionCoverage(
        [
          { candidate: "button#missing", interactionIds: [], routeId: "fashion-store-home" },
          {
            candidate: "a#duplicate",
            interactionIds: [
              fashionStoreInteractionContract[0]!.id,
              fashionStoreInteractionContract[1]!.id,
            ],
            routeId: "fashion-store-home",
          },
        ],
        fashionStoreInteractionContract,
      ),
    ).toThrow("exactly one");
    expect(() =>
      assertFashionStoreRenderedInteractionCoverage(
        [
          {
            candidate: "a#unknown",
            interactionIds: ["missing-row"],
            routeId: "fashion-store-home",
          },
        ],
        fashionStoreInteractionContract,
      ),
    ).toThrow("unknown rows");
  });

  test("keeps choose-options navigation distinct from direct cart mutation", () => {
    const productCardRows = fashionStoreInteractionContract.filter(({ candidate }) =>
      candidate.includes(".shop-modern .grid-item"),
    );
    const cartRows = productCardRows.filter(
      ({ disposition }) =>
        disposition.kind === "commerce-intent" && disposition.intent === "cart.add",
    );
    const chooseOptionsRows = productCardRows.filter(
      ({ candidate, disposition }) =>
        candidate.includes("a.add-to-cart[data-fashion-store-route]") &&
        disposition.kind === "internal-navigation" &&
        disposition.target.kind === "resource" &&
        disposition.target.resourceKind === "product",
    );

    expect(cartRows.length).toBeGreaterThan(0);
    expect(cartRows.every(({ candidate }) => candidate.includes("button.add-to-cart"))).toBe(true);
    expect(chooseOptionsRows.length).toBeGreaterThan(0);
  });

  test("rejects bare fragments, insecure external targets, and incomplete Commerce payloads", () => {
    const base = {
      behaviorId: "example",
      breakpoints: ["all"],
      candidate: "a",
      evidence: ["example-outcome"],
      fallback: "The control remains truthful.",
      id: "example",
      inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
      inputOutcomes: {
        keyboard: "Keyboard outcome.",
        noJs: "No-JavaScript outcome.",
        pointer: "Pointer outcome.",
        reducedMotion: "Reduced-motion outcome.",
        touch: "Touch outcome.",
      },
      outcome: "The requested outcome is observable.",
      owner: "theme",
      parity: ["structural", "behavioral", "absence"],
      role: "navigation",
      routeId: "fashion-store-home",
    } as const;

    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: { kind: "internal-navigation", target: { kind: "fragment", target: "#" } },
      }),
    ).toThrow();
    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: {
          kind: "internal-navigation",
          target: {
            idSource: "productId",
            kind: "resource",
            resourceKind: "product",
            routeFamily: "catalog-collection",
          },
        },
      }),
    ).toThrow();
    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: { kind: "internal-navigation", target: { kind: "route", path: "/shop" } },
        role: "local-state",
      }),
    ).toThrow();
    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: { kind: "internal-navigation", target: { kind: "route", path: "/shop" } },
        inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "pointer"],
      }),
    ).toThrow();
    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: {
          kind: "external-navigation",
          target: { kind: "external", url: "http://example.com" },
        },
      }),
    ).toThrow();
    expect(() =>
      storefrontInteractionContractRowSchema.parse({
        ...base,
        disposition: { idSources: [], intent: "cart.add", kind: "commerce-intent" },
      }),
    ).toThrow();
  });

  test("preserves named fragments and platform contact destinations as distinct types", () => {
    const rows = fashionStoreInteractionContract.flatMap(({ disposition }) => [disposition]);
    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: "internal-navigation",
        target: { kind: "fragment", target: "#comments" },
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: "contact-navigation",
        target: { kind: "contact", uri: fashionStoreDestinations.supportEmail },
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        kind: "contact-navigation",
        target: { kind: "contact", uri: fashionStoreDestinations.phone },
      }),
    );
    expect(rows).toContainEqual({
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.facebook },
    });
  });

  test("rejects literal placeholder controls and Shell-global route interception", () => {
    for (const { path, source } of componentSources()) {
      expect(source, path).not.toMatch(/href="#"/);
      expect(source, path).not.toMatch(/@click\.prevent(?:\s|>)/);
    }

    const home = readFileSync(join(componentsRoot, "FashionStoreHome.vue"), "utf8");
    expect(home).not.toMatch(/href="\/"/);

    const shell = readFileSync(join(componentsRoot, "shared/FashionStoreShell.vue"), "utf8");
    expect(shell).not.toContain("handleInternalNavigation");
    expect(shell).not.toContain('document.addEventListener("click"');
  });

  test("keeps every remaining product merchandising surface on the shared card", () => {
    const sharedCardConsumers = [
      "FashionStoreLiveHomePage.vue",
      "pages/FashionStoreProductPage.vue",
      "pages/FashionStoreShopPage.vue",
      "pages/FashionStoreWishlistPage.vue",
      "shared/FashionStoreLiveCatalog.vue",
    ];

    for (const relativePath of sharedCardConsumers) {
      const source = readFileSync(join(componentsRoot, relativePath), "utf8");
      expect(source, relativePath).toContain("FashionStoreProductCard");
    }
  });
});
