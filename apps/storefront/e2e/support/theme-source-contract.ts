import type { Page } from "@playwright/test";

export interface SourceContractProbe {
  assetMetadata?: boolean;
  content?: boolean;
  geometry?: boolean;
  id: string;
  pseudoStyles?: {
    after?: readonly string[];
    before?: readonly string[];
  };
  selector: string;
  styles?: readonly string[];
  textLayout?: boolean;
}

export interface SourceContractAssetMeasurement {
  currentSrc: string | null;
  dataAt2x: string | null;
  devicePixelRatio: number;
  naturalHeight: number;
  naturalWidth: number;
  renderedHeight: number;
  renderedWidth: number;
  srcset: string | null;
}

export interface SourceContractTextLayoutMeasurement {
  clientHeight: number;
  clientWidth: number;
  lineCount: number;
  overflowsX: boolean;
  overflowsY: boolean;
  scrollHeight: number;
  scrollWidth: number;
}

export interface SourceContractMeasurement {
  count: number;
  content: boolean;
  geometry: boolean;
  elements: Array<{
    asset: string | null;
    assetMetadata?: SourceContractAssetMeasurement;
    href: string | null;
    layout?: SourceContractTextLayoutMeasurement;
    pseudoStyles?: {
      after: Record<string, string>;
      before: Record<string, string>;
    };
    rect: {
      bottom: number;
      height: number;
      left: number;
      right: number;
      top: number;
      width: number;
    };
    styles: Record<string, string>;
    text: string;
    visible: boolean;
  }>;
  id: string;
}

export interface SourceContractSnapshot {
  devicePixelRatio?: number;
  documentHeight: number;
  probes: SourceContractMeasurement[];
  viewport: { height: number; width: number };
}

export interface SourceContractTolerance {
  fullPageHeightRatio: number;
  geometryPx: number;
  numericStylePx: number;
  styleEquivalences: Readonly<
    Record<string, readonly { implementation: string; reference: string }[]>
  >;
}

const defaultTolerance: SourceContractTolerance = {
  fullPageHeightRatio: 0.005,
  geometryPx: 2,
  numericStylePx: 0.5,
  styleEquivalences: {},
};

function normalizedText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function equivalentComputedStyle(property: string, expected: string, actual: string): boolean {
  if (property !== "transform") return expected === actual;
  const identityTransforms = new Set([
    "none",
    "matrix(1, 0, 0, 1, 0, 0)",
    "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)",
  ]);
  return identityTransforms.has(expected) && identityTransforms.has(actual);
}

