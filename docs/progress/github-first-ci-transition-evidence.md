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

Corrected commit `32f2f01737ebadbd0ecfa33d986d8ccbd2064d9b` derives deterministic canonical
manifest identities from stable slugs when legacy D1 primary keys do not satisfy the public-ID
contract, while preserving the actual first product ID only for the release row's D1 foreign key.
Its complete tools suite passed 377 tests and 1,632 expectations; tools TypeScript, formatting,
lint, boundaries, and diff checks passed.

Protected preparation run `33051894271` at that exact source passed every step. It retained
pre-insertion D1 artifact `9637962953`, named
`staging-catalog-successor-d1-before-33051894271-attempt-1`, with digest
`sha256:6589541fcfe60dc817fc117bd374df92a117d4396749bef664dd530c72e6a3d4` and seven-day retention.
It then generated and inserted new immutable successor `staging-canonical-2026-08-27-ci-gh-u4`,
verified exact semantic equality through the protected build endpoint, verified its D1 `building`
state and run correlation, and retained 90-day manifest/receipt artifact `9637966514` with digest
`sha256:4a103d599fca24214b1d2ec9c84ed704ab8ab27c81e22faa5131af419ae601ca`.
The historical release was not updated and no production job or resource ran.

The successor is now valid input for the missing exact-source staging rollback rehearsal. This
preparation proves only the bounded staging input and its backup/read-back contract; it does not
substitute for the 17-gate deploy run, staging journey, Worker restoration, D1 reconciliation, or
restored-state evidence. CI-GH-U4 and the U5 dependency boundary therefore remain open.

## Canonical representative-scale refusal — 2026-08-27

Exact-source rollback rehearsal run `33052078852` used protected-default source
`ac2fb76747b08311a5767ccf244f86f6b8884c80`, successor
`staging-canonical-2026-08-27-ci-gh-u4`, rollback rehearsal enabled, and production promotion
disabled. Deployment preflight job `98449803727` and reusable validation preflight job
`98449842719` passed. GitHub-hosted quality job `98449885215` then failed in the unchanged
`representative-catalog` gate before same-run deployment-input verification or any Cloudflare
staging credential and mutation.

The retained diagnostics artifact is `9638184208`, named
`validation-diagnostics-ac2fb76747b08311a5767ccf244f86f6b8884c80-33052078852-attempt-1`, with
digest `sha256:db79eee920b4b750e8486758a7d5fe8493d164b8fdf688458e402c260ac21c41` and
expiry `2026-09-10T08:05:32Z`. The gate exposed that `tools/verify-catalog-scale.ts` still generated
a legacy-shaped scale fixture: its redirect lacked canonical status `301`, expanded collections and
products reused base manifest IDs, reciprocal ID arrays were stale, and the route inventory did not
contain the generated scale routes. Runtime canonical validation therefore rejected the fixture; it
did not indicate a defect in the protected successor.

Failure callback job `98451182117` succeeded and transitioned the immutable successor to terminal
`failed` with failure code `candidate_validation_failed`. Deployment-input verification, staging
deployment, staging proof, restoration, human approval, and production jobs were all skipped. No
staging or production mutation occurred. That successor cannot be reused or rewritten.

The regression test in `tools/verify-catalog-scale.test.ts` first failed by parsing the representative
fixture through `canonicalCatalogReleaseSchema`. The correction now generates unique canonical
product and collection IDs, reciprocal membership IDs, an explicit 301 redirect, and the complete
scale route inventory. The focused test and complete tools suite pass locally (377 tests, 1,633
expectations), as do tools TypeScript, focused formatting and lint, and import boundaries. The host's
Homebrew Node executable currently has a missing `libsimdjson.26.dylib`; checks invoked directly
through the repository's Bun runtime passed, and this local result is not represented as GitHub
evidence.

CI-GH-U4 remains open and U5 remains unauthorized. The next hosted sequence is to integrate this
correction, prepare a new immutable canonical ordinary-staging successor from that exact source, and
run the new successor through the full exact-source rollback rehearsal with production disabled.

## Replacement canonical successor prepared — 2026-08-27

Correction commit `88528d05db121dc508a195c555ec93fbfc8e0e5c` passed the representative Catalog
schema regression and was integrated into the protected default branch. Protected preparation run
`33053063337` at that exact source passed every step for new immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-b`. It retained pre-insertion D1 artifact `9638418314`, named
`staging-catalog-successor-d1-before-33053063337-attempt-1`, with digest
`sha256:cf911096ca6336fa52db82ddf435a0d96dc6c665019f6897e5f39bf186040184` and expiry
`2026-09-03T08:13:32Z`.

The run then passed collision refusal, deterministic canonical generation, immutable insertion,
exact semantic read-back through the protected build endpoint, and D1 `building` state/correlation
verification. It retained manifest/receipt artifact `9638422206`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-b-33053063337-attempt-1`, with
digest `sha256:3c2c2596ad9d1cb12f5f46b4f747f24c8c52dcabf2cf1a15a3000e9eb8d6c789` and
expiry `2026-11-25T08:13:07Z`. No predecessor was rewritten and no production job or resource ran.

