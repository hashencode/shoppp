# Admin Card 分区布局采用记录

本轮对应独立 [本地执行计划](../plans/2026-10-15-card-layout-sync-plan.md) 和跨仓主计划 U5，
不改变 Shoppp 活动产品计划或候选完成状态。实施及下列本地 L3 门禁已完成；代码复核收口由跨仓主任务登记。

## 共享能力证据

| 项目         | 本轮记录                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标起始版本 | `shoppp@6d0bf1041989aaeb27e0371d32170ffaa758cd12`，`codex/fix-new-arrival-icon`，起始 clean                                                                                                 |
| 不可变来源   | `codex-admin-quick-start@4369688c2bf2190043c12ba5a6888c39170969fe`；仅 Card 分区布局增量，旧轮次版本见 `shared-capability-sync.md`                                                          |
| 本地实现     | `src/shared/template-kit/recipes/standard-list-page-recipe.tsx`，查询、非空摘要、结果共用 Card，16px 内边距、主题横线，前后插槽外置                                                         |
| 保留 adapter | locale、authoritative permissions、initialFormValues、appliedFilters、显式请求最短 loading、创建权限、动作宽度、列偏好、远程/本地分页、虚拟滚动及刷新保持原实现；spec/controller/API 未改变 |
| 本地规范     | `ai-rules.md` 指向 `page-guardrail-recipes.md` §2.1/§3.1；recipe/catalog 元数据增量更新，不复制来源业务配置                                                                                 |
| 示例         | 既有 `src/pages/templates/list/table-query-page.tsx` 直接继承本地 recipe；示例实现无需修改。已有 suite 补同 Card 断言；未注册示例路由，未引入业务的示例 API 依赖                            |
| 门禁范围     | Admin L3，受影响 consumer 与 suite 闭包见下表；`build:test` 包含 `tsc -b`，不另跑 typecheck                                                                                                 |

前置证明：在生产代码修改前，增强既有 recipe 查询交互用例，执行：

```sh
bun run --cwd apps/admin test src/shared/template-kit/recipes/standard-list-page-recipe.test.tsx -t 'does not auto request on filter value change and only queries on submit' --pool.maxWorkers 1
```

实际结果：1 个预期失败、17 个跳过；查询字段的 `.closest('.ant-card')` 与结果 Card 不同（修改前测试行 365）。
生产修改随后进行。业务状态行为未改变，呈现合同改变；更新原测试中的工具栏 scope 为刷新按钮所在工具区，保留创建权限、分隔线可见性与顺序断言。原空数组测试的卸载句柄同步修正，避免重复实例削弱语义查询。Users/Audit/Report 的纯样式采用以真实 Browser CSS 检查作为补充，不制造业务分支测试。

## 页面采用证据

`rg -n 'StandardListPageRecipe|standard-list-page-recipe' apps/admin/src` 找到共享 list barrel
`src/shared/template-kit/list/index.ts` 的 re-export、下列 8 个业务文件和 1 个未注册参考示例。
根 workspace 为 `apps/*`、`packages/*`；`@shoppp/admin` 依赖 `@shoppp/contracts`，contracts 及其他应用未改。
本地双资源列表与 Audit 独立 cursor 列表另行列出；共享能力验证不替代这些消费者的验证。

