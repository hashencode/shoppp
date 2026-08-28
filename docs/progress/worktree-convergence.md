# Worktree Convergence Evidence

This file records evidence for the local cleanup owned by
`docs/plans/2026-08-13-003-refactor-worktree-convergence-plan.md`. It is not a product-U queue or a
candidate-readiness ledger.

## WTC-U1 inventory — 2026-08-13

### Retained checkout

| Path                                    | HEAD / branch                                                 | State                                         | Disposition                                  |
| --------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `/Users/studio/Documents/GitHub/shoppp` | `c4ebebf5`, `codex/feat-fashion-store-functional-integration` | Dirty with the current documentation revision | Retain as the one long-lived Shoppp checkout |

### Removal targets

| Exact path                                   | HEAD / branch                                      | Live state                                                                | Recovery evidence                                                                                                          | Disposition                                                      |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/private/tmp/shoppp-ce-review.2EvGZu/tree`  | `8773f9e9`, detached                               | Clean                                                                     | HEAD is contained by the retained Fashion branch and its remote                                                            | Remove                                                           |
| `/private/tmp/shoppp-fashion-deploy`         | `4c6dc554`, detached                               | Seven tracked modifications plus five untracked preview-artifact files    | HEAD is contained by the retained Fashion branch and its remote; useful source/test outcomes are retained in later commits | Discard the audited dirty set, then remove                       |
| `/private/tmp/shoppp-live-cart-proof.PRoMhj` | `8773f9e9`, detached                               | Two generated modifications plus three untracked source/test/config files | HEAD is contained by the retained Fashion branch and its remote; later retained files supersede the dirty versions         | Discard the audited dirty set, then remove                       |
| `/Users/studio/.codex/worktrees/7922/shoppp` | `0c2cdb86`, `codex/feat-decor-store-source-parity` | Clean                                                                     | Local and remote branch point to the same HEAD; GitHub PR #6 is open and reported successful CI at audit time              | Remove checkout only; retain branch, PR, commits, and Decor plan |

All four targets were ordinary directories owned by `studio`, not symbolic links, at inventory time.
The live `git worktree list --porcelain` contained exactly the retained checkout and these four
targets. No target reported a worktree lock.

The Fashion and Decor branches diverge from merge base `c089dde9`: the retained Fashion branch has
22 unique commits and the Decor branch has 14. This cleanup does not merge, classify, or delete those
Decor commits.

### Bounded ignored-path classification

The following ignored classes are reproducible and can be discarded by directory class:

- root and workspace `node_modules/` directories — restored by the repository package install;
- `.nuxt/`, `.output/`, `dist`, and `worker-dist/` — framework/build output;
- generated collection, product, and Experience fixture directories — restored by their checked-in
  preparation/generation scripts;
- `test-results/` — one-run test output.

Material ignored or untracked output received separate treatment:

- Decor `artifacts/source-equivalence/reference-intake-u1/` contains four reference screenshots,
  metadata, and process preflight output. It is reproducible from the tracked
  `demo-decor-store.html` input with the capture command recorded in its preflight data. The tracked
  source digest matches the metadata (`90a907f8...e9271`). Discard the generated capture with the
  checkout; the Decor branch and source inputs remain.
- Fashion deploy `artifacts/preview/` contains a one-time build input, manifest, deployment record,
  headers, and root HTML. The retained implementation, preview configuration, and runbook are in
  commit `363d4ed6`. Do not copy or commit this environment-bound output; discard it with the
  checkout.

### Dirty temporary-worktree comparison

`shoppp-fashion-deploy` matched the approved disposition:

- checkout page, integration CSS, and live-Commerce spec were byte-identical to the retained
  checkout;
- `StorefrontExperience.vue` differed only by formatting;
- the Playwright configuration was an older form missing the retained preparation step;
- active Experience/Theme files were environment-specific generated output;
- the five preview files were the one-time artifacts described above.

`shoppp-live-cart-proof.PRoMhj` matched the approved disposition:

- its Playwright configuration was byte-identical to the retained checkout;
- its live-Commerce spec and preparation script were older than the retained versions, which add
  complete address handling, current MiniCart interaction, typed build-input construction, and
  testable helpers;
- active Experience/Theme files were environment-specific generated output.

Relevant retained history includes `309c4bda` (live cart and shipping), `4c6dc554` (review fixes),
and `363d4ed6` (Fashion staging preview acceptance); each is contained by the primary branch.

## Removal invariant

Immediately before each removal, re-check the exact path, directory/link type, ownership, worktree
registration, HEAD/ref reachability, lock state, and porcelain/ignored content. Any new path, changed
semantic diff, changed HEAD/ref, unexpected link, or failed removal stops the remaining cleanup.

### Evidence-retention limitation

The live checks classified every observed tracked, untracked, and material ignored path before the
four removals, but the raw per-path porcelain, ignored-path, comparison, and command transcripts were
not retained in this repository. After the dirty worktrees were removed, their exact raw manifests
could no longer be reconstructed. The counts, material classes, semantic comparison outcomes, retained
commit references, and post-removal topology below remain available, but they are not a substitute for
the missing raw manifests.

WTC-U1 and WTC-U2 are therefore **not complete**. Current topology and committed-history
recoverability can be reverified, but the discarded uncommitted and ignored inventories cannot be
independently replayed. Future dirty-worktree cleanup must retain the exact pre-removal manifests and
removal command before deleting the checkout; this execution is not a reusable force-removal precedent.

## Re-execution audit — 2026-08-14

The completion claim was withdrawn and the observable checks were rerun without deleting or changing
any worktree, branch, ref, or file:

| Check                        | Observed result                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live worktree enumeration    | Exactly one registered worktree: `/Users/studio/Documents/GitHub/shoppp`, HEAD `8a3723d4`, branch `codex/feat-fashion-store-functional-integration` |
| Primary checkout boundary    | Ordinary directory owned by `studio`; not a symbolic link                                                                                           |
| Stale worktree metadata      | `git worktree prune --dry-run --verbose` reported nothing to prune                                                                                  |
| Four historical target paths | All four paths are absent                                                                                                                           |
| Decor recoverability         | Local and remote `codex/feat-decor-store-source-parity` refs both resolve to `0c2cdb86`; that commit remains reachable from each ref                |
| Destructive action           | None performed during this audit                                                                                                                    |

This rerun confirms the current one-worktree steady state and retained Decor history. It cannot prove
the exact contents of the already deleted dirty worktrees immediately before removal. U1 and U2 stay
not complete for that reason; U3's current operating rule remains valid.

## Historical WTC-U2 removal record — 2026-08-13

The four targets were revalidated and removed one at a time with Git's worktree mechanism. The dirty
temporary targets, and the Decor checkout containing ignored generated capture output, were removed with
Git's force option after their approved live checks; the clean detached review checkout was removed
normally. No command was retried with a stronger primitive after failure:

| Removed checkout                             | Removal result                                                             | Recoverability after removal                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/private/tmp/shoppp-ce-review.2EvGZu/tree`  | Removed cleanly                                                            | HEAD `8773f9e9` remains in the retained Fashion branch history                                                |
| `/Users/studio/.codex/worktrees/7922/shoppp` | Checkout removed, including its reproducible ignored capture output        | Local/remote branch `codex/feat-decor-store-source-parity` still points to `0c2cdb86`; PR #6 was not modified |
| `/private/tmp/shoppp-fashion-deploy`         | Audited dirty checkout and one-time preview output discarded, then removed | Base HEAD `4c6dc554` and all accepted implementation outcomes remain in the primary branch history            |
| `/private/tmp/shoppp-live-cart-proof.PRoMhj` | Audited superseded/generated content discarded, then removed               | Base HEAD `8773f9e9` and later live-Commerce outcomes remain in the primary branch history                    |

