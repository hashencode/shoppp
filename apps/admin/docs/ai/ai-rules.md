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
- 新页面先复用 `src/pages/templates/*` 与 `src/shared/template-kit/*`。
- 若需求是“从其他项目迁移页面”，优先阅读 `docs/ai/form-migration-rules.md` 或 `docs/ai/list-migration-rules.md`，先做旧新对照清单，再决定是否接入 recipe。
- 标准列表筛选模板必须优先支持字段：`input`、`select`、`date`、`date-range`；可搜索下拉优先通过 `selectProps.showSearch/filterOption/onSearch` 表达。
- 普通筛选项（如 `Input / Select / DatePicker / RangePicker`）禁止使用 `custom` 实现；`custom` 仅用于真正的业务特例字段。
- 页面先按模块拆解（筛选区/内容区/反馈区/权限区），再选组件。
- 标准查询列表页分页必须复用 `src/shared/hooks/use-standard-pagination.ts`，禁止页面内散装实现分页状态。
- 所有标准 Modal 的数值宽度大于等于 `1000px` 时，必须复用 `src/shared/template-kit/standard-modal-rules.ts` 设置 `top: 24px`；`centered`、全屏或已显式声明纵向定位的特例除外。字符串、响应式对象等非数值宽度不得猜测阈值。
- Modal 中的表格统一使用 `middle` 标准密度；弹窗内列表必须复用 `src/shared/template-kit/list/modal-list-rules.ts`，分页保留左下角“共 N 条数据”。复杂选择器等 business override 也必须复用该列表展示合同。
- 有异步请求必须处理 `loading / empty / error / partial`。
- 列表查询默认行为为：筛选项变更不自动触发请求，请求仅在点击“查询”后发送，`重置` 除外。
- 标准列表控制区固定为：筛选动作“搜索设置 → 重置 → 查询”，内容区动作“可见业务动作 → 条件分隔线 → 刷新 → 密度 → 列设置”；刷新按钮必须显示图标和“刷新”文本，分隔线只在前方存在最终可见业务动作时显示。
- 表单模式必须遵守 `add / modify / readonly`（见 `src/routes/form-route-contract.ts`）。
- 表单类型必须按 `docs/ai/page-recipes.yaml#formTemplateDecisionMatrix` 判别，禁止拍脑袋选型；除非用户主动要求复杂表单或多步骤表单，否则一律使用普通三态表单（`BasicCrudFormRecipe`）。
- 模块标题、多 Card、字段数量偏多、远程下拉、上传字段、富文本或普通字段分组都不构成脱离普通表单的理由；若实现者判断必须升级为复杂/多步骤表单，必须先在计划里说明原因并等待用户确认。
- 默认不新建详情页，优先复用表单 `readonly` 模式；独立详情页需满足特例条件。
- 基础 CRUD 表单默认保留必填标识，禁止在基础 recipe 中默认设置 `requiredMark={false}`。
- 全页面表单校验失败时必须滚动到首个错误字段；`BasicCrudFormRecipe` 已默认处理，业务页面不得重复实现。绕过标准 submit、手动调用 `form.validateFields()` 时必须复用 `validateFieldsWithScroll`；短表单或 Modal 不默认强制滚动。
- 所有 API 返回结构必须显式定义 TypeScript 类型。
- 任何新增行为都要补对应测试（最少覆盖 happy path + 1 个失败路径）。
- 新建任意测试文件前，必须先读取 `docs/testing-standards.md`，并按其中分层、命名和最小覆盖清单执行。
- 尽量少写死样式值（颜色、背景、边框、阴影）；优先使用主题 token、组件变量或语义 class，以适配 `light/dark/system`。
- 操作列必须直接展示所有可见操作项；宽度禁止运行时动态推算，必须在开发阶段按“同一时刻全部直出”的按钮组合一次性计算后写成固定值，并在代码注释说明计算过程。
- 同域列表的主标识列和时间列应尽量统一宽度；若同类资源编号列已形成稳定宽度，新页面默认沿用。
- 普通行危险动作必须使用 `ListRowActions.confirm`（内部 Popconfirm）描述后果并二次确认。IAM、主题发布等涉及 recent-auth、operation ID、冲突恢复或不可撤销页面流程时，保留现有安全 Modal；不得降级为行确认。
- 动态表单中“上移/下移/删除/编号”操作必须复用统一组件 `sort-action-group`，禁止页面内重复散装实现。
- 复杂字段（如 `Cascader/TreeSelect/RemoteSearchSelect`）默认同构复用，禁止无依据降级为 `Input/普通Select`。
- 重置行为必须是“全状态重置”：除表单字段外，需同步重置复杂组件状态（如树勾选/半勾选、展开态、搜索关键字、临时列表缓存）。
- 初始化加载相关副作用必须保证依赖稳定：传入 hook/controller 的请求函数默认使用稳定引用（如 `useCallback`），避免重复请求与渲染抖动。
- `mode/id` 等关键路由参数校验失败时，必须提供首层可见错误态与恢复动作，禁止静默失败。
- 二级及更深层级页面（非一级列表落地页）必须使用统一页头组件 `PageHeaderWithBack`（定义于 `src/shared/components/form-page-header.tsx`），包含标题与返回 icon，禁止页面内重复手写返回头部。
- 当页面已使用 `PageHeaderWithBack` 承载主标题时，页面主容器 `Card` 不得重复设置同义 `title`；基础表单页与分步表单页必须去掉主 `Card title`。
- 标准一级列表页主标题由 `StandardListPageRecipe.pageTitle` 承载，并应与 route `title` 保持同义。
- 一级业务 override / 自定义页必须使用 `CustomPageRecipe` 承载内容区主标题；默认标题来自 `AppShell` 暴露的当前 route title，可通过 `title` 显式覆盖，禁止页面内散装手写同义 `Typography.Title`。
- 面包屑只由 `AppShell` 渲染，独立一级入口和不足两级的路径不显示；完整 contract 见 `page-guardrail-recipes.md` §5.5。页面内容区不得重复渲染面包屑；`Card title` 只用于表达内容分区。
- 自定义表单内容容器必须复用 `FORM_CONTENT_ALIGN_CLASS_NAME` 或 `FORM_CARD_BODY_WIDTH_CLASS_NAME`，避免覆盖用户在 `AppShell` 中选择的表单左/中/右对齐偏好。
- 旧页迁移或业务接入中，启用/禁用、状态切换、审核、绑定、过滤等非表单写动作必须冻结请求合同：`endpoint / method / payload 来源 / 完整对象更新还是局部 patch / 状态值映射 / null 与 undefined 处理 / 成功判定`。
- 默认值必须区分三层：用户首屏看到什么、组件/表单内部持有什么值、请求 payload 实际发什么；三层不一致时必须在边界层显式映射。
- 枚举展示必须对未知值兜底，禁止因为后端返回新增枚举或脏值导致空白、崩溃或错误文案。
- 列表页的编辑/表单/详情路由必须使用“列表路径前缀 + 子路径”编排（例如 `.../list/edit`、`.../list/form`），禁止跨级跳到平级路径（例如从 `.../fission-apply-list` 跳到 `.../fission-apply-edit`）；否则会导致左侧菜单高亮失焦。
- 新增或修改跳转时，`navigate/window.open/useCrudFormNavigation` 的目标路径必须与对应列表路由保持同前缀。
- 列表操作列中用于打开表单、详情或子页面的跳转按钮默认新开页，使用 `window.open(url, '_blank', 'noopener,noreferrer')` 或等价 `target="_blank" rel="noopener noreferrer"`；只有旧页或产品明确要求当前页跳转时才允许例外，并需在实现说明中写明。
- 列表页主创建按钮若语义为“新增/新建某业务对象”，默认不使用 `PlusOutlined` 等加号 icon；文案按业务语义保持“新增/新建<业务对象>”。
- 查询列表页顶部主新增按钮统一使用 `type="primary"`；即使包裹权限守卫，也不得回退为 `color="primary" variant="filled"`。
- 组件库约束：当前项目为 `antd@6`，禁止产出任何已标记 deprecated 的 API/props；若出现冲突，以 Ant Design v6 迁移指南为准完成替换。
- 代码卫生约束：禁止保留未使用的 import/变量；提交前必须通过 ESLint（包含 `unused-imports` 规则）。

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
- 编辑页/表单页默认使用单列布局，优先沿用基础表单页的 `compact` 窄栏单列基线；只有旧页合同明确要求、字段密度过高，或存在复杂审核/编辑器混排等业务 override 场景，才允许显式使用双列/多列，并在实现说明中写明例外原因。
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
- 操作列不再按宽度预算折叠隐藏操作项；所有可见操作项默认直出，并在开发阶段完成直出宽度重算，不得以运行时测量结果控制列宽。
- 反馈语义必须分层：轻量结果用 `message`，高风险/强确认写操作用 `modal`（如删除、发布、不可撤销操作）；同类行为在同页面保持一致。
- 二级及更深层级页面必须展示“标题 + 返回 icon”统一头部，交互与样式以 `PageHeaderWithBack` 为基线。
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

