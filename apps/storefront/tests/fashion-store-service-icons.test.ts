import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const themeRoot = new URL("../app/themes/fashion-store/", import.meta.url);

describe("Fashion Store service icons", () => {
  test("uses the credit-card icon and a lighter stroke in the shared Home services renderer", async () => {
    const [services, context, decorHome, homeContent, icon] = await Promise.all([
      readFile(new URL("components/sections/FashionStoreServicesSection.vue", themeRoot), "utf8"),
      readFile(new URL("components/sections/home-section-context.ts", themeRoot), "utf8"),
      readFile(new URL("components/home/FashionStoreDecorHomeBody.vue", themeRoot), "utf8"),
      readFile(new URL("components/sections/home-content.ts", themeRoot), "utf8"),
      readFile(new URL("components/shared/FashionStoreIcon.vue", themeRoot), "utf8"),
    ]);

    expect(context).toContain('"credit-card"');
    expect(homeContent).toContain('["Secure payment", "Protected checkout", "credit-card"]');
    expect(services).toContain(':stroke-width="1.5"');
    expect(
      decorHome.match(/<FashionStoreIcon\n\s+name="(package|map-pin|credit-card|headphones)"/g),
    ).toHaveLength(4);
    expect(decorHome.match(/:stroke-width="1\.5"/g)).toHaveLength(4);
    expect(decorHome).not.toMatch(/demo-decor-store-icon-0[6-9]\.png/);
    expect(icon).toContain("strokeWidth?: number");
    expect(icon).toContain("strokeWidth: 2");
    expect(icon).toContain(':stroke-width="strokeWidth"');
  });
});
