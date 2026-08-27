# GitHub-first CI transition evidence

This file retains non-secret operational observations for the GitHub-first bridge. It is not a
second current-unit queue; the active checkpoint in
[`2026-08-26-1756-refactor-github-first-ci-transition-plan.md`](../plans/2026-08-26-1756-refactor-github-first-ci-transition-plan.md)
alone owns current status, blockers, and next action.

## Pre-removal eligibility observation — 2026-08-27

### Repository implementation available

- CI-GH-U1 authority reconciliation: `c09f05a7`.
- CI-GH-U2 reusable hosted validation and attestation contract: `dafeb412`.
- CI-GH-U3 same-run protected deployment binding: exact commit
  `de03d93a416cdcf0dcfdd6dd4d7ed57ab45c1460`.
- The U2/U3 focused contract suite passed locally with 49 tests, TypeScript tool checking passed,
  both workflow YAML files parsed, every maintained validation/deployment action used a full commit
  SHA, no workflow requested a write-capable `GITHUB_TOKEN`, and the release gate list plus
  Lighthouse threshold file remained unchanged.
- These local results prove repository implementation only. They are not GitHub-hosted validation,
  staging deployment, rollback, or release evidence.

### Protected-default integration not yet present

At `2026-08-27 09:44:33 +0800`, `origin/main` resolved to exact commit
`63b71c824ff2ac5852c7cd9bae951e286603f1dd`. It did not contain CI-GH-U1–U3, so the bridge's own
credential-free default-branch workflow preflight could not authorize the new path. No branch,
default ref, environment, or remote content was changed during this observation.

### GitHub-hosted execution blocker

- `gh run list --workflow full-validation.yml` returned no runs. No hosted validation or deployment
  was dispatched from this worktree.
- GitHub Actions run `32830213920` for exact commit
  `3d63fb8cee2a8af853ae0528a793e33542c35019` completed as failure on 2026-08-25. Its `quality` job
  (`97746978847`) had zero steps. The job annotation states that it was not started because recent
  account payments failed or the spending limit needed to be increased.
- The repository exposes `staging`, `staging-human-access`, and `production` GitHub environments, in
  addition to the independent `fashion-staging` environment. This observation inspected environment
  names and policy metadata only; it did not read, write, rotate, or print any secret or variable.

### Evidence classification and stop boundary

CI-GH-U4 still lacks every required operational result: a passing exact-SHA hosted 17-gate run,
bound attestation/report/deployable artifacts, controlled mismatch refusal, captured pre-mutation
Worker and D1 baseline, staging deployment and post-deployment checks, rollback or forward
reconciliation, and verification of the restored safe staging state. The billing failure is blocker
evidence, not a substitute for those results. CI-GH-U5 is
therefore not authorized, and no Docker, Intel, capsule, candidate-evidence, signing, retention, or
restore implementation was removed. No staging or production mutation occurred.

## Local review remediation — 2026-08-27

Commit `57ce4d9e` applies the actionable findings from the structured local review without changing
the bridge checkpoint or crossing the CI-GH-U4 dependency boundary. The remediation moves deploy
credentials behind a protected-code, same-run artifact verification job; restores the idempotent
validation-failure callback in the protected `staging` environment; makes scheduled validation
fail closed without an approved immutable Catalog release ID; limits the Catalog credential to the
release-validation step and gate; validates report and attestation JSON at runtime; and verifies
the complete nine-artifact inventory plus refusal cases.

After remediation, the focused workflow and verifier suite passed with 84 tests and 599
expectations, the complete `tools` suite passed with 367 tests and 1,534 expectations, TypeScript
tool checking and repository lint passed, both workflow YAML files parsed, boundary checking and
`git diff --check` passed, and every external Action reference in the maintained workflows remained
pinned to a full commit SHA. The release contract still contains exactly 17 gates and the existing
Lighthouse thresholds were not changed.

These are local implementation and review results only. They do not prove a GitHub-hosted run,
staging deployment, rollback/reconciliation, Intel execution, retention, restoration, signing, or
production behavior, and they do not relax the CI-GH-U4 blocker recorded above.

## Protected-default integration and exact-source dispatch — 2026-08-27