| 页面 / 路由                                                             | 采用与保留合同                                                                                                                                          | 对应 focused suite（`src/` 下）                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `catalog/catalog-list-page.tsx` / `/catalog/products`                   | 自动继承；商品版本、检查、发布和库存合同保留                                                                                                            | `pages/catalog/catalog-list-page.test.tsx`                                                        |
| `catalog/collection-list-page.tsx` / `/catalog/collections`             | 自动继承；Product handoff 与 return target 保留，交接反馈留在 Card 外；已有测试补位置断言                                                               | `pages/catalog/collection-list-page.test.tsx`                                                     |
| `content/content-list-page.tsx` / `/content/pages`、`/content/articles` | 自动继承；内容类型、保存来源及发布权限保留                                                                                                              | `pages/content/content-list-page.test.tsx`                                                        |
| `orders/order-list-page.tsx` / `/orders`                                | 自动继承；订单查询及详情跳转保留                                                                                                                        | `pages/orders/order-list-page.test.tsx`                                                           |
| `reports/order-report-page.tsx` / `/reports/orders`                     | 自动继承；export 无内容仍返回 null，有内容进入中间分区；导出原因、确认、幂等、下载链接与 expiry 不改                                                    | `pages/reports/order-report-page.test.tsx`、`.browser.test.tsx`                                   |
| `inventory/inventory-page.tsx` / `/inventory`                           | 自动继承；版本、库存调整安全流程和 locale 保留                                                                                                          | `pages/inventory/inventory.test.tsx`、`inventory.browser.test.tsx`                                |
| `iam/roles-page.tsx` / `/access/roles`                                  | 自动继承；authority、权限集合、版本、Drawer 和 recent-auth 保留                                                                                         | `pages/iam/iam-pages.test.tsx`、`iam-pages.browser.test.tsx`、`iam-form-drawers.browser.test.tsx` |
| `operations/jobs/notification-jobs-page.tsx` / `/operations/jobs`       | 自动继承；通知恢复状态、权限及动作合同保留                                                                                                              | `pages/operations/jobs/notification-jobs-page.test.tsx`                                           |
| `iam/users-page.tsx` / `/access/users`                                  | 本地同 Card 查询/结果分区；Ant Design Tabs 保留资源切换，Users/Invitations 的请求、分页、列偏好、邀请幂等、角色权限、recent-auth 和写入恢复各有原 owner | `pages/iam/iam-pages.test.tsx`、`iam-pages.browser.test.tsx`、`iam-form-drawers.browser.test.tsx` |
| `audit/audit-page.tsx` / `/audit`                                       | 本地同 Card 查询/结果分区；First/Previous/Next、cursor trail、Restart、Retry 与读取恢复保留                                                             | `pages/audit/audit-page.test.tsx`、`.browser.test.tsx`                                            |
| `templates/list/table-query-page.tsx` / 未注册示例                      | 自动继承，选中动态标题与详情 Drawer 保留；无需生产示例 route                                                                                            | `pages/templates/list/table-query-page.test.tsx`                                                  |

消费者业务源码无需重复修改。同 Card、空摘要和 export 有内容的断言进入原消费者测试；其余已有交互、安全和 locale suites 原样使用。不存在未归属的生产消费者。

## 权威验证交接

以下限定门禁已由主任务执行。实现 worker 只观察前置失败用例，没有将来源验证作为目标通过证据。

```sh
bun run --cwd apps/admin test src/shared/template-kit/recipes/standard-list-page-recipe.test.tsx src/pages/templates/list/table-query-page.test.tsx src/pages/catalog/catalog-list-page.test.tsx src/pages/catalog/collection-list-page.test.tsx src/pages/content/content-list-page.test.tsx src/pages/orders/order-list-page.test.tsx src/pages/reports/order-report-page.test.tsx src/pages/inventory/inventory.test.tsx src/pages/iam/iam-pages.test.tsx src/pages/operations/jobs/notification-jobs-page.test.tsx src/pages/audit/audit-page.test.tsx --pool.maxWorkers 2
bun run --cwd apps/admin test:browser src/pages/iam/iam-pages.browser.test.tsx src/pages/iam/iam-form-drawers.browser.test.tsx src/pages/audit/audit-page.browser.test.tsx src/pages/reports/order-report-page.browser.test.tsx src/pages/inventory/inventory.browser.test.tsx
bun run --cwd apps/admin build:test
```

