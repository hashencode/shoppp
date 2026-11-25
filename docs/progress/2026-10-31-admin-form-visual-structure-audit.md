# Admin 表单视觉结构排查证据

范围和唯一执行检查点由 `../plans/2026-10-31-2103-fix-admin-form-visual-structure-plan.md` 拥有。本文记录覆盖、发现及关闭证据，不维护实施顺序或当前单元队列。

## 当前基线与方法

- 使用当前主 checkout；保留原有 WIP，无 stash、重置、提交或另建 worktree。精确源码副本、初始 status 和 binary diff 在 `.artifacts/admin-form-visual-structure-2026-10-31/`；[源基线哈希](assets/admin-form-visual-structure/baseline-manifest.json)。
- 路由逐项沿当前 import 检查 Form、Drawer、Modal、renderAfterForm、动态字段；搜索 JSX fieldset／legend、Grid／Row／Col、Descriptions、Card 和 CSS 宽度，再追踪生产消费者及测试。源码检查不冒充实际浏览器验收。
- 实际画面使用 Rsbuild 当前组件与本地只读 fixture API（127.0.0.1:8790）；业务写请求一律 405、无数据库；新预览的固定内存会话例外见文末。fixture 由现有测试提取，含明确的数值／开关／素材补充样本；素材图为仓库 favicon.svg。
- 截图中文、1280×900、100%，light／dark。所有新发现先保存自身及共享消费者旧图再改代码；中途替换的新入口按保留精确共享源补拍；[实际拍摄条件](assets/admin-form-visual-structure/capture-manifest.json)。

## 路由与来源覆盖

下表为本轮重新读取的路由源码清单。界面核验和源码核对分别记录。

