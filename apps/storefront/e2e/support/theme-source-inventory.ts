import type { Page } from "@playwright/test";
import type { ThemeBehaviorContract } from "./theme-behavior-contract";
import type { ThemeVisibleCopyEntry } from "./theme-source-contract";

export interface ThemeInventoryRegion {
  id: string;
  selector: string;
}

export interface ThemeBehaviorCandidate {
  behaviorIds: string[];
  fingerprint: string;
  href: string | null;
  region: string;
  selector: string;
  signals: string[];
  suppressionCandidates: string[];
  tag: string;
  text: string;
}

export interface ThemeSourceInventorySnapshot {
  accessibilityCopy: ThemeVisibleCopyEntry[];
  candidates: ThemeBehaviorCandidate[];
  visibleCopy: ThemeVisibleCopyEntry[];
}

export function assertThemeSourceInventoryCovered(
  snapshot: ThemeSourceInventorySnapshot,
  contract: ThemeBehaviorContract,
): void {
  const issues: string[] = [];
  for (const candidate of snapshot.candidates) {
    if (candidate.behaviorIds.length === 0 && candidate.suppressionCandidates.length === 0) {
      issues.push(
        `${candidate.region}/${candidate.fingerprint}: unresolved candidate (${candidate.signals.join(", ")})`,
      );
    }
  }
  for (const suppression of contract.suppressions) {
    if (
      !snapshot.candidates.some(({ suppressionCandidates }) =>
        suppressionCandidates.includes(suppression.candidate),
      )
    )
      issues.push(`${suppression.candidate}: stale suppression matches no current candidate`);
  }
  if (issues.length > 0) throw new Error(`Source inventory coverage failed:\n${issues.join("\n")}`);
}

