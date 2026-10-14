# Admin Card 分区布局限定执行计划

本计划是独立 Admin 呈现层调整，对应跨仓主计划 U5（R2、R3、R5–R10）：
`codex-admin-quick-start/docs/plans/2026-10-15-0134-refactor-card-layout-sync-plan.md`。
不改变 Shoppp 产品主计划、活动指针、候选范围或实施顺序。

## 基线与范围

- 目标起始 HEAD：`6d0bf1041989aaeb27e0371d32170ffaa758cd12`，分支 `codex/fix-new-arrival-icon`，工作区 clean。
- 固定通用来源：`codex-admin-quick-start@4369688c2bf2190043c12ba5a6888c39170969fe`，只采用本轮 Card 布局差量。
- 仅 `apps/admin`；沿用当前 checkout，不创建 worktree、根目录或新路由，不写 Git index。
- 业务归类：8 个标准查询列表消费 `StandardListPageRecipe`；Users/Invitations、Audit 是保留领域控制器的本地查询列表。

## 实施方案

1. 在现有 recipe 查询交互测试中补充同 Card、摘要与外置插槽断言，先观察合并前的预期失败。以刷新按钮为语义锚点更新旧 `.ant-card-extra` 工具选择器，保留动作可见性和顺序断言。
2. 仅调整 recipe JSX：查询、非空摘要、结果在同 Card 的 16px 分区；主题横线分隔；列表标题和工具栏位于结果区顶部。前后插槽保持外置。保留 spec、权限、locale、请求、分页、动作宽度、列偏好、虚拟滚动及刷新机制。
3. Users/Invitations 同 Card 内保留原查询与结果分区，用 Ant Design Tabs 承载原资源切换；两个控制器、分页与偏好仍独立。Audit 同 Card 内保留原 cursor 导航、重启和重读恢复。
4. 增量更新本地规则、recipe 元数据及能力记录。既有 TableQuery 示例自动继承，不添加示例路由。记录逐消费页采用与共享能力证据，分别报告。

筛选区沿用 `TemplateListFilterForm` 标准字段；反馈区沿用既有 `TemplateListContent`、外置 collection 交接和中间 report 导出状态；权限区沿用当前 authoritative permissions。此次不改表单结构，已有基础表单、readonly 详情、Drawer 与 Modal owner 保持；没有新表单选型。操作列继续使用当前各业务可见动作组合及 `resolveActionColumnLayout`，不修改宽度计算。

参考示例为 `src/pages/templates/list/table-query-page.tsx`；运行时复用为 `src/shared/template-kit/recipes/standard-list-page-recipe.tsx`。拟改文件：该 recipe 及测试、本地 Users/Audit 及相应测试、Users Tabs CSS、`ai-rules.md`、`page-guardrail-recipes.md`、`page-recipes.yaml`、`component-catalog.yaml`、`shared-capability-sync.md`、`card-layout-adoption.md`；report 已有测试只补摘要位置证据。

## 验证与风险

选择 Admin **L3**：共享 recipe 跨页呈现变化，反向 consumer 闭包和对应 suite 已明确。根 workspaces 为 `apps/*`、`packages/*`，Admin 依赖 `@shoppp/contracts`；该 package 与 API 无改动，范围不扩大到其他应用。

- recipe：查询仍显式提交，非空摘要同 Card，前后插槽外置，无查询/无摘要无空区；权限过滤、动作顺序、选中动态标题不额外请求。
- 8 个消费者：分别执行现有 Catalog、Collection、Content、Orders、Report、Inventory、IAM 和 Notification suites；检查导出空/非空状态、下载及 collection 交接反馈。
- 本地列表：Users/Invitations 切换与双查询/分页/权限/邀请安全恢复保持；Audit First/Previous/Next、Restart 与 Retry 保持。
- 原生 Browser Mode：Users、Audit、Report 与 Inventory 的既有 suites，加入同 Card、实际 16px 内边距及主题横线检查；保留原生 locale 和溢出断言。最后一次 Admin `build:test` 含 `tsc -b`，替代单独 typecheck；changed-file lint/format 和 diff 检查。
- 参数、权限、空态和错误风险使用上述既有 suites；主题风险使用 token 分隔线和实际 CSS 验证。worker 仅执行一个 focused 前置证明用例，全部权威验证由主任务整合后执行。

本次没有改变非普通查询列表。商品/内容纵向编辑模块、主题 saved snapshot 与外部 preview grant、导航实体、主题包、设置和订单详情保留独立边界；前后图库不适用。普通列表 Browser 验证不等于图库截图。

## 复核

范围与来源均限定；不增加容器开关、共享组件、ReactNode 空检测、控制器、焦点机制或示例路由。现有中间摘要由业务返回 `null`，最小 JSX 改动足够。保留的独立模块符合按操作关联归组的已确认边界，无需改变用户决策。无待决定事项；完成采用仍取决于主任务的本地权威门禁。
