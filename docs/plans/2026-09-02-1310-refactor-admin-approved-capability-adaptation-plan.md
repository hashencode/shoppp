---
title: Shoppp Admin Approved Capability Adaptation - Plan
type: refactor
date: 2026-09-02
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
baseline: 55b2608c51ada6c00a2cf5e3365fe4b40460fb5e
quick_start_source: 5b732ffd17fac02cd10088ba0a1b5ff456e819a7
depends_on: codex-admin-quick-start/docs/plans/2026-09-02-1310-refactor-approved-capability-promotion-plan.md
approved_rows: [SHOP-QS-01, SHOP-QS-02, SHOP-QS-03, SHOP-QS-04, C-S-01, C-S-02, C-S-04]
rejected_rows: [C-S-03]
deferred_rows: [C-S-05]
upstream_product_authority: docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md
---

# Shoppp Admin Approved Capability Adaptation

## Plan relationship and tail

- Inherited baseline：Shoppp `55b2608…`、Q `5b732ffd17fac02cd10088ba0a1b5ff456e819a7`，Approval B 四条加 Approval C 三条 approved-adapt。
- Supersessions：none；本计划不改写现有产品、Fashion/Decor、CI 或 release 计划。
- Parallel plans：产品 master 当前 `REL-Pre-DC` 与其 active child 保持原权威；本计划只治理 `apps/admin` shared capability，不接管产品当前指针。
- Tail ownership：2026-09-03 用户已另行启动本地实施与验证；初次交付保留 main 和可审阅 diff。后续用户明确要求“提交代码”，已授权在原 main 本地提交本计划全部变更；push/PR/合并仍不在授权范围。完成后返回现有 product master，不改变其 active plan/current unit/next action，因此不更新 master pointer。
- Execution dependency：Q 已冻结为上述 clean commit，Approval C 已批准；2026-09-03 复核 Shoppp HEAD 与 baseline 一致，仅本计划未跟踪。执行前重新核对目标状态。

## Product contract

- 分类：Admin shared infrastructure；不新增商品、IAM、主题或订单功能。
- 页面 recipe：沿用 StandardList/ModalList/StepForm；不改变 Shoppp 的 i18n、HttpOnly session、首个获权路由或高风险 Modal 状态机。
- 模块：分页与 filter 属 content，行确认属 content/feedback，校验分类与日期属 form；shell 仅接入 Ant feedback provider，permission/导航不变。
- 表单类型：不新增表单；现有 StepForm 只是校验分类器消费者。
- Reuse：现有 pagination hook、ListRowActions、TemplateListFilterForm、form-validation-scroll 与 Catalog consumer。
- 依赖闭包：`apps/admin` 直接依赖 `@shoppp/contracts`；任何 contracts 变化必须独立验证 package 和反向 Admin consumer。

## Units

保留原 U-ID；SA-U6 先建立反馈 owner，再迁移消费者；SA-U5 在其余全部单元后登记。C-S-03 Card heading rejected，C-S-05 稳定上传 deferred，不设实现单元。

### SA-U1. 分页关闭全量项并适配 API 上限（SHOP-QS-01）

- 修改 `apps/admin/src/shared/hooks/use-standard-pagination.ts`、`.test.ts`。
- 修改 `apps/admin/src/pages/catalog/catalog-list-page.tsx`、`.test.tsx`：受 `pageSize<=100` 合同约束的远程请求显式关闭 all-data 并设置上限。
- 复核 `apps/admin/src/shared/template-kit/recipes/standard-list-page-recipe.tsx`、`modal-list-page-recipe.tsx` 与 `packages/contracts/src/admin.ts`；只有发现现有断言错误才修改 contracts 测试，不改变服务端上限。
- 必测默认开启、显式关闭、自定义 99999 重入拒绝和 catalog 请求参数。

### SA-U2. 行危险确认规则（SHOP-QS-02）

- 修改 `apps/admin/docs/ai/ai-rules.md`、`list-action-guidelines.md`、`component-catalog.yaml`、`shared-capability-sync.md`。
- 普通行动作使用 `ListRowActions.confirm`；IAM/主题发布等 recent-auth、operation ID、冲突恢复或不可撤销页面流程保留 Modal。
- 只做规则与静态 consumer 复核；不修改 `user-detail-page.tsx`、`role-detail-page.tsx` 的安全交互。

