# Admin App Rules

These rules apply only to `apps/admin`. Repository-root rules still apply, and this file takes
precedence only for work inside the admin subtree. It does not define verification policy for other
Shoppp applications or packages.

## Mandatory Read Order

Before implementing a new or standard admin page, read:

1. `docs/ai/README.md`
2. `docs/ai/ai-rules.md`
3. `docs/ai/page-recipes.yaml`
4. `docs/ai/component-catalog.yaml`
5. `docs/testing-standards.md`

For legacy-page migration, follow the read order in
`docs/ai/legacy-page-migration-workflow.md` instead.

## Proportional Verification

- Before running verification, select `L0-L4` from `docs/testing-standards.md` based on the actual
  admin change scope and state the choice in the implementation plan or progress update.
- Default to focused verification. Do not upgrade to app-wide tests, builds, Browser Mode, E2E, or
  monorepo-wide quality checks without a documented escalation condition.
- Run each required gate once after the relevant code stabilizes. Do not repeat a narrower check
  after an equivalent broader check, and do not run a standalone typecheck when the selected build
  command already includes it.
- Isolate and report unrelated pre-existing failures with evidence; do not repeatedly rerun them
  hoping for a different result.

`docs/testing-standards.md` is the only detailed `L0-L4` policy owner for this subtree. Existing
admin security, permission, E2E, build, and release requirements remain mandatory when their risk or
delivery conditions apply.
