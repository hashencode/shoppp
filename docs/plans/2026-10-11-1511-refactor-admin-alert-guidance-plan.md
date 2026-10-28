---
title: Admin Alert and Guidance Cleanup - Plan
type: refactor
date: 2026-10-11
topic: admin-alert-guidance
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
plan_role: independent
plan_alias: ADM-FB
---

# Admin Alert and Guidance Cleanup - Plan

## Goal Capsule

- **Objective:** 商家能够快速发现真正需要处理的异常和风险，正常页面不被空态、机制说明和重复反馈占据。
- **Means:** 采用现有反馈规范，逐页调整呈现和生命周期，复用既有组件（KTD1-KTD3）。
- **Authority:** 本计划是独立有界 Admin 呈现清理；长期规则由 `apps/admin/docs/ai/ai-rules.md` §4.3 拥有，本计划只拥有下列页面处置和本地验证。
- **Inherited baseline:** 已完成的 ADM-UX 页面说明清理、IAM 列表层级清理、收入报表表头帮助、仪表盘空态精简，以及 `docs/plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md` 的业务后果与版本状态合同。
- **Supersession:** 只取代本计划具名页面的正常状态 Alert、重复说明、技术机制文案和过期轻量反馈呈现，不取代其业务、安全、审批或请求合同。
- **Parallel authority:** REL 继续拥有产品候选与 DC/PG；侧栏展开状态、环境配置及其他独立计划只拥有自己的范围。此清理不转移其权威。
- **Execution boundary:** 本次只交付规范与计划。U2-U4 代码工作尚未获得实施指令；不得因本计划已写入、文档验证通过或 U1 完成而开始改代码。
- **Tail owner:** ADM-FB 拥有规范和后续具名清理的收口；产品 master、REL-Pre-DC、候选范围和部署状态保持原权威。

---

## Product Contract

### Summary

清理的对象是不能帮助当前决策、呈现过重、重复或已经过期的提示。
真实失败、冲突、依赖缺失、持续任务状态以及金融、隐私和权限风险仍需被清楚发现。
每个页面分别决定删除、降级、合并、移位或调整生命周期，不以 Alert 总量或“页面无 Alert”作为验收目标。

### Problem Frame and Evidence

2026-10-11 排查在 Admin 非测试 TSX 中发现 85 处 Alert 声明，涉及 37 个文件，包含业务页面、共享组件和示例。
这不是 85 个缺陷，也不代表同时渲染的提示数量。
导航菜单、商品系列新建表单、受保护角色详情已经页面实看；其余下表项以当前代码及显示条件核对，未穷举所有权限和环境。

历史修复已经删除泛泛的用途说明，并将指标定义移到表头帮助。
现有规则仍未充分区分“状态需要被表达”与“状态需要被 Alert 强调”，使正常空态、只读说明和轻量结果继续使用持久提示。

### Requirements

**Feedback presentation**

- R1. 新增与现有提示遵从 `apps/admin/docs/ai/ai-rules.md` §4.3；其选型、严重级别和生命周期由该规范统一拥有。
- R2. 下表具名正常加载、空态和常规限制采用所属组件的轻量呈现，保留必要原因和已有下一步入口。
- R3. 轻量结果按实际操作结果反馈；评价审核等页面不长期保留上一操作的成功提示。
- R4. 内部机制说明从日常操作界面移除；当前决策需要的业务后果仍在对应控件或确认处出现。

**Preservation and delivery**

- R5. 保留下表异常、风险、持续任务及恢复信息；不得因合并而丢失不同限制原因。
- R6. 提示清理不改变接口、请求载荷、成功判定、权限、字段校验、确认、审计、幂等或恢复逻辑；沿用 Ant Design 和现有 primitives 的交互与无障碍所有权。
- R7. 文案遵从现有 i18n 与真实保存、批准、预览、发布状态合同，不能把已入队或来源已保存表示为已完成或已上线。
- R8. 本次只完成 U1 文档工作；代码、测试文件和运行配置不修改，后续 U 按明确实施指令启动。

### Page Disposition

下表是计划中的处置，不是已实施结果。
“保留”项不要求制造代码差异；只有与对应清理共享边界时才纳入 focused 验证。