This new successor is valid input for the missing exact-source rollback rehearsal. Preparation does
not substitute for its 17-gate validation, exact deployment binding, staging proof, Worker
restoration, D1 reconciliation, or restored-state evidence. CI-GH-U4 and the U5 dependency boundary
remain open until that exercise passes.

## Exact-artifact overwrite refusal and safe restoration — 2026-08-27

Exact-source rollback rehearsal run `33053216917` used protected-default source
`34905ccef3b16b807c3c4e5c6788548a75c9f008`, successor
`staging-canonical-2026-08-27-ci-gh-u4-b`, rollback rehearsal enabled, and production promotion
disabled. Both credential-free preflights passed. GitHub-hosted quality job `98453615902` passed all
17 unchanged release gates and retained exact validation artifact `9639060520`, named
`validated-release-34905ccef3b16b807c3c4e5c6788548a75c9f008-33053216917-attempt-1`, with
digest `sha256:8f2ea783ef5193e37c8d0731f7f5e101f3dbe4b389bc528e09eaf4d8637b8d37` and
expiry `2026-09-26T08:34:59Z`. Same-run deployment-input verification job `98458368020` passed.

Protected deploy job `98458429826` captured and retained exact Worker/D1 baseline artifact
`9639081309` with digest
`sha256:7a7e7f0c5ef67ca47bb049c108ae42cab4253c60ce43259f46fe9ff1e3f8f14b` and
expiry `2026-11-25T08:15:14Z`. It exported D1 artifact `9639084029` with digest
`sha256:77eb6687ca70d11818498a7279c4c2433d0ae7062f156d1d00c6127c17fef75e` and
expiry `2026-09-03T08:35:46Z`, found no pending migration, passed protected-administrator and D1
integrity checks, and deployed all three exact validated Worker versions to staging.

Staging proof job `98458690018` passed credential provisioning, administrator secret verification,
inventory/fixture preparation, and service-principal access. The public purchase journey created a
cart but its cart-line request carried predecessor `representative-release-2026-07-30`; the API
correctly returned HTTP 422 `catalog_release_invalid`, and navigation remained on the product page.
The retained staging evidence is artifact `9639142127` with digest
`sha256:d722abe0911d89c58985554acff2bd9cfc4d8eaa52adce16a62b482cd47bb5cf` and
expiry `2026-11-25T08:15:14Z`. Transient proof cleanup passed; latency and success callbacks were
skipped.

The trace confirmed an exact-artifact construction bug rather than a flaky click or successor
defect. `production-builds` fetched and built the selected successor, but the later
`browser-journeys`, `accessibility`, and `performance` gates each started a local web server by
running storefront build again. Catalog URL/token were correctly absent outside the production-build
gate, so those later builds selected the default legacy fixture and the last one overwrote the
deployable `.output`. Artifact binding then faithfully retained that wrong final bundle. The fix
keeps Catalog read credentials exclusive to `production-builds` and makes the three later browser
gates serve and test that already validated build through a non-secret reuse marker instead of
rebuilding it.

Recovery job `98459034561` validated the captured baseline, restored all three exact Worker versions,
reconciled run-scoped D1 proof data, verified restored Worker and D1 safe state, recorded the failed
rehearsal, and retained restoration artifact `9639162753` with digest
`sha256:f20fdb2bac2821520d9e50f924cf583c664c5e699f57438088309c3a70ab242c` and
expiry `2026-11-25T08:15:14Z`. Human access, production approval, and production promotion were all
skipped. The failed callback made the immutable successor terminal; it will not be reused.

CI-GH-U4 remains open and U5 remains unauthorized. The next hosted sequence is to integrate the
exact-artifact reuse correction, prepare another immutable canonical staging successor, and run the
new successor through the full rollback rehearsal with production disabled.

## Exact-artifact correction and replacement successor — 2026-08-27