export async function captureSourceContract(
  page: Page,
  probes: readonly SourceContractProbe[],
): Promise<SourceContractSnapshot> {
  return page.evaluate((contractProbes) => {
    const text = (value: string) => value.replaceAll(/\s+/g, " ").trim();
    const assetName = (element: Element): string | null => {
      if (!(element instanceof HTMLImageElement)) return null;
      const source = element.currentSrc || element.src;
      if (!source) return null;
      const url = new URL(source, location.href);
      return url.pathname.split("/").pop() ?? null;
    };
    const assetMetadata = (element: Element): SourceContractAssetMeasurement | undefined => {
      if (!(element instanceof HTMLImageElement)) return undefined;
      const rect = element.getBoundingClientRect();
      const source = element.currentSrc || element.src;
      return {
        currentSrc: source
          ? (new URL(source, location.href).pathname.split("/").pop() ?? null)
          : null,
        dataAt2x: element.dataset.at2x
          ? (new URL(element.dataset.at2x, location.href).pathname.split("/").pop() ?? null)
          : null,
        devicePixelRatio,
        naturalHeight: element.naturalHeight,
        naturalWidth: element.naturalWidth,
        renderedHeight: rect.height,
        renderedWidth: rect.width,
        srcset: element.getAttribute("srcset"),
      };
    };
    const textLayout = (element: Element): SourceContractTextLayoutMeasurement => {
      const lineTops = new Set<number>();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.height > 0) lineTops.add(Math.round(rect.top * 2) / 2);
          }
        }
        node = walker.nextNode();
      }
      const htmlElement = element as HTMLElement;
      return {
        clientHeight: htmlElement.clientHeight,
        clientWidth: htmlElement.clientWidth,
        lineCount: lineTops.size,
        overflowsX: htmlElement.scrollWidth > htmlElement.clientWidth + 1,
        overflowsY: htmlElement.scrollHeight > htmlElement.clientHeight + 1,
        scrollHeight: htmlElement.scrollHeight,
        scrollWidth: htmlElement.scrollWidth,
      };
    };
    const stylesFor = (
      element: Element,
      pseudo: "::after" | "::before",
      properties: readonly string[],
    ): Record<string, string> => {
      const style = getComputedStyle(element, pseudo);
      return Object.fromEntries(
        properties.map((property) => [property, style.getPropertyValue(property)]),
      );
    };
    const visible = (element: Element, style: CSSStyleDeclaration): boolean => {
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return {
      devicePixelRatio,
      documentHeight: document.documentElement.scrollHeight,
      probes: contractProbes.map((probe) => {
        const elements = [...document.querySelectorAll(probe.selector)];
        return {
          count: elements.length,
          content: probe.content !== false,
          geometry: probe.geometry !== false,
          elements: elements.map((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const metadata = probe.assetMetadata ? assetMetadata(element) : undefined;
            return {
              asset: assetName(element),
              ...(metadata ? { assetMetadata: metadata } : {}),
              href:
                element instanceof HTMLAnchorElement
                  ? new URL(element.href, location.href).pathname
                  : null,
              rect: {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width,
              },
              ...(probe.textLayout ? { layout: textLayout(element) } : {}),
              ...(probe.pseudoStyles
                ? {
                    pseudoStyles: {
                      after: stylesFor(element, "::after", probe.pseudoStyles.after ?? []),
                      before: stylesFor(element, "::before", probe.pseudoStyles.before ?? []),
                    },
                  }
                : {}),
              styles: Object.fromEntries(
                (probe.styles ?? []).map((property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
              text: text(element.textContent ?? ""),
              visible: visible(element, style),
            };
          }),
          id: probe.id,
        };
      }),
      viewport: { height: innerHeight, width: innerWidth },
    };
  }, probes);
}

function numericPixels(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

export function compareSourceContractSnapshots(
  reference: SourceContractSnapshot,
  implementation: SourceContractSnapshot,
  tolerance: Partial<SourceContractTolerance> = {},
): string[] {
  const allowed = { ...defaultTolerance, ...tolerance };
  const issues: string[] = [];

  if (
    reference.viewport.width !== implementation.viewport.width ||
    reference.viewport.height !== implementation.viewport.height
  ) {
    issues.push(
      `viewport: expected ${reference.viewport.width}×${reference.viewport.height}, received ${implementation.viewport.width}×${implementation.viewport.height}`,
    );
  }

  if (
    reference.devicePixelRatio !== undefined &&
    implementation.devicePixelRatio !== undefined &&
    reference.devicePixelRatio !== implementation.devicePixelRatio
  ) {
    issues.push(
      `device pixel ratio: expected ${reference.devicePixelRatio}, received ${implementation.devicePixelRatio}`,
    );
  }

  const expectedOrder = reference.probes.map(({ id }) => id);
  const actualOrder = implementation.probes.map(({ id }) => id);
  if (
    expectedOrder.length === actualOrder.length &&
    expectedOrder.every((id) => actualOrder.includes(id)) &&
    expectedOrder.some((id, index) => id !== actualOrder[index])
  ) {
    issues.push(
      `probe order: expected ${expectedOrder.join(" > ")}, received ${actualOrder.join(" > ")}`,
    );
  }

  const allowedHeight =
    Math.max(reference.documentHeight, implementation.documentHeight) * allowed.fullPageHeightRatio;
  if (Math.abs(reference.documentHeight - implementation.documentHeight) > allowedHeight) {
    issues.push(
      `document height: expected ${reference.documentHeight}px, received ${implementation.documentHeight}px`,
    );
  }

  const implementationById = new Map(
    implementation.probes.map((measurement) => [measurement.id, measurement]),
  );
  for (const expectedProbe of reference.probes) {
    const actualProbe = implementationById.get(expectedProbe.id);
    if (!actualProbe) {
      issues.push(`${expectedProbe.id}: missing probe`);
      continue;
    }
    if (expectedProbe.count !== actualProbe.count) {
      issues.push(
        `${expectedProbe.id}: expected ${expectedProbe.count} elements, received ${actualProbe.count}`,
      );
      continue;
    }

    expectedProbe.elements.forEach((expected, index) => {
      const actual = actualProbe.elements[index]!;
      const prefix = `${expectedProbe.id}[${index}]`;
      if (
        expectedProbe.content !== false &&
        normalizedText(expected.text) !== normalizedText(actual.text)
      )
        issues.push(`${prefix} text: expected "${expected.text}", received "${actual.text}"`);
      if (expectedProbe.content !== false && expected.href !== actual.href)
        issues.push(`${prefix} href: expected ${expected.href}, received ${actual.href}`);
      if (expectedProbe.content !== false && expected.asset !== actual.asset)
        issues.push(`${prefix} asset: expected ${expected.asset}, received ${actual.asset}`);
      if (expected.visible !== actual.visible)
        issues.push(
          `${prefix} visibility: expected ${expected.visible}, received ${actual.visible}`,
        );

      if (expectedProbe.geometry !== false) {
        for (const edge of ["top", "right", "bottom", "left", "width", "height"] as const) {
          if (Math.abs(expected.rect[edge] - actual.rect[edge]) > allowed.geometryPx) {
            issues.push(
              `${prefix} ${edge}: expected ${expected.rect[edge]}px, received ${actual.rect[edge]}px`,
            );
          }
        }
      }

      for (const [property, expectedValue] of Object.entries(expected.styles)) {
        const actualValue = actual.styles[property] ?? "";
        const expectedPixels = numericPixels(expectedValue);
        const actualPixels = numericPixels(actualValue);
        const pixelsMatch =
          expectedPixels !== null &&
          actualPixels !== null &&
          Math.abs(expectedPixels - actualPixels) <= allowed.numericStylePx;
        const approvedStyleEquivalent = allowed.styleEquivalences[property]?.some(
          (equivalent) =>
            equivalent.reference === expectedValue && equivalent.implementation === actualValue,
        );
        if (
          !pixelsMatch &&
          !approvedStyleEquivalent &&
          !equivalentComputedStyle(property, expectedValue, actualValue)
        ) {
          issues.push(
            `${prefix} ${property}: expected "${expectedValue}", received "${actualValue}"`,
          );
        }
      }

      if (expected.pseudoStyles) {
        for (const pseudo of ["before", "after"] as const) {
          for (const [property, expectedValue] of Object.entries(expected.pseudoStyles[pseudo])) {
            const actualValue = actual.pseudoStyles?.[pseudo]?.[property] ?? "";
            const expectedPixels = numericPixels(expectedValue);
            const actualPixels = numericPixels(actualValue);
            const pixelsMatch =
              expectedPixels !== null &&
              actualPixels !== null &&
              Math.abs(expectedPixels - actualPixels) <= allowed.numericStylePx;
            const approvedStyleEquivalent = allowed.styleEquivalences[property]?.some(
              (equivalent) =>
                equivalent.reference === expectedValue && equivalent.implementation === actualValue,
            );
            if (!pixelsMatch && !approvedStyleEquivalent && expectedValue !== actualValue) {
              issues.push(
                `${prefix} ::${pseudo} ${property}: expected "${expectedValue}", received "${actualValue}"`,
              );
            }
          }
        }
      }

      if (expected.layout) {
        if (!actual.layout) {
          issues.push(`${prefix} text layout: missing measurement`);
        } else {
          for (const property of ["lineCount", "overflowsX", "overflowsY"] as const) {
            if (expected.layout[property] !== actual.layout[property]) {
              issues.push(
                `${prefix} ${property}: expected ${expected.layout[property]}, received ${actual.layout[property]}`,
              );
            }
          }
          for (const property of [
            "clientHeight",
            "clientWidth",
            "scrollHeight",
            "scrollWidth",
          ] as const) {
            if (
              Math.abs(expected.layout[property] - actual.layout[property]) > allowed.geometryPx
            ) {
              issues.push(
                `${prefix} ${property}: expected ${expected.layout[property]}px, received ${actual.layout[property]}px`,
              );
            }
          }
        }
      }

      if (expected.assetMetadata) {
        if (!actual.assetMetadata) {
          issues.push(`${prefix} asset metadata: missing measurement`);
        } else {
          for (const property of ["currentSrc", "dataAt2x", "srcset"] as const) {
            if (expected.assetMetadata[property] !== actual.assetMetadata[property]) {
              issues.push(
                `${prefix} ${property}: expected ${expected.assetMetadata[property]}, received ${actual.assetMetadata[property]}`,
              );
            }
          }
          for (const property of ["naturalHeight", "naturalWidth"] as const) {
            if (expected.assetMetadata[property] !== actual.assetMetadata[property]) {
              issues.push(
                `${prefix} ${property}: expected ${expected.assetMetadata[property]}, received ${actual.assetMetadata[property]}`,
              );
            }
          }
          for (const property of ["renderedHeight", "renderedWidth"] as const) {
            if (
              Math.abs(expected.assetMetadata[property] - actual.assetMetadata[property]) >
              allowed.geometryPx
            ) {
              issues.push(
                `${prefix} ${property}: expected ${expected.assetMetadata[property]}px, received ${actual.assetMetadata[property]}px`,
              );
            }
          }
        }
      }
    });
  }

  const expectedIds = new Set(reference.probes.map(({ id }) => id));
  for (const actualProbe of implementation.probes) {
    if (!expectedIds.has(actualProbe.id)) issues.push(`${actualProbe.id}: unexpected probe`);
  }

  return issues;
}
