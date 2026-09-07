# Fashion 与 Decor runtime retirement 证据

本文保留 FS-R3-U7/U8 的只读环境清点、冻结、reference 分离和删除证据。当前单元、下一步、
blocker 与删除权限只由 FS-R3 执行检查点维护；本文不是第二条执行队列。

## 2026-09-07 — U7.1 provider 与配置 reconciliation（冻结前）

- `wrangler whoami` 通过 OAuth 对账户 `449e7f42fe4c4e55d5c674e2e7c57c8d` 完成授权；与三个
  checked-in API D1 binding 的账户一致。这里只执行 provider metadata 与 `SELECT`。
- 配置环境去重后为 `staging`、`fashion-staging`、`production`。root/default 与 `staging`
  指向同一 Worker、D1 与 deployed preview bucket，不重复计数。
- Provider 另有 `shoppp-staging-preview` 与 `shoppp-production-preview` 两个 D1。授权
  `sqlite_master` 查询证明二者均无七个 governed Storefront Experience 表；它们被明确分类为
  Wrangler preview 资源，不进入 deployed API 数据零值的替代证明。

| Environment       | API Worker metadata                                                 | D1                                                                | Governed schema | Preview artifact namespace                                                                 |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `staging`         | deployed; pre-freeze version `0e01c999-8e04-4de7-a950-c0497cf50300` | `shoppp-staging` / `0c84c9e0-5ef1-4897-815e-5ec7efb7582e`         | 7/7 tables      | `shoppp-storefront-preview-artifacts`; exists, 0 objects                                   |
| `fashion-staging` | deployed; pre-freeze version `a1f5591a-30f3-4cde-99b0-e6d0f554f9f3` | `shoppp-fashion-staging` / `eb1ca4ef-3121-4d02-b20e-e619eac1cecc` | 7/7 tables      | `shoppp-fashion-staging-preview-artifacts`; exists, 2,806 objects / 221 MB total namespace |
| `production`      | `shoppp-api-production` absent                                      | `shoppp-production` / `e17ef1dc-d87c-40c7-b218-e4827d815168`      | 0/7 tables      | configured `shoppp-production-preview-artifacts` absent                                    |

Production is a configured but currently undeployed surface: there is no Worker, no governed table,
and no preview bucket on which a Decor lifecycle write can occur. It remains in every U7/U8
reconciliation and must be re-evaluated if provisioned later. The configured default-only
`shoppp-development-preview-artifacts` bucket is also absent and is not bound by a deployed named
environment.

### Authorized pre-freeze aggregate baseline

Both deployed governed databases were queried separately for exact `decor` and exact `decor-store`.
Each of the following metrics was `0` for both identities in both databases: drafts, draft version
sum, validations, migrations, snapshots, builds, runtime-dependent builds, uncleaned build artifacts,
grants, active grants, sessions, and active sessions. Aggregate draft/build max `updated_at` values
were `null`. Every response reported `success: true`, `changed_db: false`, `changes: 0`, and
`rows_written: 0`.

This is a characterization baseline only. U7 deletion authority still requires an effective
deployed exact-ID freeze, a fresh post-freeze aggregate result with zero deltas, and independent
reference-source verification.

## U7.1 local freeze implementation

- One exact-ID policy contains only `decor` and `decor-store`; near matches such as
  `decor-store-source` and `decorative` remain unaffected.
- Draft create/update/copy, validation, preview/approval snapshot, migration dry-run/approval,
  build/rebuild/result, grant create/redeem, and session authorization fail with the stable
  `storefront_theme_package_retired` response before governed row mutation.
- The operator package list exposes only writable `fashion-store`; immutable Decor draft, snapshot,
  and build reads remain available. Preview revocation remains a security action; automated expiry
  cleanup skips retired snapshot lineage and does not delete its grants, sessions, rows, or objects.
- Focused Worker evidence: 28 passed, including both exact identities, all guarded surfaces,
  preserved row counts/version/`updated_at`, retained reads, retained artifacts, and near-match
  rejection.

Deployment identity/time and post-freeze aggregate evidence are appended only after the exact
committed Worker is active. No runtime file or remote row/object has been removed.

## 2026-09-07 — U7 freeze convergence and zero-state gate

The exact freeze implementation is recoverable at commit `f2c8a86d` and was deployed only to the
two already-existing governed Workers. Deployment metadata confirms 100% convergence:

| Environment       | Freeze version                         | Effective at (UTC)            |
| ----------------- | -------------------------------------- | ----------------------------- |
| `staging`         | `4524918b-0d0a-40e7-875b-69e297769079` | `2026-09-07T12:29:08.242589Z` |
| `fashion-staging` | `e8a1f9fd-d013-4a3e-a678-6c40b1ed8419` | `2026-09-07T12:29:45.030085Z` |
| `production`      | no Worker; unchanged                   | not applicable                |

