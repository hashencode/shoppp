# Main format-gate repair evidence

- Branch/ref: `codex/fix-main-format-gate` from `origin/main@91e5db248f7e53c9029c73539ee7d0dfa575233a`
- Owner: Long-Term CI Resilience plan, operational repair only
- Purpose: repair the exact formatting failure observed by Jenkins `shoppp-main` build 7 without
  mixing the active Fashion/U8 worktree changes into `main`
- Cleanup condition: the repair is safely landed, the synchronized server mirror contains the
  landed commit, and Jenkins has rerun the affected gate successfully
- Status authority: this evidence does not change the CI or Fashion current-unit queue
