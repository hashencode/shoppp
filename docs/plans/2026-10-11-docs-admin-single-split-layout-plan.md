---
title: Admin 单列与单卡片双列布局规范及角色示意图
type: docs
status: complete
execution: knowledge-work
date: 2026-10-11
---

# Admin 单列与单卡片双列布局规范及角色示意图

## Scope and authority

本计划是独立、有界的设计规范与示意图工作。用户已确认普通角色与受保护 Admin 的单卡片双列设计方向，要求重新生成两张示意图，并将布局选型写入项目规范。

- 上游设计权威：`apps/admin/docs/ai/ai-rules.md`、`page-guardrail-recipes.md` 与现有 templates / template-kit 页面体系。
- 继承基线：普通表单默认 `compact` 800px 单列；共享页头、全宽外层 Card、主题 token、整页操作栏、既有权限合同和组件库交互。
- 明确修订：补充已批准的“基础资料＋复杂操作区”和“结构选择＋详情编辑”双列适用条件，使原有宽度说明与新规则一致。
- 并行工作：`2026-10-11-1511-refactor-admin-alert-guidance-plan.md` 已有未提交规则改动；本计划仅增量修改布局条目，不覆盖其反馈规则或 checkpoint。
- 本计划不改变产品序列、候选范围、active-product-plan pointer、产品 U 或 DC / PG 状态；主计划无需更新。
- 本轮明确交付为规范与示意图，页面运行时代码实施范围单独澄清。若用户明确要求实际页面实施，先补齐该实施范围和对应验证等级。

## Requirements and decisions

- R1：区分单列表单、资料＋操作区分栏、结构＋详情分栏、局部成对字段并排；以任务关系和内容宽度决定选型。
- R2：同资源、同任务、共享提交与恢复的两区可在一张 Card 内用分割线分隔；独立保存或状态生命周期的模块保留独立区域。
- R3：普通角色左侧基本资料、右侧可全选子项的权限树；Admin 使用同样布局且保持只读，可搜索和展开，不显示保存／重置。
- R4：窄容器退化为上下布局，保留语义顺序、表单状态及现有组件交互；不以分栏为由改变权限、确认、请求或配方分类。
- KTD1：`ai-rules.md` 新增布局选型详细规则，README、recipe 规范与 `page-recipes.yaml` 引用该规则，避免新增竞争性口径。
- KTD2：两张角色示意图继承现有导航树／表单的分栏外观，图中数据仅为设计演示；生成稿不替代源码、真实权限目录或布局 token。

## Execution checkpoint

本计划已完成；无剩余交付项或阻塞。本执行正文冻结为本轮规范与示意图的历史记录。

| Unit | Scope | Status |
| --- | --- | --- |
| U1 | 写入单列／双列设计规则，同步 recipe 宽度说明与文档入口 | complete |
| U2 | 生成普通角色与 Admin 单卡片双列示意图并保存预览 | complete |
| U3 | 检查文档差异、引用和图片呈现，完成交付 | complete |

## Verification

采用 Admin `L0`：本轮明确交付为文档和静态示意图，不影响运行产物。检查本计划与四份设计文档的 diff、格式、相对引用和规则一致性；检查两张生成图的单卡片分栏、权限勾选状态和 Admin 只读表现。无需测试、typecheck 或 build。

验证证据：

- 五份任务文档通过限定路径的 `prettier --check`，四份设计文档通过 `git diff --check`。
- 已核对 §4.4 heading anchor、README／guardrail 交叉引用、三处 `wide` 准入说明与原有 §4.3 反馈规则保留。
- 两张内置 ImageGen 图片已视觉检查：均为一张 Card 内左右分栏；普通角色展示模块全选与半选，Admin 展示禁用勾选且没有保存／重置／归档动作。
- 静态预览的引用、分区 anchor、图片与完整提示词文件已检查；Codex 浏览器确认两张角色图片及导航参考均已加载。
- 预览：`http://127.0.0.1:3428/role-split-redesign.html`。图片和生成提示词保存于 `/Users/studio/.codex/visualizations/2026/10/11/01a129af-05bc-7cb2-9bb9-9db81944e18e/shoppp-style-audit/`。
- 本轮没有修改运行时代码或真实角色数据，未运行测试、typecheck 或 build；未提交或发布。既有反馈规范工作与其计划仍由原 owner 管理。

以上证据只属于本计划，不改变产品、候选或 DC／PG 状态。
