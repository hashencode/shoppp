import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decorSourceContract } from "../app/themes/decor/source-contract";

describe("Decor motion and responsive contract", () => {
  test("separates the cross-fade from the interaction-gating layer timeline", async () => {
    const hero = await readFile(
      resolve(import.meta.dir, "../app/themes/decor/components/DecorHeroCarousel.vue"),
      "utf8",
    );
    expect(decorSourceContract.hero.transition.durationMs).toBe(300);
    expect(decorSourceContract.hero.layerTimeline.durationMs).toBe(2_700);
    expect(decorSourceContract.hero.interaction.swipeThresholdPx).toBe(75);
    expect(hero).toContain("data.value?.layerTimeline?.durationMs ?? 2_700");
    expect(hero).toContain("threshold: swipeThresholdPx.value");
    expect(hero).toContain("if (!sourceStopsBeforeFirstAutoplay) controller.start()");
    expect(hero).not.toContain("pause('hover')");
    expect(hero).not.toContain("pause('focus')");
  });

  test("maps every implemented scrolling region to the one-shot reveal runtime", async () => {
    const componentNames = [
      "DecorCategoryShowcase.vue",
      "DecorProductTabs.vue",
      "DecorMarquee.vue",
      "DecorCollectionFeature.vue",
      "DecorClientStrip.vue",
      "DecorJournal.vue",
      "DecorServiceStrip.vue",
    ];
    const sources = await Promise.all(
      componentNames.map((name) =>
        readFile(resolve(import.meta.dir, `../app/themes/decor/components/${name}`), "utf8"),
      ),
    );
    expect(sources.every((source) => source.includes("useDecorRevealMotion"))).toBe(true);
    expect(sources.every((source) => source.includes("data-source-reveal"))).toBe(true);
  });

  test("keeps the reported responsive bands fluid and viewport bounded", async () => {
    const css = await readFile(resolve(import.meta.dir, "../app/themes/decor/tokens.css"), "utf8");
    expect(css).toContain("width: calc(100vw * 1.3532258)");
    expect(css).toContain("left: calc(50% - 307.5px)");
    expect(css).toContain("width: min(720px, calc(100vw - 36px))");
    expect(css).not.toContain("left: 757px");
  });
});
