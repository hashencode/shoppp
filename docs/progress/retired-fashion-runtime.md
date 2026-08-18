# Retired Fashion Runtime — Execution Evidence

This file retains focused FRT evidence. The owning plan remains the only authority for the current
unit, next action, blockers, and implementation tail.

## 2026-08-17 — FRT-U1 authorized aggregate inventory

- **Execution time:** `2026-08-17T13:09:03Z` (`2026-08-17 21:09:03 CST`).
- **Authorization:** `wrangler whoami` succeeded for the same Cloudflare account ID configured by
  all three remote D1 bindings. Only `SELECT` statements were issued.
- **Identity filter:** exact `theme_id = 'fashion'`; no prefix, slug, JSON-text, or approximate
  match was accepted.
- **Data handling:** schema metadata and aggregate counts only. No record ID, business payload,
  credential, digest, origin, or timestamp value was returned or retained.

### Environment coverage

| Environment     | D1 database                                                       | Schema result                            | Aggregate result                                                                         | Mutation metadata                      |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| staging         | `shoppp-staging` / `0c84c9e0-5ef1-4897-815e-5ec7efb7582e`         | All seven governed tables present        | Every retained metric was `0`                                                            | `changed_db: false`, `rows_written: 0` |
| fashion-staging | `shoppp-fashion-staging` / `eb1ca4ef-3121-4d02-b20e-e619eac1cecc` | All seven governed tables present        | Every retained metric was `0`                                                            | `changed_db: false`, `rows_written: 0` |
| production      | `shoppp-production` / `e17ef1dc-d87c-40c7-b218-e4827d815168`      | None of the seven governed tables exists | Authorized schema absence; no Storefront Experience row can exist in those absent tables | `changed_db: false`, `rows_written: 0` |

The root/default staging binding and `env.staging` resolve to the same database identity and were
counted once. Contract-test databases with placeholder UUIDs are not configured staging or
production environments and are outside this inventory.

### Query shape and lifecycle coverage

The successful staging queries used CTEs for exact-Fashion drafts, snapshots, builds, grants, and
sessions, then returned one row containing only named count columns:

- drafts: total;
- validations joined through exact-Fashion drafts: total, `valid`, `invalid`;
- migrations joined through exact-Fashion drafts: total, `dry_run`, `approved`;
- snapshots: total, `preview`, `approved`;
- builds matched by either build or immutable snapshot theme identity: total, `pending`,
  `building`, `deployed`, `failed`, `expired`;
- grants joined through exact-Fashion snapshots/builds: total, `active`, `redeemed`, `expired`;
- sessions joined through exact-Fashion snapshots/builds: total, `active`, `expired`.

Both staging databases use the deployed pre-revocation schema: grant/session `revoked_at` and the
later validation Catalog identity columns are absent. The query therefore classified only states
that actually exist in those environments; no remote migration was run and no missing state was
invented. Production's authorized `sqlite_master` result was empty for every governed table.

Three earlier aggregate attempts were rejected before execution because of command-line newline
escaping, D1's compound-select term limit, and the discovered pre-revocation schema. None was used
as zero-data evidence. The final compatible query succeeded in both staging environments and
reported `rows_written: 0`.

### U1 verdict

FRT-U1.1, U1.2, and U1.3 are complete. Authorized evidence covers every configured staging and
production D1 surface and finds zero exact-Fashion runtime state. Per KTD3/R5, FRT proceeds without
a retirement migration, trigger, compatibility service, or data rewrite. This result authorizes
U2 reference-label migration but does not itself authorize U3 deletion before U2 completes.

## 2026-08-17 — FRT-U2.1 reference-identity classification

The bounded rename set is the comparison identity carried by reference capture configuration,
comparison descriptors, artifact roots and IDs, fidelity metadata/report defaults, matrix and
named-state summaries, Fashion Store acceptance setup, and their focused tests. Those occurrences
move from bare `fashion` to `fashion-store-source` in U2.2.

The following similarly spelled occurrences are deliberately outside that rename set:

- `apps/storefront/app/themes/fashion/**`, its runtime fixture, runtime import-tool support, route
  IDs, catalogs, and registrations are the old implementation identity and remain owned by U3;
- `.fashion-*` selectors, `demo-fashion-store.html`, source-relative asset paths, and Crafto markup
  are source behavior or provenance inputs and remain byte/behavior compatible;
