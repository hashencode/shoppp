---
title: Fashion Store Decor Wide Layout - Plan
type: refactor
date: 2026-09-10
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: user-approved-follow-up
execution: code
plan_role: corrective-follow-up
plan_alias: FS-F5
---

# Fashion Store Decor Wide Layout - Plan

## Goal Capsule

- **Objective:** The migrated Decor Home uses the wider Fashion Store presentation rhythm for its
  featured categories, product merchandising, journal, client logos, and Footer without stretching
  cards or changing the full-bleed Hero, promotional marquee, Lounge collection, or services strip.
- **Authority:** The product master owns product sequencing. Completed FS-F4 is the inherited visual
  and interaction baseline. The user's 2026-09-10 approval owns the five selected regions.
- **Execution profile:** Implement and verify locally in the existing primary checkout. Do not create
  a worktree, restore a retired Decor runtime, open a PR, freeze a candidate, deploy, or advance DC/PG.
- **Stop conditions:** Stop if the layout change requires global Bootstrap mutation, changes non-Home
  routes, or cannot preserve compact breakpoints and existing interaction geometry.
- **Tail ownership:** FS-F5 owns this layout correction and local evidence, then returns control to
  REL-Pre-DC. REL retains candidate, immutable Preview, DC, deployment, and PG authority.

## Authority and Lineage

- **Upstream product authority:** `docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md`.
- **Inherited baseline:** `docs/plans/2026-09-08-1204-fix-decor-home-visuals-plan.md` completed FS-F4.
- **Explicit supersession:** For the combined Home only, this plan supersedes FS-F4 source-width
  parity for the five approved regions. Isolated Decor review keeps the source-width baseline.
- **Parallel plans:** REL remains next in sequence. Commerce, IAM, AI, Admin, CI, and completed
  Fashion plans retain their current authority.
- **Tail ownership:** FS-F5 owns U1-U3 and the REL handback; no candidate or production state changes.

## Execution Checkpoint

- **Plan state:** Complete.
- **Current parent/child stage:** None — `U1-U3` are complete.
- **Unit state:** U1-U3 complete on 2026-09-10.
- **Blocker:** None in FS-F5. REL retains its independent Pre-DC blockers.
- **Next concrete action:** Return execution to `REL-Pre-DC`; no FS-F5 implementation tail remains.
- **Update rule:** This plan is the only authority for FS-F5 unit state, blocker, next action, and tail.
  Update this checkpoint and the product-master pointer together when those facts change.

## Product Contract

### Requirements

- **R1.** Combined Home featured categories, products, and journal use one named wide-content rule.
- **R2.** Combined Home client logos and Footer use a bounded 1320px content rule.
- **R3.** Isolated Decor review retains the source Bootstrap container widths and source comparison.
- **R4.** Hero, promotional marquee, Lounge collection, and services remain full-bleed and unchanged.
- **R5.** Card internals, hover/focus actions, carousel controls, and content truth do not change.
- **R6.** Compact layouts preserve existing Bootstrap widths with no horizontal overflow.
- **R7.** Layout ownership is explicit and reusable; no global `.container` override is introduced.

### Key Technical Decisions

- **KTD1 (user-approved):** Adapt exactly the first five proposed regions: featured categories,
  products, journal, client logos, and Footer.
- **KTD2:** The combined composition opts into the wide layout; isolated composition remains the
  source-width reference so intentional platform adaptation does not destroy source evidence.
- **KTD3:** Container owners change; ProductCard internals and full-bleed regions do not scale.
- **KTD4:** The bounded wide rule uses a 1320px target beginning at the desktop adaptation boundary,
  intentionally superseding Crafto's 1220px `min-width: 1400px` container override while retaining
  ordinary gutters.

## Verification Contract

- **AE1 (R1-R4):** Browser geometry at 1200, 1300, 1399, 1400, 1536, and 1920 proves intended
  container widths, centered alignment, source-mode preservation, and unchanged full-bleed width.
- **AE2 (R5-R6):** Existing Decor interaction, compact Header, Lounge, card geometry, and overflow
  assertions remain green at 1440, 1024, 768, and 390.
- **AE3 (R7):** Focused source/contract tests assert the named layout seam and absence of a global
  Bootstrap override.
- **AE4:** The Fashion Store theme test/build gate passes without changing candidate or production state.

## Implementation Units

### U1. Establish wide-layout ownership

- **Goal:** Add an explicit combined-versus-isolated content-width seam and focused contract coverage.
- **Files:** Home shell/profile wiring, shared shell/Footer props, integration CSS, focused tests.
- **Approach:** Carry a named layout mode from the Home profile to the document and Footer. Scope all
  width rules under that mode; keep source mode untouched.
- **Execution note:** Strengthen the existing source/contract test first and observe the intended failure.
- **Verification:** AE3 plus focused unit tests.
- **Dependencies:** None.

### U2. Adapt the five approved regions

- **Goal:** Apply the wide/bounded rules without changing card or full-bleed component internals.
- **Files:** Decor Home markup only if a semantic hook is necessary, Footer, integration CSS.
- **Approach:** Use a shared wide-content selector for categories/products/journal and the bounded
  selector for clients/Footer. Preserve grid gaps and responsive column ownership.
- **Execution note:** Use browser geometry as the primary proof because this is visual behavior.
- **Verification:** AE1-AE2.
- **Dependencies:** U1.

### U3. Close regression and hand back

- **Goal:** Run focused and theme-wide verification, retain useful evidence, and return to REL-Pre-DC.
- **Files:** Browser tests, optional progress evidence, this checkpoint, product master.
- **Approach:** Test boundary widths and existing interaction states; record only durable evidence.
- **Verification:** AE1-AE4 and clean agreement between this checkpoint and the master pointer.
- **Dependencies:** U1-U2.

## Definition of Done

- The five approved regions use the intended combined-Home width policies.
- Isolated source-width review and all four full-bleed regions remain unchanged.
- Desktop boundary and compact-width geometry tests pass without overflow or interaction regression.
- Focused tests and the Fashion Store theme gate pass.
- FS-F5 records completion and the product master returns to REL-Pre-DC without advancing DC/PG.

## Completion Evidence

- Combined Home sets an explicit `wide` document layout while isolated Decor remains `source`.
  Categories, products, journal, clients, and every Footer container consume one inherited 1320px
  maximum and 30px gutter rule from 1200px upward; no global Bootstrap container rule changed.
- Boundary geometry passed at 1199, 1200, 1300, 1399, 1400, 1536, and 1920px in combined and
  isolated 1440 browser projects. The same test proves the Hero and the width-owning containers for
  promotional marquee, Lounge collection, and services remain full-bleed.
- The complete combined responsive matrix passed with 8 tests and 12 intentional project skips.
  Focused static coverage passed 9 tests and 162 assertions; Storefront typecheck and focused ESLint
  passed; the production preview build and Worker dry run passed.
- Simplification removed duplicate Footer layout state and consolidated its width policy with the
  other four regions. Code review found two test-boundary gaps; both were applied and independently
  validated as resolved. No justified residual finding remains.
- Candidate, DC, deployment, and PG state did not change. Tail ownership returns to `REL-Pre-DC`.
