# Admin 表单样式统一验证证据

范围与执行检查点由 `docs/plans/2026-10-31-0307-fix-admin-form-style-unification-plan.md` 拥有；本文件只记录事实与证据。

## Worktree baseline

- 日期：2026-10-31。分支：`codex/fix-new-arrival-icon`；HEAD：`b3680807f62ea70e4416415691c028be2880eb54`。
- 开始时没有未合并条目；相关 Drawer 修改与三份计划等 15 个 WIP 文件已保留，没有 stash、重置或另建 worktree。
- [修改前文件内容标识](assets/admin-form-style-unification/baseline-manifest.json) 记录本轮开始时的 HEAD、分支及 WIP SHA-256；精确源码副本与原始 diff 保存在本地忽略目录 `.artifacts/admin-form-style-2026-10-31/baseline/`。
- 当前集合表单已存在搜索代次隔离、重置清空查询与候选、恢复基线成员的实现；现有 `collection-form-page.test.tsx` 含迟到查询情景。这里只记录已观察到的实现，不将其视为本轮验证通过。

## Preserved form contracts

| 入口         | 值与校验归属                                                                   | 保存与恢复边界                                                                                  |
| ------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 商品选项展示 | 页面 `optionDefinitions` 和 `optionErrors`；名称和值来自变体，颜色须不透明 HEX | 原选项 PATCH、expectedVersion、商品共享写锁；父商品主体草稿不被重读覆盖；取消零写               |
| 商品展示     | 页面 presentation 与原规格／文案处理                                           | 原独立 PATCH、版本和写锁；成功回包更新基线、列表频道一次通知                                    |
| 实体地点     | 标准 Form，隐藏 ID、null、排序、公开状态和字段校验                             | Drawer 确认只回填联系设置草稿；最终由页面提交完整配置                                           |
| 商品集合     | 原 Form 与有序成员、查询状态                                                   | Drawer 与旧独立 URL 共用转换／提交；保留 handoff、returnTo、权限、完整 payload 与冲突／依赖恢复 |

## Verification selection

字段组合整改使用 L2：沿用实际行为测试和 Drawer Browser Mode 检查，不为颜色／间距新增类名测试；纯视觉部分以实际界面和同条件前后原图证明。
后续已知跨页面状态操作按计划 L3 建立消费者与 suite 对照；不默认全量测试、build、E2E 或发布门禁。

## Screenshot conditions

本轮使用实际 Admin 组件及本地只读 fixture API，不连接数据库；所有写请求拒绝执行。
截图约定为 1280×900、100% 缩放、中文、同组数据／权限／模式和业务区域，分别保存浅色、深色及必要状态。
接受的原图保存在 `assets/admin-form-style-unification/`；每个入口完成后在对话直接展示新旧图。

## Color presentation verification

- 原有 fieldset/legend 已改为 Drawer recipe 的 sections；展示类型使用 Form.Item 和全列 Select，实测 672px。色样复合输入采用标准字段标签和错误反馈，HEX 保持 160px，业务颜色值保留。
- 固定灰色边框和固定红色错误文字已移除。浅／深色常规态与非法 HEX 错误态均已保存并打开检查，长名称没有横向溢出，颜色选择器输入 `abcdef` 能写回对应 `#abcdef`。
- 扩展既有非法色样测试验证语言切换：修改前因英文错误未出现而失败；实现后保留非法草稿、错误关联和零写入，当前语言错误正确更新。
- `bun run --cwd apps/admin test src/pages/catalog/catalog-form-page.test.tsx --pool.maxWorkers=2`：19 项通过；`test:browser src/test/admin-local-form-drawers.browser.test.tsx`：3 项通过；Admin typecheck 通过。
- 在 `apps/admin` 目录运行实际 changed-file Prettier 与 ESLint 通过。根 `.prettierignore` 排除了 Admin，根目录的格式命令不能作为本批格式证据。
- 原始日志：`.artifacts/admin-form-style-2026-10-31/color-locale-red.log`、`color-tests.log`、`color-typecheck.log`、`current-drawers-browser.log`。
- [浅色修改前](assets/admin-form-style-unification/color/before-light.jpg)／[浅色修改后](assets/admin-form-style-unification/color/after-light.jpg)；[深色修改前](assets/admin-form-style-unification/color/before-dark.jpg)／[深色修改后](assets/admin-form-style-unification/color/after-dark.jpg)。两组对比已在对话直接展示。
- [浅色错误态](assets/admin-form-style-unification/color/after-light-error.jpg)、[深色错误态](assets/admin-form-style-unification/color/after-dark-error.jpg)、[长值补充检查](assets/admin-form-style-unification/color/after-light-long-values.jpg)。[截图条件清单](assets/admin-form-style-unification/capture-manifest.json) 保存实际路由、主题、视口与滚动位置。