## 5.1 操作列固定宽度规则（强制）

详细口径见 `docs/ai/list-column-width-rules.md`。本节保留必须遵守的摘要规则。

1. 固定计算口径：

- 2 个汉字 = 28px（14px/字）
- 4 个汉字 = 56px（14px/字）
- 按钮间距默认 13px（需计入）
- 额外余量默认 +16px（非特殊场景不扩大）
- 操作列不设默认宽度上限；只有明确业务约束要求时才允许传入页面级上限

2. 计算基线：

- 以“同一时刻全部直出按钮集合”的最宽组合计算（含权限放开、状态分支命中）
- 对互斥按钮（如“启用/禁用”“通过/驳回”）按单分支计入，不得把互斥分支叠加为同屏宽度
- 使用 `Divider` 分隔时，必须计入分隔占位，不得只按文案估算

3. 代码要求：

- 宽度写成常量（如 `ACTION_COLUMN_WIDTH`），禁止运行时动态推算
- 常量上方必须有注释，明确计算过程与各项像素来源
- 注释中的计算过程必须与常量值一致

## 6. File Placement Convention

- 新业务页面: `src/pages/templates/<domain>/`
- 模板化复用逻辑: `src/shared/template-kit/`
- 页面 API: `src/pages/templates/<domain>/api.ts`
- 路由配置: `src/routes/routes.config.ts`

