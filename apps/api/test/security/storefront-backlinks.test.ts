import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import {
  filterStorefrontBacklinks,
  findPolicyBacklinks,
} from "../../src/storefront-control/backlinks";

describe("storefront authority backlinks", () => {
  test("returns a permission-filterable common diagnostic shape", async () => {
    const suffix = crypto.randomUUID();
    const policyId = `policy.${suffix}`;
    const menuId = `menu.${suffix}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO policy_versions
          (policy_id, version, kind, slug, title, effective_date, sections_json, status,
           created_at, updated_at)
         VALUES (?, 1, 'returns', ?, 'Returns', '2026-09-23', '[]', 'draft', ?, ?)`,
      ).bind(policyId, `returns-${suffix}`, "2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO navigation_menu_versions
          (menu_id, version, placement, status, created_at, updated_at)
         VALUES (?, 1, 'footer', 'draft', ?, ?)`,
      ).bind(menuId, "2026-09-23T00:00:00.000Z", "2026-09-23T00:00:00.000Z"),
      env.DB.prepare(
        `INSERT INTO navigation_items
          (menu_id, menu_version, item_id, position, label, target_json)
         VALUES (?, 1, 'returns', 0, 'Returns', '{}')`,
      ).bind(menuId),
      env.DB.prepare(
        `INSERT INTO navigation_policy_references
          (menu_id, menu_version, item_id, policy_id, policy_version, environment, created_at)
         VALUES (?, 1, 'returns', ?, 1, 'development', ?)`,
      ).bind(menuId, policyId, "2026-09-23T00:00:00.000Z"),
    ]);

    const diagnostics = await findPolicyBacklinks(env.DB, policyId, 1, "development");
    expect(filterStorefrontBacklinks(diagnostics, [])).toEqual([]);
    expect(filterStorefrontBacklinks(diagnostics, ["navigation.read"])).toEqual([
      {
        code: "resource_referenced",
        environment: "development",
        sourceDomain: "navigation",
        sourceId: menuId,
        sourceItemId: "returns",
        sourceVersion: 1,
        targetDomain: "policy",
        targetId: policyId,
        targetVersion: 1,
      },
    ]);
    await expect(
      env.DB.prepare(
        `UPDATE navigation_policy_references SET environment = 'staging'
          WHERE menu_id = ? AND menu_version = 1 AND item_id = 'returns'`,
      )
        .bind(menuId)
        .run(),
    ).rejects.toThrow(/reference_relation_immutable/);
  });
});
