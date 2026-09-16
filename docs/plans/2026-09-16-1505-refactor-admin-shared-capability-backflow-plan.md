---
title: Admin Shared Capability Backflow
type: refactor
date: 2026-09-16
artifact_contract: ce-unified-plan/v1
product_contract_source: downstream-capability-audit
execution: code
status: complete
---

# Admin Shared Capability Backflow - Plan

## Authority and Continuity

- **Upstream product authority:** `docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md` remains the Shoppp product authority.
- **Inherited baseline:** Admin at `602f452eb755d94b142ecbb69318f746f8d0d2e2`; quick-start capability source at `2a28631bb5954c5514bc0885d174ab38de8632e5`.
- **Supersessions:** none. This plan adapts Admin shared infrastructure and does not supersede product, Fashion Store, catalog, or publishing plans.
- **Parallel plans:** the currently active Fashion Store/product plans and their existing WIP continue independently; their files are excluded from this plan and its commit.
- **Tail ownership:** this plan owns local Admin implementation, verification and a path-limited local commit only. It does not change the master active-plan pointer and does not push or open a PR.

## Execution Checkpoint

- **Current unit:** complete — U1-U4 closed.
- **Status:** complete; implementation, evidence, L3 verification and local commit preparation are closed.
- **Blocker:** none.
- **Next concrete action:** none in this plan; proceed to the next repository in the approved backflow sequence.

## Goal Capsule

- **Objective:** 让 Shoppp Admin 的操作列在所有可见动作直出的前提下保持不超过 280px 的稳定单/双行布局，并让 PDF 预览在 PDF.js 失败后确定降级到 native，再失败时保留下载恢复。
- **Means:** 本地移植 quick-start 已验证的通用合同，适配 Shoppp Admin 的 i18n、app base、recipe API 和现有消费者；不引入跨仓运行时依赖。
- **Execution profile:** L3；共享组件、recipe、静态审计与真实浏览器行为均受影响，但消费者闭包可由 Admin imports 和 workspace metadata 界定。
- **Stop conditions:** 需要改变业务权限、危险操作安全 Modal、API endpoint、下载认证、Shoppp 产品主线计划或非 Admin workspace 时停止。

## Product Contract

### Requirements

- R1. `ListRowActionSpec` 支持固定 `contentWidth`；已采用组合合同的动作必须完整声明。先过滤 `visible: false`，再按页面提供的布局预算决定单行或连续双行，不隐藏、不折叠、不运行时测量；全旧式消费者保留 warning 以支持渐进迁移。
- R2. `resolveActionColumnLayout` 按最大可达组合、17px divider 与 table density padding 求解；最终列宽不超过 280px，双行保持动作顺序并选择最小最大行宽，平局取更早切点。
- R3. Standard/Modal list recipe 同时提供布局求解器；现有 `resolveActionColumnWidth` 保留为兼容入口，但标准模板消费者迁移到组合合同。
- R4. 静态审计校验 action key、命名宽度 map、可达组合、scroll.x 与布局支持性；全旧式消费者允许渐进 warning，部分采用合同不得漏项。
- R5. PDF 使用 source/session 隔离的 PDF.js→native blob iframe→download reducer；Document、Page load/render、lazy import、React render 和 iframe error 均可推进恢复且每阶段最多一次。
- R6. native fetch 使用 `credentials: 'include'` 和 15 秒 timeout；cleanup abort 静默，timer、Blob URL 与 iframe listener 对称清理，listener-before-src。
- R7. Shoppp i18n、图片/视频/未知文件、显式下载、受控 open、app base、现有安全与业务反馈语义保持不变。

### Acceptance Examples

- AE1. 最大单行最终宽度 `<=280px` 时一行；超出时连续切成两行，隐藏动作后可自然回到一行，divider 仅存在于行内。
- AE2. 五个及以上可见动作全部存在，不出现“更多”；布局列宽由最大可达组合稳定决定。
- AE3. PDF Document/Page/render 失败后进入 native；native fetch、iframe 或 15 秒 timeout 失败后显示现有本地化失败态和可用下载按钮。
- AE4. A→B→A、同源关闭重开和 StrictMode 下，旧 session 错误不能推进新 session，资源均被回收。