The isolated bridge branch was a pure fast-forward of `origin/main`, and the exact implementation
was pushed without force or a production workflow. The protected default branch then resolved to
`bad6aeda5dac3727a039b5ead4f69020ca3ac000`; this removes the earlier integration blocker without
claiming any hosted or staging result.

Hosted full-validation run `33035917400` was explicitly dispatched from `main` for exact source
`bad6aeda5dac3727a039b5ead4f69020ca3ac000` and the existing staging variable
`LAST_KNOWN_GOOD_RELEASE_ID` value `representative-release-2026-07-30`. Preflight job `98398449298`
failed with zero steps. Its GitHub annotation states that the job did not start because recent
account payments failed or the spending limit must be increased; the dependent quality job was
skipped with zero steps. No hosted gate executed, no artifact or attestation was produced, no
environment secret was exposed to a runner, and no staging or production mutation occurred.

Run `33035917400` is current CI-GH-U4 billing-blocker evidence only. It does not satisfy any hosted
validation, controlled-refusal, deployment, post-deployment, rollback, reconciliation, restoration,
signing, retention, DC, or PG requirement.

## Public-repository retry and hosted validation — 2026-08-27

After the repository became public, attempt 2 of run `33035917400` started on GitHub-hosted Linux
instead of failing at billing preflight. Its preflight job `98400701920` passed, but quality job
`98400745140` failed because the default Admin browser suite incorrectly included the interactive
`storefront-theme-preview.live.spec.ts` acceptance file without its separately governed Fashion U8
manifest. Diagnostics artifact `9632615394` retained that real failure. This attempt proves billing
execution resumed; it is not a passing hosted validation or Fashion acceptance result.

Commit `b1ea32e33335e964f1578af057e87a008ab27df0` excludes `*.live.spec.ts` from the default Admin
Playwright configuration while leaving the dedicated Fashion staging configuration authoritative.
Its focused configuration tests, the full 302-test Admin Rstest suite, the default and dedicated
Playwright discovery checks, the 77-test CI/deploy/release validator suite, lint, boundaries, and
diff checks passed locally. Those local checks are implementation evidence only.

An operator input error then supplied nonexistent source SHA
`b1ea32e3b7b512a4f8eaa9fb2930a574b9cc73a4` to hosted run `33041864836`. Preflight job
`98417033760` rejected it as an invalid commit before quality ran. No credentialed validation,
staging, or production job started. This is genuine fail-closed source-refusal evidence, but it was
not the plan's deliberate controlled source/report/artifact mismatch exercise and is not classified
as that missing proof.

Hosted run `33041884429` then passed for exact protected-default source
`b1ea32e33335e964f1578af057e87a008ab27df0`. Preflight job `98417096118` and GitHub-hosted Linux X64
quality job `98417114486` both succeeded. The retained release report records 17 ordered passing
gates and unchanged release semantics. Artifact `9634591187`, named
`validated-release-b1ea32e33335e964f1578af057e87a008ab27df0-33041884429-attempt-1`, binds:

- source tree `7cecaefcae784996215c54432bb90fb6fe40b329`;
- run `33041884429`, attempt `1`, report digest
  `sha256:1b7eec5221d6b1811a0cb0264e44991336fa4c24f9fef573bcb5e56092bc2ba0`, and attestation file digest
  `sha256:6c9f701b58a7abb5633389a07e3d39027f990b4cceb83fd64c01a2a142bd7f73`;
- Ubuntu runner image `ubuntu24/20260816.277.1`, Linux X64, Bun `1.3.5`, Playwright `1.62.1`,
  Chromium `151.0.7922.34`, and the captured system/font identities; and
- all nine declared storefront, admin, API, configuration, and D1-migration artifact digests.

This is valid intermediate hosted 17-gate evidence and confirms the billing blocker is removed. It
does not complete CI-GH-U4: no staging deployment ran, no pre-mutation Worker/D1 baseline was
captured, no planned controlled mismatch was exercised, and no Worker rollback, D1 reconciliation,
or restored-state verification occurred. No production mutation occurred, and U5 remains
unauthorized.

## Controlled mismatch and first rollback-capable dispatch — 2026-08-27

Commit `6c6cd6486463f19e61431a77b1288c31e351d1cd` added the staging-only rollback rehearsal contract,
including exact pre-mutation Worker/D1 capture, pending-migration refusal, exact Worker restoration,
run-scoped D1 forward reconciliation, retained proof-history classification, protected-state
verification, and production/rehearsal conflict refusal. The complete local tools suite passed 373
tests; TypeScript, format, lint, boundaries, YAML parsing, and diff checks passed. Structured local
review findings were applied before the commit. These remain local implementation results.

