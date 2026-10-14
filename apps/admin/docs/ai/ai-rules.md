# AI Implementation Rules

## 1. Goal

让 AI 在这个项目里稳定地做到三件事：

- 先识别业务属于哪个页面类型
- 再复用已存在模板与组件
- 最后按现有规范交付可测试代码

## 2. Mandatory Inputs (每次生成代码前必须读取)

1. `docs/ai/business-map.yaml`
2. `docs/ai/page-recipes.yaml`
3. `docs/ai/page-guardrail-recipes.md`
4. `docs/ai/component-catalog.yaml`
5. `docs/testing-standards.md`
6. `src/routes/routes.config.ts`
7. `src/infrastructure/auth/permissions.ts`

## 3. Engineering Constraints

- 路由、菜单、权限都走已有 route contract。
- 新页面先参考 `src/pages/templates/*` 的适用示例，运行时优先复用 `src/shared/template-kit/*` 与 `src/shared/components/*`；参考示例不等于导入示例页面或 API。
- 若需求是“从其他项目迁移页面”，优先阅读 `docs/ai/form-migration-rules.md` 或 `docs/ai/list-migration-rules.md`，先做旧新对照清单，再决定是否接入 recipe。
- 标准列表筛选模板必须优先支持字段：`input`、`select`、`date`、`date-range`；开始和结束日期默认拆成两个 `date` 字段，只有业务要求两个值成对填写、共同提交为一个完整区间时才使用 `date-range`。可搜索下拉优先通过 `selectProps.showSearch/filterOption/onSearch` 表达。
- 普通筛选项（如 `Input / Select / DatePicker / RangePicker`）禁止使用 `custom` 实现；`custom` 仅用于真正的业务特例字段。
- 页面先按模块拆解（筛选区/内容区/反馈区/权限区），再选组件。
- 标准查询列表页分页必须复用 `src/shared/hooks/use-standard-pagination.ts`，禁止页面内散装实现分页状态。
- 所有标准 Modal 的数值宽度大于等于 `1000px` 时，必须复用 `src/shared/template-kit/standard-modal-rules.ts` 设置 `top: 24px`；`centered`、全屏或已显式声明纵向定位的特例除外。字符串、响应式对象等非数值宽度不得猜测阈值。
- Modal 中的表格统一使用 `middle` 标准密度；弹窗内列表必须复用 `src/shared/template-kit/list/modal-list-rules.ts`，分页保留左下角“共 N 条数据”。复杂选择器等 business override 也必须复用该列表展示合同。
- 有异步请求必须处理 `loading / empty / error / partial`。
- 列表查询默认行为为：筛选项变更不自动触发请求，请求仅在点击“查询”后发送，`重置` 除外。
- 标准列表控制区固定为：筛选动作“搜索设置 → 重置 → 查询”，内容区动作“可见业务动作 → 条件分隔线 → 刷新 → 密度 → 列设置”；刷新按钮必须显示图标和“刷新”文本，分隔线只在前方存在最终可见业务动作时显示。
- 普通 Drawer/独立表单模式遵守 `add / modify / readonly`（见 `src/routes/form-route-contract.ts`）；轻量 Modal 仅实现实际模式，不补造路由。
- 表单类型必须按 `docs/ai/page-recipes.yaml#formTemplateDecisionMatrix` 判别，禁止拍脑袋选型；除非用户主动要求复杂表单或多步骤表单，否则默认基础表单；容器按第 3.1 节选择，独立页用 `BasicCrudFormRecipe`、普通 Drawer 用 `CrudFormDrawerRecipe`。
- 模块标题、多 Card、字段数量偏多、远程下拉、上传字段、富文本或普通字段分组都不构成脱离普通表单的理由；若实现者判断必须升级为复杂/多步骤表单，必须先在计划里说明原因并等待用户确认。
- 默认不新建详情页，优先复用表单 `readonly` 模式；独立详情页需满足特例条件。
- 基础 CRUD 表单默认保留必填标识，禁止在基础 recipe 中默认设置 `requiredMark={false}`。
- 全页面表单校验失败时必须滚动到首个错误字段；`BasicCrudFormRecipe` 已默认处理，业务页面不得重复实现。绕过标准 submit、手动调用 `form.validateFields()` 时必须复用 `validateFieldsWithScroll`；短表单或 Modal 不默认强制滚动。
- 所有 API 返回结构必须显式定义 TypeScript 类型。
- 任何新增行为都要补对应测试（最少覆盖 happy path + 1 个失败路径）。
- 新建任意测试文件前，必须先读取 `docs/testing-standards.md`，并按其中分层、命名和最小覆盖清单执行。
- 尽量少写死样式值（颜色、背景、边框、阴影）；优先使用主题 token、组件变量或语义 class，以适配 `light/dark/system`。
- 操作列必须直接展示所有可见操作项；每个动作声明固定 `contentWidth`，页面枚举可达组合并通过 `resolveActionColumnLayout` 固化单行或连续双行布局，最终列宽不得超过 280px。禁止运行时测量 DOM 或折叠动作来迁就宽度。
- 同域列表的主标识列和时间列应尽量统一宽度；若同类资源编号列已形成稳定宽度，新页面默认沿用。
- 普通行危险动作必须使用 `ListRowActions.confirm`（内部 Popconfirm）描述后果并二次确认。IAM、主题发布等涉及 recent-auth、operation ID、冲突恢复或不可撤销页面流程时，保留现有安全 Modal；不得降级为行确认。
- 动态表单中“上移/下移/删除/编号”操作必须复用统一组件 `sort-action-group`，禁止页面内重复散装实现。
- 复杂字段（如 `Cascader/TreeSelect/RemoteSearchSelect`）默认同构复用，禁止无依据降级为 `Input/普通Select`。
- 重置行为必须是“全状态重置”：除表单字段外，需同步重置复杂组件状态（如树勾选/半勾选、展开态、搜索关键字、临时列表缓存）。
- 初始化加载相关副作用必须保证依赖稳定：传入 hook/controller 的请求函数默认使用稳定引用（如 `useCallback`），避免重复请求与渲染抖动。
- `mode/id` 等关键路由参数校验失败时，必须提供首层可见错误态与恢复动作，禁止静默失败。
- 已选独立页的二级及更深层级页面（非一级列表落地页）必须使用统一页头组件 `PageHeaderWithBack`（定义于 `src/shared/components/form-page-header.tsx`），包含标题与返回 icon，禁止页面内重复手写返回头部。
- 当页面已使用 `PageHeaderWithBack` 承载主标题时，页面主容器 `Card` 不得重复设置同义 `title`；基础表单页与分步表单页必须去掉主 `Card title`。
- 标准一级列表页主标题由 `StandardListPageRecipe.pageTitle` 承载，并应与 route `title` 保持同义。
- 一级业务 override、自定义页和一级表单页必须使用 `CustomPageRecipe` 承载内容区主标题；默认标题来自 `AppShell` 暴露的当前 route title，可通过 `title` 保留语义等价的业务标题，禁止页面内散装手写同义 `Typography.Title`。
- 所有 `inMenu: true` 路由（包括分组 IAM 入口）的 normal/loading/error/empty/permission 状态都必须保留一个 recipe-owned level-4 主标题及统一外层间距；不得用早返回、`titleHidden` 或详情式 `onBack` 丢失一级 route 上下文。完整 heading-owner inventory 见 `page-guardrail-recipes.md` §5.5。
- 标题下方仅复述页面用途的通用摘要必须删除；影响决策的 guidance 必须只保留一次并移到对应筛选、结果、权限、状态或操作控件旁。字段 help、指标定义、错误/空态 description、表格事实和无障碍 description 不属于标题副文案，不得一并删除。
- 面包屑只由 `AppShell` 渲染，独立一级入口和不足两级的路径不显示；完整 contract 见 `page-guardrail-recipes.md` §5.5。页面内容区不得重复渲染面包屑；`Card title` 只用于表达内容分区。
- 自定义表单内容容器必须复用 `FORM_CONTENT_ALIGN_CLASS_NAME` 或 `FORM_CARD_BODY_WIDTH_CLASS_NAME`，避免覆盖用户在 `AppShell` 中选择的表单左/中/右对齐偏好。
- 旧页迁移或业务接入中，启用/禁用、状态切换、审核、绑定、过滤等非表单写动作必须冻结请求合同：`endpoint / method / payload 来源 / 完整对象更新还是局部 patch / 状态值映射 / null 与 undefined 处理 / 成功判定`。
- 默认值必须区分三层：用户首屏看到什么、组件/表单内部持有什么值、请求 payload 实际发什么；三层不一致时必须在边界层显式映射。
- 枚举展示必须对未知值兜底，禁止因为后端返回新增枚举或脏值导致空白、崩溃或错误文案。
- 已选独立页和保留兼容 URL 的编辑/表单/详情路由必须使用“列表路径前缀 + 子路径”编排（例如 `.../list/edit`、`.../list/form`），禁止跨级跳到平级路径（例如从 `.../fission-apply-list` 跳到 `.../fission-apply-edit`）；否则会导致左侧菜单高亮失焦。
- 新增或修改跳转时，`navigate/window.open/useCrudFormNavigation` 的目标路径必须与对应列表路由保持同前缀。
- 已选独立页的列表操作列跳转按钮默认安全新开页，使用 `window.open(url, '_blank', 'noopener,noreferrer')` 或等价 `target="_blank" rel="noopener noreferrer"`；只有旧页或产品明确要求当前页跳转时才允许例外，并需在实现说明中写明。
- 列表页主创建按钮若语义为“新增/新建某业务对象”，默认不使用 `PlusOutlined` 等加号 icon；文案按业务语义保持“新增/新建<业务对象>”。
- 查询列表页顶部主新增按钮统一使用 `type="primary"`；即使包裹权限守卫，也不得回退为 `color="primary" variant="filled"`。
- 组件库约束：当前项目为 `antd@6`，禁止产出任何已标记 deprecated 的 API/props；若出现冲突，以 Ant Design v6 迁移指南为准完成替换。
- 代码卫生约束：禁止保留未使用的 import/变量；提交前必须通过 ESLint（包含 `unused-imports` 规则）。

