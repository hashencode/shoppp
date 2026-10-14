# Shoppp Admin 表单消费者统一（U8）

本记录属于跨后台统一计划的 U8，依赖本地共享采用基线 `488ba6881d97ff6ce1d386298b272fd5ebd788a3`，范围仅 `apps/admin`。这是独立 UI 整改，不接管根产品计划、候选或发布队列。

## 完整范围与互斥分类

36 项全部归入五批。主容器分类合计：普通 Drawer 4、局部 Modal 11、独立工作空间 10、嵌入字段/选择器 3、独立认证入口 4、独立表单示例 3、只读详情 Drawer 1，总计 36。同一文件的认证/发布等附加动作继续由原业务 owner 管理，不重复计数。

下表路径均相对 `src/`；“保留”是明确实施结论，不等于浏览器或真实业务账号验收。

| #   | 维护源                                                | 最终分类与处理                                                                                                                | 批次 |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | `pages/iam/roles-page.tsx`                            | 角色创建接标准 Drawer720；权限集合、key 校验和原请求保持                                                                      | SP1  |
| 2   | `pages/iam/role-detail-page.tsx`                      | 列表维护用 Drawer720；旧 `/access/roles/:id` 共享字段/提交。protected、own-role、authority、降权、依赖、archive、version 保持 | SP2  |
| 3   | `pages/iam/user-detail-page.tsx`                      | 列表维护用 Drawer720；旧 `/access/users/:id` 共享字段/提交。self、role options、last-admin、确认和 version 保持               | SP2  |
| 4   | `pages/iam/users-page.tsx`                            | 邀请 Modal；保留当前 tabs、最新邀请读取和 stable idempotencyKey                                                               | SP2  |
| 5   | `pages/inventory/inventory-page.tsx`                  | 调整 Modal；history 非表单列表 Modal 保留，delta/reason 与审计完整                                                            | SP1  |
| 6   | `pages/orders/order-detail.tsx`                       | 订单独立工作空间；cancel/refund/fulfill 局部 Modal，原允许动作和后果保留                                                      | SP3  |
| 7   | `pages/reports/order-report-page.tsx`                 | 导出原因 Modal；filter、PII 后果、异步任务保留                                                                                | SP3  |
| 8   | `pages/operations/jobs/notification-jobs-page.tsx`    | replay 原因 Modal；permission、job 状态、原 provider identity 保留                                                            | SP3  |
| 9   | `pages/privacy/privacy-page.tsx`                      | verified-request Modal；身份说明及 correction 条件 payload 保留                                                               | SP3  |
| 10  | `pages/catalog/catalog-list-page.tsx`                 | 发布原因 Modal；部署后生效说明保留，写失败保留理由，刷新只读                                                                  | SP3  |
| 11  | `pages/catalog/review-moderation-page.tsx`            | 决策 Modal；Approve/Reject 两个业务结果保留                                                                                   | SP3  |
| 12  | `pages/storefront/themes-page.tsx`                    | 起草 Modal；theme/preset 联动与 guideSearch 进入编辑工作空间保留                                                              | SP3  |
| 13  | `pages/storefront/storefront-publication-panel.tsx`   | 安全确认 Modal；安全 Cancel、frozen identity、版本、recent auth、operation 与发布/回滚状态机保留                              | SP3  |
| 14  | `pages/auth/change-password-modal.tsx`                | 改密 Modal；12 字符规则、confirmation 字段保留；校验零写、busy 关闭阻断                                                       | SP3  |
| 15  | `pages/catalog/catalog-form-page.tsx`                 | 独立工作空间保留；媒体上传、options/presentation 子保存、collectionIds、handoff 和 reset 保持，子写同步互斥                   | SP4  |
| 16  | `pages/catalog/published-product-revision-editor.tsx` | revision 工作空间内嵌保留；stage/preview/publish、上传和 expectedDraftVersion 保持                                            | SP4  |
| 17  | `pages/catalog/collection-form-page.tsx`              | 独立工作空间保留；顺序 membership、handoffProductId/returnTo、版本/backlinks/reset 原合同                                     | SP4  |
| 18  | `pages/content/content-editor-page.tsx`               | 独立结构化编辑工作空间保留；普通 save 与 publish/archive 不合并，原 dirty 和 generation 保持                                  | SP4  |
| 19  | `pages/settings/store-identity-page.tsx`              | 独立配置工作空间保留；branding/media 组合、多个 logo、版本/backlinks 保持                                                     | SP4  |
| 20  | `pages/settings/contact-settings-page.tsx`            | 独立工作空间保留；ranges/locations/socials、局部 ID 和序列化保持                                                              | SP4  |
| 21  | `pages/settings/launch-settings-page.tsx`             | 独立 health/config 工作空间保留；hash、后果确认、政策跨页与 safety checks 保持                                                | SP4  |
| 22  | `pages/settings/policies-page.tsx`                    | 独立 policy 编辑/审核工作空间保留；approve/publish/archive、完整 sections、冲突恢复保持                                       | SP4  |
| 23  | `pages/settings/shipping-settings-page.tsx`           | 普通单对象 Drawer720；一份 zone、当地 Form.List、一次 saveShippingZone，没有子写或持续比较工作空间                            | SP4  |
| 24  | `pages/storefront/navigation-page.tsx`                | 独立树编辑工作空间保留；排序/缩进、target、版本及 publish/archive 保持                                                        | SP4  |
| 25  | `pages/storefront/theme-editor-page.tsx`              | 独立编排工作空间保留；templates/blocks/bindings/media、catalog candidate、preview/approve/conflict 状态机保持                 | SP4  |
| 26  | `pages/storefront/storefront-link-editor.tsx`         | 工作空间字段保留；target/外链校验、onChange owner 保持                                                                        | SP4  |
| 27  | `pages/storefront/storefront-resource-picker.tsx`     | 嵌入选择器保留；查询/分页不是独立 save，不加 carrier                                                                          | SP4  |
| 28  | `pages/storefront/catalog-media-picker.tsx`           | 嵌入选择/上传保留；media/rendition 合同保持                                                                                   | SP4  |
| 29  | `pages/auth/login-page.tsx`                           | 独立认证入口；原 session 恢复和密码规则保持，同步提交锁                                                                       | SP5  |
| 30  | `pages/auth/forgot-password-page.tsx`                 | 独立恢复入口；原 protected-admin recovery 保持，同步提交锁                                                                    | SP5  |
| 31  | `pages/auth/reset-password-page.tsx`                  | 独立 token 恢复入口；token、确认及密码规则保持，同步提交锁                                                                    | SP5  |
| 32  | `pages/auth/activate-account-page.tsx`                | 独立激活入口；token 和确认保持；session 读取失败不重放已成功激活                                                              | SP5  |
| 33  | `pages/templates/form/basic-form-page.tsx`            | 独立基础示例保留；普通 Drawer 参考实际 roles/shipping，局部 Modal 参考 inventory/users                                        | SP5  |
| 34  | `pages/templates/form/advanced-form-page.tsx`         | 独立大空间示例保留，不增加 AdvancedRecipe                                                                                     | SP5  |
| 35  | `pages/templates/form/step-form-page.tsx`             | 独立 step 示例保留，不把普通 CRUD 拆步                                                                                        | SP5  |
| 36  | `pages/templates/list/table-query-page.tsx`           | 非表单规则详情 Drawer720，完整 name/desc/date/facts 保留，没有 reset/save                                                     | SP5  |

