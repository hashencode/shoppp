# Provider-neutral CI main landing evidence

This file retains integration evidence only. The active CI plan remains the authority for current
unit, blocker, next action, and tail status.

## Temporary isolation

- Worktree: `.worktrees/ci-current-entry-landing`
- Branch: `codex/land-provider-neutral-ci`
- Base: `origin/main` at `3d63fb8cee2a8af853ae0528a793e33542c35019`
- Owner: CI provider-neutral entry landing
- Purpose: transplant the current CI-U1 through CI-U3 implementation without carrying the
  superseded `codex/refactor-local-first-ci` branch or the primary worktree's U8 changes.
- Cleanup condition: the exact integrated tree is verified, landed on `main`, mirrored to Jenkins,
  and passes the Jenkins provider-neutral post-commit job; removal does not delete the branch,
  commits, or retained evidence.

## Integrated source commits

- `795172fa` — provider-neutral validation tiers
- `d1027841` — simplified validation orchestration
- `9729b66b` — optional workflow adapters
- `96de0a4a` — full-validation contract clarification
- `bca6fede` — shared workflow contract fixtures
- `93b3f88f` — secure runner operations contract

## Integration review and local verification

- The obsolete `codex/refactor-local-first-ci` tip was not merged. The six current CI-U1 through
  CI-U3 commits above were transplanted onto the current `origin/main` base without conflict.
- A seven-lens review covered correctness, project standards, testing, maintainability, security,
  reliability, and adversarial false-pass behavior. Independent validation confirmed all four
  merged findings.
- The integration now rechecks Git identity and worktree cleanliness after every successful
  post-commit gate, treats command-launch and signal-style exits as infrastructure failures, and
  rejects unpinned workflow actions even when a YAML line has a trailing comment.
- The current CI feature plan, master-plan registration, and retained CI-U1, CI-U2, CI-U3, and
  CI-U12 evidence are included without changing the active product pointer.
- Focused CI/workflow/runbook/deployment verification passed with 55 tests. Repository formatting,
  lint and boundary checks, workspace type checking, and the complete repository unit/contract test
  command also passed on the isolated integration checkout.
- Remote Jenkins post-commit evidence is intentionally pending until the integrated tree is
  committed and mirrored; this file does not infer that result in advance.
