# Storefront Editor Plan Review

Date: 2026-10-10. Scope: plan and interactive sketch only.

Reviewed artifact: [Shopify-style editor plan](../plans/2026-10-10-1950-refactor-shopify-style-storefront-editor-plan.md).

No product implementation, active-plan transition, candidate freeze, deployment, commit, PR or worktree creation occurred. This evidence does not maintain an implementation queue.

## Resolved Result

Document review complete (non-interactive mode).

Applied 1 correction:

- Production delivery: added the missing approved Experience consumption contract before request/status integration. The plan now names the production build input, generated theme/experience modules, provider/composition, exact tuple/digest, staging proof and activation receipt. U7.1 owns implementation; U7.2 depends on it. REL retains eligibility and actual delivery authority. Existing fallback compatibility remains, but a selected target may not silently fall back. This correction fulfills the proposed contract's requirement that publication changes the actual storefront; it does not activate the plan or authorize deployment.

No remaining review proposals, decisions or FYI findings. The plan itself remains a user-review proposal, as requested. The topology proof is explicitly the first planned engineering stage, not a claim of existing capability.

## Coverage

| Persona        | Original findings | Disposition                                                                |
| -------------- | ----------------- | -------------------------------------------------------------------------- |
| coherence      | 0                 | Completed                                                                  |
| feasibility    | 1                 | Verified against repository; applied; focused follow-up confirmed resolved |
| scope-guardian | 0                 | Completed                                                                  |
| design-lens    | 0                 | Completed                                                                  |
| product-lens   | 0                 | Completed                                                                  |
| security-lens  | 0                 | Completed                                                                  |
| adversarial    | 0                 | Completed                                                                  |

Each persona ran in a separate context with its full skill-local prompt, schema and document. Compound Pack resolver returned no roots, warnings or errors. Cross-model pass did not run: no installed attested different-provider route (`claude`, `grok`, `cursor-agent`) was found. Local persona coverage completed; no document was sent to a separate external review provider.

## Finding Evidence and Judgment

Original feasibility claim, confidence 100 / P1 / omission:

> 发布适配缺少生产 Snapshot 消费合同。

Original plan evidence:

> 编辑器先复用正式校验、private Preview、approve，再以最小 request/status 适配接入现有 protected release 工作流。

> 若现有 release model 不能映射目标 Snapshot，U7 必须报告具体阻塞并修正 adapter 合同，不能以 UI mock 或提交成功结束。

The original stop condition recognized an unknown mapping risk but did not identify the already-known producer/consumer gap. Request/status records cannot make an approved theme render in production. Retained as a necessary contract correction; a new production input branch earns its place because the requested publishing flow cannot work without it and it changes a shared immutable interface.

Verified repository basis:

- `apps/storefront/scripts/experience-build-input.ts`: production input is strict `{ environment: "production" }`, with no Snapshot.
- `apps/storefront/scripts/prepare-experience.ts`: non-preview builds reject Experience input files and generate a null active Experience fallback.
- `apps/storefront/tests/theme-engine.test.ts` and `fashion-store-theme.test.ts`: current fallback tests explicitly prohibit theme imports for that legacy production input.
- `.github/workflows/deploy.yml`: current accepted deployment identity includes Catalog Release and source SHA/ref, not a general approved Experience activation input.

The reviewer recommended making production consumption a REL dependency. The resolved remedy instead assigns implementation to this successor plan's U7.1, while REL keeps qualification and release authority. This avoids placing a mandatory dependency after U8 in the proposed product sequence. The follow-up reviewer verified that ownership and ordering, production isolation and target/fallback tests resolve the original finding at plan level.

## Required Plan Audit

- **Overdesign:** reuse the existing CAS persistence, resolvers, Vue renderer, resource pickers, dnd-kit and protected release workflow. No second document store, CRDT, collaboration service, arbitrary code editor, plugin system or parallel deployment engine. The new projection, authoring metadata and removal guard are justified by current contracts.
- **Coherence:** stable local R/F/AE/KTD/U IDs, eight parent implementation units with named dependencies and concrete acceptance. Current master/REL authority stays intact until activation. Production contract ownership was the one material correction.
- **Practical improvement:** prove one real edit/preview/undo/save loop before expanding controls; retain history readers; filter every mutable resource backlink with removal; bind asynchronous replies to local revision; name real production consumption before publication UI.
- **Confidence scoring:** after correction, Requirements and Research have no trigger; KTD/Implementation/Impact/Questions each retain at most the critical-section bonus (1), with no unaddressed trigger. No section reaches 2. Repository and spec-flow research supplied the targeted strengthening; no extra mechanism or research wave needed.
- **Design audit:** architecture, protocol, editing state, draft lifecycle, publication decisions, projection data flow, session ownership, mode combinations and interface shapes have corresponding diagrams/tables. These describe boundaries and do not mandate new services.

## Sketch Verification

Browser checks passed with no JavaScript errors and no horizontal overflow at 1024, 768, 358 and 288 px product widths (1056, 800, 390 and 320 px outer preview widths).

Verified local demo interactions: live title update, undo/redo, save state, mobile preview, palette change, add/remove section, formal-review dialog, submitted versus live wording, library navigation and deletion, dark appearance, saved-version duplication, and preservation of dirty local content while switching drafts.

Screenshots, wrapper, verification script and raw browser result are in ignored `/.artifacts/screenshots/2026-10-10-storefront-editor-plan/`. The editable inline sketch belongs to the current conversation's visualization directory. Screenshots use illustration placeholders and are not storefront visual-regression baselines.

The first sandboxed Chromium launch was blocked by the macOS process sandbox; the authorized local browser check then ran successfully. This limitation did not require changing application behavior.

## Raw Review Returns

All seven initial returns were schema-valid. Zero-finding returns each contained an empty `findings`, `residual_risks` and `deferred_questions` array. Original feasibility return and its resolved follow-up are retained verbatim in the companion [review evidence](2026-10-10-storefront-editor-plan-review.json).

Review complete.
