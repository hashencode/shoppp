# Admin 导航单卡片树与编辑表单验证

实施 authority：`docs/plans/2026-10-11-refactor-admin-navigation-split-layout-plan.md`。范围仅为 `/storefront/navigation` 及局部样式、翻译和导航测试；本记录保存证据，不维护产品执行队列。

## 实施结果

- R1：保留 `CustomPageRecipe` 标题和 Header / Footer Tabs。每个菜单使用一张 Card，内部沿用 `wide` 1200px 及内容对齐偏好；左侧 300px 结构树、右侧当前项表单，用 `colorBorderSecondary` 分隔。实际内容不足 900px 时同卡上下堆叠，分割线转为横向。
- R2：整菜单草稿由 `items` state 承载，右侧只展示当前节点；切换节点、Tabs、容器宽度保留修改。新增后选中，保存后按返回 ID 或父级／兄弟位置恢复选择；删除父节点包含其子项，按原邻项／父级回退，最后一项删除后聚焦新增。
- R3：保持 GET / PUT 和发布／归档 POST 合同、完整菜单 payload、版本与 Idempotency-Key。write / publish 分离，资源查询继续依资源权限；只读能浏览树，不能写入。保存失败保留草稿及已加载版本。发布与归档保留理由、确认及 dirty 阻断。
- R4：复用固定工作条和标准重置确认，重置本 Tab 的全部未保存项、备注、状态理由、选择、展开和错误，无请求。contracts 最多两级，按钮和 helper 都阻止带子项父节点降级，避免原 normalize 丢失三级子项。

## L2 验证

生产代码稳定后运行，未升级为 app-wide suite、build、Browser Mode 或 E2E：

- 新结构用例先在旧页面产生缺少 Tree 的预期失败。
- `bun run test src/pages/storefront/navigation-page.test.tsx`（`apps/admin`）：16/16 通过。覆盖树选择与整菜单 payload、未显示的外链修改、内部资源搜索与选择、新建服务端 ID、重置、删除后的局部焦点、两级限制、只读与资源权限、Retry、保存冲突、独立 Tab 草稿和精确发布／归档合同。
- `bun run typecheck`（`apps/admin`）：通过。
- 本页、导航测试和翻译文件的 scoped ESLint：通过。
- `bun test tools/check-admin-i18n.test.ts`：8/8 通过，43 条断言。
- 使用 `scanTranslationCalls` / `scanMessageCatalog` / `checkMessages` 限定本页、既有资源类型目录和四个排序动作，71 个使用处无缺词、空译文或插值问题。扫描器未解析的五处动态调用已暴露：资源目录和动作组合显式检查，发布结果／状态／候选分支由既有有限词条承载；没有新增任意数据翻译路径。
- 本页、导航测试、CSS、翻译及本计划／证据的 Prettier 和 scoped `git diff --check`：通过。

## 实际浏览器

本地 Admin `http://127.0.0.1:3418`，已登录本地测试账号；只操作未保存演示草稿，没有保存、发布或归档真实菜单。

- 1280 × 720：可见一张 Card；内容约 928px，grid 实测 300px / 596px，右列内含分割线与 padding。选中“新品”显示所属“商品”和 `/collections/new-arrivals`。
- 1440 × 1050：同卡两列，实测 300px / 756px；六项演示树清晰显示父子层级、当前选择和右侧单项字段。
- 390 × 844：单列宽约 182px，右区 `border-top: 1px`，页面无横向溢出。卡片标题、状态、添加入口均可见；当前选中“新品”与草稿保持。
- 从 Header 切换到 Footer 的空菜单，再切回 Header，选中项及路由修改保留。确认重置后六项演示草稿清除，恢复真实空菜单；视口覆盖已恢复默认。
- 目标类型切换和真实内部资源 picker 已打开验证；本地无已发布 page 时使用其原空态。搜索和选择返回项的行为由 focused suite 验证。
- Card / Tree 使用现有 Ant Design 主题，局部分割线由 `theme.useToken()` 提供。当前浅色 Card 为 `rgb(255, 255, 255)`，分割线为 `rgb(240, 240, 240)`；本次未做深色运行时切换，不把静态 token 审核当作深色浏览器证据。
- 截图保存在本线程 `shoppp-style-audit/implemented-navigation.png` 和 `implemented-navigation-narrow.png`；截图中的菜单是未保存演示草稿。

## 简化与代码复核

使用 ce-simplify-code 和 ce-code-review 的检查方法，按仓库 AGENTS 的 Task / Subagent 映射在主线程顺序完成；未运行独立代理、跨模型审查或完整多代理流程。

- 复用现有 Tree / Form / Card、内容宽度、固定工作条、API 和资源 picker。资源 kind 标签复用 `resourceKindMessages`。不抽取与角色页交互状态不同的共享编辑器，也不迁移共享 recipe。
- 保持完整 `items` 为唯一草稿来源，当前项、父级和兄弟由其推导，避免两份 Form store 相互同步；树选择仅持有 ID。当前项 picker 随节点切换挂载，未显示节点的数据仍由父级保留。
- 顺序复核正确性、测试、项目规范、维护性、授权和前端状态：包含新增 ID 重写与返回数组重排、隐藏项保存、只读硬守卫、busy / dirty 状态、发布版本、重置、Tab 生命周期、删除焦点和两级层级边界。
- 对照原 API、contracts、排序 helper、固定工具条及 §4.4，未发现本次变更引入的可行动问题。R1–R4 与 U1–U2 均满足；深色运行时未单独验证，覆盖限制如上。

结论：本范围本地验证通过，Actionable findings: none。修改保留在当前工作区，未提交、推送或部署；既有角色页、设计文档与其他 WIP 保留。