Commit `7730951f35fb9cf81b3a3e346d9638370ab92945` keeps Catalog URL/token exposure exclusive to
`production-builds`. It gives only the non-secret `STOREFRONT_REUSE_VALIDATED_BUILD=1` marker to the
`browser-journeys`, `accessibility`, and `performance` gates, causing their Playwright servers to
exercise the already validated storefront output without rebuilding it. The complete local tools
suite passed 377 tests with 1,654 expectations; focused governance/release tests, tools TypeScript,
ESLint, import boundaries, configuration imports, formatting, and diff checks also passed. These
local checks are implementation evidence only and do not replace GitHub-hosted proof.

Protected preparation run `33055956466`, job `98462680378`, used exact protected-default source
`7730951f35fb9cf81b3a3e346d9638370ab92945` to create immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-c`. It passed the staging-only request guard, retained the
pre-insertion D1 export, fetched the predecessor, projected exact staging identities, refused
collisions, generated the canonical successor, inserted it immutably, read it back through the
protected build endpoint, and verified its exact D1 state.

The pre-insertion D1 export is official artifact `9639597171`, named
`staging-catalog-successor-d1-before-33055956466-attempt-1`, with digest
`sha256:b15f68267d97f8723636a260dedc95cbf87f038f9c1ecf180376a4c1fb7cc44d` and expiry
`2026-09-03T08:52:46Z`. The canonical manifest/receipt is official artifact `9639601822`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-c-33055956466-attempt-1`, with
digest `sha256:cae0ce814027efe54d984b9411f39f75b07c8dd8fbf2213f7e08a72b640318d9` and expiry
`2026-11-25T08:52:23Z`. No predecessor was rewritten and no production job or resource ran.

Preparation is not CI-GH-U4 completion. U5 remains unauthorized until an exact clean source runs
this successor through all 17 unchanged hosted gates, same-run artifact binding, staging proof,
exact Worker restoration, D1 reconciliation, and restored safe-state verification with production
disabled.

## Release-aware journey refusal — 2026-08-27

Exact-source rollback rehearsal run `33056208460` bound protected-default source
`2bc8de12c19531257642023f81b522c35d8e3f44` to immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-c`, with rollback rehearsal enabled and production promotion
disabled. Preflight jobs `98463518029` and `98463575128` passed. Hosted quality job `98463609919`
passed the first 14 unchanged gates: reproducible install, format, lint, types, source equivalence,
theme contracts, fidelity contract, unit contract, Worker integration, administrator browser,
representative catalog, theme matrix, production builds, and static output.

The `browser-journeys` gate then failed both desktop and mobile instances of the cart journey. The
preserved build correctly submitted release ID `staging-canonical-2026-08-27-ci-gh-u4-c`, proving
that the exact-artifact reuse correction prevented the earlier legacy rebuild. The test itself still
expected hard-coded predecessor `representative-release-2026-07-30`, so it rejected the correct
request. This is a deterministic assertion defect, not a billing failure, deployment-input failure,
or staging response.

Official validation diagnostic artifact `9640303957`, named
`validation-diagnostics-2bc8de12c19531257642023f81b522c35d8e3f44-33056208460-attempt-1`, has
digest `sha256:e3219b1d24ae0eefe37f5427111fe78b7bf4d713c60b4825ad6d228ca358d228` and expiry
`2026-09-10T09:14:46Z`. Failure-record job `98468424584` passed. Exact deployment-input
verification, staging deployment/proof/restoration, human access, and production jobs were all
skipped. The successor is terminal failed and will not be reused.

The correction makes the cart journey expect `RELEASE_ID` when the release gate supplies it, while
retaining the representative fixture as the ordinary local fallback. CI-GH-U4 remains open and U5
remains unauthorized pending integration, another immutable successor, and a complete exact-source
rollback rehearsal with production disabled.

## Release-aware replacement successor — 2026-08-27

Commit `91202e945820a78214bd46b82da1fa525223f7fa` integrates the release-aware cart journey while
preserving the representative fixture fallback. Protected preparation run `33058031666`, job
`98469621564`, used that exact protected-default source to create immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-d`. The job passed the staging-only request guard, exported D1
before insertion, fetched the immutable predecessor, projected exact staging identities, refused
collisions, generated the canonical successor, inserted it immutably, read it back through the
protected endpoint, and verified its exact D1 state.

The pre-insertion D1 export is official artifact `9640464999`, named
`staging-catalog-successor-d1-before-33058031666-attempt-1`, with digest
`sha256:8d9ee931667790cfa38f8555e4b48441dbf011596d361b21cdf3460cddb268c9` and expiry
`2026-09-03T09:19:44Z`. The canonical manifest/receipt is official artifact `9640468977`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-d-33058031666-attempt-1`, with
digest `sha256:c80d8091b9de467db9fe00446aac96902fe0d4c884d22552ccc48891e7b1ba0d` and expiry
`2026-11-25T09:19:25Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not replace the required exact
17-gate hosted validation, same-run artifact binding, staging proof, Worker restoration, D1
reconciliation, or restored safe-state evidence.

