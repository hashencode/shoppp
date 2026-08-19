import { describe, expect, test } from "bun:test";

import { buildDecorAcceptancePlan } from "./run-decor-acceptance";

describe("Decor acceptance runner", () => {
  test("builds the same bounded home checks for page and theme scope", () => {
    const page = buildDecorAcceptancePlan({ page: "home", scope: "page" });
    const theme = buildDecorAcceptancePlan({ scope: "theme" });
    expect(page.pages).toEqual(["home"]);
    expect(page.steps).toEqual(theme.steps);
    expect(page.steps.map(({ label }) => label)).toEqual(["home/unit", "home/browser"]);
  });

  test("rejects unsupported page selections", () => {
    expect(() => buildDecorAcceptancePlan({ page: "product", scope: "page" })).toThrow(
      /requires --page=home/,
    );
    expect(() => buildDecorAcceptancePlan({ page: "home", scope: "theme" })).toThrow(
      /does not accept --page/,
    );
  });
});