## 3.1 表单容器与生命周期（强制）

容器与基础/分步/高级结构分别决策。按以下顺序选择，不因旧 URL、字段数量或旧 UI 习惯跳过判断：

1. 必须独立分享、收藏、访问，或需要持续的大工作空间：独立页，保留合法路由、来源参数和安全新开页。
2. 否则，轻量、单目标、一步结束的输入：页面级 `Modal + Form`，仅实现实际模式，不补造三态、路由或通用 Modal 表单 recipe。
3. 其余普通单对象维护：`CrudFormDrawerRecipe`。独立页由 `BasicCrudFormRecipe` 承载；特殊业务流程保有原 owner，但仍执行适用的容器、布局与关闭合同。

- 所有右 Drawer 固定 `size={720}`，包含表单、详情、教程和示例。仅设计、验收不小于 720px 的桌面窗口，不新增窄窗口适配或测试；其他页面既有适配继续保留。
- Drawer 由组件提供标题、滚动 body 和 footer，不嵌套整页 recipe、页头或固定页级工具条。字段空间按 [drawer-form-layout-rules.md](drawer-form-layout-rules.md) 判断；独立页继续使用第 4 节内容宽度与对齐。
- 普通 Drawer 编辑 footer 为重置、保存；普通 Modal footer 默认一个主提交，header 关闭，不重复取消且不默认加重置。危险确认、审核分支、复制凭据、多种业务提交保留必要动作。
- 查看或没有有效未保存差异时，header、遮罩、Esc 可关闭；存在差异时所有入口共用一次放弃确认，继续编辑保留值。按业务提交纯值与完整回填后的基线比较，回填和改回原值不误报；重置后的差异由原清空/恢复合同决定。
- 普通提交使用同步锁；业务写、上传预处理/上传、富文本图片、附加写入计入 `actionBusy`，禁止关闭和重复写。内层 Modal 通过 `nestedModalOpen` 先消费 Esc；保留局部浮层冲突处理，不新建焦点管理。
- 每次打开挂载独立实例。关闭先 `open=false`，退出动画结束才卸载；父页在此期间固定目标并拒绝新的打开，迟到详情/提交回调和关闭清理只能作用于所属实例。每次打开清理旧输入、校验和请求错误。
- readonly 和 `showActions=false` 隐藏/禁用并硬阻断普通写；只读资料的审核、退款、预览等独立业务动作按原权限和业务状态保留。字段、Form 外集合、树、上传及动态数组仍进入原完整 payload、校验和 reset。
- 校验错误就地展示、零写，不进入 API 错误反馈；确定写失败保留输入并提供恢复动作。结果未知、409、重新认证、operation identity、一次性凭据沿用原领域恢复，不盲目重放。
- 普通 Drawer 确认写成功后立即关闭，根级 `App.useApp().modal.success` 使用业务成功标题、footer 仅当前语言的确认动作，同时每个受影响父内容刷新一次。确认仅关闭结果提示，不再读；凭据结果由原专用 Modal 唯一承接，不叠普通成功提示。附加动作可用 `complete()` 共用退出和刷新，反馈仍由原业务 owner 承接。
- 普通 Modal 成功关闭并一次刷新，反馈按有效业务合同；独立页保留适用的“× 留页、确定离页”成功确认。当前页直调 `reload` 与跨标签频道每入口只选一个，不双刷新。
- 刷新失败由父内容持有：保留旧列表、持续显示读取失败，重试仅同一已提交查询，不能误报保存失败或重放 POST/PUT。`onSaved` 负责该读取边界，recipe 接住其 rejection，不改变已成功写结果。
- 不新增全局反馈服务、草稿、URL 同步、导航拦截、乐观更新、配置引擎或无消费者抽象。