### Scope Boundaries

- Included: `apps/admin` 的 row-action primitive、recipe/spec、标准模板消费者、静态审计、FilePreview、测试和能力文档。
- Excluded: 当前 dirty 的 catalog/settings/API/storefront/contracts/db/product-plan WIP；业务权限、endpoint、路由、产品模板和发布流程。

## Planning Contract

### Key Technical Decisions

- KTD1. 代码在 Shoppp Admin 本地落地，quick-start 只作为不可变来源证据。
- KTD2. 行布局预算由页面最大可达组合声明，运行时只按可见动作选用已声明预算，不测 DOM。
- KTD3. PDF 复用一个 reducer 和 preview session；不把 iframe `load` 当作 PDF 已绘制成功。
- KTD4. 先迁移模板和现有少量 Admin 消费者，再把强校验用于已采用合同的集合；不在本计划重迁无关业务页。

## Implementation Units

### U1. Add bounded row-action primitive

- **Files:** `apps/admin/src/shared/template-kit/list/resolve-action-column-width.ts`, new focused resolver test, `apps/admin/src/shared/components/list-row-actions.tsx`, its unit/browser tests, list barrel.
- **Verification:** single/wrapped/tie/unsupported layouts；visible 过滤、顺序、行内 divider、自定义 render 与 link/confirm 回归。

### U2. Wire recipes, consumers and audit

- **Dependencies:** U1.
- **Files:** standard/modal recipe and spec, template list page, current Admin consumers as required, `apps/admin/src/test/table-width-audit*`, related tests.
- **Verification:** recipe density、组合合同、模板/消费者宽度、strict audit 和 scroll.x 通过；不触碰业务权限与 endpoint。

### U3. Add resilient PDF recovery

- **Files:** `file-preview.tsx`, `file-preview-pdf-content.tsx`, new reducer, unit/browser/load-error tests and Upload adjacency tests.
- **Verification:** Document/Page/render/import/native/iframe/timeout、credentials、cleanup、A→B→A、controlled reopen、非 PDF 回归。

### U4. Align Admin capability evidence and close verification

- **Dependencies:** U1-U3.
- **Files:** `apps/admin/docs/ai/ai-rules.md`, component catalog, list width/action rules, shared-capability sync, this plan checkpoint.
- **Verification:** changed-file lint/format, focused suites, Browser Mode, strict audit, `bun run build:test`, `git diff --check`。

## Verification Contract

- L3 consumer closure: `rg` imports/references + root/app package dependency metadata + direct suites for changed shared files and current consumers.
- Run focused unit suites after each stabilized unit; Browser Mode once after U1-U3 converge.
- Run strict table-width audit after consumer migration.
- Final changed-file ESLint/Prettier and `bun run build:test`; build includes typecheck, so no duplicate standalone typecheck.
- Existing unrelated dirty files and failures are isolated and never reformatted or committed.

## Definition of Done

- R1-R7 and AE1-AE4 have code and verification evidence.
- Execution checkpoint marks U1-U4 complete and names no remaining implementation tail.
- Existing Shoppp WIP is byte-for-byte outside this plan's path set and remains uncommitted.
- One path-limited local commit contains only this plan and Admin shared-capability files; no push or PR.

## Completion Evidence

- Focused unit/consumer closure: 10 files, 82 tests passed.
- Browser Mode: FilePreview and virtual ListRowActions, 6 tests passed in Chromium, including light/dark fixed-cell alignment and PDF source/reopen resource isolation.
- `bun run qa:table-widths -- --strict` passed with one non-blocking unresolved-expression warning for the computed template width and no errors.
- Changed TypeScript ESLint passed; documentation/YAML were outside the ESLint config. Prettier check, `git diff --check` and `bun run build:test` passed.
- Consumer closure confirmed both current `ListRowActions` consumers use the combination contract; `react-pdf` and `pdfjs-dist` remain local Admin dependencies.
- Code review: skipped (ce-code-review unavailable) — 当前主机没有顶层技能调用入口；已完成手工 diff 扫描、聚焦回归、Browser Mode、strict audit 与构建验证。