### SA-U3. Remote search selected option 稳定（SHOP-QS-03）

- 修改 `apps/admin/src/shared/template-kit/list/template-list-filter-form.tsx`、`.test.tsx`。
- 分层维护 remote/default/selected options；controlled parent 拒绝 change 时以真实 value 为准；覆盖 single/multiple/tags、搜索替换、清空与 default 泄漏。
- 保留 `useI18n` 与本地文案；不复制 Q 文件整体。

### SA-U4. 表单校验异常分流（SHOP-QS-04）

- 修改 `apps/admin/src/shared/template-kit/form/form-validation-scroll.ts`、`.test.ts`、`index.ts` 和 `apps/admin/src/pages/templates/form/step-form-page.tsx`。
- 只吞带 `errorFields` 的 validateFields rejection；非校验异常继续抛出。Modal 短表单不强制首错滚动。

### SA-U5. Provenance closeout

- 依赖其余全部单元。修改 `apps/admin/docs/ai/shared-capability-sync.md`，把 Q revision 更新为 frontmatter 的最终 clean SHA，记录七条批准行的 adapters、consumer 和验证证据。
- 若 destination 只部分采用，不得把整仓标为与 Q HEAD 等价。

### SA-U6. Ant App 消息迁移（C-S-01）

- 文件：`apps/admin/src/routes/index.tsx` 的根 ConfigProvider、`apps/admin/src/shared/contexts/theme-context.tsx`、`apps/admin/src/shared/layout/app-shell.tsx` 及测试、`apps/admin/src/infrastructure/http/api-client.ts` 及测试、当前静态 feedback 消费者；补 provider `.test.tsx` 与主题浏览器用例。
- 在 ConfigProvider 下新增唯一 App。组件使用上下文，非 React client 由 owner 注入并清理；保留 useI18n、HttpOnly session、IAM/主题安全 Modal，不建立第二个 singleton。
- 必测主题/翻译上下文、偏好提交后单次提示、401 反馈及卸载、IAM 强确认不变；实施前重搜原 19 文件消费者闭包。

### SA-U7. 日期时间范围归一（C-S-02）

- 文件：新增 `apps/admin/src/shared/utils/date-time-range.ts` 与 `.test.ts`，修改 `apps/admin/src/pages/templates/dashboard/analysis-page.tsx`、`form/basic-form-page.tsx`、`form/advanced-form-page.tsx` 及对应测试；复核当前 4 个 RangePicker 文件闭包。
- 只迁移时间范围语义，保留 i18n、序列化和纯日期合同；最大跨度由 Shoppp 各模板声明，不照搬其他项目天数。
- 必测非法/不完整/相等、反向输入、分钟 ISO、边界跨度及本地化错误反馈。

### SA-U8. API 错误 cause 与幂等（C-S-04）

- 文件：`apps/admin/src/infrastructure/http/api-client.ts`、`.test.ts`、`apps/admin/src/shared/utils/download.test.ts`。
- 保留 nested envelope、details/status、contracts 校验和业务 code 优先级；仅补 transport cause 和已归一 ApiError 同对象返回。
- 必测真实 Axios 错误经 normalize 后的下载 fallback，而非只构造假 ApiError；业务错误不得 fallback，重复归一不丢 code/details/cause，session/401 行为不变。

## Verification

- 本次实施因 SA-U6 新根 App 和跨消费者选 L4，范围限 Admin；其他能力开发时按 L3 focused；SA-U2 文档和 SA-U7 no-op 为 L0。
- focused tests：pagination、Catalog、TemplateListFilterForm、form-validation/StepForm；changed-file ESLint/Prettier。
- 若触及 `packages/contracts`，运行 contracts 自身 focused test/typecheck，再运行 Admin consumer tests。
- 开发时增加 feedback/日期/API error focused tests；稳定后按 `apps/admin/docs/testing-standards.md` 的已选 L4 执行一次 `bun run --cwd apps/admin test`、`bun run --cwd apps/admin build:test`（含 typecheck）和主题/i18n/安全 Modal 浏览器验证。不在同一稳定状态重复较窄测试或单跑 typecheck，不自动升级到服务端或整仓 release 门禁。

## Stop conditions / done