真实 Browser 现有 fixtures 导入 `index.css`，补充实际 16px padding、1px solid 横线及同 Card 检查；保留 locale、日期边界、资源切换、cursor 和宽表溢出断言。changed-file ESLint/Prettier、YAML及 diff 检查按主任务实际改动清单运行，不跑 Admin 全量或 Shoppp 全产品回归。

实际结果：11个 unit suite、120条通过；5个 Browser suite、10条通过；`build:test`（包含完整 `tsc -b`）通过。改动代码 ESLint 初次有两处新断言的 optional-chain 非空写法错误，调整为同一已存在 Tabs 节点后通过，相关 invitation Browser 用例再次通过；其余结果不重复累计。修改区段与 diff 检查通过；整文件 Prettier 在未修改的 Collection `LocationProbe` 单行 JSX 处有既存提示，HEAD 对照保留，未为此混入格式改造。日志保存于仓库根 `.artifacts/verification/2026-10-15-card-layout-sync/`，仅 Admin 验证，不宣称产品候选或发布通过。

## 保留边界与图库

- 商品 `catalog-form-page.tsx`、内容 `content-editor-page.tsx`：纵向基础表单、版本编辑和发布模块，未合并。
- `theme-editor-page.tsx`：保存后的 Store snapshot、外部 preview grant、校验、升级、批准和发布均有独立 owner；不是本地实时预览，未改变布局或安全边界。
- `navigation-page.tsx` 的菜单实体、`themes-page.tsx` 的可选择包、设置页的纵向/重复实体、订单详情的 facts/operations/timeline 和 Dashboard 独立指标/图表保留。

本次没有改变非普通查询列表；Users/Audit 仍属普通查询列表。**前后图库不适用**，未新增演示入口或采普通列表图凑数。Browser CSS 证据只说明局部呈现，不表示产品候选、发布或人工视觉批准。

考虑但未新增：容器模式开关、共享 wrapper、空 ReactNode 检测、额外请求/恢复机制、焦点协议；现有插槽与领域 owner 已满足本轮合同，不需要这些机制。

## 2026-10-15 后续同步完整性复核

上文保留首轮采用事实；本节记录后续按五项重新核对的结果。 复核起点: `7e40394ee154d6cc3ab4093d02da6f2b5462b9e0`.

| 核对项 | 本轮结论                                                                                                                                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 规范   | Admin ai-rules、guardrail、recipe/catalog metadata及来源/adoption链接完整，未发现 Card 边界或间距冲突。                                                                                                                     |
| recipe | 单 Card分区及空区省略完整，locale/权限/版本/最近认证/分页等本地扩展保持，未修改运行时。                                                                                                                                     |
| 测试   | recipe 已覆盖共同容器、空区、动态标题与请求；Report真实 Browser确实消费共享 recipe并验证CSS，Users/Audit各自的Browser保护本地壳；本轮没有需补的缺口。                                                                       |
| 示例   | 未注册的 table-query 参考页直接采用本地 recipe，其现有 unit 已保护同 Card与720px只读 Drawer；没有为补齐制造生产演示入口。                                                                                                   |
| 消费页 | 实查8业务recipe文件+1示例，另Users/Invitations、Audit两个本地壳全部采用。Collections交接外置、Report空导出摘要null；双资源控制器、cursor、安全恢复保留。嵌套picker/独立条目流与已保存主题快照等不满足合并条件，保留原布局。 |

本次只有静态复核和记录，按 L0：核对 imports/JSX/barrel/routes、相关源码/测试和文档一致性。未运行或重复计数既有120 unit/10 Browser/build门禁；本次无生产或测试源码差异，仅 apps/admin 的本记录变化，不涉及其他应用或主计划。

跨仓实际 JSX 消费清单、起点/WIP hash及本轮原始日志保存在源仓 `.artifacts/verification/2026-10-15-card-layout-completeness/`。本轮仅补测试与记录，未新增运行时抽象、容器配置、请求或界面文案。