Shoppp 继续使用 `I18nProvider`、`useCurrentTranslate` 和本地 `ApiError` 映射。持久错误按当前语言渲染；切换语言不重挂载表单实例、不重读数据、不清理草稿。IAM 的 reauth、operation identity、copy-once、版本冲突和发布结果 owner 保持原合同。

## 4. Design Baseline (Authoritative)

以下规则是本项目 UI/UX 的唯一执行标准。

- 状态反馈必须覆盖 `readonly / loading / empty / error / partial`。
- `readonly` 必须禁用重置/保存并硬阻断提交；`BasicCrudFormRecipe` 不默认渲染“查看模式”提示。
- `loading` 必须有明确任务文案，不能只放转圈。
- `empty` 必须说明“为什么为空”并提供一个恢复动作。
- `error` 必须提供可执行恢复动作（重试或返回），禁止死路提示。
- `partial` 必须有告警语义和“重载完整数据”动作。
- Query 状态文案必须页面语义化，禁止跨页面复制同一句文案。
- 默认详情展示复用表单 `readonly`；仅当信息结构与编辑结构显著不同时才允许独立详情页。
- 列表筛选区禁止因散装自定义字段导致桌面端换行或错位；模板字段应保证同行布局稳定。
- 表单默认单列；右 Drawer 按 `drawer-form-layout-rules.md` 判断普通双列、关联组合行和全宽区域。已选独立页沿用下列内容宽度与对齐合同；字段数量本身不决定列数。
- `BasicCrudFormRecipe` 接入页默认不传 `contentWidthPreset`，等同 `compact`（最大宽度 800px）；富文本不单独触发 `wide`。单 Card 内容命中单行表单项超过 3 个的动态表单、多层级动态表单、或列数大于等于 4 个的列表时，才可显式声明 `wide`（最大宽度 1200px）。`full` 不设置最大宽度，仅用于工作台/编排器/矩阵/画布/超宽批量编辑等 `wide` 仍明显影响操作效率的模块，必须特殊声明。
- 普通表单允许通过 `BasicCrudFormRecipe` 的标准分区能力承载模块标题；禁止因为出现“基本信息/考试信息/资质信息”等模块标题就改用复杂表单或页面内散装分组。
- 多 Card 表单页的外层 Card 必须保持页面全宽；`compact/wide` 宽度限制应按每个 Card 独立判断并落在 Card body 内容区或 Card 内表单内容容器上，不得挂在包裹多个 Card 的 Form 根节点上。
- 普通单列编辑页字段控件默认填满表单内容列；禁止用 `md:!w-[360px]`、`md:!w-[480px]` 等字段级固定宽度替代模板内容宽度。
- 主题必须支持 `light / dark / system`，并使用同一主题上下文。
- 新增样式优先使用 Ant Design token 或语义化 CSS 变量；避免硬编码颜色、背景、边框、阴影。
- 信息只在最接近操作或决策的位置展示一次。筛选控件已经清楚表达币种、时区、日期等条件时，禁止再增加同义“报表口径”卡片、摘要行或说明块；指标定义放在对应指标旁的问号 Tooltip 中，并使用当前语言。只有新增决策信息（如筛选尚未应用、加载失败、数据限制）才保留局部提示，不重复罗列条件。此约定来自 2026-09-03 Dashboard 反馈。
- 若出现临时硬编码样式，必须在 `TODOS.md` 记录迁移任务。
- 可访问性基线：键盘焦点顺序与视觉顺序一致，状态文案可被屏幕阅读器清晰理解；Ant Design
  与现有共享组件负责通用角色、键盘行为、弹层焦点和常规 live feedback，业务页不得重复实现。
