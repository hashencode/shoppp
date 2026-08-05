import type { Page } from "@playwright/test";

export interface FontContractProbe {
  atomic?: boolean;
  id: string;
  selector: string;
}

export interface FontProbeSnapshot {
  family: string;
  fontSize?: string;
  id: string;
  letterSpacing?: string;
  lineCount: number;
  lineHeight?: string;
  text: string;
  textWidth: number;
  weight: string;
}

export interface FontContractSnapshot {
  fontsReady: boolean;
  probes: FontProbeSnapshot[];
}

function normalizedFamily(value: string): string {
  return value
    .split(",")[0]!
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function compareFontContractSnapshots(
  reference: FontContractSnapshot,
  implementation: FontContractSnapshot,
  tolerance = { textWidthPx: 0.5 },
): string[] {
  const issues: string[] = [];
  if (reference.fontsReady !== implementation.fontsReady)
    issues.push(
      `fontsReady: expected ${reference.fontsReady}, received ${implementation.fontsReady}`,
    );
  const actualById = new Map(implementation.probes.map((probe) => [probe.id, probe]));
  for (const expected of reference.probes) {
    const actual = actualById.get(expected.id);
    if (!actual) {
      issues.push(`${expected.id}: missing font probe`);
      continue;
    }
    if (normalizedFamily(expected.family) !== normalizedFamily(actual.family))
      issues.push(
        `${expected.id}.family: expected ${JSON.stringify(normalizedFamily(expected.family))}, received ${JSON.stringify(normalizedFamily(actual.family))}`,
      );
    if (expected.weight !== actual.weight)
      issues.push(
        `${expected.id}.weight: expected ${JSON.stringify(expected.weight)}, received ${JSON.stringify(actual.weight)}`,
      );
    for (const property of ["fontSize", "lineHeight", "letterSpacing"] as const) {
      if (expected[property] !== undefined && expected[property] !== actual[property])
        issues.push(
          `${expected.id}.${property}: expected ${JSON.stringify(expected[property])}, received ${JSON.stringify(actual[property])}`,
        );
    }
    if (Math.abs(expected.textWidth - actual.textWidth) > tolerance.textWidthPx)
      issues.push(
        `${expected.id}.textWidth: expected ${expected.textWidth}px, received ${actual.textWidth}px`,
      );
    if (expected.lineCount !== actual.lineCount)
      issues.push(
        `${expected.id}.lineCount: expected ${expected.lineCount}, received ${actual.lineCount}`,
      );
  }
  for (const actual of implementation.probes) {
    if (!reference.probes.some(({ id }) => id === actual.id))
      issues.push(`${actual.id}: unexpected font probe`);
  }
  return issues;
}

export async function captureFontContract(
  page: Page,
  probes: readonly FontContractProbe[],
): Promise<FontContractSnapshot> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  return page.evaluate((contractProbes) => {
    const lineCount = (element: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = new Set(
        [...range.getClientRects()]
          .filter(({ width, height }) => width > 0 && height > 0)
          .map(({ top }) => Math.round(top * 10) / 10),
      );
      return Math.max(1, tops.size);
    };
    return {
      fontsReady: document.fonts.status === "loaded",
      probes: contractProbes.map((probe) => {
        const element = document.querySelector(probe.selector);
        if (!element) throw new Error(`Missing font probe selector: ${probe.selector}`);
        const style = getComputedStyle(element);
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          family: style.fontFamily,
          fontSize: style.fontSize,
          id: probe.id,
          letterSpacing: style.letterSpacing,
          lineCount: lineCount(element),
          lineHeight: style.lineHeight,
          text: (element.textContent ?? "").replaceAll(/\s+/g, " ").trim(),
          textWidth: range.getBoundingClientRect().width,
          weight: style.fontWeight,
        };
      }),
    };
  }, probes);
}
