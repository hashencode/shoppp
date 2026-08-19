import {
  fidelityStatesByRegionFromBehaviorContract,
  namedStatesFromBehaviorContract,
  type ThemeBehaviorContract,
} from "../../../e2e/support/theme-behavior-contract";
import { decorSourceContract, decorSourceRegions } from "./source-contract";

const decorRegionById = new Map(decorSourceRegions.map((region) => [region.id, region] as const));
function regionSelectors(id: (typeof decorSourceRegions)[number]["id"]): {
  implementation: string;
  source: string;
} {
  const region = decorRegionById.get(id);
  if (!region) throw new Error(`Missing Decor source region: ${id}`);
  return { implementation: region.selector, source: region.inventorySelector };
}
const heroSelectors = regionSelectors("hero");
const collectionSelectors = regionSelectors("collection");
const marqueeSelectors = regionSelectors("marquee");
const clientSelectors = regionSelectors("clients");
const scrollProgressSelectors = regionSelectors("scroll-progress");

export const decorBehaviorContract = {
  behaviors: [
    {
      actions: {
        implementation: { kind: "keyboard", selector: heroSelectors.implementation },
        source: { kind: "keyboard", selector: heroSelectors.source },
      },
      branches: [
        { id: "pointer", input: "mouse", outcome: "Previous and Next select one slide." },
        { id: "keyboard", input: "keyboard", outcome: "Arrow keys select one slide." },
        {
          id: "touch",
          input: "touch",
          outcome: `A ${decorSourceContract.hero.interaction.swipeThresholdPx}px swipe selects one slide.`,
        },
      ],
      disposition: { kind: "reproduced" },
      evidenceStates: [0, 1, 2].map((index) => ({
        fidelityState: `hero-slide-${index + 1}`,
        namedState: {
          action: { index, kind: "hero" as const },
          capture: "element" as const,
          id: `hero-slide-${index + 1}`,
          implementationSelector: heroSelectors.implementation,
          sourceSelector: heroSelectors.source,
        },
      })),
      fallback: {
        outcome: "One readable slide remains manually selectable without autoplay.",
        strategy: "reduced-motion",
      },
      id: "hero-carousel",
      initialState: "slide-1 timeline-running",
      modes: ["static", "temporal", "interaction", "fallback"],
      outcome: `The ${decorSourceContract.hero.transition.durationMs}ms cross-fade and complete ${decorSourceContract.hero.layerTimeline.durationMs}ms layer timeline run without overlapping input.`,
      owner: "source-runtime",
      region: "hero",
      role: "carousel",
      sourceCandidate: "#decor-store-slider, .tp-caption, .tp-parallax-wrap",
      sourceSelector: heroSelectors.source,
      triggers: ["load", "timer", "click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "observe", selector: "[data-source-reveal]" },
        source: { kind: "observe", selector: "[data-anime]" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "revealed" }],
      fallback: {
        outcome: "Every reveal target is immediately visible.",
        strategy: "reduced-motion",
      },
      id: "section-reveals",
      initialState: "pending until first viewport intersection",
      modes: ["temporal", "fallback"],
      outcome: "All twelve source reveal groups complete once and remain visible.",
      owner: "source-runtime",
      region: "categories",
      role: "state-control",
      sourceCandidate: "[data-anime]",
      sourceSelector: "[data-anime]",
      triggers: ["load", "scroll", "resize"],
    },
    {
      actions: {
        implementation: { kind: "wait", selector: `${marqueeSelectors.implementation}-track` },
        source: { kind: "wait", selector: ".swiper-wrapper" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "marquee-motion" }],
      fallback: {
        outcome: "The complete offer text remains readable without continuous motion.",
        strategy: "reduced-motion",
      },
      id: "marquee-motion",
      initialState: "cycle-start",
      modes: ["temporal", "fallback"],
      outcome: `The marquee completes one full horizontal cycle in ${decorSourceContract.marqueeMotion.durationMs}ms.`,
      owner: "source-runtime",
      region: "marquee",
      role: "continuous-motion",
      sourceCandidate: "[data-slider-options*='8000']",
      sourceSelector: "[data-slider-options*='8000']",
      triggers: ["load", "timer"],
    },
    {
      actions: {
        implementation: { kind: "click", selector: collectionSelectors.implementation },
        source: { kind: "click", selector: "[data-slider-options*='fade']" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [0, 1, 2].map((index) => ({
        fidelityState: `collection-slide-${index + 1}`,
        namedState: {
          action: { index, kind: "collection" as const },
          capture: "element" as const,
          id: `collection-slide-${index + 1}`,
          implementationSelector: collectionSelectors.implementation,
          sourceSelector: "section [data-slider-options*='fade']",
        },
      })),
      fallback: {
        outcome: "The first product remains readable and controls remain usable.",
        strategy: "reduced-motion",
      },
      id: "collection-carousel",
      initialState: "slide-1",
      modes: ["static", "temporal", "interaction", "fallback"],
      outcome: `Products autoplay every ${decorSourceContract.collection.interaction.autoplayDelayMs}ms with a ${decorSourceContract.collection.interaction.transitionDurationMs}ms fade and no hover pause.`,
      owner: "source-runtime",
      region: "collection",
      role: "carousel",
      sourceCandidate: "section [data-slider-options*='fade']",
      sourceSelector: "section [data-slider-options*='fade']",
      triggers: ["load", "timer", "click", "keyboard", "touch"],
    },
    {
      actions: {
        implementation: { kind: "wait", selector: `${clientSelectors.implementation}-track` },
        source: { kind: "wait", selector: ".clients-style-08 .swiper-wrapper" },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "client-motion" }],
      fallback: {
        outcome: "Client marks remain visible in a static row.",
        strategy: "reduced-motion",
      },
      id: "client-carousel",
      initialState: "track-start",
      modes: ["temporal", "fallback"],
      outcome: `The client strip advances continuously with a ${decorSourceContract.clientMotion.slideDurationMs}ms per-step duration.`,
      owner: "source-runtime",
      region: "clients",
      role: "continuous-motion",
      sourceCandidate: ".clients-style-08 [data-slider-options]",
      sourceSelector: ".clients-style-08 [data-slider-options]",
      triggers: ["load", "timer", "resize"],
    },
    {
      actions: {
        implementation: { kind: "scroll", selector: scrollProgressSelectors.implementation },
        source: { kind: "scroll", selector: scrollProgressSelectors.source },
      },
      branches: [],
      disposition: { kind: "reproduced" },
      evidenceStates: [{ fidelityState: "scroll-progress-visible" }],
      fallback: {
        outcome: "A native anchor still returns to the document start.",
        strategy: "native-control",
      },
      id: "scroll-progress",
      initialState: "hidden at document start",
      modes: ["scroll-fixed", "interaction", "fallback"],
      outcome: "Scrolling reveals the fixed control, updates progress, and returns to the top.",
      owner: "source-runtime",
      region: "scroll-progress",
      role: "fixed-control",
      sourceCandidate: scrollProgressSelectors.source,
      sourceSelector: scrollProgressSelectors.source,
      triggers: ["load", "scroll", "click"],
    },
  ],
  customAdapters: [],
  routeId: "decor-home",
  suppressions: [],
  themeId: "decor",
} as const satisfies ThemeBehaviorContract;

export const decorNamedStateContracts = namedStatesFromBehaviorContract(decorBehaviorContract);
export const decorFidelityStatesByRegion =
  fidelityStatesByRegionFromBehaviorContract(decorBehaviorContract);