## Product presentation verification

- 商品展示改用 recipe 的“展示设置／详情文案／规格”分区及标准 Form.Item；文案、多行文本、SKU 和媒体选择沿内容列展示，补齐中文标签。保留原 React 值、版本、写锁、规格排序和完整 PATCH payload。
- 实际保存空规格时发现原汇总错误落在视口下方。现改为字段关联错误，并在校验失败时仅在本规格容器中定位和聚焦首个错误字段；没有新增全局焦点协议。保留原非空和忽略大小写的唯一性规则。
- 扩展原测试验证中文标签、非法规格零写、首错焦点、语言切换和原完整排序 payload。修改前标签与错误聚焦测试分别失败，修改后 19 项通过；3 项 Drawer Browser Mode、Admin typecheck、changed-file ESLint／Prettier 通过。异步表单校验后的焦点使用 waitFor 验证。
- 日志：`.artifacts/admin-form-style-2026-10-31/product-label-red.log`、`product-error-red.log`、`product-error-green.log`、`product-final-typecheck.log`、`product-final-browser.log`。翻译 suite 在新增分区词条后 8 项通过；字段错误新增词条亦已由本轮最终翻译检查覆盖。
- [浅色前](assets/admin-form-style-unification/product-presentation/before-light.jpg)／[浅色后](assets/admin-form-style-unification/product-presentation/after-light.jpg)，[深色前](assets/admin-form-style-unification/product-presentation/before-dark.jpg)／[深色后](assets/admin-form-style-unification/product-presentation/after-dark.jpg)。长表单另保存同主题规格区域 before／after；[深色错误最终态](assets/admin-form-style-unification/product-presentation/after-dark-error.jpg) 显示首错字段及具体原因。

## Location Drawer verification

- 当前地点入口原已使用标准 Form.Item、主题组件与完整内容列，本轮没有为样式重复改写。长名称、地址及两种主题实图通过；非法邮箱、HTTP 地图 URL 在关联字段显示校验且不会回填。
- 实际确认有效地点显示“地点已加入待保存的修改”，关闭后父页面显示未公开地点，仍待父页面保存；没有数据库连接或持久化写入。只读、取消、排序和最终完整联系配置由既有 focused suite 覆盖。
- 本轮 contact／collection form／collection list／i18n focused suites 共 31 项通过（见 `location-collection-tests.log`）；Drawer Browser Mode 已在当前商品代码状态运行，3 项通过。
- [浅色前](assets/admin-form-style-unification/location/before-light.jpg)／[浅色后](assets/admin-form-style-unification/location/after-light.jpg)，[深色前](assets/admin-form-style-unification/location/before-dark.jpg)／[深色后](assets/admin-form-style-unification/location/after-dark.jpg)，[字段校验](assets/admin-form-style-unification/location/after-light-error.jpg)。此处前后相同是复核结论，不声称有新的地点样式修改；联系页面空反馈容器仍归 U4。

## Collection Drawer verification