## Staging proof lifecycle refusal and safe restoration — 2026-08-27

Exact-source rollback rehearsal run `33058180318` bound protected-default source
`f93444b08789cb8bc00d0001973cec06f87d1740` to immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-d`, with rollback rehearsal enabled and production promotion
disabled. Preflight jobs `98470113805` and `98470159817` passed. GitHub-hosted quality job
`98470208557` passed all 17 unchanged gates, including browser journeys, accessibility, performance,
and the unchanged Lighthouse thresholds. Official validation artifact `9641197088`, named
`validated-release-f93444b08789cb8bc00d0001973cec06f87d1740-33058180318-attempt-1`, has digest
`sha256:f6c9e046f14531f7179349d6be66635d7edb740c0b7c1c6ce028fe4faf9737e0` and expiry
`2026-09-26T09:43:04Z`. Same-run deployment-input job `98475584031` passed.

Protected deployment job `98475652856` captured exact baseline artifact `9641221208` with digest
`sha256:edb7d2394a28246c3e5b53e0a20cf2c0b2c3594aaaa9398b1616684244c74f17` and expiry
`2026-11-25T09:21:22Z`. It retained D1 export artifact `9641223991` with digest
`sha256:ad8b023f489f6f816dcb0d86f20b986ba794ad4e045c4118c65fdbcb293b2561` and expiry
`2026-09-03T09:43:57Z`, found no pending migration, passed protected administrator and D1 integrity
checks, and deployed all three exact Worker versions.

Staging proof job `98475908911` passed credential provisioning, administrator secret verification,
last-unit inventory preparation, isolated fixtures, and service-principal access. The public journey
loaded the correct successor storefront, but Add to bag returned `catalog_release_unavailable` with
“Select a deployed Catalog Release.” The successor was still correctly `building`: the workflow
required public proof before its success callback could transition it to `deployed`, while cart
authority correctly required `deployed` before public proof. Staging evidence artifact `9641282687`
has digest `sha256:5b2421e993bac346d51dbd6218f2fc0d3d825ae552bfbd6d85c980d4efd59188` and expiry
`2026-11-25T09:21:22Z`.

Recovery job `98476257703` restored all three exact Worker versions, reconciled run-scoped D1 data,
verified the restored Worker/D1 safe state, and recorded the failed rehearsal. Restoration artifact
`9641302137` has digest
`sha256:4886e6159c36d8f832ca83dfd20b54e8b978484108d8dab11ba7e1ea54c74859` and expiry
`2026-11-25T09:21:22Z`. Human access and production remained skipped. The successor is terminal
failed and will not be reused.

The correction preserves the four existing lifecycle states and adds no migration. Protected staging
proof prefixes the release's existing build correlation with `staging-proof:` while it remains
`building`. Staging cart and stable-product reads may accept only that marked state; production still
refuses it and release listings still expose only `deployed`. Ordinary proof removes the marker while
the existing authenticated callback records `deployed` or `failed`. Rollback rehearsal removes the
marker before that same terminal callback after exact Worker/D1 safe-state verification. CI-GH-U4
remains open and U5 remains unauthorized pending integration, another immutable successor, and a
complete rehearsal.

## Proof-marker replacement successor — 2026-08-27

Commit `91f1b8387ece3cbdd30686152e40ae988d72109a` integrates the staging-only proof marker without a
database migration or new Catalog lifecycle state. Protected preparation run `33061325008`, job
`98480534185`, used that exact protected-default source to create immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-e`. It passed the protected staging-only request guard,
pre-insertion D1 export, predecessor fetch, exact staging identity projection, collision refusal,
canonical generation, immutable insertion, protected endpoint read-back, and exact D1 state check.

The pre-insertion D1 export is official artifact `9641821513`, named
`staging-catalog-successor-d1-before-33061325008-attempt-1`, with digest
`sha256:54758ffaed66b81646fd68ae6813f54c6fdcd8b59c02fcb0dbffc3306198324c` and expiry
`2026-09-03T10:03:31Z`. The canonical manifest/receipt is official artifact `9641825290`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-e-33061325008-attempt-1`, with
digest `sha256:fc2cf6e993fb6ee2ab460f2ce5684f550a372c76071ae73cbd58e65afcfc4781` and expiry
`2026-11-25T10:03:04Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. This preparation does not substitute for all 17
unchanged hosted gates, same-run artifact binding, staging proof, exact Worker/proof-marker
restoration, D1 reconciliation, or restored safe-state evidence.

## Default-deny test-harness refusal — 2026-08-27