| 页面 / 所属组件                                                                                                                   | 当前情况与触发条件                                                                          | 计划处置                                                                                           | 必须保留                                                                        | 单元 |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---- |
| 导航菜单：`apps/admin/src/pages/storefront/navigation-page.tsx`                                                                   | `loading` 返回 info Alert；`items.length === 0` 显示“没有可选菜单项” Alert                  | 降级：复用加载态；空菜单用局部空态，继续使用“添加菜单项”入口                                       | 加载失败和 Retry、保存错误、目标失效、资源浏览权限限制                          | U2   |
| 商品系列表单：`apps/admin/src/pages/catalog/collection-form-page.tsx`                                                             | 未添加商品时显示“此可选商品集合中没有商品” Alert，新建正常状态即触发                        | 降级：有序成员区域的简短空态，已有“添加商品”控件保留；不把可选集合变成必填                         | 保存错误、引用阻塞与修复、只读和排序边界                                        | U2   |
| 装修素材选择：`apps/admin/src/pages/storefront/catalog-media-picker.tsx`                                                          | `items.length === 0` 用 info Alert 表达搜索无结果                                           | 降级：与 `apps/admin/src/pages/storefront/storefront-resource-picker.tsx` 的局部无结果文字保持一致 | 请求失败 Alert 与 Retry、素材审批边界及选择能力                                 | U2   |
| 商品系列列表：`apps/admin/src/pages/catalog/collection-list-page.tsx`                                                             | 只有商品交接参数存在时，info Alert 说明当前筛选 / 选择任务，并带切换入口                    | 移位、降级：在列表业务动作附近保留任务上下文和当前范围，不能当作泛泛用途说明删除                   | 选定商品身份、返回位置、显示全部 / 已包含的切换动作                             | U2   |
| 角色详情：`apps/admin/src/pages/iam/role-detail-page.tsx`                                                                         | 标题下介绍 D1；受保护角色与本人角色条件可同时出现两条“不能编辑” Alert                       | 删除机制介绍；在权限分区合并当前适用的只读原因，保留可辨识状态                                     | 超出权限范围、受保护 / 本人限制、最后管理员与依赖拒绝、版本冲突和重新加载       | U3   |
| 用户详情：`apps/admin/src/pages/iam/user-detail-page.tsx`                                                                         | 标题下复述用途；本人限制与无角色读取权限分别显示 info Alert                                 | 删除用途复述；把姓名 / 角色 / 状态各自的可编辑范围就近说明，避免误称整页只读                       | 最后受保护管理员风险、recent-auth 确认、更新拒绝和冲突恢复                      | U3   |
| 用户与邀请：`apps/admin/src/pages/iam/users-page.tsx`                                                                             | 有用户写权限但无角色读取权限时，页面顶部提示不能新建邀请、仍可重发或撤销                    | 移位：邀请操作分区说明限制，不新增全页只读提示                                                     | 已有邀请动作、角色加载失败 Retry、新建邀请错误及其权限边界                      | U3   |
| 店铺装修列表 / 编辑器：`apps/admin/src/pages/storefront/themes-page.tsx`、`apps/admin/src/pages/storefront/theme-editor-page.tsx` | 受限账号显示 Read-only theme access / Read-only experience info Alert                       | 降级：在所属分区说明实际可用操作，不能笼统隐藏所有读、预览或发布能力                               | 未保存离开确认、并发草稿冲突、缺失引用、预览失败、校验 / 迁移冲突和真实发布状态 | U3   |
| 商品表单：`apps/admin/src/pages/catalog/catalog-form-page.tsx`                                                                    | `catalogShapeLocked` 时 warning 解释已发布或多规格等编辑能力边界，含 scalar editor 技术措辞 | 降级、改写：在对应商品字段 / 编辑分区说明具体不可编辑原因；不按只读删除原因                        | 实际字段锁定、已发布商品修订路径、媒体限制、字段错误和保存失败                  | U3   |
| 评价审核：`apps/admin/src/pages/catalog/review-moderation-page.tsx`                                                               | 审核后 `notice` 保存批准 / 拒绝结果，页面顶部 info Alert 未清除                             | 调整生命周期：轻量批准 / 拒绝结果用 message；“批准后还需后续发布才能公开”在审核决策处简短说明      | 审核决定、原因输入、失败反馈与“批准不等于当前店铺已展示”的真实边界              | U4   |
| 自动任务恢复：`apps/admin/src/pages/operations/jobs/notification-jobs-page.tsx`                                                   | 重放弹窗 warning 介绍提供商幂等身份和审计机制                                               | 改写：确认处说明重新执行的具体通知后果；机制细节不作为黄色警告；按真实风险决定局部强调             | 原确认、重放原因、可重放条件、幂等与审计行为、入队状态和失败反馈                | U4   |
| 订单详情：`apps/admin/src/pages/orders/order-detail.tsx`                                                                          | 退款、取消和履约共用 warning：“已审计、不能静默撤销”，未区分动作后果                        | 改写：按当前动作说明可证实的退款、取消或履约状态后果；金融和其他实际风险仍用必要 warning 强调      | 原 Modal 确认、金额上限、原因和物流字段校验、允许动作、权限、请求与失败反馈     | U4   |