- 只有明确产品要求或可复现的组合缺口才允许增加自定义 ARIA、局部 live region 或焦点修正；
  已由可见状态、当前焦点或组件库语义表达的结果，禁止再镜像到页面级隐藏 announcer。
- 同一页面同一时刻可见的 `primary` 按钮默认不超过 2 个；若页面只有一个明确主流程，仍应优先只保留 1 个主焦点按钮。
- 同一操作分区内默认只保留 1 个 `primary`；返回、重置、复制、导出、查看规则、打开弹窗等次级动作默认使用普通按钮、链接按钮或文本动作，不得与主流程动作抢夺视觉焦点。
- 导入/导出区域中的“下载模板/下载导入模板”按钮统一使用 `type="link"`，保留 Button 默认内边距，不配 icon，并紧跟在对应导入/导出按钮右侧。
- 列表 Result 错误态的“重试/重新加载”按钮，以及空态的“重置筛选/重新筛选”按钮，使用默认 Button，不使用 `type="primary"`。
- 若同一页面确需出现 3 个及以上 `primary` 按钮，必须在实现说明中写明原因与分区边界，不能默认生成。
- 操作列不再按宽度预算折叠隐藏操作项；所有可见操作项默认直出，超过单行预算时使用稳定连续双行，不得以运行时测量结果控制列宽。
- 表单保存结果按第 3.1 节执行；其他轻量结果用 `message`，高风险/强确认写操作用原 `modal`（如删除、发布、不可撤销操作），保留必要安全流程。
- 已选独立页的二级及更深层级页面必须展示“标题 + 返回 icon”统一头部，交互与样式以 `PageHeaderWithBack` 为基线。
- 动态表格、远程下拉、多选器、上传、富文本等运行时交互必须至少覆盖一次真实交互验证，不能只做静态渲染断言。

