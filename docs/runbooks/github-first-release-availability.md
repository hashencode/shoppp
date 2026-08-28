# GitHub-first release availability

This runbook owns the operational boundary between repository-local development and Shoppp's one
maintained formal release path. GitHub-hosted full validation, same-run artifacts, protected
environments, and protected deployment jobs are release authority. Local development may continue
when that authority is degraded, but local, self-hosted, or historical evidence must not substitute
for a new exact-SHA hosted run.

This document does not select a candidate, change a U/DC/PG verdict, authorize production, or create
an alternate credential plane. The active feature plan and product master remain the current-unit
authorities.

## Availability states

Classify one state before attempting formal validation or deployment. Availability records are
limited to these allowlisted structured fields: state, observed provider surface, exact source SHA
when one is in scope, run and attempt when they exist, operator role, timestamp, and a short
transition-reason code. Do not include free-form provider observations, raw provider or environment
output, credential-bearing transition text, or credential values. Before publication or retention,
redact incidental sensitive values and pass the CI-plan R32 canary-secret scan; refuse publication
or retention when either control fails. Never infer a passing state from workflow definitions alone.

| State                | Observable condition                                                                                                                                                                                 | Development behavior                                                                                                                                                 | Formal release behavior                                                                                                         | Exit condition                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normal`             | GitHub can resolve the governed source, start hosted jobs, expose protected environments, retain the same-run artifacts, and complete the required audit trail.                                      | Local fast and post-commit commands continue normally; the optional non-secret mirror stays advisory.                                                                | The protected GitHub workflow may validate and deploy within existing REL/DC/PG and environment approvals.                      | Any required GitHub or artifact surface fails or becomes uncertain; move to the matching degraded state.                                                   |
| `actions-degraded`   | The repository is reachable, but Actions billing, queues, hosted runners, workflow execution, environments, approvals, or artifact transport cannot produce and consume the governed same-run proof. | Local development may continue through repository-owned gates. Classify package/bootstrap failures separately.                                                       | Formal release is paused. A queued, zero-step, canceled, failed, or upload-failed run is blocker evidence only.                 | Repair the affected service, then enter `recovery-audit`; do not resume a failed release attempt in place.                                                 |
| `github-unavailable` | The source remote, GitHub API, authentication, Actions control plane, or protected workflow authority cannot be reliably reached or inspected.                                                       | Local development may continue from an already available clean checkout and installed dependencies. Do not claim fresh bootstrap or remote integration availability. | Formal release is paused. No staging or production workflow is dispatched and no local credential fallback exists.              | Restore reliable GitHub access, reconcile remote source and workflow state, then enter `recovery-audit`.                                                   |
| `recovery-audit`     | GitHub has returned after either degraded state, or retained release artifacts are missing, expired, altered, or inaccessible.                                                                       | Local gates may continue, but their reports remain development evidence.                                                                                             | Formal release remains paused while stale/duplicate runs are classified and a new exact-SHA hosted run establishes fresh proof. | The new run passes exact-source preflight, all 17 gates, same-run artifact verification, and every authorized protected job; only then return to `normal`. |

When multiple conditions apply, use the state with the stricter release stop. Uncertainty is degraded,
not `normal`. Package registry or fresh-bootstrap network failure is an infrastructure dependency;
cached work may continue, but the incident must not be described as GitHub independence or product
test success.

## Provider dependency inventory

| Surface                                     | Development impact                                                                                               | Release impact                                                                                                                      | Required recovery access                            | Acceptable outage behavior                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Source remote                               | Existing clean local checkouts and commits remain usable; fetch, push, and remote identity checks may stop.      | Exact-source reachability and protected-default/frozen-ref authority cannot be established.                                         | Repository administration                           | Continue local work without claiming integration; pause release and reconcile refs before a recovery run.                          |
| Workflow triggers and Actions control plane | Direct repository commands remain available. Advisory projection may stop.                                       | Dispatch, orchestration, same-run joins, and protected jobs are unavailable.                                                        | GitHub Actions and account/billing access           | Record billing/API/control-plane evidence, do not retry continuously, and pause release.                                           |
| GitHub-hosted runners                       | Local commands remain available when dependencies are installed.                                                 | The governed Linux x64 `release:validate` proof cannot run.                                                                         | GitHub Actions and support access                   | Treat queued or zero-step jobs as infrastructure blockers; never replace them with a local result.                                 |
| Environments, secrets, and approvals        | Ordinary local development remains credential-free.                                                              | Staging/production credentials and approvals cannot be safely exposed or audited.                                                   | GitHub environment and secret administration        | Pause every credentialed job; never copy environment credentials to a laptop or advisory runner.                                   |
| Workflow artifacts                          | Local reports may diagnose development state.                                                                    | Validation attestation, report, deployables, baseline, backup, staging proof, or restoration evidence cannot be joined or retained. | GitHub Actions run and artifact access              | A missing, expired, altered, or inaccessible artifact fails closed; start fresh hosted validation after recovery.                  |
| Status checks                               | Local results remain readable outside GitHub.                                                                    | Check visibility may be incomplete, but a status check alone is never release proof.                                                | Repository checks and Actions access                | Preserve run identity and classify the visibility incident; rely only on verified jobs and artifacts after recovery.               |
| GitHub Releases                             | Ordinary development is unaffected unless source distribution depends on a release asset.                        | A governed release asset or publication record cannot be created or inspected.                                                      | GitHub Releases administration                      | Pause publication; do not substitute an ad hoc file host or local archive.                                                         |
| Cloudflare Workers and D1                   | Local development may continue where its configured dependencies are available. Remote-dependent tests may stop. | Staging/production deployment, baseline capture, verification, reconciliation, or rollback may be unavailable.                      | Cloudflare Workers and D1 deployment access         | Stop before mutation when preconditions fail; preserve the last safe state and follow the rollback runbook after service recovery. |
| Deployment audit                            | Local gates continue, but cannot manufacture a protected deployment receipt.                                     | Approval, mutation, restoration, or receipt lineage cannot be proven.                                                               | GitHub Actions and deployment-environment access    | Pause release until protected job/run/attempt and receipt state are reconciled.                                                    |
| Package registry and bootstrap network      | Fresh install or tool acquisition may fail; a previously installed environment may still run.                    | Hosted validation cannot begin or reproduce the declared toolchain.                                                                 | Package registry and dependency-provider visibility | Classify bootstrap infrastructure explicitly; do not report an offline-capability or test verdict.                                 |

Cloudflare and GitHub are correlated release dependencies under the maintained path; this inventory
does not claim either is independently recoverable. Access, retention, and deletion follow the
repository/provider policy visible to the operator at the time of the run. Record policy changes in
the recovery audit before relying on them.

## Fail-closed artifact handling

A deployment job may consume only the artifact uniquely named for its source SHA and the same
caller GitHub run and attempt. The trusted GitHub source checkout and same-run artifact download may
precede verification. The job must then verify the source/tree, release ID, report digest,
validation attestation digest, deployable map, and each deployable artifact before its first
Cloudflare Workers or D1 operation, including any remote read or mutation.

If any required artifact is missing, expired, altered, or inaccessible:

1. Stop the deployment chain before remote mutation, or preserve the existing safe-state recovery
   path if an already-started staging rehearsal must reconcile.
2. Record the exact source, run, attempt, expected artifact name, observed failure class, and which
   protected jobs did or did not start. Do not record credential values or artifact contents.
3. Do not retry a failed deployment job against historical artifacts, copy local output into the
   run, rebuild inside a deployment job, discover a different run's artifact, or extend retention
   by relabeling evidence.
4. Enter `recovery-audit` and dispatch a new exact-SHA hosted run. The fresh run and attempt produce
   a new attestation and new same-run artifacts; the old attempt remains failure evidence.

## Recovery audit

1. Read the active CI plan, active feature checkpoint, product-master pointer, candidate-readiness
   record, and current release/rollback runbooks. Confirm that no Fashion, Decor, REL, DC, PG, or
   production state is being inferred from the availability incident.
2. Reconcile the protected default branch, optional governed frozen-candidate ref, workflow commit,
   GitHub run list, environments, and artifact retention state. Classify stale, duplicate, canceled,
   failed, and never-started runs without deleting or overwriting them.
3. Choose the exact clean source SHA already authorized by the active release/candidate authority.
   From the protected default-branch workflow, dispatch `Deploy immutable commerce release` with
   that full `source_sha`, the approved immutable `release_id`, production promotion disabled, and
   `rehearse_staging_rollback` enabled only when the governed non-production recovery proof is due.
4. Require a new exact-SHA hosted run to pass trusted-source preflight, the unchanged 17-gate
   `release:validate` suite, validation-attestation creation, and same-run deployment-input
   verification. Old local, self-hosted, Intel, Codex Cloud, or expired GitHub evidence remains
   non-authoritative.
5. If a staging rehearsal is authorized, verify that `.github/workflows/deploy.yml` captures the
   exact pre-mutation Worker/D1 baseline, refuses unsafe pending migrations, validates the baseline
   with `staging-rollback-baseline.ts`, restores exact Worker versions and release lifecycle,
   reconciles run-scoped D1 state, verifies the restored safe state, and records one outcome.
   Human-access and production jobs remain skipped; production mutation remains disabled.
6. Return to `normal` only after the new run's source/tree, run/attempt, toolchain, report,
   attestation, deployable artifacts, protected-job results, and required recovery receipts all
   reconcile. Otherwise remain degraded and record the next action in the owning plan.

The retained successful CI-GH staging rehearsal proves the recipe existed and restored the safe
non-production state at that historical source. It does not stay fresh forever, authorize replay,
or replace the new run required after an availability incident or material contract change.