Deliberate controlled mismatch run `33045559474` requested nonexistent 40-character source
`0000000000000000000000000000000000000001`. Deploy preflight job `98428612399` completed, and the
reusable validation preflight job `98428651461` rejected source reachability. Quality, staging,
proof, restoration, human approval, and production jobs were skipped. The validation-failure Catalog
callback returned HTTP 409, but no Cloudflare staging or production mutation occurred.

Exact-source rehearsal run `33045612910` requested
`6c6cd6486463f19e61431a77b1288c31e351d1cd`, with rollback rehearsal enabled and production
promotion disabled. Deploy preflight job `98428783393` and reusable validation preflight job
`98428810262` passed. Quality job `98428845739` then failed before running any release gate because
strict staging validation received an empty `NUXT_CATALOG_RELEASE_TOKEN`: the reusable workflow call
had neither declared nor passed `BUILD_MANIFEST_TOKEN`. Every staging, proof, restoration, approval,
and production job was skipped. This is a real credential-wiring blocker, not hosted, staging, or
rollback proof; CI-GH-U4 remains open and U5 remains unauthorized.

Commit `bd53945a8aafc24fe63ae8c4e418710ec936edce` explicitly declared the reusable workflow's
`BUILD_MANIFEST_TOKEN` and passed only that named secret from `deploy.yml`; it did not use
`secrets: inherit`. Eighty-three focused workflow/release tests, TypeScript, YAML parsing, and diff
checks passed locally. Exact-source run `33045869299` confirmed the token path by passing both
preflights and entering the unchanged release test gate. Quality job `98429687655` then failed in
`candidate evidence operating contract > keeps the solo baseline separate from the optional signed
profile` because that test still expected the prior CI-GH-U4 next-action and blocker wording. All
staging, proof, restoration, approval, and production jobs were skipped. This is real hosted failure
evidence only; it is not a passing 17-gate or staging-restoration proof.

## Exact-source rollback refusal and verified safe restoration — 2026-08-27

Commit `5b2e9d73905deb51f84d2ee1c4d0ed15191d597b` aligned the CI bridge governance contract. Its local
focused workflow/release suite passed 84 tests and 685 expectations; TypeScript, formatting, YAML
parsing, and diff checks passed. Exact-source deploy run `33046259704` then passed deployment
preflight job `98430860137`, reusable validation preflight job `98430894194`, the unchanged 17-gate
quality job `98430917302`, and same-run deployment-input verification job `98435824176`. Bound
validation artifact `9636328676` is named
`validated-release-5b2e9d73905deb51f84d2ee1c4d0ed15191d597b-33046259704-attempt-1`.

Before any new Worker received traffic, deploy job `98435873207` captured exact Worker/D1 baseline
artifact `9636347253` with digest
`sha256:32f46118c51b911a12bcedeb0dfb8a3a2f5c17f7e5aebbe7e133da5f8953ba81`, exported test D1 to
artifact `9636349427`, and listed the remote migration state. The rollback rehearsal correctly
refused because migrations `0018_storefront_preview_revocation.sql` through
`0022_admin_identity_expiry.sql` remain pending. Upload, migration, deployment, and staging proof
steps were skipped; no new Worker version or production resource was deployed.

Recovery job `98436002794` validated the captured baseline, restored the captured API, Admin, and
Storefront Worker versions at 100%, reconciled run-scoped D1 proof data, verified the restored Worker
and D1 safety projection, and uploaded restoration artifact `9636364856` with digest
`sha256:51ea1f7a73d31781bbce3cea16743be6508a177a53e3375f708660c454bd2037` and 90-day retention. Its
final failed-status Catalog callback returned HTTP 409 because the representative release was
already terminal; the explicit workflow outcomes remained Worker restoration `success`, D1
reconciliation `success`, and restored state `success`. This run is valid hosted validation,
fail-closed migration-refusal, baseline-capture, and safe-restoration evidence, but it is not a
successful staging deployment/post-deployment rollback rehearsal. CI-GH-U4 remains open and U5
remains unauthorized.