- 标识、成员、SEO 已采用 recipe sections 与标准 Form.Item；浅／深色及成员尾部实图检查没有确认新的字段样式缺口，因此本轮未重复修改。兼容独立 `form?mode=readonly&id=collection-001` 实际回填且名称禁用；原 Drawer 长成员、footer、只读与 payload 由本轮 3 项 Browser Mode 和 collection focused suites 覆盖。
- [浅色前](assets/admin-form-style-unification/collection/before-light.jpg)／[浅色后](assets/admin-form-style-unification/collection/after-light.jpg)，[深色前](assets/admin-form-style-unification/collection/before-dark.jpg)／[深色后](assets/admin-form-style-unification/collection/after-dark.jpg)；同主题 `before-*-members`／`after-*-members` 保留对应成员与 SEO 区域。[旧 URL 只读证据](assets/admin-form-style-unification/collection/readonly-compatible-url.jpg)。
- U5 重置测试本轮已通过，涵盖迟到搜索响应不能重新填入候选；源码与合同核对已完成，详见下文 Collection reset reconciliation，没有重复新增实现。

## New role permission tree

- 新建角色沿用现有 PermissionTree；共享树、编辑角色、受保护 Admin 行为未改。消费者闭包为 CreateRoleAction → RolesPage，已有 RoleDetailPage 同时作为反向兼容验证对象。
- 扩展原创建测试验证父选、半选、搜索和可授予子集，完整 payload 仅含 `catalog.read` 叶子；新增该入口的真实 Browser Mode 情景验证选择、搜索、收起和确认重置，未写入。浏览器复选框使用树组件提供的点击接口，不重写树键盘行为。
- IAM focused suite 51 项、Drawer Browser Mode 2 项、Admin typecheck、changed-file lint／format 通过。浏览器测试开发时误用不支持的 matcher 和 span 的 Space 行为，已更正为现有 matcher 与实际点击；最终通过日志为 `roles-tests.log`、`roles-browser.log`、`roles-typecheck.log`。
- 最终翻译检查 `bun test tools/check-admin-i18n.test.ts`：8 项通过，涵盖当前新增词条。
- [浅色前](assets/admin-form-style-unification/roles-create/before-light.jpg)／[浅色后](assets/admin-form-style-unification/roles-create/after-light.jpg)，[深色前](assets/admin-form-style-unification/roles-create/before-dark.jpg)／[深色后](assets/admin-form-style-unification/roles-create/after-dark.jpg)。精确角色源码基线已补入 manifest。

## Content and policy transition confirmations

- L3 消费者核对：ContentEditorPage 只有 PageEditorPage／ArticleEditorPage 两个业务 wrapper，再由 Admin router 挂载；PoliciesPage 是独立设置入口。没有共享 primitive、服务、contracts 或 workspace 改动；根 workspaces 包含 Admin，Admin 依赖 `@shoppp/contracts`，没有向其他应用传播的导出。对应 suites 为 content-editor、policies-page、content-editor.browser 与 admin-template-style.browser。
- 两页分别持有 Modal、原因 Form、打开时的对象／版本／动作以及错误；正文和普通备注保留。原因沿原服务合同 trim 后 3–500 字；readonly publisher 仍可操作，权限与状态在提交前复核。请求中阻止关闭、重复提交；取消零写入，普通失败保留输入，冲突令旧确认失效。
- 内容冲突通过显式 Reload 读取后重新打开确认；政策沿原最新审阅恢复，但关闭旧确认且不得自动重试。新增 review 代次隔离防止先选记录的迟到审阅覆盖当前记录。
- 实际测试暴露内容路由切换后的程序回填可能标记 touched，导致新记录误判 dirty；局部 restoreRecord 使用 Form 原生 setFields 恢复未编辑基线，真实用户编辑的 dirty 阻断继续保留。
- 本轮 focused tests 30 项通过，含 page／article 发布归档完整 payload、三类政策状态 payload、取消、trim/min/max、忙时写锁、失败原因保留、冲突新版本与路由失效。Browser Mode 8 项通过，含真实内容失败／冲突／Escape 恢复及既有模板交互；Admin typecheck、changed-file ESLint／Prettier 通过。
- 日志：`transitions-red.log`（新流程前 4 项失败）、`transitions-cases.log`、`transitions-browser.log`、`transitions-typecheck.log`。测试按项目统一错误文案、真实标签和 loading 动画边界断言；临时调试输出已移除。
- `content-page`、`content-article` 目录各有 `before-light/dark` 与 `after-light/dark` 主区域原图，另有 `after-*-confirmation`；页面还保留 `after-light-request-error`，实测只读 fixture 拒绝写请求后原因和恢复按钮仍在弹窗。
- 政策状态区域及深色确认原图已保存；其日期宽度由 U4 继续完成，最终整页对比在 U4 交付，不提前声称政策整页完成。