No removal command failed, no stronger retry was used after a removal failure, and no branch, PR,
tag, product plan, or candidate state was deleted or promoted. The discarded uncommitted/generated
and environment-bound artifacts cannot be recovered from Git.

## WTC-U3 steady state — 2026-08-13

Final enumeration contains one worktree:

| Path                                    | Role                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/Users/studio/Documents/GitHub/shoppp` | Long-lived checkout for Shoppp as a whole, including Fashion Store, Decor Store, and shared platform work |

`AGENTS.md` now requires temporary worktrees to record a branch/ref, owner, purpose, and cleanup
condition. Worktree topology does not couple the Fashion Store and Decor Store schedules, and it does
not determine candidate scope. At convergence completion, the active product-development pointer was
`FS-U1.1`; the product master plan owns all later pointer changes.

## Bounded temporary-worktree cleanup — 2026-08-28

This is a new live-target cleanup record under the standing `AGENTS.md` worktree rules. It does not
repair or complete historical WTC-U1/U2, merge any product branch, advance Fashion or Decor status,
or change REL/DC/PG authority. The user authorized execution after reviewing the named cleanup and
preservation recommendations. No writer matched any exact target path, no target was locked, and
`git worktree prune --dry-run --verbose` reported nothing to prune.

### Exact pre-removal inventory and manifests

| Exact path                                                                     | Branch / inventory HEAD                                                             | Type and lock                                         | Tracked manifest | Untracked manifest           | Ref recovery                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/Users/studio/Documents/GitHub/shoppp/.worktrees/relax-ci-u7-signing`         | `codex/relax-ci-u7-signing` / `5a4dbfd68818c4848f61b345039a3d8e78a1f356`            | Ordinary directory with regular `.git` file; unlocked | Empty            | Empty                        | Inventory HEAD equals `origin/main`; the final pre-removal HEAD is revalidated after this evidence commit   |
| `/Users/studio/Documents/GitHub/shoppp/.worktrees/fashion-u8-governed-harness` | `codex/fashion-u8-governed-harness` / `91e5db248f7e53c9029c73539ee7d0dfa575233a`    | Ordinary directory with regular `.git` file; unlocked | Empty            | Two exact files listed below | HEAD is contained by `origin/main` and retained by local and remote branch refs                             |
| `/Users/studio/Documents/GitHub/shoppp/.worktrees/decor-store-source-parity`   | `codex/feat-decor-store-source-parity` / `db1a362a680421e2c0b7dbb966f92f5fb03d7105` | Ordinary directory with regular `.git` file; unlocked | Empty            | Empty                        | Local and remote branch refs both resolve to exact HEAD after pushing the ten previously local-only commits |

