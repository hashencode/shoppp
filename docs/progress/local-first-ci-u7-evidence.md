# CI-U7 retained evidence

This file retains focused CI-U7 evidence and does not own the current-unit queue.

## CI-U7.1 authority — 2026-08-25

- The operator approved the complete source-input, Ed25519 signing, `2/2` independent retention,
  and artifact audit/retention policy in
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
- Projection stages and read-back-verifies both independent copies before publishing signed quorum
  witnesses. Build requires both witnesses; restore can recover exact bytes atomically from either
  surviving domain using that domain's witness, without fabricating execution provenance.
- Focused candidate-evidence verification passed 27 tests with 135 expectations. Formatting,
  `git diff --check`, repository lint/boundary checks, and workspace type checking passed.
- The complete repository test command passed after 310 tool tests plus every workspace suite. One
  earlier run hit the existing Fashion source-import test's 5-second timeout; its immediate focused
  rerun passed 18/18, and the subsequent complete repository rerun exited successfully.
- The structured multi-lens review completed with seven validated security/correctness/reliability
  finding groups applied. The remaining line-count-only file-split suggestion was rejected as not
  evidence of a functional or maintainability defect.
- This is repository evidence only. CI-U7.2 stays open until the exact integrated `main` SHA passes
  Intel Jenkins and a real offline-signed two-domain build/restore exercise is retained.