## Policy date and contact feedback

- 政策日期沿现有内容列填满，实际 dateWidth／columnWidth 均为 752px；日期类型、保存／重置、对齐偏好与 toolbar 沿用原实现。政策最终 `before/after-*-date` 和状态区域两组原图均保留，确认弹窗浅／深色另存。
- 联系页反馈 Card 只在 saveError、latest 或只读说明存在时渲染；内部原错误、409 比较、替换及只读分支不变。普通可写无反馈时不再留下空容器。
- 当前改动后 policy／contact focused tests 21 项通过，local-drawers／template-style Browser Mode 9 项通过，Admin typecheck、changed-file 格式／lint 通过。日志为 `date-contact-tests.log`、`date-contact-browser.log`、`date-contact-typecheck.log`；不新增样式实现镜像测试。
- [联系页浅色前](assets/admin-form-style-unification/contact/before-light.jpg)／[后](assets/admin-form-style-unification/contact/after-light.jpg)，[深色前](assets/admin-form-style-unification/contact/before-dark.jpg)／[后](assets/admin-form-style-unification/contact/after-dark.jpg)。政策及联系页本轮最终对比在本对话交付。

## Collection reset reconciliation

- 当前代码原已在 reset 时增加 searchGeneration、恢复原 Form／成员基线并清空 productQuery／临时候选；异步响应同时检查 active 与 generation。handoff 商品继续按原约定合入基线，不被 reset 丢弃；Drawer 与兼容入口共用同一实现。
- 本轮原有迟到响应、完整字段及排序 payload、handoff、409 恢复等 collection focused tests 已通过，见 `location-collection-tests.log`；真实 Browser Mode 本轮再次覆盖 collection 入口，见 `date-contact-browser.log`。没有发现额外实现缺口，也没有重复新增 reset 代码或测试。
- 实际将 Carry-on 下移、输入 Linen 后确认重置，查询恢复空值，顺序恢复 Carry-on → Checked luggage，零写入。[重置完成原图](assets/admin-form-style-unification/collection/after-light-reset.jpg)；初始到最终的浅／深色成员图已在 U7.4 交付。

## U8 全后台排查与 U9 局部批次证据

- [完整覆盖与发现](2026-10-31-admin-form-style-audit.md)：31 条业务路由、404 不适用、4 条认证路由及账号密码入口。新增 A01–A09 由四份具名有界子计划承接。
- 1-local 修复 A01／A02／A03／A07／A09：配送保留 Form.List 与完整方法 payload，Card＋单列字段；审核和发布原因使用 Form.Item 明确关联；次要提示使用 Typography；认证背景使用 colorBgLayout，无状态／服务变动。
- `local-tests.log`：6 suites／33 tests 通过；`local-browser.log`：1 配送 Drawer 浏览器用例通过（多种方式、720px、完整 payload）；`local-typecheck.log` 通过；实际改动文件 prettier／eslint 通过。既有用例覆盖取消、忙碌、重置、只读、失败重试，未增加只断言样式的测试。
- 所有截图中文、1280×900、100%，沿 U8 同 fixture 和空原因。认证只观察空字段，重置／激活使用测试 token，未输入凭证。所有写请求均被隔离 API 阻止。