Exact-source run `33061506493` bound source `2cb23ab7dc82f2381e3b2431182c942bf974428f`
to immutable successor `staging-canonical-2026-08-27-ci-gh-u4-e`, with rollback rehearsal enabled
and production promotion disabled. Preflight jobs `98481140443` and `98481194312` passed. Hosted
quality job `98481232858` passed the first eight unchanged gates and entered Worker integration.
There, the new staging proof-marker test confirmed a proof-marked `building` release can add a cart
line in staging with HTTP 200.

The test's production-deny half then replaced only `ENVIRONMENT` while retaining the complete staging
binding set. Production configuration validation correctly failed with HTTP 500 before Catalog
authority could return the expected 422, so the assertion failed. The correction exercises the
Catalog helper directly without `allowStagingProof`, which proves default/production denial without
constructing an invalid mixed environment. This was a deterministic test-harness defect; no staging
credential or mutation job ran.

Official validation diagnostic artifact `9642006086`, named
`validation-diagnostics-2cb23ab7dc82f2381e3b2431182c942bf974428f-33061506493-attempt-1`, has
digest `sha256:d5b16474ab3e55903b8a71da7e319773691aeee830b8a9c0e2ed0c8ddbb34c42` and expiry
`2026-09-10T10:09:38Z`. Failure-record job `98482166186` passed. Deployment-input verification,
staging deployment/proof/restoration, human access, and production jobs were all skipped. The
successor is terminal failed and will not be reused. CI-GH-U4 remains open and U5 remains
unauthorized.

## Default-deny correction successor — 2026-08-27

