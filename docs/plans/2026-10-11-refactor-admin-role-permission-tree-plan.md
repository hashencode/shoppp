---
title: Admin 角色详情单卡片双列与权限树实施
type: refactor
status: completed
date: 2026-10-11
---

# Admin 角色详情单卡片双列与权限树实施

## Scope and authority

独立、有界的 Admin 页面改造，依据用户本轮“开始修改页面代码”的授权，实施已确认的普通角色与受保护 Admin 示意图。继承已完成的 `2026-10-11-docs-admin-single-split-layout-plan.md` 和 `apps/admin/docs/ai/ai-rules.md` §4.4；前者保持历史正文冻结。本计划不改变产品序列、主计划指针、候选范围、DC / PG 或其他页面。

保留当前 checkout `codex/fix-new-arrival-icon`，本线程内顺序实施。既有设计规则、Alert 规范、`.idea/` 等未提交修改不属于本实施的交付；不创建 PR 或部署。并行 Alert 规范计划仍由原 owner 管理。

## Requirements and implementation

- R1：普通角色与 Admin 共用基础表单 recipe，一张全宽 Card，内部 `wide` 1200px；左侧基本资料约 320px，右侧权限树。实际内容容器不足 900px 时上下排列、横向分隔，保留输入与树状态。依据真实 1280px 页面中约 928px 可用内容以及两区预算，将规范建议的约 960px 验证起点调整为 900px。
- R2：权限类别为父节点、真实权限为叶子。父节点可全选当前可授予的子项；库负责半选与键盘行为；保存只包含叶子权限，查看与编辑权限保持独立。搜索与展开不修改授权值。
- R3：Admin、自身角色、无写权限及包含超出当前会话授权范围的角色保持只读；可搜索和展开，无保存、重置或归档。只读时显示已授予权限，不能因调用者子集而误删。
- R4：保留权限削减 Modal、版本冲突重载、归档依赖反馈；统一固定保存／重置。重置恢复当前已加载角色资料、权限和树搜索／展开。

### Source-to-target contract

| Boundary       | Current contract / retained result                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Route and menu | `/access/roles/:id`，`iam.roles.read`；返回 `/access/roles`，不改变列表与新增弹窗                                                      |
| Read           | `GET /admin/iam/roles/:id`，读取 `data` 内角色，失败可重试／返回                                                                       |
| Edit           | `iam.roles.write` 且非 protected、非 session.role.id、角色权限均在调用者权限内                                                         |
| Fields         | key 禁用；name 必填；description 选填；permissions 叶子数组。Form 全量校验值是提交来源                                                 |
| Save           | `PATCH /admin/iam/roles/:id`，完整字段白名单为 description、expectedVersion、name、permissions；description 空白为 null，其余文本 trim |
| Reduction      | 删除原有权限时先 Modal 确认，确认后沿原 PATCH 合同提交                                                                                 |
| Archive        | 非 system 且 enabled 且可编辑；原 Popconfirm；PATCH enabled=false、expectedVersion，不改保存粒度                                       |
| Failure        | stale_role_version 重载最新详情；role_has_dependencies 展示 identities / pendingInvitations；保留其他既有错误映射                      |
| UI changes     | 统一 recipe 页头、Card、主题 token 与工具条；资料／权限同卡分栏；保护原因在关联分区显示一次                                            |

### Decisions

- KTD1（user-approved）：单卡片双列、权限父子全选、Admin 只读；分栏不是升级为高级表单的理由。
- KTD2：复用 `BasicCrudFormRecipe`、Ant Design Tree 和现有保存合同；新增 IAM 局部权限树，现有创建角色 `PermissionChecklist` 保持原消费者与合同。
- KTD3：主线程原生执行；不修改共享 recipe、路由、后端或真实角色数据。浏览器只操作未保存草稿；保存结果由 MSW focused tests 验证。

## Execution checkpoint

U1、U2 均已完成；无阻塞或后续实施尾项。验证与主线程复核记录见 `docs/progress/2026-10-11-admin-role-permission-tree-verification.md`。本计划正文随完成冻结。

| Unit | Scope                                                  | Status   |
| ---- | ------------------------------------------------------ | -------- |
| U1   | 角色详情、局部权限树、响应式布局、翻译及针对性回归覆盖 | complete |
| U2   | L2 验证与宽／窄容器实际页面检查                        | complete |

## Verification contract

选择 Admin L2：仅角色详情与局部字段行为，已有 IAM suite 可界定影响；不改变共享组件、路由或权限基础设施。更新现有 `iam-pages.test.tsx`，先验证父子全选的新行为失败，实施后完整运行该 suite；覆盖精确保存 payload、半选／削减确认、只读提交阻断、重置、caller subset、冲突及依赖失败。限定文件 ESLint / Prettier、最终一次 Admin typecheck、翻译检查。浏览器检查实际 Admin、普通角色未保存草稿、宽／窄分栏、状态保留及主题；不运行全量测试或 build。