### Retained Surfaces

| 页面 / 边界                                                                     | 保留理由与本计划边界                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 收入报表 `apps/admin/src/pages/reports/order-report-page.tsx`                   | 敏感客户邮件导出确认、有效期、任务状态和下载入口有实际后果；保留既有表头 Tooltip，常驻口径 Alert 不恢复                                                                                                                                               |
| 订单详情 `apps/admin/src/pages/orders/order-detail.tsx`                         | U4 只改确认处的泛化机制文案；退款、取消和履约继续依具体业务动作确认，真实订单风险不得弱化                                                                                                                                                             |
| 联系信息 `apps/admin/src/pages/settings/contact-settings-page.tsx`              | 409 冲突、对比当前值、主动替换草稿和加载失败保留；旧营业时间的格式状态及替换入口有具体用途，不并入泛泛空态清理                                                                                                                                        |
| 商品系列依赖、装修链接与资源选择器                                              | `apps/admin/src/pages/catalog/collection-blocked-dependencies.tsx`、`apps/admin/src/pages/storefront/storefront-link-editor.tsx`、`apps/admin/src/pages/storefront/storefront-resource-picker.tsx` 的缺失引用、访问限制和失败恢复保留                 |
| 店铺正式发布 `apps/admin/src/pages/storefront/storefront-publication-panel.tsx` | 未验证线上版本、发布中、未解决激活、失败及提交错误与后续恢复入口保留；不以等待状态为由自动消失                                                                                                                                                        |
| 店铺资料、经营设置和政策                                                        | `apps/admin/src/pages/settings/store-identity-page.tsx` 的依赖修复、`apps/admin/src/pages/settings/launch-settings-page.tsx` 的健康失败重试、`apps/admin/src/pages/settings/policies-page.tsx` 的权限和提交异常保留；具体保存后果继续在原操作边界呈现 |
| 角色列表、内容编辑和已发布商品修订                                              | `apps/admin/src/pages/iam/roles-page.tsx` 的创建错误、`apps/admin/src/pages/content/content-editor-page.tsx` 的保存错误、`apps/admin/src/pages/catalog/published-product-revision-editor.tsx` 的修订失败保留                                          |
| 认证、上传、文件预览与共享 query 状态                                           | 不列入批量清理；认证结果、上传失败、预览不可用和 partial 都有明确状态含义，不修改共享反馈 primitive                                                                                                                                                   |
| 开店指南、商业仪表盘                                                            | 沿用现有专项页面合同；本计划不修改这两页的内容、布局、数据、提示或状态逻辑                                                                                                                                                                            |

组件示例 `apps/admin/src/pages/templates/form/step-form-page.tsx` 不作为商家页面清理项；本计划不批量修改示例或共享组件。后续新增示例同样消费长期规范。

### Scope Boundaries

只处理 Page Disposition 表的具名呈现问题。
不修改业务 API、安全策略、审批模型、发布流程、页面结构或共享状态控制器，也不新建全局提示、焦点管理或 Alert 数量检查器。
后者不能判断提示的业务必要性，当前逐页合同与回归边界足够承接本次目标。
若未来发现共享 primitive 的可复现缺口，另立有界计划并重新确定消费者与验证等级。

### Sources

- `docs/plans/2026-09-20-1438-fix-admin-page-query-consistency-plan.md`
- `docs/plans/2026-09-21-1545-refactor-admin-iam-list-hierarchy-plan.md`
- `docs/plans/2026-09-30-fix-revenue-report-header-help.md`
- `docs/plans/2026-09-30-fix-dashboard-empty-state-presentation.md`
- `docs/plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md`
- `apps/admin/AGENTS.md`、`apps/admin/docs/ai/ai-rules.md`、`apps/admin/docs/testing-standards.md` 及上表当前源码。

---

## Planning Contract

### Key Technical Decisions