附加非表单闭包：`shared/components/file-preview.tsx`、`list-excel-actions.tsx` 和 `shared/template-kit/recipes/modal-list-page-recipe.tsx` 保留自身预览、导入和列表业务动作；普通表单单主提交规则不裁剪这些功能。全部右 Drawer 的源码 owner 只有标准 recipe 和规则详情示例，均为 720px。

## 本地实现边界

普通 Drawer 消费已采用 recipe，保存立即退出、业务成功 Modal、父内容唯一读取。IAM 列表刷新留在各自列表 owner；旧独立 URL 不发布第二条刷新频道。必要权限确认写入期间锁住安全退出；权限变更被取消时本地 result 增加 `cancelled: true`，只结束本次提交，不显示“保存失败”或读取父列表；必要确认完整关闭后再交付普通保存结果。这是有两个真实 IAM 消费者的本地适配，不回流业务策略或创建通用反馈框架。

独立基础表单的页内返回在写入时同步阻断；卸载后完成的延迟校验不得写入。增强原测试先观察返回一次和迟到校验写入一次的 RED，再补本地实例守卫。该能力的直接消费者是 catalog、collection、content 和基础参考页，已按闭包单独验证；没有全局导航拦截。

轻量 Modal 使用本地 `use-form-dialog` 生命周期 hook，页面继续持有字段、payload、写入错误、成功和恢复：有效业务值比较、继续编辑/放弃确认、同轮锁、校验退出后零写及卸载隔离。没有新增 Modal recipe、额外业务 API、RBAC、全局草稿/导航/焦点机制或依赖。安全发布保留安全 Cancel，审核保留两个决定；普通 Modal footer 只有主提交。Replay 的实现机制说明不再作为醒目警告重复展示；审计 reason 与原 identity 仍由请求合同和测试保证。

