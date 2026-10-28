# 管理后台模板风格七页修复验证

本记录属于 [独立修复计划](../plans/2026-10-28-refactor-admin-template-style-fixes-plan.md)，只保留本地实现和验证证据，不改变 REL-Pre-DC、候选、DC/PG 或主计划指针。

## 实现结果

配送、履约、隐私列表复用原生 Card、ListToolbarActions、useListViewPreferences 和 TemplateListContent；不分页、不自动刷新，保留原查询和数据范围。新增/记录动作进入 Card，读取失败可重试，刷新失败保留上次数据。配送 720px Drawer、完整配送方式、原因和保存后读取保持原合同；隐私确认、纠正字段、原因及导出规则保持。

政策编辑区采用 compact 800px、FormSubmitToolbar、标准校验定位和确认重置。重置恢复最近读取/成功保存的政策或显式新建的基线，清除备注、校验和错误，不写服务器；审批、发布、归档、版本冲突恢复与业务原因保持。

评价审核保留卡片列表与决定流程，移除额外页面 padding，增加标准内容 Card、读取状态和显式刷新。独立用户详情接入 BasicCrudFormRecipe，原页面路由、确认、安全守卫、完整 payload 和 expectedVersion 保持；本人/只读禁用全部字段并隐藏写操作。列表内 Drawer 继续走既有 recipe。商品三组普通字段恢复 compact，复杂工作区不变；移除在 sections 路径下无效的全局 wide 配置。

## 验证范围与结果

本轮选择 L2。范围是七页展示组合和新增恢复/重置，不改共享组件、API、数据库或依赖；因此不运行全套 Admin、构建、E2E 或 monorepo 门禁。Browser Mode 的升级理由是实际 CSS 宽度、固定底栏、原生校验焦点以及新组合的表格工具需要真实浏览器。

- 修改前基线：7 个文件、90 个相关单元测试通过。
- 最终相关单元测试：7 个文件、95 项通过，无跳过。保留原 payload、审批版本、隐私确认、角色权限和冲突恢复；新增政策重置、失败读取恢复、30 行履约数据及原筛选/查询保留、评价读取恢复与游标竞争用例。
- 新 Browser Mode：6 项通过。三张列表均呈现 31 行，密度和列显隐生效且不额外读取；政策/可编辑用户固定栏校验并聚焦、重置恢复基线；商品各组宽度及固定栏校验正确。
- 已有 Browser Mode 消费者：配送 Drawer、IAM Drawer 各 1 项通过（首轮已绿）；共 8 个浏览器用例。新商品用例最初假定测试视口大于 800px，已改为检查浏览器计算的 800px 上限及 Card 宽于字段；1440px 实际应用也确认三组 body 为 800px。
- changed-file ESLint、Prettier、Admin typecheck 通过；类型检查发现的测试查询 `exact` 参数已按 Testing Library 类型修正，保留 Playwright 查询参数。
- 七页 235 处字面翻译调用检查无缺失、空译文或占位符错误；动态业务值沿用原映射。本轮 translations 只新增 5 个词条。
- 原 Git index 的 binary diff 与修改前完全一致，无 unmerged 文件；没有提交、推送、PR、部署或实际业务写入。其他角色、导航、资料和文档 WIP 保持。

## 简化与收尾审查

`ce-simplify-code` pipeline 按根 AGENTS 的 Task/Subagent 映射在同线程依次执行。复用、质量、效率、测试价值检查后，仅删除商品 sections 路径下无效的全局 wide 配置；未改写证明测试。三页列表保留独立请求生命周期，避免引入完整列表 controller 的分页与自动刷新；未为小段组合新增共享抽象。

`ce-code-review` 对本轮源文件快照运行 full 路径，671 个非测试变化行；与既有 WIP 分离。正确性、规范、测试、维护性、安全、可靠性、对抗及前端竞争视角依项目映射在主线程执行，没有独立代理或跨模型佐证。

唯一有效发现 #1：评价刷新失败后的恢复 Reload 仍可在游标“加载更多”期间重新读第一页，覆盖刚追加的数据。调用方已在恢复函数补齐 loading/busy/选中审核的相同限制。修正测试 fixture 使用真实 `after` 参数后，临时移除 guard 的精确红测丢失 Next shopper；恢复 guard 后 4 项评价测试全部通过，最终 95 项相关测试全部通过。无遗留发现。

审查收据和调用方处理记录在截图目录的 `review/review.json`、`review/caller-followup.json`；原 run：`/tmp/compound-engineering-501/ce-code-review/20261028-template-style-6e1d0f43/`。

## 真实截图

[打开七组前后对比和窄屏补充](/Users/studio/.codex/visualizations/2026/10/11/01a12af4-21cd-7df1-bdc4-47f27f0b26fe/admin-template-style-fixes-20261028/comparison.md)。

截图来自同一 Chrome 会话和本地实际应用。修改前/后为 1440×1050、中文、浅色、同一账号、真实当前数据、首屏；先保存七页 before 原图才修改业务页面。另存七页修改后 390×844 窄屏图。全部 21 张原图均已打开核对；main 和 document 未出现横向溢出，固定栏对齐可用区域底部。

当前环境的四张列表和政策记录为空，用户详情是本人只读，商品是新建。没有注入数据或为截图执行隐私/政策/角色操作。有数据和可编辑场景使用 Browser Mode 的隔离 transport 验证，不能把空态截图当作这些状态的人工验收。

截图目录内 `manifest.json` 保存尺寸和 SHA-256，`source-before/`、`source-after/` 保存源文件，`logs/` 保存最终测试与检查。临时基线：`/var/folders/nm/g5cp7rkx4gqflh548086923c0000gn/T/shoppp-template-fixes-20261028-18vyiff6/`。原图未重绘或修改。
