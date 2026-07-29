# shoppp

Cross-border DTC commerce workspace with independently deployable storefront, operations
console, and Cloudflare Worker API.

## Prerequisites

- Bun 1.3.5
- A Cloudflare account for deployed environments
- Stripe test-mode credentials for payment integration work

Production credentials are never required for install, lint, typecheck, unit tests, or builds.
Use example environment files and local Wrangler bindings during development; store real values
with Cloudflare secrets.

## Workspace boundaries

- `apps/storefront`: Nuxt 4 generated storefront. Production output is static HTML.
- `apps/admin`: copied React/Rsbuild operations console. Its upstream repository is read-only.
- `apps/api`: Hono Cloudflare Worker API and all runtime-only commerce operations.
- `packages/contracts`: framework-neutral schemas and public DTOs.
- `packages/domain`: framework-neutral commerce invariants and state transitions.
- `packages/db`: D1 schema, migrations, and repositories. Browser applications cannot import it.
- `packages/config`: shared TypeScript configuration.
- `packages/design`: framework-neutral design-token data shared by both frontends.

## Commands

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run test:workers
bun run test:admin-browser
bun run build
bun run verify:static
bun run test:e2e
bun run test:a11y
bun run test:perf
bun run release:validate
```

Root gates execute the matching script in every workspace where that gate applies. A gate reports
when no current workspace implements it; later implementation units add the relevant workspace
scripts before that gate becomes required.

## Environments

Development, staging, and production use distinct Worker names, D1 databases, R2 buckets, queues,
domains, provider credentials, and webhook endpoints. Checked-in configuration contains only
non-secret identifiers or placeholders.
