import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";
import { seedHumanAdmin } from '../fixtures/admin-iam';

import {
  filterStorefrontBacklinks,
  findPolicyBacklinks,
  findNavigationBacklinks,
} from "../../src/storefront-control/backlinks";

describe("storefront authority backlinks", () => {
  test('releases mutable navigation references after tombstoning a visual draft', async () => {
    await seedHumanAdmin(env.DB, { id: 'fixture', subject: 'visual-backlinks' });
    const id = `draft-${crypto.randomUUID()}`;
    await env.DB.prepare(`INSERT INTO storefront_experience_drafts (id,experience_id,theme_id,theme_version,configuration_schema_version,preset_id,bindings_json,overrides_json,version,created_by,updated_by,created_at,updated_at)
      VALUES (?,?,'fashion-store','1.3.0',4,'source-parity','[]',?,1,'fixture','fixture',?,?)`)
      .bind(id, id, JSON.stringify([{ operations: [{ kind: 'set-shell-presentation', settings: { 'header-menu': { kind: 'navigation', id: 'menu.editor' } } }] }]), '2026-10-31T00:00:00Z', '2026-10-31T00:00:00Z').run();
    expect((await findNavigationBacklinks(env.DB, 'menu.editor', 1, 'staging')).map(value => value.sourceId)).toContain(id);
    await env.DB.prepare('UPDATE storefront_experience_drafts SET removed_at = ? WHERE id = ?').bind('2026-10-31T01:00:00Z', id).run();
    expect((await findNavigationBacklinks(env.DB, 'menu.editor', 1, 'staging')).map(value => value.sourceId)).not.toContain(id);
  });
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