## 7. Output Contract for AI

AI 在输出实现方案时，必须包含：

1. 业务归类（对应 business domain / recipe）
2. 页面模块划分（至少标出筛选区/内容区/反馈区/权限区中适用项）
3. 表单选型结论（基础/分步/高级）及判别依据
4. 将复用的现有文件列表
5. 将新增或修改的文件列表
6. 测试计划（至少 2 条）
7. 风险点（权限、参数、空态、错误态、主题适配）
8. 是否使用标准筛选模板字段，若没有，原因是什么
9. 是否复用 `readonly` 表单作为详情展示
10. 操作列宽度按哪组可见动作计算
11. 是否覆盖参数非法、权限分支、查询交互三个关键风险点

## 8. Rejection Rules

如果 AI 方案出现以下任一项，视为不合格并重做：

- 新造一个和 template-kit 重复的控制器
- 忽略权限声明
- 忽略 `mode` 参数校验
- 页面只实现 happy path，没有异常/空态
- 表单类型选择没有给出判别依据
- 出现大量硬编码样式且未考虑深色模式
- 普通筛选项使用 `custom` 实现
- 日期范围使用 `custom + RangePicker`
- 基础 CRUD 表单默认关闭必填标识
- 操作列宽度没有固定常量或没有注释说明计算过程
- 只做类型通过，没有验证关键跳转链路