## 4.1 Internationalization（国际化）

- 延用 `I18nProvider`、`AdminUiProvider` 和 `shared/i18n/translations.ts`；应用拥有的按钮、表单名称、占位、加载、空态、错误和恢复文字必须通过 `t` 显示。使用带参数的完整消息，不拼接译文片段。
- 用户输入、资源名称、原因、承运商、运单号、URL、币种、IANA 时区和技术标识按原值显示，只能作为插值参数或独立数据字段，不能送入任意 `t(value)`。第三方主题包的作者文字不自动视为应用词条。
- 持久错误保存错误对象或本地消息描述，在渲染时按当前语言翻译；异步即时提示使用 `useCurrentTranslate`。切换语言不能重播旧 toast、重载业务数据、重置草稿/筛选/选择或触发保存；请求副作用只依赖业务输入，不依赖展示用翻译函数。
- API 错误通过现有归一化器保留已知 code、status 和必要 details，再有限映射为安全说明；本地前置条件与传输错误分开。未知错误不直接展示服务端自然语言。验证/迁移/预览结果在所属页面领域映射，保留诊断码与字段定位，不用全局 helper 解析句子。
- 已知枚举按所属领域翻译，未知值保留可辨识原值或“未知 + 技术码”，不能伪造成功。混合历史 label 不拆分猜测用户数据；新增结构化字段须说明新旧客户端/响应的兼容范围。
- 新词条必须有非空中文，源文/译文的插值占位符集合必须一致。生产字面量和显式动态目录由仓库根 `tools/check-admin-i18n.ts` 检查；新动态目录同步登记并运行 `bun test tools/check-admin-i18n.test.ts`。该测试已进入根 `bun test tools`，不另建重复门禁。未解析动态调用必须暴露为覆盖限制，不能用整包排除掩盖缺词；允许技术词同文，不执行“界面不能有英文”的检查。
- 语言与时区分开处理：标注 UTC 的值必须显式按 UTC 格式化；IAM 日期采用应用 locale、保持浏览器本地时区；ISO date-only 查询值不转换时区。金额精度和报表计算不因翻译改动。
- 依照 [测试标准](../testing-standards.md) 选择风险层级。共享语言/错误改动至少验证直接消费者、切换后状态与请求次数、失败恢复和原始数据保留；真实库 locale 与窄屏/时区结论使用真实 provider 的 Browser Mode。可复用 `rstest.i18n-browser.config.ts` 的 desktop/narrow 两组原生上下文，不把 jsdom 的 navigator 覆盖当作原生浏览器证据。

