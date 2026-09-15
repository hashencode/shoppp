import { expect, type Locator } from "@playwright/test";

export interface LayoutBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface LabeledLocator {
  label: string;
  locator: Locator;
}

async function requiredBox(locator: Locator, label: string): Promise<LayoutBox> {
  const box = await locator.boundingBox();
  expect(box, `${label} must have visible geometry`).not.toBeNull();
  return box!;
}

export async function expectChildCentered(options: {
  child: LabeledLocator;
  parent: LabeledLocator;
  tolerancePx?: number;
}): Promise<{ deltaX: number; deltaY: number }> {
  const tolerancePx = options.tolerancePx ?? 1;
  const [parent, child] = await Promise.all([
    requiredBox(options.parent.locator, options.parent.label),
    requiredBox(options.child.locator, options.child.label),
  ]);
  const deltaX = Math.abs(child.x + child.width / 2 - (parent.x + parent.width / 2));
  const deltaY = Math.abs(child.y + child.height / 2 - (parent.y + parent.height / 2));

  expect(deltaX, `${options.child.label} is not horizontally centered`).toBeLessThanOrEqual(
    tolerancePx,
  );
  expect(deltaY, `${options.child.label} is not vertically centered`).toBeLessThanOrEqual(
    tolerancePx,
  );
  return { deltaX, deltaY };
}

export async function expectHorizontalSequence(options: {
  alignFirstToStart?: boolean;
  alignLastToEnd?: boolean;
  container: LabeledLocator;
  containerBox?: "border" | "content";
  expectedStepPx?: number;
  items: readonly LabeledLocator[];
  tolerancePx?: number;
  verticallyAligned?: boolean;
}): Promise<{ container: LayoutBox; items: LayoutBox[] }> {
  const tolerancePx = options.tolerancePx ?? 1;
  const [container, items] = await Promise.all([
    requiredBox(options.container.locator, options.container.label),
    Promise.all(options.items.map((item) => requiredBox(item.locator, item.label))),
  ]);
  const padding =
    options.containerBox === "content"
      ? await options.container.locator.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            left: Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
            right:
              Number.parseFloat(style.borderRightWidth) + Number.parseFloat(style.paddingRight),
          };
        })
      : { left: 0, right: 0 };
  const contentLeft = container.x + padding.left;
  const contentRight = container.x + container.width - padding.right;
  const firstCenterY = items[0] ? items[0].y + items[0].height / 2 : undefined;

  for (const [index, item] of items.entries()) {
    const label = options.items[index]!.label;
    expect(item.x, `${label} escapes the left edge`).toBeGreaterThanOrEqual(
      contentLeft - tolerancePx,
    );
    expect(item.x + item.width, `${label} escapes the right edge`).toBeLessThanOrEqual(
      contentRight + tolerancePx,
    );
    if (index === 0) continue;

    const previous = items[index - 1]!;
    expect(item.x, `${label} overlaps the previous control`).toBeGreaterThanOrEqual(
      previous.x + previous.width - tolerancePx,
    );
    if (options.expectedStepPx !== undefined) {
      expect(
        Math.abs(item.x - previous.x - options.expectedStepPx),
        `${label} does not preserve the expected horizontal step`,
      ).toBeLessThanOrEqual(tolerancePx);
    }
    if (options.verticallyAligned && firstCenterY !== undefined) {
      const itemCenter = item.y + item.height / 2;
      expect(
        Math.abs(itemCenter - firstCenterY),
        `${label} is not vertically aligned with the first control`,
      ).toBeLessThanOrEqual(tolerancePx);
    }
  }

  if (options.alignFirstToStart && items[0]) {
    expect(
      Math.abs(items[0].x - contentLeft),
      "first item is not aligned to the start edge",
    ).toBeLessThanOrEqual(tolerancePx);
  }
  if (options.alignLastToEnd && items.at(-1)) {
    const last = items.at(-1)!;
    expect(
      Math.abs(last.x + last.width - contentRight),
      "last item is not aligned to the end edge",
    ).toBeLessThanOrEqual(tolerancePx);
  }

  return { container, items };
}