- generic test samples move to a neutral retained identity only when they otherwise imply a
  same-identity Fashion runtime; historical plan/progress prose remains lineage evidence.

No runtime subtree, fixture, catalog, source input, remote data, or neutral sample was changed by
the U2.1 classification. Physical runtime deletion remains blocked until U2.3 verification passes.

## 2026-08-17 — FRT-U2.2 source-reference rename

- Reference capture now accepts `fashion-store-source`, resolves the unchanged
  `demo-fashion-store.html` input, and rejects both bare `fashion` and implementation-only
  `fashion-store` as source identities.
- The comparison descriptor now records `reference/fashion-store-source`,
  `fashion-store-source-to-fashion-store`, and matching report/matrix/named-state metadata while
  retaining `fashion-store` as the implementation identity.
- Same-identity fidelity test samples that formerly implied a Fashion runtime now use retained
  `decor`; runtime import support for bare `fashion` remains untouched and explicitly owned by U3.
- Failure-first focused evidence: the migrated expectations initially failed against the old
  identity, then passed after implementation (`19` tests, `54` expectations).

No source file, CSS selector, source-relative asset path, old runtime subtree, catalog, or remote
environment was mutated. U3 deletion remains blocked while U2.3 verification runs.

## 2026-08-17 — FRT-U2.3 reference-contract verification

- `bun run verify:source-equivalence`: passed (`147` tests, `359` expectations) after verifying
  both registered source-equivalent themes; coverage includes independent-source digests,
  provenance drift, named-state reports, fidelity thresholds, and controlled defects.
