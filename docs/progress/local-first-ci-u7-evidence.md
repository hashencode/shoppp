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
