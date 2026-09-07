# Fashion Store U6.1 exact-package boundary evidence

Date: 2026-09-07  
Plan authority: `FS-R3` U6.1  
Scope: package characterization, historical freeze, successor isolation, and lifecycle eligibility only. This evidence does not own a current-unit queue and does not claim U6.2 migration/publication, candidate, DC, PG, deployment, or production state.

## Frozen source inventory

U6.1 found one still-supported exact Fashion source package:

| Theme           | Theme version | Configuration schema | Presets         | Byte-stable package                                                                                     | SHA-256                                                            |
| --------------- | ------------- | -------------------- | --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `fashion-store` | `1.0.0`       | `1`                  | `source-parity` | `apps/storefront/app/themes/fashion-store/historical/1.0.0/theme-package.json` (27,973 formatted bytes) | `95bb721577646c46c460e8a98e1e15f4c5c6a53d723e05f9147b3a678b352120` |

The retained JSON contains the complete validated manifest and preset payload that existed before the successor version was activated. A focused package test hashes the raw file, parses it with `themePackageSchema`, compares it with the immutable historical registry value, and checks the exact ID/version/schema/preset tuple.

## Successor and direct boundary

The selectable implementation now resolves through `apps/storefront/app/themes/fashion-store/successor/`. Its exact package identity is `fashion-store@1.1.0`, configuration schema `2`. The current presentation payload remains the inherited `source-parity` structure; U6.1 did not add the unified preset, a migration function, Home decomposition, or renderer-owned shell behavior.

The production registry declares one structural direct source boundary, with no chaining or executable-migration claim:

`fashion-store@1.0.0/schema-1 -> fashion-store@1.1.0/schema-2`

Registry initialization rejects a historical-package set that is not covered exactly by the direct-boundary set or whose boundary targets a different successor. The theme matrix verifies this as `directPackageBoundaries`; U6.1 does not expose it as an executable migration.

## Lifecycle evidence

| Exact package                  | Immutable read | Historical validation | Migration source | Mutate/create/copy draft                           | Activate/approve/build/preview access              |
| ------------------------------ | -------------- | --------------------- | ---------------- | -------------------------------------------------- | -------------------------------------------------- |
| `fashion-store@1.0.0/schema-1` | Allowed        | Allowed               | Allowed          | Rejected: `storefront_theme_package_not_creatable` | Rejected: `storefront_theme_package_not_creatable` |
| `fashion-store@1.1.0/schema-2` | Allowed        | Allowed               | Allowed          | Allowed                                            | Allowed                                            |

The generated Admin/API and Storefront catalogs expose only the successor descriptor. The checked-in active Fashion runtime also imports the successor registry and carries the exact `1.1.0`/schema-2 identity. The API default registry retains both exact packages, so old drafts and snapshots can be read, old schema-1 overrides validate against their exact preset, and migration dry-run reaches the source package before returning the expected U6.1 `storefront_experience_migration_unavailable` response. Exact schema-aware resolution rejects mismatched source tuples, and dry-run rejects source/target tuples outside the declared direct boundary before any migration or audit state is written. No default migration implementation was registered.

## Verification evidence

- Characterization-first red: the new contract/domain/package tests initially failed on the absent lifecycle schemas, exact-package resolver, historical registry, and successor path. Dependency resolution was initially masked by this clean worktree's absent `node_modules`; `bun install --frozen-lockfile` restored the locked workspace without changing `bun.lock`.
- Focused contract/domain/Storefront package, theme, and matrix tests: 47 passed.
- Full Storefront unit suite: 289 passed and two unrelated existing assertions failed. `fashion-store-live-commerce.test.ts` expects the unchanged `FashionStoreProductCard.vue` not to contain `onMounted(`, while `fixture-contract.test.ts` rejects the unchanged `@shoppp/contracts` import in `FashionStoreLiveProductPage.vue`; both conditions are present at HEAD and neither file changed in U6.1.
- Cloudflare API experience test: 24 passed, including immutable historical snapshot read, schema-1 override validation, immutable historical draft enforcement, historical preview grant/redeem/session denial, migration-source resolution, exact schema and direct-boundary rejection without writes, stable create/copy/activation rejection, and injected-registry draft copy. The repository's direct package command currently hits a Vite/OXC cross-workspace tsconfig lookup failure before collecting tests; the same committed config and Worker suite passed from a temporary root adapter that left no files or links.
- Admin editor unit test: 28 passed.
- Admin editor browser test: 4 passed.
- `bun run typecheck`: passed for tools, e2e, Admin, API, Storefront, contracts, database, and domain workspaces.
- `bun run lint`: passed, including import boundaries and Admin lint.
- `bun run verify:themes`: passed; generated catalogs are current and all three present storefront themes verify against platform contract `1.0.0`.
- Structured review found five P1 lifecycle/boundary leaks; all five were applied and verified. Review artifacts are retained at `/tmp/compound-engineering-501/ce-code-review/20260907-095951-2dfb88e8` for this local execution session.
- `bun run format:check`: U6.1 files pass focused formatting, while the repository-wide gate remains red on 17 pre-existing unchanged files listed by the command output. No unrelated formatting was applied.
- `bun run ci:fast`: reproducible install passed with no lockfile change, then the run stopped at the same repository-wide 17-file pre-existing formatting baseline before later stages.

No Decor or Decor Store runtime file changed. No renderer shell opt-in was enabled. No migration function, unified preset, Decor presentation, candidate, release, deployment, or production state was created or advanced.