- KTD1. 使用 `apps/admin/docs/ai/ai-rules.md` §4.3 作为唯一长期反馈规范，文档入口、guardrail 和迁移 checklist 只引用或消费该规则。Governs R1。
- KTD2. 呈现改动留在各业务页面，复用现有 Empty、加载态、Typography、Tag、Form help 和 App message；不改变共享 primitive。Governs R2、R6。
- KTD3. 评价审核将即时结果与未来公开的业务规则分开表达；任务重放与订单确认的后果文案以当前动作和服务合同为依据，不推断不存在的风险，也不把“已审计”作为实际后果的替代。Governs R3、R4、R5、R7。
- KTD4. 先落地规范，再按 U2 正常状态、U3 常规限制、U4 操作反馈顺序清理。每批只验证改变的交互及其保留边界，不把“保留”表转成全量重测队列。Governs R5、R8。

### Implementation-Time Checks

- U3 开始前按当时账号权限组合核对实际可用动作；保留状态原因，不能仅根据一个 Alert 的名称推断整页只读。
- U4 任务重放文案按任务种类及现有重放接口核对发送 / 重新处理效果；订单确认按取消、退款和具体履约目标核对后果。无法证明的后果或“不可撤销”承诺不写入界面。
- 这些是实施前的事实复核，不是新增业务设计或授权；若需要改变服务行为，停止该处清理并单独提出范围。

---

## Implementation Units

### U1. Establish feedback rules and the cleanup plan

**Requirements:** R1、R8。**Dependencies:** 无。

**Files:** `apps/admin/docs/ai/ai-rules.md`、`apps/admin/docs/ai/README.md`、`apps/admin/docs/ai/page-guardrail-recipes.md`、`apps/admin/docs/ai/legacy-page-migration-checklist.md` 与本计划。

**Approach:** 按 KTD1 补齐规则，修正旧“所有状态都带恢复动作”等容易误用的表述，建立上表的逐页处置与保留边界。

**Test expectation:** 无运行时行为变化；仅执行 L0 文档检查。

**Verification:** 规则引用可解析，无互相冲突的默认要求，代码文件与 product master 未修改。

### U2. Clarify normal loading, empty and handoff states

**Requirements:** R2、R5-R7。**Dependencies:** U1 与明确代码实施指令。

**Files:** Page Disposition 中 U2 的四个源码文件；`apps/admin/src/pages/storefront/navigation-page.test.tsx`、`apps/admin/src/pages/storefront/catalog-media-picker.test.tsx`；`apps/admin/src/pages/catalog/collection-form-page.test.tsx`、`apps/admin/src/pages/catalog/collection-list-page.test.tsx`；需要变更的字面量位于 `apps/admin/src/shared/i18n/translations.ts`。

**Approach:** 逐项落实 U2 表格处置，复用 `apps/admin/src/pages/storefront/storefront-resource-picker.tsx` 的轻量空态和现有页面加载模式。

**Test scenarios:**

1. 空菜单仍可添加、保存；加载与正常空态不使用 Alert，真正请求失败仍显示 Retry。
2. 新建无商品系列保持可选，添加、移除、排序及只读禁用行为不变，保存失败和引用阻塞可发现。
3. 素材搜索成功但无结果呈现轻量空态；失败仍可重试；成功选择仍回填原数据。
4. 有 / 无商品交接参数时筛选与返回目标不变，显示全部 / 已包含范围仍可切换。

**Verification:** L2 focused 组件测试及 changed-file checks；中英文和窄屏下空态与已有入口可发现。只有实际浏览器风险出现才补对应 Browser Mode。

### U3. Consolidate read-only and permission explanations

**Requirements:** R2、R4-R7。**Dependencies:** U2。

**Files:** Page Disposition 中 U3 的六个源码文件；`apps/admin/src/pages/iam/iam-pages.test.tsx`、`apps/admin/src/pages/iam/iam-pages.browser.test.tsx`；`apps/admin/src/pages/storefront/themes-page.test.tsx`、`apps/admin/src/pages/storefront/theme-editor-page.test.tsx`、`apps/admin/src/pages/storefront/theme-editor-page.browser.test.tsx`；`apps/admin/src/pages/catalog/catalog-form-page.test.tsx`；必要 i18n 词条。

**Approach:** 按 U3 表格在现有分区说明原因；先用已有 IAM 和装修权限用例确认动作边界，再合并重叠的可见说明。

**Test scenarios:**

1. 受保护且是本人角色时，原因完整但不重复堆叠 Alert；仍不能保存或归档，越权与冲突结果仍可发现。
2. 用户写权限与角色读取权限不同组合下，姓名、角色和状态的真实编辑范围不变；最后管理员拒绝及既有确认仍有效。
3. 不能创建邀请的账号仍按原权限重发 / 撤销已有邀请；角色加载失败仍可重试。
4. 装修受限账号保留原可用的读、预览、批准或发布能力；冲突、未保存离开和预览错误恢复未被精简掉。
5. 已发布 / 多规格商品的受限字段保持锁定，已有修订入口与可编辑内容保留，失败定位不被删除。