## Forward-aligned staging and canonical-release refusal — 2026-08-27

Commit `9928ae85b92b4dcde698c69438b39055849bcc61` was dispatched through the standard staging-only
path with production promotion and rollback rehearsal both disabled. Run `33048142888` passed
deployment preflight job `98436914852`, reusable validation preflight job `98436960643`, all 17
unchanged release gates in quality job `98436988731`, same-run deployment-input verification job
`98442016884`, and deploy-staging job `98442094728`. The run retained validation artifact
`9637061809` and pre-migration D1 export artifact `9637080055`, applied migrations `0018`–`0022`,
verified D1 integrity and protected administrator state, and deployed all three validated Worker
versions to staging. No production job ran.

Staging proof job `98442292600` provisioned the scoped proof credentials, verified administrator
authentication, prepared inventory and isolated fixtures, and passed the service-principal access
proof. The public/protected journey then failed when the Atlas product's first cart-line mutation
returned `catalog_release_invalid`: the deployed API correctly found that immutable release
`representative-release-2026-07-30` does not satisfy the canonical v2 Catalog Release schema. The
retained staging-evidence artifact is `9637131133` with digest
`sha256:f635e104b7dc4003f2097df9965a90b2f9b346374bb7a4e2ba380dfbabc98584`; transient proof cleanup
succeeded. The failed-result callback returned HTTP 409 because the legacy release was already
terminal. No rollback rehearsal was requested in this forward-alignment run.

Root-cause investigation found that `apps/storefront/scripts/prepare-release.ts` treated fetched
JSON as a TypeScript fixture type instead of runtime-validating the canonical schema. Consequently,
the hosted gates could build a legacy manifest that `apps/api/src/storefront-experience/catalog-resources.ts`
must reject during Commerce mutation. The repository fix makes local and fetched release sources
pass the shared `canonicalCatalogReleaseSchema` before any generated output is written and upgrades
the default fixture to canonical v2. The focused regression test first failed on the legacy fixture,
then the complete 239-test Storefront unit suite and Storefront typecheck passed after the fix.
These local results are implementation evidence only.

CI-GH-U4 remains open. The next hosted exercise requires a new immutable canonical successor in
ordinary staging and an exact-source rollback rehearsal; the historical release will not be
rewritten, local results do not substitute for GitHub/staging proof, U5 remains unauthorized, and
no production mutation is authorized.

## Protected canonical-successor preparation refusal — 2026-08-27

Commits `ea1f065e703ef2f7393c2644bbecf1ddba47125a` and
`750b25cb49398c45e0008fb723d2e0641a1ce5f5` integrated fail-closed canonical source validation and a
staging-only protected successor-preparation workflow. The preparation path scopes Catalog and
Cloudflare credentials to separate required steps, exports D1 before insertion, refuses release-ID
collisions, never updates the predecessor, validates the canonical manifest, verifies the protected
endpoint read-back, and retains a non-secret receipt. Its complete local tools suite passed 377 tests
and 1,630 expectations; tools TypeScript, YAML parsing, formatting, lint, boundaries, and diff checks
also passed. These remain local implementation results.

Protected preparation run `33051564144` at exact source `750b25cb49398c45e0008fb723d2e0641a1ce5f5`
exported ordinary staging D1 and retained artifact `9637815283`, named
`staging-catalog-successor-d1-before-33051564144-attempt-1`, with digest
`sha256:7fb0a34c7a196a3588bf7fc838c9d1283539dd229ca44ca1b7f8ae782c33cb37` and seven-day retention.
It fetched the immutable legacy manifest and queried its exact ordinary-staging product and
collection identities. Generation then correctly failed before insertion because those legacy D1
primary keys are neither canonical prefixed public IDs nor UUIDs. No successor or audit row was
inserted, no existing release was updated, and no production job or resource ran.

That run invalidated the assumption that ordinary staging's legacy database identities already met
the newer public-ID contract. The corrected projection derives deterministic canonical product and
collection IDs from their stable slugs for the immutable manifest, while retaining the actual legacy
product ID only in `catalog_releases.product_id` to satisfy its D1 foreign key. A new protected run,
not this failed run or local tests, must prove backup, collision refusal, exact insertion, endpoint
read-back, and receipt before the rollback rehearsal can begin. CI-GH-U4 remains open and U5 remains
unauthorized.