Commit `41992c032143d1e234e1b9d81b287149d053e8fe` replaces the invalid mixed-environment test with a
direct Catalog helper assertion that omits staging proof authorization and expects the existing
`catalog_release_unavailable` 422 refusal. Protected preparation run `33062008517`, job
`98482820505`, used that exact protected-default source to create immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-f`. It passed the protected staging-only request guard,
pre-insertion D1 export, predecessor fetch, exact staging identity projection, collision refusal,
canonical generation, immutable insertion, protected endpoint read-back, and exact D1 state check.

The pre-insertion D1 export is official artifact `9642099891`, named
`staging-catalog-successor-d1-before-33062008517-attempt-1`, with digest
`sha256:7e22a37d63d38b3c698b37e18deb06178a9c600d2a3cb719912d719a345f07e1` and expiry
`2026-09-03T10:12:40Z`. The canonical manifest/receipt is official artifact `9642104766`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-f-33062008517-attempt-1`, with
digest `sha256:df4462c6dfff541c7870f17df1c2c8a7c70bfd883c660db2ff4aa0b40b688ec6` and expiry
`2026-11-25T10:12:17Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not substitute for the pending
exact-checkpoint 17-gate hosted validation, same-run artifact binding, protected staging proof,
exact Worker/proof-marker restoration, D1 reconciliation, or restored safe-state evidence.

## Fail-closed source-parameter refusal — 2026-08-27

Dispatch run `33062287746` targeted successor `staging-canonical-2026-08-27-ci-gh-u4-f` but supplied
nonexistent source `4054e621c9e483078cd8833fb3b6b15164cb819e` instead of actual protected-default
checkpoint `4054e6219c79ee844f0e4a0fca6608335b50b057`. Deployment preflight job `98483744994`
passed the staging-rehearsal and production-off request guards. Reusable validation preflight job
`98483780847` then failed closed at exact source reachability with `Not a valid commit name`.

Failure-record job `98483826630` passed and transitioned successor `f` to terminal `failed` with
`candidate_validation_failed`. Quality, deployment-input verification, staging deployment, public
proof, restoration, human access, and production were all skipped. No official artifact was
created, no staging or production resource was mutated, and successor `f` will not be reused. This
operator dispatch error is refusal evidence only and does not satisfy CI-GH-U4 or authorize U5.

## Exact-source successor g preparation — 2026-08-27

Protected preparation run `33062452797`, job `98484305871`, used exact protected-default source
`3341e59e46b8d746291b1916b2a6ed1dc77df280` read directly from Git to create immutable successor
`staging-canonical-2026-08-27-ci-gh-u4-g`. It passed the protected staging-only request guard,
pre-insertion D1 export, predecessor fetch, exact staging identity projection, collision refusal,
canonical generation, immutable insertion, protected endpoint read-back, and exact D1 state check.

The pre-insertion D1 export is official artifact `9642293285`, named
`staging-catalog-successor-d1-before-33062452797-attempt-1`, with digest
`sha256:badadbc27f10ebc562b638c244933882d07a8f4fa82d602182a118d462bd92ae` and expiry
`2026-09-03T10:18:48Z`. The canonical manifest/receipt is official artifact `9642297876`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-g-33062452797-attempt-1`, with
digest `sha256:3b4fd92f8db21992ced983f30671e48a57c87a94c9f016fde34f2817597f6072` and expiry
`2026-11-25T10:18:26Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not substitute for the pending
exact-checkpoint 17-gate hosted validation, same-run artifact binding, protected staging proof,
exact Worker/proof-marker restoration, D1 reconciliation, or restored safe-state evidence.

## Provider-purchase copy mismatch after complete hosted deployment — 2026-08-27

Exact-source run `33062635406` bound source `8c040b044ad232c7dbeb68149178029be9bab2c1` to immutable
successor `staging-canonical-2026-08-27-ci-gh-u4-g`, with rollback rehearsal enabled and production
promotion disabled. Preflight jobs `98484924392` and `98484959915` passed. Hosted quality job
`98485013770` passed all 17 unchanged gates, including the existing Lighthouse budgets. Official
validation artifact `9642931141`, named
`validated-release-8c040b044ad232c7dbeb68149178029be9bab2c1-33062635406-attempt-1`, has digest
`sha256:a8453e599806e10b82cae4e683854d26ef81ac8633d87b67b1d713ee91f8f04b` and expiry
`2026-09-26T10:40:00Z`. It binds source tree `8bf2811ef2f07fe5ed60e85dd0c2e7b901fff285`, report
digest `sha256:5fc1802095f0208e9f4243d4a4f1b134239c995ad1d5723c305cd34deccffa91`, run/attempt,
Linux X64 toolchain, and all nine deployment artifact digests. Same-run deployment-input job
`98489557230` passed.

Protected deployment job `98489617636` passed baseline capture, D1 backup and migration safety,
protected administrator checks, integrity checks, and all three staging Worker deployments.
Baseline artifact `9642950833` has digest
`sha256:7c31450c67e27b44d9828e5e989ab84152d3b9c4c19eb9e374a6f48112f66739`; D1 backup artifact
`9642953671` has digest `sha256:a8fa056205704b690fbd7cd5c9571935b94f4bc45e8e052b19e73823ea2863cd`
and expiry `2026-09-03T10:40:48Z`.

Public proof job `98489852425` completed the real Stripe-hosted test payment and returned to a page
showing `Payment confirmed`, a provider-backed order reference, and `View order`. The last assertion
then waited for removed copy matching `order … is confirmed`; current checkout UI and its other
tests use `Order reference: …`. Staging diagnostic artifact `9643017069` has digest
`sha256:551a19a300b2bd2f73c713aa80984d17d2b3b5ff93953499a01a54fdd96abe74` and expiry
`2026-11-25T10:20:55Z`. No trace contents were inspected.

Recovery job `98490255068` restored all three exact Worker versions and the proof marker, reconciled
run-scoped D1 data, verified the restored Worker/D1 safe state and all three public health checks,
then recorded `staging_proof_failed`. Restoration artifact `9643035240` has digest
`sha256:380fb257861943d1e596933eb16170ee193c6645431a31e24ae3157df50e20c2` and expiry
`2026-11-25T10:20:55Z`. Human access and production remained skipped. Successor `g` is terminal
failed and will not be reused; CI-GH-U4 remains open and U5 remains unauthorized.

## Order-reference correction successor — 2026-08-27

Commit `56c43d4852d4dd7fd778a21e3fe7ff0ebdf96987` aligns the provider-purchase assertion with the
current provider-verified checkout page's strict order-reference format. Protected preparation run
`33064643874`, job `98491633197`, used that exact protected-default source to create immutable
successor `staging-canonical-2026-08-27-ci-gh-u4-h`. It passed the protected staging-only request
guard, pre-insertion D1 export, predecessor fetch, exact staging identity projection, collision
refusal, canonical generation, immutable insertion, protected endpoint read-back, and exact D1
state check.

The pre-insertion D1 export is official artifact `9643204230`, named
`staging-catalog-successor-d1-before-33064643874-attempt-1`, with digest
`sha256:0f0d2bc7d1f07932339f383eeb2dc92930ad030c3272133dbbc974b6cd252bd1` and expiry
`2026-09-03T10:49:31Z`. The canonical manifest/receipt is official artifact `9643208150`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-h-33064643874-attempt-1`, with
digest `sha256:3b8848e18f3f4e95164fd837409977ac01e7ff9492f50321b76349f4ac87e3c7` and expiry
`2026-11-25T10:48:57Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not substitute for the pending
exact-checkpoint 17-gate hosted validation, same-run artifact binding, protected staging proof,
exact Worker/proof-marker restoration, D1 reconciliation, or restored safe-state evidence.

## Post-purchase proof identity mismatches — 2026-08-27

Exact-source run `33064849074` bound source `6ce74ae7b0d7803d5127958583d608880d4d3154` to immutable
successor `staging-canonical-2026-08-27-ci-gh-u4-h`, with rollback rehearsal enabled and production
promotion disabled. Preflight jobs `98492319870` and `98492373842` passed. Hosted quality job
`98492419556` passed all 17 unchanged gates and Lighthouse budgets. Official validation artifact
`9643912356`, named
`validated-release-6ce74ae7b0d7803d5127958583d608880d4d3154-33064849074-attempt-1`, has digest
`sha256:54180e0e2e47ff1fb27d3374435f9f8c541df0af63acbe01939bed68d083a317` and expiry
`2026-09-26T11:14:23Z`. It binds source tree `385323a04cfb1315dca0c2ad2366921d01ff9683`, report
digest `sha256:1822c79e6a001450dccf02655872e7b0880d3f553eeef33ed1c332e48cbda0eb`, run/attempt,
Linux X64 toolchain, and all nine deployment artifact digests. Same-run deployment-input job
`98497756251` passed.

Protected deployment job `98497839584` passed baseline capture, D1 backup and migration safety,
protected administrator checks, integrity checks, and all three staging Worker deployments.
Baseline artifact `9643936982` has digest
`sha256:6fd714f48b5e9ce88a54b49b57f76671d722156f02168e54cefbc407cc12adfd`; D1 backup artifact
`9643939339` has digest `sha256:9e4b92a9998ae90a40fd864725616cedf0510ad7df463e5524870f3f7578e06c`
and expiry `2026-09-03T11:15:22Z`.

Public proof job `98498097230` passed the corrected real Stripe provider-purchase journey plus five
other release-operation cases before two assertions failed. Forged return correctly rendered
`Payment status is unavailable` and `This return cannot be matched to a secure checkout session`,
while the test expected retired copy. Synthetic publication failure correctly left exact staged
successor `h` live, while the test incorrectly compared the page to historical rollback variable
`LAST_KNOWN_GOOD_RELEASE_ID`; that variable remains correct only for the separate retained-Worker
version check. Staging diagnostic artifact `9644019226` has digest
`sha256:b5e5b2e3c19dba8ed30a297e101d537a234fe0dafca855f05eb1a0a736bbbf9f` and expiry
`2026-11-25T10:51:50Z`. No trace contents were inspected.

Recovery job `98498656284` restored all three exact Worker versions and the proof marker, reconciled
run-scoped D1 data, and verified restored safe state. Restoration artifact `9644047771` has digest
`sha256:9894ec7c7161bf0de25c572043a94a491aba7903e2bac0d7f78b79761f628f25` and expiry
`2026-11-25T10:51:50Z`. Human access and production remained skipped. Successor `h` is terminal
failed and will not be reused; CI-GH-U4 remains open and U5 remains unauthorized.

## Post-purchase identity correction successor — 2026-08-27

Commit `0f9d7654d4243ba6b85153666d36fcea489d03a2` aligns forged-return proof with current fail-closed
copy and distinguishes the exact staged successor from the separately retained historical rollback
ID. Protected preparation run `33067448314`, job `98500959140`, used that exact protected-default
source to create immutable successor `staging-canonical-2026-08-27-ci-gh-u4-i`. It passed the
protected staging-only request guard, pre-insertion D1 export, predecessor fetch, exact staging
identity projection, collision refusal, canonical generation, immutable insertion, protected
endpoint read-back, and exact D1 state check.

The pre-insertion D1 export is official artifact `9644310209`, named
`staging-catalog-successor-d1-before-33067448314-attempt-1`, with digest
`sha256:dafa6ea17624d1bad72ff558002300a1d368f4364c77b9f66a3fd6ee8a76d53d` and expiry
`2026-09-03T11:27:50Z`. The canonical manifest/receipt is official artifact `9644314572`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-i-33067448314-attempt-1`, with
digest `sha256:dba27dc75bb0ffd359db8374f7dd2012cd153442ea4510751b55a299485c8902` and expiry
`2026-11-25T11:27:30Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not substitute for the pending
exact-checkpoint 17-gate hosted validation, same-run artifact binding, protected staging proof,
exact Worker/proof-marker restoration, D1 reconciliation, or restored safe-state evidence.

## Release-staging latency authority mismatch — 2026-08-27

Exact-source run `33067627981` bound source `00313031c9b28751ff91f714b8a8244a0977a0b8` to immutable
successor `staging-canonical-2026-08-27-ci-gh-u4-i`, with rollback rehearsal enabled and production
promotion disabled. Preflight jobs `98501569326` and `98501605696` passed. Hosted quality job
`98501662425` passed all 17 unchanged gates and Lighthouse budgets. Official validation artifact
`9644902209`, named
`validated-release-00313031c9b28751ff91f714b8a8244a0977a0b8-33067627981-attempt-1`, has digest
`sha256:0003eb5c9c1fb718a4f09fb3fd1d0a2ae97a9bb5e2a634b05cdb00ca604d6e07` and expiry
`2026-09-26T11:47:24Z`. It binds source tree `2fef2b9aaab34a888985dcf51df3d539160d0bf3`, report digest
`sha256:be8324e8d1e9ade8b977d6c1a77223968ae5d88977900203380427903dbd772d`, run/attempt,
Linux X64 toolchain, and all nine deployment artifact digests. Same-run deployment-input job
`98505904495` passed.

Protected deployment job `98505982722` passed baseline capture, D1 backup and migration safety,
protected administrator checks, integrity checks, and all three staging Worker deployments.
Baseline artifact `9644926439` has digest
`sha256:637f4caa614ec05fff45f0c61015754c05b07273b98fb7b04ff580bac2658ade`; D1 backup artifact
`9644929233` has digest `sha256:929bb01523dbba45ecef2dca07f901f6c8efea89af07ceb27fa8d3617b4d74ab`
and expiry `2026-09-03T11:48:17Z`.

Public proof job `98506223720` passed every preceding browser and operational proof, including the
corrected provider purchase, forged-return, and staged-publication identities. Its p95 step then ran
the historical `test:staging-latency` command, whose target had deliberately become an
authenticated FS-U8 orchestrator library. The direct-execution guard refused it before any latency
sample, so this is an authority-entry mismatch rather than a p95 threshold failure. Staging evidence
artifact `9645005725` has digest
`sha256:d17805df7fb3362fcaec7aee4e5fe9375551785ce0f168daac50d31042bd4a01` and expiry
`2026-11-25T11:29:59Z`. No trace contents were inspected.

Recovery job `98506722688` restored all three exact Worker versions and the proof marker, reconciled
run-scoped D1 data, and verified restored safe state. Worker restoration, lifecycle restoration, D1
reconciliation, and restored-state outcomes were all `success`. Restoration artifact `9645026614`
has digest `sha256:45abc733e3854472302b261f96920afb14f2585ea6deb7b753de9dccd7d1d0c2` and expiry
`2026-11-25T11:29:59Z`. Human access and production remained skipped. Successor `i` is terminal
failed and will not be reused; CI-GH-U4 remains open and U5 remains unauthorized.

## Release-staging latency correction successor — 2026-08-27

Commit `300122f6eeaabb1015f62ffaaf424e452034ed37` adds a separate CI-GH release-staging latency
entry. It retains the existing 20 samples, checkout concurrency 4, 500 ms read p95, and 800 ms
shipping-mutation p95 thresholds, while refusing execution outside GitHub `deploy.yml`, outside a
rollback rehearsal, during production promotion, or when the checked-out source differs from the
same-run validated SHA. It neither changes nor invokes the FS-U8 authenticated Preview
orchestrator.

Protected preparation run `33070208055`, job `98510200925`, used that exact protected-default
source to create immutable successor `staging-canonical-2026-08-27-ci-gh-u4-j`. It passed the
protected staging-only request guard, pre-insertion D1 export, predecessor fetch, exact staging
identity projection, collision refusal, canonical generation, immutable insertion, protected
endpoint read-back, and exact D1 state check.

The pre-insertion D1 export is official artifact `9645439826`, named
`staging-catalog-successor-d1-before-33070208055-attempt-1`, with digest
`sha256:e6996a0276da4ca520d6ce7bdc727952851bb5dadc29dce36e79ab7a59637440` and expiry
`2026-09-03T12:05:08Z`. The canonical manifest/receipt is official artifact `9645444560`, named
`staging-catalog-successor-staging-canonical-2026-08-27-ci-gh-u4-j-33070208055-attempt-1`, with
digest `sha256:0cb329de7b808b0d871b7596464ef205cb688035475f95d8c25f77bc88eb31e2` and expiry
`2026-11-25T12:04:48Z`. No predecessor was rewritten and no production job or resource ran.

CI-GH-U4 remains open and U5 remains unauthorized. Preparation does not substitute for the pending
exact-checkpoint 17-gate hosted validation, same-run artifact binding, protected staging proof,
exact Worker/proof-marker restoration, D1 reconciliation, or restored safe-state evidence.