**Verification:** L2 focused tests；只在触及原浏览器权限 / 焦点路径时使用对应现有 Browser Mode suite，不重复测试 Ant Design 的通用能力。

### U4. Correct lightweight outcomes and action confirmation copy

**Requirements:** R3-R7。**Dependencies:** U3。

**Files:** `apps/admin/src/pages/catalog/review-moderation-page.tsx`、`apps/admin/src/pages/catalog/review-moderation-page.test.tsx`；`apps/admin/src/pages/operations/jobs/notification-jobs-page.tsx`、`apps/admin/src/pages/operations/jobs/notification-jobs-page.test.tsx`；`apps/admin/src/pages/orders/order-detail.tsx`、`apps/admin/src/pages/orders/order-detail.test.tsx`；必要 i18n 词条。

**Approach:** 按 KTD3 和 U4 表格处理轻量结果、重放与订单确认，复用当前 message 与 Modal，保持各类实际写动作的请求合同。

**Test scenarios:**

1. 批准 / 拒绝成功后列表更新并有一次轻量结果，上一操作不残留顶部 Alert；批准的公开边界在审核决策处可见。
2. 审核失败仍可发现，原因不足不发送请求；切换语言不重放旧结果。
3. 打开重放弹窗时出现可证实的任务后果，保留确认和原因校验；取消不请求，确认发送原载荷。
4. 重放成功只表示入队，失败反馈与原重试能力保留；机制说明不作为 warning 文案。
5. 退款、取消和履约弹窗分别表达对应后果，实际风险仍可发现；取消不请求，金额 / 原因 / 物流校验、确认载荷和允许动作保持不变。

**Verification:** L2 focused tests 与 changed-file checks；只在 Modal 原交互边界出现验证缺口时补已有 browser / E2E 对应场景，不自行扩展业务探针。

---

## Verification Contract

- **本次文档交付：L0。** 限定这五个文档检查 diff、Markdown 格式、本地链接、具名源码与测试路径、规范冲突和范围；不运行测试、typecheck 或 build。
- **未来代码清理：默认每批 L2。** 使用上述现有 focused suites，检查必要的 i18n 词条和变更文件质量；代码稳定后做一次 Admin typecheck，等价 build 已覆盖时不重复。
- 等级、Browser Mode / E2E 升级和门禁去重只以 `apps/admin/docs/testing-standards.md` 为准。若实施改变共享 primitive 或跨页基础设施，先重新界定 consumers 并选择 L3，不能继续沿用本计划的局部假设。
- 不新增大范围“页面没有 Alert”快照测试；正常态呈现断言须同时连接实际控件、动作与异常保留断言。
- 既有未触及的“保留”页面仅做源码 / diff 边界检查；发生共享影响或实际回归才扩大验证，候选和部署验证继续由 REL 拥有。

---

## Execution Checkpoint

| Unit | Status                                            |
| ---- | ------------------------------------------------- |
| U1   | Completed — 规范、页面计划、L0 检查与文档评审完成 |
| U2   | Not started                                       |
| U3   | Not started                                       |
| U4   | Not started                                       |

- **Current unit:** 无执行中的单元；U1 已完成，U2 尚未启动。
- **Next concrete action:** 保留本计划；仅在收到明确代码实施指令后启动 U2。
- **Blockers:** 无已知技术阻塞；本次代码执行边界由 R8 限定。
- **Tail ownership:** 本计划；不维护第二个产品 current-unit queue。

U1 验证记录（2026-10-11）：五个文档的 diff、基础 Markdown 结构与变更范围检查通过；33 个本地 Markdown 链接和 51 个具名文件引用可解析，新计划格式已检查。文档评审依仓库约束在主线程依次检查一致性、可行性、设计、安全、范围和假设，补齐完整文件路径、消除只读呈现与权限保护之间的歧义，并将订单确认的泛化机制文案纳入 U4；无待决文档问题。未运行测试、typecheck 或 build，业务源码、测试、运行配置与产品 master 均未修改。

---

## Definition of Done

**本次文档交付完成：** U1 完成，长期规范及消费入口一致，逐页处置和保留项可复核，L0 与文档评审通过，业务源码未修改。

**未来完整清理完成：** U2-U4 各自满足表格处置、focused 验证和 R5-R7；只按已授权范围实施。完成后在本计划记录收口并冻结执行正文，不把代码未开始的计划宣称为已完成清理。
