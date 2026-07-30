# Storefront Fidelity Preview

## Scope

This runbook covers local review of the Fashion and Decor home templates. Their secondary routes
remain regression coverage and are not reference-faithful. This workflow does not activate a
production theme, connect live commerce, or publish a private preview artifact.

## Build and verify

Run the theme previews independently because each build generates one selected-theme module:

```sh
bun run --cwd apps/storefront test:fashion
bun run --cwd apps/storefront test:decor
```

Each suite builds a static preview and checks desktop, `768 × 1024` tablet, mobile, no-JavaScript,
reduced-motion, accessibility, secondary routes, bundle budget, and selected-theme isolation.
Always restore the production fallback after a local preview:

```sh
bun run --cwd apps/storefront prepare:experience
bun run verify:themes
```

## Capture and compare

Set `THEME_FIDELITY_CAPTURE_ROOT` to a review-only directory and
`THEME_FIDELITY_COMMIT` to the exact `git rev-parse HEAD` value while running each theme suite.
Keep implementation captures separate from the immutable reference captures. Generate the
side-by-side report with:

```sh
bun run report:theme-fidelity -- \
  --reference=<reference-root> \
  --implementation=<implementation-root> \
  --output=<report-root> \
  --commit=<exact-commit-sha>
```

The report validates theme identity, initial-home state, viewport dimensions, PNG integrity, and
commit identity. Do not create `approval.json` before the user explicitly accepts both live
previews and the side-by-side evidence. A passing automated suite is not visual approval.

## Local handoff

Serve the built static output with `apps/storefront/scripts/serve-static.ts` or another loopback-only
static server. Use separate copied output directories when Fashion and Decor must remain available
at the same time. Record the ports, exact commit, evidence path, and production-fallback check in
the handoff. Stop the servers when review is complete.
