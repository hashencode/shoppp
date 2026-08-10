import { describe, expect, test } from "bun:test";

import { fashionStoreSourceRegionOrder } from "../app/themes/fashion-store/source-contract";
import {
  fashionStoreBehaviorContract,
  fashionStoreFidelityStatesByRegion,
  fashionStoreNamedStateContracts,
} from "../app/themes/fashion-store/behavior-contract";
import {
  assertThemeBehaviorContractComplete,
  assertThemeBehaviorModeEvidenceComplete,
  type ThemeBehaviorContract,
} from "../e2e/support/theme-behavior-contract";
import { createThemeBehaviorDescriptor } from "../e2e/support/theme-behavior-descriptor";

const completeFixture = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "click", selector: "[data-search]" },
        source: { kind: "click", selector: ".header-search-form" },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "Search overlay is visible." },
        { id: "touch", input: "touch", outcome: "Search overlay is visible." },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [
        {
          fidelityState: "open",
          namedState: {
            action: { kind: "search" },
            capture: "viewport-top",
            id: "search-open",
            implementationSelector: ".search-form-wrapper",
            sourceSelector: ".search-form-wrapper",
          },
        },
      ],
      fallback: { outcome: "Search remains keyboard operable.", strategy: "native-control" },
      id: "header-search-overlay",
      initialState: "closed",
      modes: ["interaction", "fallback"],
      outcome: "Activating Search opens the overlay and focuses its input.",
      owner: "source-runtime",
      region: "header",
      role: "overlay-trigger",
      sourceCandidate: "a.header-search-form",
      sourceSelector: ".header-search-form",
      triggers: ["click", "keyboard", "touch"],
    },
  ],
  customAdapters: [],
  routeId: "fixture-home",
  suppressions: [],
  themeId: "fixture",
} as const satisfies ThemeBehaviorContract;

describe("theme behavior contract", () => {
  test("accepts the complete Fashion Store contract and derives both evidence surfaces", () => {
    expect(() =>
      assertThemeBehaviorContractComplete(
        fashionStoreBehaviorContract,
        fashionStoreSourceRegionOrder,
      ),
    ).not.toThrow();
    expect(fashionStoreNamedStateContracts.map(({ id }) => id)).toContain("search-open");
    expect(fashionStoreFidelityStatesByRegion.header).toContain("navigation-open");
  });

  test("accepts multiple trigger branches without duplicating behavior identity", () => {
    expect(() => assertThemeBehaviorContractComplete(completeFixture, ["header"])).not.toThrow();
    expect(
      createThemeBehaviorDescriptor({
        adapters: {},
        contract: completeFixture,
        sourceRegions: [{ id: "header", selector: "header" }],
      }).fidelityStatesByRegion.header,
    ).toEqual(["open"]);
  });

  test.each([
    ["owner", { owner: "" }, "owner is required"],
    ["trigger", { triggers: [] }, "at least one trigger is required"],
    ["initial state", { initialState: "" }, "initialState is required"],
    ["outcome", { outcome: "" }, "outcome is required"],
    ["fallback", { fallback: { outcome: "", strategy: "" } }, "fallback strategy is required"],
    ["mode", { modes: [] }, "at least one acceptance mode is required"],
    ["disposition", { disposition: { kind: "" } }, "disposition is required"],
  ])("rejects a missing %s", (_label, change, message) => {
    const behavior = { ...completeFixture.behaviors[0], ...change };
    const contract = { ...completeFixture, behaviors: [behavior] } as ThemeBehaviorContract;
    expect(() => assertThemeBehaviorContractComplete(contract, ["header"])).toThrow(message);
  });

  test("rejects duplicate IDs, unknown regions, and duplicate or orphaned evidence states", () => {
    const behavior = completeFixture.behaviors[0];
    const duplicate = {
      ...behavior,
      evidenceStates: [
        ...behavior.evidenceStates,
        { ...behavior.evidenceStates[0], fidelityState: "open-again" },
      ],
      region: "missing-region",
    };
    const contract = {
      ...completeFixture,
      behaviors: [behavior, duplicate],
    } as ThemeBehaviorContract;
    expect(() => assertThemeBehaviorContractComplete(contract, ["header"])).toThrow(
      /duplicate behavior ID.*unknown region.*duplicate named-state ID/s,
    );
  });

  test.each([
    ["approved adaptation", { kind: "approved-adaptation" }],
    ["explicit deferral", { kind: "explicitly-deferred" }],
  ])("requires a reason for an %s", (_label, disposition) => {
    const contract = {
      ...completeFixture,
      behaviors: [{ ...completeFixture.behaviors[0], disposition }],
    } as ThemeBehaviorContract;
    expect(() => assertThemeBehaviorContractComplete(contract, ["header"])).toThrow(
      "disposition reason is required",
    );
  });

  test("requires reasons for custom adapters and candidate suppressions", () => {
    const contract = {
      ...completeFixture,
      customAdapters: [{ id: "swiper", reason: "" }],
      suppressions: [{ candidate: ".ignored", reason: "" }],
    } as ThemeBehaviorContract;
    expect(() => assertThemeBehaviorContractComplete(contract, ["header"])).toThrow(
      /custom adapter reason is required.*suppression reason is required/s,
    );
  });

  test("rejects static-only, zero-motion, and non-monotonic evidence for dynamic modes", () => {
    expect(() =>
      assertThemeBehaviorModeEvidenceComplete(completeFixture, [
        { behaviorId: "header-search-overlay", mode: "static" },
      ]),
    ).toThrow(
      /not a declared acceptance mode|missing interaction evidence|missing fallback evidence/,
    );

    const temporalContract = {
      ...completeFixture,
      behaviors: [
        {
          ...completeFixture.behaviors[0],
          id: "moving",
          modes: ["temporal", "scroll-fixed"],
        },
      ],
    } as ThemeBehaviorContract;
    expect(() =>
      assertThemeBehaviorModeEvidenceComplete(temporalContract, [
        {
          behaviorId: "moving",
          mode: "temporal",
          temporalSamples: { after: 10, before: 10, elapsedMs: 1_000 },
        },
        { behaviorId: "moving", mode: "scroll-fixed", scrollSamples: [10, 5] },
      ]),
    ).toThrow(/distinct timed samples|monotonic progress samples/);
  });
});
