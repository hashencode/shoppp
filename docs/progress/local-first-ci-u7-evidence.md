# CI-U7 retained evidence

This file retains focused CI-U7 evidence and does not own the current-unit queue.

## CI-U7.1 original authority — 2026-08-25

- The operator originally approved the complete source-input, Ed25519 signing, `2/2` independent
  retention, and artifact audit/retention policy in
  `docs/architecture/ci-evidence-trust-and-retention.md`.
- REL owns the executable clean-archive input policy; CI owns bundle construction, verification,
  signing mechanics, projection, restore, and operational evidence.
- No private key, storage credential, production authority, candidate selection, or deployment
  approval was granted to repository code or ordinary CI.

## Temporary worktree

- Path: `.worktrees/ci-u7-portable-evidence`
- Branch: `codex/ci-u7-portable-evidence`
- Owner/purpose: CI-U7.1 policy capture and CI-U7.2 implementation, isolated from concurrent FS-U8
  work in the primary checkout.
- Cleanup condition: remove only after the exact integrated tree is on `main`, mirrored to the Intel
  executor, and the provider-neutral Jenkins job passes. Branches, commits, keys, bundles, and
  retained evidence are never deleted by worktree cleanup.

## CI-U7.2 repository implementation — 2026-08-25

- Implementation completed through `6cf0cd69`. It requires an external expected bundle digest,
  canonical exact-field signed documents, complete 17-gate report/capsule/toolchain linkage, and a
  Git tree derived from the archived source bytes.
- Under the original policy, projection staged and read-back-verified both independent copies before
  publishing signed quorum witnesses. Build required both witnesses; restore could recover exact
  bytes atomically from either surviving domain without fabricating execution provenance.
- Focused candidate-evidence verification passed 27 tests with 135 expectations. Formatting,
  `git diff --check`, repository lint/boundary checks, and workspace type checking passed.
- The complete repository test command passed after 310 tool tests plus every workspace suite. One
  earlier run hit the existing Fashion source-import test's 5-second timeout; its immediate focused
  rerun passed 18/18, and the subsequent complete repository rerun exited successfully.
- The structured multi-lens review completed with seven validated security/correctness/reliability
  finding groups applied. The remaining line-count-only file-split suggestion was rejected as not
  evidence of a functional or maintainability defect.
- This was repository evidence under the original policy. Its mandatory two-domain operational
  condition was superseded by the operator's 2026-08-26 single-target amendment.

## Intel Jenkins integration proof — 2026-08-25

- `shoppp-main#14` was deliberately aborted after its checkout log exposed a stale local mirror at
  `e77187b6`; it is not acceptance evidence.
- After synchronizing the host-local mirror, `shoppp-main#15` checked out exact integrated SHA
  `72cc2bdf`, passed the complete provider-neutral post-commit lane in 176.547 seconds, archived the
  report with Jenkins fingerprints, and retained it under
  `/srv/shoppp-evidence/72cc2bdf0b4241a3dccd0f707c6aebe9833609e2/15/`.
- This closes the repository implementation and independent Intel mirror portion of CI-U7.2. It
  did not substitute for the then-required offline-signed retention proof. Final main SHA
  `59c2a64e` subsequently passed `shoppp-main#16` in 177.907 seconds.

## CI-U7.1 retention amendment — 2026-08-26

- The operator explicitly removed mandatory two-domain acceptance. One operator-approved durable
  retention target with exact-byte write, read-back verification, signed witness, and successful
  restore is sufficient. An independent second replica remains recommended but optional.
- Source cleanliness, capsule/report/toolchain binding, external digest anchoring, Ed25519 trust,
  expiry/revocation refusal, secret scanning, atomic publication, audit fields, and exact restore
  remain unchanged.
- If multiple targets are declared in one build invocation, every declared target must verify; the
  tool does not convert a failed optional backup into a successful redundancy claim.
- Accepted residual risk: loss or compromise of the sole retained target can destroy the only
  authoritative copy. Immutable/versioned Intel storage, periodic restore, and an optional later
  replica mitigate but do not eliminate that risk.

## Temporary worktree — single-target amendment