export async function captureThemeSourceInventory(options: {
  contract: ThemeBehaviorContract;
  page: Page;
  regions: readonly ThemeInventoryRegion[];
  side: "implementation" | "source";
}): Promise<ThemeSourceInventorySnapshot> {
  const behaviorSelectors = options.contract.behaviors.map((behavior) => ({
    id: behavior.id,
    selector:
      options.side === "source"
        ? behavior.sourceCandidate
        : behavior.actions.implementation.selector,
  }));
  return options.page.evaluate(
    ({ behaviorSelectors, regions, suppressions }) => {
      const normalize = (value: string) => value.replaceAll(/\s+/g, " ").trim();
      const visible = (element: Element) => {
        if (element.closest(".swiper-slide:not(.swiper-slide-duplicate)")) return true;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        let ancestor = element.parentElement;
        while (ancestor && ancestor !== document.body) {
          if (!ancestor.classList.contains("swiper-slide")) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (
              ancestorStyle.display === "none" ||
              ancestorStyle.visibility === "hidden" ||
              Number(ancestorStyle.opacity || "1") <= 0
            )
              return false;
          }
          ancestor = ancestor.parentElement;
        }
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const regionFor = (element: Element) =>
        regions.find(({ selector }) => element.closest(selector))?.id ?? "document";
      const stableSelector = (element: Element) => {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const classes = [...element.classList]
          .filter(
            (name) =>
              !/^(active|open|show|visible|swiper-slide-(active|next|prev|duplicate))$/.test(name),
          )
          .slice(0, 3)
          .map((name) => `.${CSS.escape(name)}`)
          .join("");
        return `${element.tagName.toLowerCase()}${classes}`;
      };
      const fingerprint = (element: Element, region: string) => {
        const semantic =
          normalize(element.getAttribute("aria-label") ?? "") ||
          normalize(element.getAttribute("title") ?? "") ||
          normalize(element.textContent ?? "").slice(0, 80) ||
          element.getAttribute("href") ||
          stableSelector(element);
        return `${region}:${element.tagName.toLowerCase()}:${semantic.toLowerCase()}`;
      };
      const matchesSelector = (element: Element, selector: string) => {
        try {
          return element.matches(selector);
        } catch {
          return false;
        }
      };
      const candidateSelector = [
        ...new Set([
          ...behaviorSelectors.map(({ selector }) => selector),
          "a[href]",
          "button:not([data-accept-btn]):not([data-reject-btn])",
          "input:not([type=hidden])",
          "select",
          "textarea",
          "[role=button]",
          "[aria-controls]",
          "[data-bs-toggle]",
          "[tabindex]:not([tabindex='-1'])",
          ".swiper[data-slider-options]",
          ".sticky-wrap",
          ".scroll-progress",
        ]),
      ].join(",");
      const candidateMap = new Map<string, ThemeBehaviorCandidate>();
      for (const element of document.querySelectorAll(candidateSelector)) {
        if (element.closest(".swiper-slide-duplicate")) continue;
        const region = regionFor(element);
        const id = fingerprint(element, region);
        const style = getComputedStyle(element);
        const sliderOptions = element.getAttribute("data-slider-options") ?? "";
        const signals = [
          ...(sliderOptions.includes("autoplay") ? ["autoplay"] : []),
          ...(sliderOptions.includes("loop") ? ["loop"] : []),
          ...(style.position === "fixed" || style.position === "sticky" ? [style.position] : []),
          ...(element.matches("a,button,input,select,textarea,[role=button],[tabindex]")
            ? ["actionable"]
            : []),
          ...(element.classList.contains("scroll-progress") ? ["scroll-linked"] : []),
          ...(element.classList.contains("sticky-wrap") ? ["sticky-rail"] : []),
        ];
        const current = candidateMap.get(id);
        const behaviorIds = behaviorSelectors
          .filter(({ selector }) => matchesSelector(element, selector))
          .map(({ id: behaviorId }) => behaviorId);
        const suppressionCandidates = suppressions.filter((selector) =>
          matchesSelector(element, selector),
        );
        if (current) {
          current.behaviorIds = [...new Set([...current.behaviorIds, ...behaviorIds])];
          current.signals = [...new Set([...current.signals, ...signals])];
          current.suppressionCandidates = [
            ...new Set([...current.suppressionCandidates, ...suppressionCandidates]),
          ];
          continue;
        }
        candidateMap.set(id, {
          behaviorIds,
          fingerprint: id,
          href:
            element instanceof HTMLAnchorElement ? new URL(element.href, location.href).href : null,
          region,
          selector: stableSelector(element),
          signals,
          suppressionCandidates,
          tag: element.tagName.toLowerCase(),
          text: normalize(element.textContent ?? ""),
        });
      }

      const visibleCopy: ThemeVisibleCopyEntry[] = [];
      const accessibilityCopy: ThemeVisibleCopyEntry[] = [];
      const visibleRegionCounters = new Map<string, number>();
      const accessibilityRegionCounters = new Map<string, number>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        const text = normalize(node.textContent ?? "");
        if (
          parent &&
          text &&
          !parent.closest("script,style,noscript,.swiper-slide-duplicate") &&
          visible(parent)
        ) {
          const region = regionFor(parent);
          const accessibilityOnly = Boolean(
            parent.closest(
              ".visually-hidden,.sr-only,.screen-reader-text,.skip-link,[data-accessibility-only]",
            ),
          );
          const counters = accessibilityOnly ? accessibilityRegionCounters : visibleRegionCounters;
          const index = counters.get(region) ?? 0;
          counters.set(region, index + 1);
          const entry = { fingerprint: `${region}:text:${index}`, region, text };
          if (accessibilityOnly) accessibilityCopy.push(entry);
          else visibleCopy.push(entry);
        }
        node = walker.nextNode();
      }
      return {
        accessibilityCopy,
        candidates: [...candidateMap.values()].sort((left, right) =>
          left.fingerprint.localeCompare(right.fingerprint),
        ),
        visibleCopy,
      };
    },
    {
      behaviorSelectors,
      regions: options.regions,
      suppressions: options.contract.suppressions.map(({ candidate }) => candidate),
    },
  );
}
