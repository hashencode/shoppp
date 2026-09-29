# CDA implementation evidence

Scope: `docs/plans/2026-09-29-2128-feat-commerce-dashboard-analytics-plan.md`. This file records evidence only; the plan owns execution status. No master/REL, candidate, DC, PG, remote deployment or production-data state is changed.

## Behavior and acceptance mapping

- AE1–AE2: Currency resides in the first gross-sales card; selection refreshes financial endpoints only. Browser timezone is fixed to the query, with UTC fallback. Local currency preference is scoped to identity/environment; switching identities discards old responses. JPY/KWD and order drilldown keep the applied currency/date/timezone.
- AE3–AE6: Existing revenue/refund semantics remain unchanged. Four cards use revenue daily series and independently deduplicated daily UV. Main tabs use gross sales/PV, product sales combine variants, include refunded order line amounts, exclude order-level shipping/tax adjustments, and use stable ties. Complete date pairs commit once; stale requests cannot replace the current range.
- AE7: Worker tests exercise signed identity→atomic D1 aggregation→report. A single visitor creates A×3/B×2, yielding UV1/PV5/product3+2; repeat delivery is idempotent. Cross-day range UV remains1 while daily UV is1+1. A second browser identity increments UV. Separate window tests cover DST and quarter-hour timezone boundaries; U1 probe covers half-hour offsets and representative data volume.
- AE8: Public link resolution uses the latest validated successfully deployed public release before product membership; removed/unpublished products have null links. Product rankings retain historical names independently of links.
- AE10: Public storefront sends automatically on mount/page entry, independently of any notice dismissal. Real reloads and SPA re-entry count again; duplicate hydration hooks do not. Multi-tab browser tests verify one new identity under Web Locks and two page views. Private preview remains excluded by build/runtime/API boundaries.
- AE11: Genuine empty results are zero; failures are visible and retryable. PV and necessary UV associations survive beyond 90 days. Only short-lived retry records expire. Missing prior coverage is labeled rather than fabricated.
- AE12: Actual reporting permission tests deny unauthorized roles on both new endpoints. Native Browser Mode exercises real ECharts, RangePicker, keyboard date entry, chart resize, locale change, error recovery and light/dark/system theme rendering. Separate 390px/UTC/Chinese and 1280px/Asia-Shanghai/English contexts pass.

## Verification results

- Repository `bun run typecheck` and `bun run lint`: passed before final review fixes; final checks are recorded below.
- Contracts: 65 passed. Storefront unit suite: 360 passed. Domain:31 passed. DB seed:1 passed. Tool suite:456 passed.
- DB Worker migration suite:18 passed.
- API focused revenue/reporting/public-boundary/redaction/http/collector suite:8 files,42 passed.
- API full Worker suite initially:365 passed,5 failed,1 skipped. All five failures were the staging-reset schema inventory missing the four new tables. Added them to its existing disposable business-table inventory; focused reset suite:14 passed. No runtime retention policy changed.
- Admin full suite initially:616/618 passed; two unchanged theme-editor tests timed out under full-suite load. Isolated editor+dashboard rerun:47/47 passed, including all9 dashboard tests. No editor code or timeout threshold changed.
- Admin Browser Mode:3 tests pass in each desktop and narrow context. This uses the actual chart/date libraries and the real reporting service with transport fixtures.
- Storefront built-output Playwright:4 passed across desktop and mobile (automatic entry, refresh, real Vue-router navigation, concurrent tabs).
- Admin `build:test`, storefront `build`, API `build`:passed. Wrangler commands are dry runs only. Build-generated theme configuration was restored to its pre-work content afterward.

## Real HTTPS collector-to-report probe

Run `node docs/progress/2026-09-29-cda-browser-probe.mjs` after building the default public storefront. Requires local Node, OpenSSL and installed Playwright Chromium; port3444 must be free.

The probe creates a temporary certificate and Worker bundle, isolated in-memory D1 with all migrations, a validated public fixture release and an analyst fixture identity. It serves the actual static build via a loopback HTTPS gateway, forwarding the real traffic requests to `createApp`. It verifies the browser's actual Secure/HttpOnly identity cookie, refresh, SPA navigation and second-tab reuse, then reads the real permission-protected reporting endpoint.

Observed result: UV1, PV4, product PV2, valid public `/products/atlas-carry-on` link, zero failed traffic requests. No traffic endpoint is mocked. The analyst verifier is test-only inside the temporary bundle; no production authentication or credentials are modified. Temporary certificate, signing secrets and D1 state are removed after the run. This verifies local semantics, not hosted capacity or deployment readiness.

## Simplification and review

Applied five focused simplifications: existing SHA256 helper reuse, removal of duplicate cache-header assignments, readable date-preset switch, per-report memoization of historical manifests, and bounded request-body reading. No safety checks were removed. Independent review receipt and final fixes are recorded below when complete.

## Final review resolution and verification

`ce-code-review` completed with11 lenses and an independent validator; receipt `docs/progress/2026-09-29-cda-review/review.json`, run `2026-09-29-cda-review`, status `complete`. The receipt describes the pre-fix snapshot. Both confirmed P2 findings were applied in disjoint file batches:

1. Sustained retry-record backlog: the aggregate trigger now retires at most one expired retry row per successful incoming event, in addition to the existing scheduled500-row idle cleanup. Four successive600-event cohorts without cron retain600 retry rows rather than growing to2400; aggregate PV remains2400 and one identity remains one UV. Rollback, concurrency and scheduled cleanup tests remain green.
2. Stalled network request: identity fetch/body consumption and each event attempt now have a ten-second AbortController deadline. Timeout releases the Web Lock operation and pending route queue; bounded retries keep the same ID/body/ticket. Tests cover stuck identity headers/body and both event attempts, including transports that ignore abort.

Final affected API Worker run:9 files,57 passed. DB migration run:18 passed. Repository typecheck and lint passed. Admin test build, API dry-run build and public storefront build passed. Rebuilt public-output Playwright:4/4 passed. The real HTTPS probe was rerun after both fixes with the same UV1/PV4/productPV2 result and zero traffic failures.

All three additional test suggestions are closed: identity expiry and401/403 renewal, overlapping A→B→A queue ordering, and independent stale traffic success/failure responses. Final storefront collector suite:8 tests/72 assertions passed; final dashboard suite:11 tests passed. No runtime redesign was needed for these tests.

Remaining scope limit: hosted D1 latency/resource use at500,000 bucket rows has not been measured. Local indexed query probes and row caps are verified; hosted capacity/deployment checks are outside this plan's authorized local implementation scope. This is recorded here, not as a new product queue or tracker ticket.