- 不降低 IAM/主题发布确认强度，不改变 session、route、i18n 或业务 API。
- 七条指向 Shoppp 的批准行与 provenance 完成；`pageSize<=100` 真实 consumer 不再可发送 99999；Card heading 不采纳，稳定上传无真实业务消费者而延期。
- product master 指针未改变；若本计划实施被提升为当前产品执行计划，必须同改 master checkpoint 后再继续。

## Execution checkpoint (2026-09-03)

- Authorization: 本任务已满足另行启动门禁；只在现有主目录/main 实施，不改 product master pointer。
- Baseline reconciliation: HEAD `55b2608c51ada6c00a2cf5e3365fe4b40460fb5e` 与计划一致；原始 dirt 仅本计划。来源 frozen `5b732ffd17fac02cd10088ba0a1b5ff456e819a7` 已用 git show 验证，其他仓库只读。
- Current work: none；批准范围本地实施与验证已完成。
- Status: SA-U1/SA-U2/SA-U3/SA-U4/SA-U5/SA-U6/SA-U8 completed；SA-U7 completed (C-S-02 no-op：无时间范围消费者)。
- Blocker: none。
- Next concrete action: 按用户后续“提交代码”授权，将本次67文件变更本地提交到现有main；提交后本计划无剩余实施或提交尾项，推送/PR/合并仍未授权。
- Verification: L4 Admin；开发阶段 focused red/green，稳定后一次 Admin test + build:test（含 typecheck）+ 指定浏览器门禁。
- Local adapters: remote/default/selected 状态实际归属 `shared/components/remote-search-select.tsx`，SA-U3 扩展该 primitive 与测试是必要路径适配；保留业务合同。静态 feedback 实际闭包为28文件，非计划原19；API client 无静态反馈，AuthProvider/login 仍拥有401状态，无须新建非React反馈singleton。日期全部先按消费者语义核对。

- SA-U6 文件适配：为可独立验证，将原根 ConfigProvider 提取至 `src/routes/admin-ui-provider.tsx`，`index.tsx` 只组合 RouterProvider；其下唯一 Ant App。28 个静态 message 文件全迁移；IAM 两处 `Modal.confirm` 仅改为上下文 `modal.confirm`，参数/危险级别/确认回调不变。`theme-context.tsx` 已与来源等价，不改状态或存储合同。
- SA-U7 / C-S-02 no-op：analysis 固定近七天展示；basic 起止日期（月初/月末）原样 ISO；advanced 生效日期与独立 taskTime；filter 仅透传 date-range props 且无 showTime 实例。来源 minute normalization 会改变日末秒/毫秒，未引入 helper 或90/365天限制。本单元实际 L0，只读证据，不把来源测试记成本地通过。
- SA-U8 反向适配：TableQuery 原依赖第二次归一化给5xx显示通用文案，现在在页面 mapError 明确保留该展示合同；API同对象返回保留message/code/details/cause及原404/5xx优先级。
- Verification correction: 首轮全量 339/341，TableQuery 文案回归已修复；ThemeEditor 重用例与并行构建时超时，使用 maxWorkers=2 顺序收口。首轮 build 发现2处新增测试泛型问题，已修复；不降低断言或提高既有超时。

### Completion evidence

- Final complete Admin suite:64 files /341 tests passed (`test --pool.maxWorkers 2`)；build:test含typecheck通过；2/2 focused Browser Mode通过；changed-file ESLint/Prettier、diff check通过。
- 单用例原超时复核后保留20秒门槛，仅将ThemeEditor昂贵的全页role查询替换为等价标签/alt查询，按钮与group语义仍测；原单独21.36秒总时长降至10.78秒，最终全量通过。
- Built candidate: 已在独占端口43871进行桌面/移动截图检查，synthetic session只用于浏览器，one App/dark theme/page errors=[]；本任务临时服务已关闭。
- Seven approved rows：SHOP-QS-01/02/03/04、C-S-01/04本地适配；C-S-02语义no-op。C-S-03 rejected、C-S-05 deferred均未实施。
- [本地证据与文件清单](../progress/2026-09-03-admin-approved-capability-adaptation.md)；[provenance](../../apps/admin/docs/ai/shared-capability-sync.md)。首次交付为main未提交diff；后续本地提交承载相同实施与验证结果，product master pointer不改变。
