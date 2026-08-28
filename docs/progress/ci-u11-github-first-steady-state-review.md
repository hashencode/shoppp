# CI-U11.1 GitHub-first steady-state review evidence

This file retains historical evidence for the completed CI-U11.1 review. It is not a current-unit
queue and does not own status, blockers, next actions, or the implementation tail; the CI plan and
product master own those facts.

## 2026-08-28 — inaugural full recovery drill review

- **Evidence selected:** Retained GitHub workflow run `33073613728`, attempt 1, for exact source
  `40cfdec8021aca5b7e78fc9be27553ba620d0511` is the inaugural full recovery drill. CI-U8.3
  read-only reconciliation confirmed that its validation, staging baseline, D1 backup, staging
  evidence, and restoration artifacts remained available and unexpired on 2026-08-28. This review
  did not dispatch a workflow or mutate staging or production.
- **R27 pre-mutation refusal:** The governed workflow first passed exact-source preflights and
  same-run input verification. Contract coverage rejects source, report, attestation, artifact,
  run, or attempt mismatch before the first Cloudflare read or mutation.
- **R27 Worker/D1 baseline capture:** Protected staging job `98528114752` captured the exact three
  Worker versions, proof marker, release lifecycle, and D1 backup before deployment. Baseline
  artifact `9647619915` and D1 artifact `9647623150` remain bound to run/attempt and digest.
- **R27 post-deploy checks:** All three validated staging Workers deployed, protected administrator
  and integrity checks passed, and public proof job `98528414893` passed the release journeys and
  unchanged catalog/cart/shipping p95 thresholds.
- **R27 rollback or forward reconciliation:** Recovery job `98528962337` restored the exact Worker
  versions and proof marker, reconciled run-scoped D1 data, and passed the foreign-key check. The
  recipe also fails closed on unsafe pending migrations and requires the governed staging-only
  forward-alignment path before another rollback rehearsal.
- **R27 return to the prior safe staging state:** Restored API, Admin, and Storefront versions each
  returned at 100 percent and the safe-state projection passed. Human access, production approval,
  and production promotion were skipped; production skipped is a required boundary, not missing
  proof.

## Operating decision

- **Decision — keep:** Keep the GitHub-first path. Routine repository-owned local development
  continues during GitHub degradation, while GitHub outage pauses release and no local, self-hosted,
  historical, or expired artifact becomes substitute authority.
- **Required access:** Repository and Actions administration; Actions run/artifact access; protected
  GitHub environment and secret administration; Cloudflare Workers/D1 staging deployment access;
  the relevant credential-provider administration for rotation or emergency revocation; and
  package/bootstrap visibility for toolchain reconciliation. Production access is not required for
  this non-production review.
- **Current limits:** GitHub remains the release-time control-plane and retention boundary. There is
  no offline proof claim, alternate credential plane, independent signing system, or provider-
  independent restore path. Missing or inaccessible GitHub evidence requires a fresh exact-SHA
  hosted run after recovery.
- **Shutdown criteria:** Pause formal validation and every affected credentialed job on uncertain
  billing/control-plane state, artifact mismatch or expiry, failed staging recovery, suspected
  disclosure, toolchain mismatch, or mutable/unreviewed action references. Disable an unsafe runner,
  adapter, credential, or workflow path rather than weakening a release prerequisite.
- **Material-change triggers:** Re-review billing/control-plane behavior, artifact retention/access,
  staging recovery contracts, credential rotation/revocation or suspected disclosure, hosted
  toolchain drift, and workflow action-pin updates. Also reopen governed CI work if team size,
  repository plan/visibility, runner exposure, credential model, or deployment provider changes the
  trust boundary.
- **No recurring assignment:** The single maintainer records `keep`, `revise`, or `remove` only when
  a material trigger occurs. No owner roster, responsibility matrix, escalation tree, periodic
  calendar, or completion-blocking ceremony is created.

## Authority boundary

The review completes CI-U11.1 only. It does not select a product candidate, alter Fashion or Decor
status, enter DC or PG, approve human access, or authorize production. Run `33073613728` remains
historical evidence and cannot be replayed as deployment input or used after a new material change.