- `auth-login`：[before-light](assets/admin-form-style-unification/auth-login/before-light.jpg), [after-light](assets/admin-form-style-unification/auth-login/after-light.jpg), [before-dark](assets/admin-form-style-unification/auth-login/before-dark.jpg), [after-dark](assets/admin-form-style-unification/auth-login/after-dark.jpg)；已实际打开并在会话逐页展示。
- `auth-forgot`：[before-light](assets/admin-form-style-unification/auth-forgot/before-light.jpg), [after-light](assets/admin-form-style-unification/auth-forgot/after-light.jpg), [before-dark](assets/admin-form-style-unification/auth-forgot/before-dark.jpg), [after-dark](assets/admin-form-style-unification/auth-forgot/after-dark.jpg)；已实际打开并在会话逐页展示。
- `auth-reset`：[before-light](assets/admin-form-style-unification/auth-reset/before-light.jpg), [after-light](assets/admin-form-style-unification/auth-reset/after-light.jpg), [before-dark](assets/admin-form-style-unification/auth-reset/before-dark.jpg), [after-dark](assets/admin-form-style-unification/auth-reset/after-dark.jpg)；已实际打开并在会话逐页展示。
- `auth-activate`：[before-light](assets/admin-form-style-unification/auth-activate/before-light.jpg), [after-light](assets/admin-form-style-unification/auth-activate/after-light.jpg), [before-dark](assets/admin-form-style-unification/auth-activate/before-dark.jpg), [after-dark](assets/admin-form-style-unification/auth-activate/after-dark.jpg)；已实际打开并在会话逐页展示。
- `shipping`：[before-light](assets/admin-form-style-unification/shipping/before-light.jpg), [after-light](assets/admin-form-style-unification/shipping/after-light.jpg), [before-dark](assets/admin-form-style-unification/shipping/before-dark.jpg), [after-dark](assets/admin-form-style-unification/shipping/after-dark.jpg)；已实际打开并在会话逐页展示。
- `review-moderation`：[before-light](assets/admin-form-style-unification/review-moderation/before-light.jpg), [after-light](assets/admin-form-style-unification/review-moderation/after-light.jpg), [before-dark](assets/admin-form-style-unification/review-moderation/before-dark.jpg), [after-dark](assets/admin-form-style-unification/review-moderation/after-dark.jpg)；已实际打开并在会话逐页展示。
- `privacy`：[before-light](assets/admin-form-style-unification/privacy/before-light.jpg), [after-light](assets/admin-form-style-unification/privacy/after-light.jpg), [before-dark](assets/admin-form-style-unification/privacy/before-dark.jpg), [after-dark](assets/admin-form-style-unification/privacy/after-dark.jpg)；已实际打开并在会话逐页展示。
- `catalog-publish`：[before-light](assets/admin-form-style-unification/catalog-publish/before-light.jpg), [after-light](assets/admin-form-style-unification/catalog-publish/after-light.jpg), [before-dark](assets/admin-form-style-unification/catalog-publish/before-dark.jpg), [after-dark](assets/admin-form-style-unification/catalog-publish/after-dark.jpg)；已实际打开并在会话逐页展示。
- 配送第二个长方法按字段锚点补拍 before/after-light/dark-methods，均完整保留名称与币种、重量设置。

## U9 商品修订验收