- `bun run typecheck`: passed tools, E2E, Admin, API, Storefront, Contracts, DB, and Domain checks.
- Focused Fashion Store Playwright acceptance slice: passed all applicable desktop/mobile cases
  (`7` passed, `9` intentionally skipped by the test's desktop/mobile scope).
- Static identity/import scans found no old `app/themes/fashion/` dependency in the renamed capture,
  report, named-state, comparison, or acceptance path. Bare `fashion` rejection tests remain as
  absence evidence; retained `fashion-store` implementation imports are expected.

FRT-U2 is complete. The original Crafto input and selectors remain unchanged, the comparison is
`fashion-store-source` to `fashion-store`, and the U1/U2 gates now permit U3.1 deletion-safety
inventory. No runtime deletion or remote mutation occurred in U2.

## 2026-08-17 — FRT-U3.1 exact-target and dependency inventory

- Resolved targets are exactly
  `/Users/studio/Documents/GitHub/shoppp/apps/storefront/app/themes/fashion` and
  `/Users/studio/Documents/GitHub/shoppp/apps/storefront/fixtures/experience/fashion.json`, both
  inside the primary Shoppp checkout. The first is an ordinary directory; the second is an
  ordinary regular file.
- The subtree contains `98` regular files and no symbolic links. Together with the fixture, all
  `99` paths are tracked and clean; exact-path status found no modified, untracked, or ignored
  content. No writer or extra worktree owns either target.
- Active dependencies are bounded to API default package/fixture registration, catalog generator
  import and manifest allowlist, Storefront verification matrix, generated catalog entries, and
  the old runtime option in the import tool. Generic Theme Engine, resource, and contract tests use
  bare `fashion` only as sample identity and therefore move to neutral `test-theme` data.
- U2-owned source input filenames and `.fashion-*` selectors, retained `fashion-store` runtime
  code, and historical documentation are explicitly excluded from deletion or replacement.

The user-authorized plan, U1 authorized zero-data result, U2 independence proof, and this exact
clean-path inspection satisfy the U3.2 deletion gates. Removal remains limited to these paths and
classified references; no remote data operation is authorized or required.

## 2026-08-17 — FRT-U3.2 runtime and registration removal

- Removed the validated `apps/storefront/app/themes/fashion/**` subtree (`98` tracked files) and
  `apps/storefront/fixtures/experience/fashion.json` (one tracked file). The patch tool rejected the
  binary font payload before applying any deletion, so the same exact safety checks were rerun and
  the two clean tracked targets were removed directly. All `99` deletions remain recoverable from
  the current Git baseline; no unrelated path was removed.
- Removed old package/fixture registration from the API, old descriptor/allowlist registration
  from catalog generation, the old Storefront verification row, and bare-Fashion support from the
  import tool. Regenerated both checked-in catalogs, which now contain exactly `decor` and
  `fashion-store`.
- Generic Theme Engine, resource, Admin, Contracts, DB-migration, and importer test samples now use
  neutral `synthetic` data or retained `decor`; `fashion-store`, source files/selectors, and explicit
  bare-`fashion` rejection/absence assertions remain intact.
- Focused gates passed: generator/import/Theme Engine/resources/Contracts (`73` tests), API Workers
  (`175`), DB Workers (`11`), Admin theme editor (`17`), and `bun run verify:themes` (two themes).
  A direct root `bun test` attempt for Workers/jsdom files collected zero tests because it lacked
  their workspace harnesses; the correctly configured workspace commands above supersede it.

No stage, commit, push, deploy, worktree change, or remote data mutation occurred. U3.3 owns final
absence, type, and fresh-build proof before U3 can close.

## 2026-08-17 — FRT-U3.3 absence and build proof

- Full tools/E2E/workspace typecheck passed after deletion.
- Exact repository scans found no executable `themes/fashion/` import, old fixture path, runtime
  manifest/preset/descriptor registration, bare runtime catalog entry, or generated catalog row.
  The only code-owned bare-`fashion` literals are explicit rejection/absence assertions; the
  upstream Crafto photography HTML has an unrelated accessibility label.
- Fresh `fashion-store` and `decor` preview builds completed via Wrangler dry-run. Both post-build
  scans found no `*/themes/fashion/*` output and no old import/fixture path. Decor preview static
  verification passed for `snapshot-decor-fixture-1`.
- Two initial `verify:static` invocations omitted `STOREFRONT_BUILD_MODE=preview` and correctly
  rejected the active preview snapshot as non-production output. The contract-correct preview-mode
  rerun passed; those command-shape failures are not product failures.
- `git diff --check` passed.

FRT-U3 is complete: only `decor` and `fashion-store` runtime directories/catalog entries remain,
and no old inactive asset is emitted. No deploy or remote mutation occurred; both Wrangler calls
were explicit dry runs.

## 2026-08-17 — FRT-U4.1/U4.2 retained-baseline reconciliation

- The architecture now states the observed post-U3 baseline: the old ID is absent from active
  runtime, fixture, registry, catalog, Admin selection, and build surfaces while historical lineage
  and aggregate evidence remain valid.
- The retirement runbook now separates a zero-data authorization signal from later source-
  independence and exact-path deletion gates, and explicitly forbids treating old evidence as
  authorization for unrelated remote cleanup.
- The retained test matrix already covers exact two-entry API/catalog output, Fashion Store's
  selected registry plus old-import absence, Decor's independent preview/comparison contract,
  `fashion-store-source` rejection boundaries, type safety, and both fresh builds. No additional
  product-code gap was found during reconciliation.

U4.1 and U4.2 are complete. U4.3 owns the final full verification run and completion-pointer
update; FRT remains active until that evidence is green.

## 2026-08-17 — FRT-U4.3 final verification and completion

- Repository gates passed: lint and boundaries; source equivalence (`147` tests, `359`
  expectations); root tools (`202`), Admin (`299`), Storefront (`234`), Contracts (`28`), DB seed
  (`1`), and Domain (`29`) tests; API Workers (`175`); DB Workers (`11`); full typecheck; and
  `git diff --check`.
- Full Fashion Store verification passed: focused suite (`34`), live-Commerce suite (`14`), and
  Playwright (`132` passed, `192` intentionally skipped). Every required behavior-evidence bucket
  was non-zero: `59, 8, 3, 8, 4, 10, 6, 6, 4, 4, 6, 6, 5, 4, 4`.
- Full retained Decor verification passed: focused suite (`8`) and Playwright (`15` passed, `6`
  intentionally skipped). Current Decor preview static verification also passed.
- Fresh Fashion Store preview build/static verification passed; exact inactive-runtime scans passed
  for both retained templates, and theme verification reported exactly two themes.
- All Wrangler build operations were explicit dry runs. No deploy, remote mutation, staging,
  commit, push, or worktree change occurred.

FRT-U4 and FRT are complete. The owning and product-master checkpoints now return execution to
`FS-U12.1`; candidate state remains Pre-DC.
