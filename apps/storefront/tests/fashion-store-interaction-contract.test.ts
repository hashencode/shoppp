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

  test("publishes static reduced-motion outcomes for temporal behavior", () => {
    const expected = new Map([
      [
        "hero-carousel",
        {
          count: 3,
          outcome:
            "The complete first slide remains readable when motion is reduced or startup fails.",
        },
      ],
      [
        "promotional-marquee",
        { count: 1, outcome: "All promotional copy remains visible without animation." },
      ],
      [
        "about-carousel-motion",
        {
          count: 1,
          outcome: "All six source images remain visible and ordered with motion disabled.",
        },
      ],
      [
        "product-gallery",
        { count: 1, outcome: "Every source image remains readable in thumbnail order." },
      ],
      [
        "shop-new-arrivals",
        { count: 2, outcome: "Both source arrival groups remain readable in DOM order." },
      ],
    ]);

    for (const [behaviorId, contract] of expected) {
      const rows = fashionStoreInteractionContract.filter(
        (interaction) => interaction.behaviorId === behaviorId,
      );
      expect(rows).toHaveLength(contract.count);
      expect(rows.map(({ inputOutcomes }) => inputOutcomes.reducedMotion)).toEqual(
        Array.from({ length: contract.count }, () => contract.outcome),
      );
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

  test("owns every retained Home merchandising control through mutually exclusive families", () => {
    const homeRows = fashionStoreInteractionContract.filter(
      ({ routeId }) => routeId === "fashion-store-home",
    );
    const merchandisingRows = homeRows.filter(({ candidate }) =>
      candidate.includes("[data-home-section='product-merchandising']"),
    );

    expect(
      merchandisingRows.map(({ behaviorId, disposition, role }) => ({
        behaviorId,
        disposition,
        role,
      })),
    ).toEqual([
      {
        behaviorId: "merchandising-selector-tabs",
        disposition: { control: "merchandising-product-group", kind: "local-state" },
        role: "local-state",
      },
      {
        behaviorId: "home-merchandising-product-actions",
        disposition: {
          idSources: ["productId", "variantId"],
          intent: "cart.add",
          kind: "commerce-intent",
        },
        role: "commerce",
      },
      {
        behaviorId: "home-merchandising-product-actions",
        disposition: {
          kind: "unavailable",
          reason: "Wishlist persistence is not available in the Home merchandising fixture.",
        },
        role: "unavailable",
      },
      {
        behaviorId: "home-merchandising-product-actions",
        disposition: {
          kind: "unavailable",
          reason: "Product quick-view content is not available in the Home merchandising fixture.",
        },
        role: "unavailable",
      },
      {
        behaviorId: "new-arrival-collection-carousel",
        disposition: { control: "new-arrival-carousel-previous", kind: "local-state" },
        role: "local-state",
      },
      {
        behaviorId: "new-arrival-collection-carousel",
        disposition: { control: "new-arrival-carousel-next", kind: "local-state" },
        role: "local-state",
      },
    ]);
    expect(
      merchandisingRows.map(({ inputOutcomes }) => ({
        noJs: inputOutcomes.noJs,
        reducedMotion: inputOutcomes.reducedMotion,
      })),
    ).toEqual([
      {
        noJs: "The initial best-sellers product group remains readable without JavaScript.",
        reducedMotion: "Selecting a merchandising tab displays exactly its local product group.",
      },
      {
        noJs: "Product details remain readable without JavaScript; no cart mutation is claimed.",
        reducedMotion: "The selected product is added once to the shared preview cart.",
      },
      {
        noJs: "Product details remain readable without JavaScript.",
        reducedMotion:
          "The unavailable wishlist utility issues no persistence request or success claim.",
      },
      {
        noJs: "The retained product link remains available without JavaScript.",
        reducedMotion:
          "The unavailable quick-view utility opens no modal and makes no navigation claim.",
      },
      {
        noJs: "The current collection item remains readable without JavaScript.",
        reducedMotion:
          "The previous collection item becomes visible immediately while autoplay remains paused.",
      },
      {
        noJs: "The current collection item remains readable without JavaScript.",
        reducedMotion:
          "The next collection item becomes visible immediately while autoplay remains paused.",
      },
    ]);

    const candidates = merchandisingRows.map(({ candidate }) => candidate);
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates.every((candidate) => !candidate.endsWith(" button"))).toBe(true);
    expect(candidates.filter((candidate) => candidate.includes("[data-card-action=")).length).toBe(
      3,
    );
    expect(candidates.every((candidate) => !candidate.includes("data-product-presentation"))).toBe(
      true,
    );
    expect(
      candidates
        .filter((candidate) => candidate.includes("[data-card-action="))
        .every((candidate) => candidate.includes("[data-product-surface='home-merchandising']")),
    ).toBe(true);
    expect(
      merchandisingRows.find(
        ({ disposition }) =>
          disposition.kind === "unavailable" && disposition.reason.includes("quick-view"),
      )?.candidate,
    ).toContain("button[data-card-action='quick-view']");

    const homeBehavior = fashionStorePageBehaviorContracts
      .flatMap(({ behaviors }) => behaviors)
      .find(({ id }) => id === "home-merchandising-product-actions");
    const legacyBehavior = fashionStorePageBehaviorContracts
      .flatMap(({ behaviors }) => behaviors)
      .find(({ id }) => id === "product-card-actions");
    expect(homeBehavior?.sourceSelector).toBe(".tab-style-04 .shop-boxed");
    expect(homeBehavior?.disposition.kind).toBe("approved-adaptation");
    expect(legacyBehavior?.sourceSelector).toBe(".shop-modern .grid-item .shop-image");
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
    ];

    for (const relativePath of sharedCardConsumers) {
      const source = readFileSync(join(componentsRoot, relativePath), "utf8");
      expect(source, relativePath).toContain("FashionStoreProductCard");
    }
  });
});