- A05：保留原受控状态、API 与版本锁，标准 Form.Item＋Card 分区；媒体使用 SortActionGroup，单图禁止移除行为不变；宽高保留语义关联的两列组合。普通内容使用既有 compact body 与对齐偏好。
- `published-tests.log` 19 tests 通过，包含上传原字节、拒绝无效图片、选择位置后保存完整媒体顺序、并发写锁和版本重试；`published-typecheck.log`、改动文件 format/lint 通过。
- 实际两主题按名称、详情正文、首个变体 Color、首图描述、底部操作锚点成对保存：`published-product/before|after-light|dark[-presentation|-variants|-media|-actions].jpg`。基础与操作区对比已在会话展示。
- 1280×900 下底部“发布评价更新” top 722.56、bottom 754.56，父固定栏位于更下方；文档 scrollWidth=1280，无横向溢出。操作有完整滚动空间。截图空原因与无修订草稿，因此禁用发布是原有业务状态。

## U9 结构化内容字段验收

- A08：无 name 的 Form.Item 配合 useId＋section ID 为图片素材／替代文本与链接各字段提供可见标签和原生关联，不创建第二 Form 状态。内部资源枚举显示中文，实际 target.kind/id 与 window 合同不变。
- 生产消费者仅 ContentEditorPage(page/article) 与 PoliciesPage，引用闭包由 `rg` 核对。`rich-tests.log` 34 tests 通过；标签文案精简后 `rich-label-tests.log` 4 tests 通过；`rich-browser.log` 2 内容恢复边界通过；`rich-typecheck.log`、format/lint 与 `u9-i18n.log` 8 项通过。新增用例验证媒体 combobox 名称及图片／内外链接编辑完整 payload。
- 三个父入口各在原段落后追加空图片与链接，未保存；before/after-light/dark-image/link 均已保存。会话逐页展示图片区域两主题对比，完整链接区域原图亦保留。动态 UUID 不显示，不影响同可见 fixture 比较。
- 内部类型本地化是在标准字段完成后发现，保留 `structured-content/intermediate-light|dark-internal.jpg` 与 `after-light|dark-internal.jpg`，明确为中间版本到最终的小修复，未冒充初始字段基线。

- structured-content：[before-light-image](assets/admin-form-style-unification/structured-content/before-light-image.jpg), [after-light-image](assets/admin-form-style-unification/structured-content/after-light-image.jpg), [before-light-link](assets/admin-form-style-unification/structured-content/before-light-link.jpg), [after-light-link](assets/admin-form-style-unification/structured-content/after-light-link.jpg), [before-dark-image](assets/admin-form-style-unification/structured-content/before-dark-image.jpg), [after-dark-image](assets/admin-form-style-unification/structured-content/after-dark-image.jpg), [before-dark-link](assets/admin-form-style-unification/structured-content/before-dark-link.jpg), [after-dark-link](assets/admin-form-style-unification/structured-content/after-dark-link.jpg)
- structured-article：[before-light-image](assets/admin-form-style-unification/structured-article/before-light-image.jpg), [after-light-image](assets/admin-form-style-unification/structured-article/after-light-image.jpg), [before-light-link](assets/admin-form-style-unification/structured-article/before-light-link.jpg), [after-light-link](assets/admin-form-style-unification/structured-article/after-light-link.jpg), [before-dark-image](assets/admin-form-style-unification/structured-article/before-dark-image.jpg), [after-dark-image](assets/admin-form-style-unification/structured-article/after-dark-image.jpg), [before-dark-link](assets/admin-form-style-unification/structured-article/before-dark-link.jpg), [after-dark-link](assets/admin-form-style-unification/structured-article/after-dark-link.jpg)
- structured-policy：[before-light-image](assets/admin-form-style-unification/structured-policy/before-light-image.jpg), [after-light-image](assets/admin-form-style-unification/structured-policy/after-light-image.jpg), [before-light-link](assets/admin-form-style-unification/structured-policy/before-light-link.jpg), [after-light-link](assets/admin-form-style-unification/structured-policy/after-light-link.jpg), [before-dark-image](assets/admin-form-style-unification/structured-policy/before-dark-image.jpg), [after-dark-image](assets/admin-form-style-unification/structured-policy/after-dark-image.jpg), [before-dark-link](assets/admin-form-style-unification/structured-policy/before-dark-link.jpg), [after-dark-link](assets/admin-form-style-unification/structured-policy/after-dark-link.jpg)