The first authorized post-convergence aggregate query returned zero for every metric and both exact
IDs in both governed databases: drafts, draft-version sum, validations, migrations, snapshots,
builds, runtime-dependent builds, uncleaned artifacts, grants, active grants, sessions, active
sessions, and immutable Catalog Release references. Both max `updated_at` values remain `null`.
Every query reported `success: true`, `changed_db: false`, `changes: 0`, and `rows_written: 0`.
Against the pre-freeze baseline, every row-count, version, and timestamp delta is therefore zero.

The aggregate query is deliberately repeated immediately before each U8 identity removal. This
covers a request that entered an old Worker before deployment convergence but completed afterward.
Security revocation remains allowed; any resulting grant/session aggregate change requires an
explicit disposition and cannot be silently accepted as a zero delta.

## U7 reference separation and recovery boundary

- `apps/storefront/theme-references/decor` and `decor-store` retain frozen source contracts,
  behavior/named-state ledgers, acceptance-adapter declarations, provenance, and source digests.
- The shared authoritative HTML and approved source assets remain under
  `templates/Crafto - The Multipurpose HTML5 Template/html`; the hash-pinned intake manifest remains
  `tools/storefront-theme-source-manifest.json`.
- `tools/storefront-source-equivalence-policy.json` resolves the frozen Decor source-intake
  contracts through the reference tree. The retained reference test verifies the source digest,
  both behavior ledgers, a controlled missing-region failure, and a Fashion-to-reference forbidden
  dependency scan. `bun run verify:source-equivalence` passed 163 tests, `bun run verify:themes`
  passed, and the workspace typecheck passed.
- Supported audit use is source/provenance verification, behavior-decision inspection, and
  immutable historical payload decoding. Exact retired-runtime visual replay is not a production
  capability; the recovery mechanism is the Git ref below.

Pre-removal recovery ref `f2c8a86d` contains both selectable runtime identities in full. Its exact
tree identities are `decor` tree `b5aa063bf37773391d8f69851af021a7aef26dfe` (113 files) and
`decor-store` tree `168ae5dd21bc6d424e08cf58727e0283984ddefd` (179 files). It also retains
`fixtures/experience/decor.json` blob `c3e5e8e66927068a722c6c4bf23d3284a94159ac`,
`fixtures/experience/decor-store.json` blob `770a1f82139fee324dee80f8eb61970d602a78d6`, both package
descriptors/presets/registries, and the generated catalog family. No runtime file or remote row/object
was deleted in U7.

## 2026-09-07 — U8.1 exact identity `decor` removal

Immediately before removal, provider metadata was reconciled again against account
`449e7f42fe4c4e55d5c674e2e7c57c8d`. The same four D1 namespaces were present: governed
`shoppp-staging` and `shoppp-fashion-staging`, undeployed/schema-empty `shoppp-production`, and the
two schema-empty Wrangler preview databases. Both governed Workers still reported 100% traffic on
the U7 freeze versions. The staging artifact bucket remained empty, the Fashion staging namespace
remained at 2,806 objects / 221 MB total, and the configured production bucket remained absent.

The fresh aggregate-only query again returned zero for exact `decor` and exact `decor-store` across
all governed metrics, including drafts/version sum, validations, migrations, snapshots, builds,
runtime-dependent builds, uncleaned artifacts, grants/sessions and Catalog Release references.
Every query reported `success: true`, `changed_db: false`, `changes: 0`, and `rows_written: 0`, with
both maximum `updated_at` values still `null`. This authorized only the first exact identity.

The recoverable local command was:

`git rm -r apps/storefront/app/themes/decor apps/storefront/fixtures/experience/decor.json apps/storefront/playwright.decor.config.ts apps/storefront/e2e/decor-motion.spec.ts apps/storefront/e2e/decor-theme.spec.ts apps/storefront/tests/decor-motion-contract.test.ts apps/storefront/tests/decor-preview-authority.test.ts tools/run-decor-acceptance.ts tools/run-decor-acceptance.test.ts`

Before that deletion, the sole source-intake-only local font was moved to
`apps/storefront/theme-references/decor-store/assets/fonts/plus-jakarta-sans-latin.woff2` and its
manifest pointers were updated. No remote row, object, namespace, Worker, branch, or recovery ref
was deleted.

After removal, generated catalogs, package registrations, fixture generation, build imports,
prerender selection, package commands, source-equivalence policy, fidelity matrices, and capture
matrices no longer expose exact `decor`. The generated catalog contains only `decor-store` and
`fashion-store`; the independent reference test remains green. Intermediate verification passed:
161 source-equivalence tests, the two-theme package verifier, 26 focused Worker API tests including
both exact retired IDs and immutable reads, the workspace typecheck, and the U1 disposition check.
The second identity remains intact and selectable until its independent fresh gate completes.