- Path: `.worktrees/relax-ci-u7-retention`
- Branch: `codex/relax-ci-u7-retention`
- Owner/purpose: implement and verify the 2026-08-26 CI-U7 single-target policy amendment while the
  primary checkout retains concurrent FS-U8 work.
- Cleanup condition: remove only after the exact integrated tree is on `main`, mirrored to Intel
  Jenkins, and its provider-neutral post-commit job passes. Removal retains the branch, commits,
  signed evidence, and Jenkins artifacts.

## CI-U7.2 single-target repository verification — 2026-08-26

- The current `2026-08-26` policy requires one verified `intel-append-only` target and permits one
  optional second target. Every target declared by an invocation remains required for that
  invocation; more than two targets and VPS-only declarations fail closed.
- The verifier continues accepting signed `2026-08-25` bundles only with their historical two-target,
  two-class, two-administrative-domain witness contract. A downgrade to a one-target legacy witness
  is rejected, while either surviving original copy can restore exact bytes.
- Witnesses are staged and verified on every declared target before publication. If any final
  publication fails, final witnesses created on other targets by that attempt are removed; the
  focused fault-injection regression confirms no partial accepted witness remains.
- Focused candidate-evidence and runbook verification passed 20 tests with 65 expectations. The
  repository typecheck, lint/boundary checks, `git diff --check`, and complete repository test
  command all exited successfully.
- The full structured review used correctness, standards, testing, maintainability, security,
  reliability, performance, API-contract, and adversarial lenses. Four findings were applied and a
  fresh validator confirmed all four resolved.

## CI-U7 solo-developer policy amendment and U7.3 gap — 2026-08-26

- The operator explicitly accepted a proportionate personal-project baseline and removed live
  offline-root, short-lived signer, signed-witness, and recurring signing/restore ceremony from CI,
  candidate, and launch completion authority.
- Exact clean source identity, the complete validation-class capsule report and receipt, toolchain
  and artifact SHA-256 digests, secret scanning, one encrypted versioned/append-only durable target,
  digest read-back, and a practical restore check at target adoption/material change remain the
  required baseline.
- The existing Ed25519 implementation and its negative-path tests remain available as an optional
  high-assurance profile. No unsigned result is relabeled as signed, and no signing key or trust file
  is claimed to have been provisioned.
- Intel Jenkins `shoppp-main#17` passed the provider-neutral post-commit lane against exact integrated
  SHA `63b71c82` and retained its machine-readable report. That result does not exercise the amended
  no-PKI build/verify/retain/restore baseline and does not close parent CI-U7.
- The existing `evidence:build`, `evidence:verify`, and `evidence:restore` commands still require the
  signed-profile certificate/signer/trust inputs. The correctness review therefore reopened the
  parent tail: the active plan owns CI-U7.3 for an executable unsigned path, profile-isolation tests,
  and one practical Intel-target restore. This file records that gap but does not own its queue.
- CI-U7.3 now adds `evidence:baseline:build`, `evidence:baseline:verify`, and
  `evidence:baseline:restore`. Focused tests prove one-target build/read-back/restore, altered-byte
  and wrong-external-digest refusal, secret refusal, runtime signing-option refusal, and bidirectional
  signed/baseline profile isolation. The candidate-evidence and runbook suites pass 24 tests with 90
  expectations; focused ESLint and strict TypeScript checks also pass.
- The only remaining CI-U7.3 evidence is one practical restore against the adopted Intel target.
  On 2026-08-26 the development Mac could not reach `192.168.1.250` on SSH or Jenkins ports and
  received `Host is down`; no restore result is fabricated from that outage.
- Re-entry triggers are multiple release operators, external artifact consumers, regulatory or
  contractual audit, shared/untrusted runners, cross-provider provenance requirements, or an
  observed tampering or credential-compromise event.

## Temporary worktree — solo-developer signing amendment

- Path: `.worktrees/relax-ci-u7-signing`
- Branch: `codex/relax-ci-u7-signing`
- Owner/purpose: amend CI-U7 signing authority and downstream documentation without touching the
  concurrent dirty FS-U8 primary checkout.
- Cleanup condition: remove the checkout after the exact amendment commit is integrated. Its branch,
  commit, historical signed-profile implementation, and retained evidence are not deleted by
  worktree cleanup.