## U9 主题和共享选择器验收

- A04／A06：四类普通 schema 控件接入 Form.Item，保留旧 wrapper focus ID、aria 名称、state 与 schema；复杂 picker 保留原生 fieldset，用 AntD border token；媒体结果尺寸文字使用 secondary。链接内部标准标签／间距；审批原因有可见关联标签。草稿列表 token 及 Valid／Invalid／Not validated 本地化。
- 生产闭包：ResourcePicker → ThemeEditorPage 与 NavigationPage(header/footer)；其余两个 picker／link → ThemeEditorPage。已有 6 suites／105 tests 通过。`theme-typecheck.log` 和改动文件 format/lint 通过；`u9-i18n.log` 8 检查通过。
- `theme-browser.log` 首轮 15 中 14 通过，一条 persistent 语言恢复在最终值断言失败。定点复核未重现；在原用例增加完整请求中保留原链接文字的独立断言，两个恢复分支通过（`theme-recovery-browser.log`）；最终同一 2 suites／15 tests 全部通过（`theme-browser-final.log`）。没有为此改动生产状态逻辑或弱化断言。
- 原 draft-browser 与草稿列表数据不变。补充 draft-audit-fields 只读情景：在原 fashion-store 测试 schema 上添加合法 number／boolean，提供已有发布资源和一条使用本地 favicon.svg 的明确测试媒体；仅验证选择回填与原资源描述，不执行保存。before/after 两主题在相同情景与锚点记录。
- `theme-editor/`：顶部、pickers、actions 两主题 before/after；`themes/`：列表与 create 两主题；`theme-fields/`：数值／开关与非空媒体两主题；`theme-select/`：text/select 两主题；`navigation-picker/`：同一个 Men 节点从系统路由切到内部资源的未保存草稿两主题 before/after。页脚复用入口另保存 `audit/navigation-footer-picker-dark.jpg`。
- 上述主题编辑、列表和导航已在会话交付成对原图；创建表单本身无需字段变更，复核父页面主题效果。

## U6 收尾修复与最终检查

- 内容 page／article 编辑后确认重置，旧实现只恢复值，touched 仍使发布／归档禁用。复用原 restoreRecord 恢复值与未编辑基线；新建表单沿 Form.resetFields，不引入额外 dirty 状态。新增两入口测试先失败、修复后通过。`content-reset/before|after-light|dark.jpg` 已逐图检查并在会话交付。
- 随后的正确性复查发现，重置会清除 content_conflict，使旧版本重新进入状态确认。现在重置保留冲突，成功读取记录后才清除；重新加载失败继续走既有 detailError／Retry 边界。新增 page／article 情景验证冲突 → 重置仍阻断 → 加载失败无发布入口 → 重试读取 v4 → 空原因新确认 → 精确 v4 payload，只有两次明确确认产生写请求。`conflict-recovery-red.log` 两项在重置后阻断断言失败；最终 `conflict-recovery-green.log` 22 项全部通过。
- `reset-browser-final.log` 和最终生产修复后的 `conflict-recovery-browser.log` 各 2 项通过。此前失败恢复浏览器用例在 AntD 入场动画中等待原生点击超时；该用例局部配置 motion:false，保留原生填入／点击／Escape、失败原因保留、写次数、冲突与新版本断言。未提高超时、跳过断言或改生产动画；实际默认动画界面另已检查。
- 最终全部改动源文件／测试的 format、ESLint 已通过，见 `final-prettier.log`／`final-eslint.log`；随后新增的内容恢复代码与测试再按改动文件检查通过。`final-typecheck.log` 对应最终 Admin `tsc -b`，退出 0。当前词条 `u9-i18n.log` 8 项通过。没有全量 Admin／monorepo 测试、build 或发布门禁结论。
- 主题切换回“跟随系统”并重新加载，内容表单正常加载、无横向溢出；[系统主题 smoke](assets/admin-form-style-unification/audit/final-system-theme.jpg)。截图仍为 1280×900；临时视口在退出验证时恢复。
- 同线程简化按复用、质量、效率、测试价值和注释检查，没有需要保留的新通用抽象，也没有删除行为证据。两类原因弹窗继续由各页面持有；业务色值、关联紧凑组合、复杂 picker 分组保留。
- 最终正确性、项目规范、测试、可维护性、可靠性、安全及反例复查未留下确认问题。按用户 AGENTS.md 串行在主线程完成，没有独立子审查者；未找到可用的不同提供方 CLI，因此没有外部模型审查或代码传输。[审查回执](assets/admin-form-style-unification/review-summary.json) 保留这个覆盖限制，不将同一上下文的检查称为独立复核。

