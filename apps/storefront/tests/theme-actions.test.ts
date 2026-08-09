import { describe, expect, test } from "bun:test";

import { PreviewIntentRecorder, previewActionSchema } from "../app/theme-engine/actions";

describe("theme preview actions", () => {
  test("records Fashion Store commerce affordances through the typed boundary", () => {
    const recorder = new PreviewIntentRecorder();
    const actions = [
      {
        id: "toggle-product-wishlist",
        intent: "wishlist.toggle-preview",
        label: "Toggle product wishlist",
      },
      {
        id: "quick-view-product",
        intent: "product.quick-view-preview",
        label: "Open product quick view",
      },
    ] as const;

    for (const action of actions)
      recorder.record(previewActionSchema.parse(action), "fashion-store");

    expect(recorder.all().map(({ intent }) => intent)).toEqual([
      "wishlist.toggle-preview",
      "product.quick-view-preview",
    ]);
  });

  test("rejects hard-navigation targets on commerce actions", () => {
    expect(() =>
      previewActionSchema.parse({
        id: "bad-wishlist",
        intent: "wishlist.toggle-preview",
        label: "Wishlist",
        target: "/cart",
      }),
    ).toThrow("Only navigation preview actions may declare a target");
  });
});