The Fashion harness untracked manifest is exact and content was not copied into repository evidence:

- `apps/admin/test-results-fashion-staging/.last-run.json` — 96 bytes, SHA-256
  `a107aee6e64c573a9fa3cdaf5d2cb3c2df398e7a2356eac19b58ad1e89a3c6be`;
- `apps/admin/test-results-fashion-staging/storefront-theme-preview.l-dc8e6-ew-return-and-approval-path/error-context.md`
  — 27,439 bytes, SHA-256
  `8648b07a7c434ab9b4d03791b97f3aece93f7cdafe321e793edd79e77726564c`.

These are one-run failed-test diagnostics, not retained product, release, candidate, DC, or PG
evidence. Their exact paths and digests are retained; their contents will be discarded with the
checkout and will not be recoverable from Git.

The exact material ignored-path manifest, collapsed only at ignored directory boundaries, is:

- `relax-ci-u7-signing`: `apps/storefront/.nuxt/`,
  `apps/storefront/app/generated/collections/`, `apps/storefront/app/generated/products/`, and
  `apps/storefront/test-results/`;
- `fashion-u8-governed-harness`: `apps/admin/dist/`, `apps/admin/test-results/`,
  `apps/api/.wrangler/`, and `apps/storefront/.nuxt/`;
- `decor-store-source-parity`: `apps/storefront/.nuxt/`, `apps/storefront/.output/`,
  `apps/storefront/app/generated/collections/`, `apps/storefront/app/generated/products/`,
  `apps/storefront/dist`, `apps/storefront/fixtures/experience/.generated/`,
  `apps/storefront/test-results/`, and `apps/storefront/worker-dist/`.

Root/workspace `node_modules/` paths are excluded from the material manifest as reproducible
dependency installations. The listed `.nuxt`, `.output`, `dist`, `worker-dist`, generated fixture,
and test-result paths have the same reproducible generated-output disposition already established
under this file's bounded ignored-path classification. No ignored path is candidate or release
authority.

The exact approved manager invocation is:

```text
printf 'y\\n' | bash /Users/studio/.codex/skills/git-worktree/scripts/worktree-manager.sh cleanup
```

It resolves the three absolute targets listed above from the primary checkout. Immediately before
invocation, each exact path, type, registration, branch, HEAD, lock, writer, tracked/untracked state,
material ignored manifest, and retained ref must match this record (except the CI cleanup checkout's
expected advance to the commit containing this record). A mismatch stops removal. The manager uses
Git's force option; this authorization is bounded to these three exact paths and manifests and is not
a reusable cleanup precedent. No failed removal may be retried with a stronger primitive.