## 4.2 Form Input Necessity（表单输入必要性）

本节是 Shoppp 表单新增、修改和专项排查的输入必要性原则；各应用继续使用自己的组件、权限和业务契约。

- 每个要求用户输入的字段都必须有具体用途：完成当前业务动作、供后续明确决策使用，或满足已定义的追溯要求。无法说明用途的字段不应必填；用途不明显时，在字段附近说明。
- 系统已经可靠掌握的操作人、时间、动作、对象、版本和变更内容自动记录；同一流程已经填写的信息应复用。补充说明使用“备注（选填）”，不能要求用户重述系统事实。
- 区分“用户必须输入”与“保存结果必须非空”。业务名称/标题可作为 SEO 标题的明确默认值，但默认值不得伪造用户动机、审批意见、法律内容或其他业务事实；界面应说明默认规则并允许修改。
- 普通草稿创建、草稿保存、校验和私有预览不因缺少手填备注而受阻。保留 `reason` 请求键的兼容性，省略或空白可归一为无备注；审计仍记录完整操作事实，不能用自动生成的“原因”冒充用户解释。
- 高风险动作的原因逐动作判断并保留现有必要要求，包括审批、发布、回滚、退款、库存调整、隐私处理和客户数据导出。危险确认解决“是否执行”，原因解决具体追溯用途，二者分别表达，不能相互替代。
- 必填/选填文案、可见标识、客户端校验、请求契约和服务端校验必须一致。选填字段有值时仍遵守既有长度、格式和脱敏规则；取消手填门槛不放宽保存数据约束、权限、版本冲突或发布条件。
- 名称生成 Slug 仅作为新建时可编辑的建议：仅转换能够可靠处理的英文名称，不臆造中文拼音，不覆盖已有或用户修改过的 Slug；无法生成时保留明确输入要求与错误反馈。
- 素材和其他已存在资源优先通过现有选择器检索、回填和选择，减少复制技术 ID。复用时保留所属业务域的读权限，不要求用户获得无关业务域权限。
- 采用 [GOV.UK Question pages](https://design-system.service.gov.uk/patterns/question-pages/) 中“只询问需要的信息、解释用途、复用已填信息”的原则；必填标识和页面组织继续遵守 Ant Design、`BasicCrudFormRecipe` 与本项目规范，不照搬无星号或一字段一页的布局。
- 不为本原则新造通用表单框架、页面级焦点或播报机制。按 [测试标准](../testing-standards.md) 验证真实提交边界；跨页面调整具名列出 consumers，覆盖界面、API、审计和必要的真实交互。

## 5.1 操作列固定宽度规则（强制）

详细口径见 `docs/ai/list-column-width-rules.md`。本节保留必须遵守的摘要规则。

1. 固定计算口径：

- 2 个汉字 = 28px（14px/字）
- 4 个汉字 = 56px（14px/字）
- 相邻动作分隔占位固定 17px（需计入）
- 表格密度 padding：`large` 为 32px，`middle/small` 为 16px
- 操作列最终宽度上限为 280px；求解器在上限内优先单行，否则选择使较宽行最小的连续双行切点

2. 计算基线：

- 为每个动作声明固定正文宽度，并枚举“同一时刻全部直出按钮集合”的可达组合（含权限放开、状态分支命中）
- 对互斥按钮（如“启用/禁用”“通过/驳回”）按单分支计入，不得把互斥分支叠加为同屏宽度
- 使用 `Divider` 分隔时，必须计入分隔占位，不得只按文案估算

3. 代码要求：

- 动作正文宽度与可达组合写成常量，调用 `resolveActionColumnLayout` 得到列宽和行布局预算
- 渲染 `ListRowActions` 时必须同步传入求解结果的 `layoutMode` 与 `maxRowContentWidth`
- 修改后必须运行严格表宽审计和虚拟表格 Browser Mode，确认 `scroll.x`、固定列与单双行混排一致

## 6. File Placement Convention
- 参考示例: `src/pages/templates/`，仅承载可运行的模板页面及其示例 API、示例数据，不放正式业务模块。
- 新业务页面: `src/pages/<domain>/`；项目已有清晰的业务目录时沿用其结构，不强制增加目录层级。
- 业务 API、局部组件、类型和测试: 优先与业务页面同目录，例如 `src/pages/<domain>/api.ts`。
- 运行时复用逻辑: `src/shared/template-kit/`；通用组件: `src/shared/components/`。
- 业务模块不得直接导入 `templates` 中的示例页面、示例 API、示例数据或示例权限；接口、路由和权限合同必须来自当前项目的业务权威。
- 模板示例不得依赖具体业务模块；确需运行时共享的能力应放入 `shared`，不以示例文件作为公共依赖。
- 示例路由注册、示例测试及示例 MSW handler 可引用示例文件；迁移已有业务目录时保留 URL、菜单、接口和权限行为，仅调整文件位置与引用。
- 路由配置: `src/routes/routes.config.ts`；示例路由路径不是业务路由约定。

## 7. Output Contract for AI

AI 在输出实现方案时，必须包含：

1. 业务归类（对应 business domain / recipe）
2. 页面模块划分（至少标出筛选区/内容区/反馈区/权限区中适用项）
3. 表单选型结论（基础/分步/高级）及判别依据
4. 分别列出参考示例与实际复用的现有代码
5. 将新增或修改的文件列表
6. 测试计划（至少 2 条）
7. 风险点（权限、参数、空态、错误态、主题适配）
8. 是否使用标准筛选模板字段，若没有，原因是什么
9. 是否复用 `readonly` 表单作为详情展示
10. 操作列宽度按哪组可见动作计算
11. 是否覆盖参数非法、权限分支、查询交互三个关键风险点

## 8. Rejection Rules

如果 AI 方案出现以下任一项，视为不合格并重做：

- 将正式业务模块放入 `src/pages/templates/`，或把示例页面/API/权限当作业务依赖
- 新造一个和 template-kit 重复的控制器
- 忽略权限声明
- 忽略 `mode` 参数校验
- 页面只实现 happy path，没有异常/空态
- 表单类型选择没有给出判别依据
- 出现大量硬编码样式且未考虑深色模式
- 普通筛选项使用 `custom` 实现
- 可拆分的开始/结束日期使用 `date-range`，或日期范围使用 `custom + RangePicker`
- 基础 CRUD 表单默认关闭必填标识
- 操作列宽度没有固定常量或没有注释说明计算过程
- 只做类型通过，没有验证关键跳转链路