shipping 的代表样本包含两个 method、flat/weight、长服务名称、六位金额、free threshold 和完整重量区间。方法名全宽，普通数值/状态最多两列，所有隐藏 IDs、null、currency/country 大写语义和审计 reason 都保留。真实 720px 阅读、溢出、滚动及 footer 结论待宿主运行新 browser source，不以静态布局或单测声称视觉已通过。

## 验证与交还

选择 L3：IAM 入口跨页面、实际共享生命周期及敏感确认；单位内只做定向 unit self-check。修改前基线：IAM/inventory 2 文件 38 项、局部 Modal 9 文件 51 项、workspace/字段 13 文件 145 项、auth/templates 6 文件 20 项全部通过。增强 pilot 与 shipping 验收先观察旧 820/900 Modal 缺少目标 Drawer/保存操作的 RED。

复用原完整业务测试，不从上游通过数推断本仓。新增/加强请求白名单、版本、库存同步锁/审计、dirty 改回、继续编辑、shipping 全 method reset、一次保存与读取失败仅 Retry、旧 IAM URL、隐私更正必填零写与完整 payload/一次读取、激活一次与 session 读取失败、规则只读 Drawer720。最新结果按 suite 去重为 32 个 unit 文件、307 项通过、零跳过；这包含保留工作空间的合同回归与两种实际 recipe 的定向验证，不包含浏览器。重置必须完成原操作栏的确认；jsdom 退出断言沿既有 AntD 测试推进真实 motion 结束事件，实际动画由 Browser Mode 负责。

宿主仍拥有最终 changed-file 质量检查、typecheck、以下 Browser Mode 与批准范围收口以及路径限定提交：

- `pages/iam/iam-form-drawers.browser.test.tsx`（仅 >=720 桌面），以及既有 IAM/feedback 的受影响场景。
- `pages/settings/shipping-settings-page.browser.test.tsx`（仅 >=720 桌面，长名称/多方法/完整 payload/唯一父读取）。
- `pages/inventory/inventory.browser.test.tsx`（Modal Portal/Esc、继续编辑、改回和语言）。
- 既有 orders、catalog/content、contact/launch、navigation/theme 的浏览器风险按本地 testing standards 由宿主选取，不因源代码保留推断已验收。

worker 未运行 Browser Mode、全套、build 或 typecheck，未启动服务、安装、创建 worktree/branch、暂存、提交或写 API。真实业务账号和最终视觉批准未在 worker 中执行；该记录不宣称 U8/U10 最终交付。