| 路由                          | 当前组件来源                                                      | 观察                                                                                     |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/dashboard`                  | `apps/admin/src/pages/dashboard/dashboard-page.tsx`               | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/welcome`                    | `apps/admin/src/pages/home/welcome-page.tsx`                      | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/orders`                     | `apps/admin/src/pages/orders/order-list-page.tsx`                 | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/orders/:reference`          | `apps/admin/src/pages/orders/order-detail.tsx`                    | 次要文字固定灰色已修复，两主题新旧图独立交付                                             |
| `/fulfillment`                | `apps/admin/src/pages/fulfillment/fulfillment-page.tsx`           | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/catalog/products`           | `apps/admin/src/pages/catalog/catalog-list-page.tsx`              | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/catalog/products/form`      | `apps/admin/src/pages/catalog/catalog-form-page.tsx`              | 选项展示分区缺陷；商品展示为反向检查对象                                                 |
| `/catalog/collections`        | `apps/admin/src/pages/catalog/collection-list-page.tsx`           | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/catalog/collections/form`   | `apps/admin/src/pages/catalog/collection-form-page.tsx`           | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/inventory`                  | `apps/admin/src/pages/inventory/inventory-page.tsx`               | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/catalog/reviews`            | `apps/admin/src/pages/catalog/review-moderation-page.tsx`         | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/content/pages`              | `apps/admin/src/pages/content/content-list-page.tsx`              | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/content/pages/form`         | `apps/admin/src/pages/content/page-editor-page.tsx`               | 已确认状态区缺陷；分别保存本轮实图                                                       |
| `/content/articles`           | `apps/admin/src/pages/content/content-list-page.tsx`              | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/content/articles/form`      | `apps/admin/src/pages/content/article-editor-page.tsx`            | 已确认状态区缺陷；分别保存本轮实图                                                       |
| `/storefront/navigation`      | `apps/admin/src/pages/storefront/navigation-page.tsx`             | header／footer 均消费共享资源选择器，实际基线已保存                                      |
| `/storefront/themes`          | `apps/admin/src/pages/storefront/themes-page.tsx`                 | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/storefront/themes/:draftId` | `apps/admin/src/pages/storefront/theme-editor-page.tsx`           | 最初挂载旧编辑器，实施中已由 bridge 切换新 VisualThemeEditorPage；独立保存当前消费者基线 |
| `/reports/orders`             | `apps/admin/src/pages/reports/order-report-page.tsx`              | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/settings/identity`          | `apps/admin/src/pages/settings/store-identity-page.tsx`           | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/settings/contact`           | `apps/admin/src/pages/settings/contact-settings-page.tsx`         | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/settings/launch`            | `apps/admin/src/pages/settings/launch-settings-page.tsx`          | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/settings/shipping`          | `apps/admin/src/pages/settings/shipping-settings-page.tsx`        | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/settings/policies`          | `apps/admin/src/pages/settings/policies-page.tsx`                 | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/access/users`               | `apps/admin/src/pages/iam/users-page.tsx`                         | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/access/users/:id`           | `apps/admin/src/pages/iam/user-detail-page.tsx`                   | 双列元信息已修复；Drawer／兼容入口两主题分别交付                                         |
| `/access/roles`               | `apps/admin/src/pages/iam/roles-page.tsx`                         | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/access/roles/:id`           | `apps/admin/src/pages/iam/role-detail-page.tsx`                   | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/privacy`                    | `apps/admin/src/pages/privacy/privacy-page.tsx`                   | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/audit`                      | `apps/admin/src/pages/audit/audit-page.tsx`                       | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `/operations/jobs`            | `apps/admin/src/pages/operations/jobs/notification-jobs-page.tsx` | 源码核对：无新增四类模式命中；适用实际入口复核见后续证据                                 |
| `*`                           | `apps/admin/src/pages/not-found-page.tsx`                         | 非表单 fallback                                                                          |

认证 `/login`、`/forgot-password`、`/reset-password`、`/activate` 与账号密码 Modal 另按 router／AppShell 来源核对；没有断边分组或普通字段双列，不执行凭证修改。模板示例未注册为业务入口，保留独立参考边界。

## 确认的视觉问题与承接

| 问题与规则                                                   | 实际入口／owner                                                                                               | 关闭证据                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 选项模块边界弱；Drawer 轻分区、无 Card                       | 商品详情的选项展示；本计划选项修复单元                                                                        | 已交付 color 两主题主图／错误态，共 8 张                                                             |
| 状态／版本／发布动作散落；全宽 Card、与 SEO 对齐的单列只读项 | 内容 page、article；本计划内容修复单元                                                                        | 已分别交付 content-page／content-article 主区／展开详情，两主题各 8 张；文章另有确认补充图           |
| 标题切开边框；共享字段轻分组                                 | 资源／媒体／链接三个组件；当前 SettingsInspector、导航 header／footer（原旧编辑器已替换）；本计划共享修复单元 | 已分别交付 theme-workspace 三个区域、navigation-header／footer；5 suite 36 项及导航 Browser 3 项通过 |
| 普通 schema 字段强行双列                                     | 原 `theme-editor-page.tsx`，现已退役；新 inspector 已是单列；本计划共享修复单元                               | 保留 6 张替换前实图，独立标注入口已替换；新 inspector 现有普通字段单列已实际复核                     |

## 例外与并行边界

- 实施中 `theme-editor-page.tsx` 被并行工作替换为 VisualThemeEditorPage 的兼容 re-export。新 SettingsInspector 现为实际消费者，原普通字段双列随旧实现退役而消失，不新增一次同功能布局修改。新入口的 before 使用冻结的新消费者与本轮起始时三份共享组件的精确源码，独立只读预览补拍；after 使用当前实际入口，未把两个编辑器混成一组。对比网页独立保留旧入口基线，不伪造其 after。
- `PermissionChecklist` 只有定义与测试引用，未发现生产 import；不新增虚构页面、删除历史测试或扩大本轮任务。
- `CatalogMediaPicker` 的两／三列是图片结果网格；商品媒体宽／高、参考模板起／止日期是关联组合；导航树＋当前项是工作区。它们不按普通字段双列判错。
- theme list 的卡片网格、Dashboard 指标、Welcome 入口网格、列表筛选与订单聚合 Descriptions 不是普通编辑字段组，不按列数自动整改。主题发布的技术追溯已折叠，归原业务 owner，不借视觉合并改发布粒度。
- 生产 import 闭包：三个字段组件 → SettingsInspector → VisualThemeEditorPage → 兼容 ThemeEditorPage；ResourcePicker → NavigationPage 的 header／footer。兼容 bridge 已切换新工作区；没有 workspace 对外导出；Admin 的 contracts／domain 依赖不在本轮修改。

## 新入口基线恢复的具体边界

只读源副本位于 `.artifacts/admin-form-visual-structure-2026-10-31/before-editor/`，不是 Git worktree，不承接产品状态；仅在此副本恢复最初三份 picker／link 代码。消费者版本与哈希见同级 `new-editor-before-source.json`。使用同一隔离 fixture，补充字段基于已有测试 schema；新参考字段沿真实 featured-collection，避免用无效商品 ID 或不受支持的绑定造景。

原业务写请求继续 405、无数据库。新编辑器的预览会话 POST 是唯一例外：只返回固定内存测试 identity，GET 返回已有 Vue 测试上下文，没有生成凭证、设置权限或保存记录。iframe 使用现有真实 Vue 预览构建产物，不伪造页面或新增构建。此条件只用于本地截图，不修改正式认证或协议。

## 额外只读详情发现

订单详情原三处次要文字使用固定 text-slate-500；实际浅／深色均为 rgb(100,116,139)，不跟随主题。该页属于只读详情覆盖范围，已单独保存两主题 before，并按现有文字 token 修复；不改事实、金额、权限、退款／履约／取消确认。其他 text-slate 命中为列表元数据／未使用旧组件，不与本轮表单分区问题混报；本轮不宣称全站所有样式均已零缺陷。

## 本轮剩余入口复核结论

| 对象与实际入口                             | 核验方式与结论                                                                    | 证据／例外依据                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 商品展示 Drawer、集合编辑 Drawer           | 当前源码及真实中文画面；普通字段单列、普通标题，无断边边框或装饰性 Card           | audit-light-product-presentation、audit-light-collection；集合状态已有正式字段，折叠部分为候选／上线引用追溯，不另造第二个可编辑状态 |
| 联系信息与地点 Drawer                      | 当前源码及真实画面；独立页标准 Card、Drawer 轻分组，footer 可达                   | audit-light-contact、audit-light-location                                                                                            |
| 配送区域 Drawer                            | 当前源码及含两个长短不同方式的真实画面；普通字段单列、主题边框                    | audit-light-shipping；Form.List 每张 Card 对应可增删的完整配送方式，不是给两个同级普通模块加装饰外壳，保留实体边界                   |
| 店铺资料                                   | 当前源码及真实画面；基本资料／品牌素材标准 Card，字段使用同一 compact 对齐        | audit-light-identity；页首单句来源版本提示不是另一组散落的状态／保存版本表单                                                         |
| 政策与结构化内容                           | 真实页面打开审核并查看下方版本内容；编辑字段单列、结构块有自身增删归属            | audit-light-policies；审阅 Card 承担待审核／已上线正文比较和精确版本批准，区别于普通保存元信息，不合并进正文编辑 store               |
| 角色 Drawer／兼容独立页                    | 当前源码、CSS 容器规则及真实 Drawer；普通资料纵向，权限为树工作区                 | audit-light-role；兼容页宽视口的基本资料＋权限树是专用工作区，Drawer 在 720px 下纵向，非普通字段平分两列                             |
| 用户 Drawer／兼容页                        | 原元信息是同类缺陷，已在有界子计划修复                                            | user-drawer／user-compatible 各 4 张配对图，原 IAM 51 项及 Browser 2 项通过                                                          |
| 已发布商品修订／媒体、结构化内容辅助字段   | 重新追踪生产消费者与源码：媒体宽／高为同一素材尺寸，图片结果网格和有序实体块保留  | published-product-revision-editor、structured-content-editor、三个 picker；不是两个无关普通字段并排                                  |
| 其余列表内输入／状态 Modal、认证与账号密码 | 当前路由及各生产组件源码检查；原垂直 Form、原局部确认，无断边字段组或普通双列命中 | inventory／review／fulfillment／privacy／launch／audit／jobs／IAM 邀请等；四个认证入口及 change-password-modal；未执行凭证变更       |

八张未改页面的本轮检查原图位于 audit 目录，在同一网页“本轮同类问题排查原图”中展示，只记覆盖证据，不伪造其 before／after。其余仅源码覆盖项明确保留该边界，不声称逐路由浏览器回归。

追加发现已闭环：订单固定灰色与账号双列元信息均有具体规则、入口、子计划 owner、行为验证及当页网页原图。本轮没有确认后仍待修复的同类项。表格、列表元数据、未使用旧 PermissionChecklist 和业务发布协议没有混入本次整改；后续新功能继续按更新后的权威规则验收，不设第二条全项目执行队列。