## 需求与交付追溯

以下是本轮完成证据映射，不是执行队列；执行状态只由主计划及四份有界子计划拥有。

| 合同           | 本轮证据                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1             | 各批次完整 payload、权限、只读与恢复测试；四 Drawer 保持 720px；没有后端、contracts、依赖或共享 primitive 改动                                     |
| R2／AE1        | 新建角色树父选、半选、搜索、授予叶子与精确提交；IAM 51 项及 Browser 2 项                                                                           |
| R3–R5／AE2–AE3 | page/article 和三类 policy 状态 Modal；取消零写入、忙时锁、trim 3–500、失败保留、路由失效与冲突新版本；U3 测试与 U6 最终 22＋2 内容验证            |
| R6             | 政策日期和所属内容列实测均为 752px；原保存／重置和对齐偏好保留                                                                                     |
| R7／AE4        | 集合原搜索代次、handoff 与完整成员基线；迟到响应测试和实际重置原图                                                                                 |
| R8             | 联系页无反馈时不渲染空 Card；错误／版本比较／只读既有分支通过 focused tests                                                                        |
| R9／AE7        | [逐页截图索引](2026-10-31-admin-form-style-comparisons.md)；27 组入口／情景、43 个区域各有浅色／深色新旧原图；源基线、截图记录与最终源哈希分别保留 |
| R10／AE5       | 颜色／Size 标准业务分区、展示类型整列、HEX 紧凑组合与关联错误；非法输入零写入、有效完整 payload                                                    |
| R11            | 商品展示标准分区与动态规格；完整中文标签、关联错误和首错焦点；相关 19 项及 Drawer Browser 3 项                                                     |
| R12／AE6       | 原四入口的长值、只读、错误、footer 和主题；地点只回填草稿，集合兼容 URL 原图和相关测试                                                             |
| R13–R14／AE8   | [全后台审计](2026-10-31-admin-form-style-audit.md)：31 条业务路由、4 条认证及全局密码入口；A01–A09 全部由四份有界计划修复并验收，合理例外具名记录  |
| R15            | 旧计划剩余工作移交本计划；四份 U9 子计划已冻结，本计划持有最终关闭；产品 master 和发布权威未变                                                     |
| R16            | 每入口视觉和功能分别验收；无额外样式变更的地点／集合如实标为复核；本轮确认问题及收尾重置／冲突缺口均已修复                                         |

本次使用无数据库的本地隔离数据，写操作被拒绝；测试中捕获的请求不代表真实业务写入。所有本地验证结束，未提交、推送、创建 PR 或部署。

证据完整性检查：10 份相关文档的 356 处本地链接全部存在；226 张原图与 226 条 capture 记录一一对应、无重名，全部 1280×900；36 个最终源文件哈希与工作区一致。临时视口已恢复，验证页及本轮两个预览进程已关闭。主计划和四份子计划完成后冻结，无待补图或待修复项。
