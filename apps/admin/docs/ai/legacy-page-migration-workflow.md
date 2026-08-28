# Legacy Page Migration Workflow

适用范围：把其他后台系统的页面迁移到本 starter 时使用。目标是迁移可复用经验与稳定行为，不迁移来源项目的业务资产。

## 1. Authority Order

迁移前按顺序读取：

1. `docs/ai/README.md`
2. `docs/ai/ai-rules.md`
3. `docs/ai/page-recipes.yaml`
4. `docs/ai/component-catalog.yaml`
5. `docs/testing-standards.md`
6. 当前页面类型对应的专项规则：
   - 列表页：`docs/ai/list-migration-rules.md`
   - 表单页：`docs/ai/form-migration-rules.md`

如果规则冲突，以更具体的页面类型规则为准；若页面规则与源码事实冲突，以源码事实为准，并在方案中说明取舍。

## 2. Source Audit

开始编码前先产出迁移对照清单：

- 来源路由、目标路由、菜单入口
- API 入参、响应结构、成功判定口径、错误码
- 页面权限、按钮权限、只读/可写分支
- 筛选字段、表格列、行操作、批量操作
- 动作矩阵快照：列表头、行内、只读态、子页四类动作分别记录 `visible 条件 / disabled 条件 / 执行主键 / fallback 主键 / 确认语 / 打开方式`
- 表单字段、校验、回填、提交组装、重置范围
- 每个表单保存/提交动作的 `校验范围 / 提交值来源 / payload 字段集合`；必须明确校验是全量还是字段清单，提交值来自校验返回值、完整 form store 还是详情合并，禁止默认把“校验范围”等同于“提交范围”
- 写动作请求合同：删除、启用/禁用、状态切换、审核、绑定、过滤等非表单写动作分别记录 `endpoint / method / payload 来源 / 完整对象更新还是局部 patch / 状态值映射 / null 与 undefined 处理 / 成功判定`
- 默认态三层合同：同一默认值分别在“用户首屏看到什么”“组件/表单内部持有什么值”“请求 payload 实际发什么”三层如何表达
- `loading / empty / error / partial` 等状态
- 脏数据与未知枚举兜底：`data=null / records=null / 只回 ID 不回名称 / 新枚举值` 等场景如何展示
- 需要保留的旧行为，以及不迁移的来源项目特例

没有完成对照清单时，不进入实现。

## 3. Fit Decision

优先选择已有 recipe：

- 标准查询列表：`StandardListPageRecipe`
- 弹窗内列表或轻量选择列表：`ModalListPageRecipe`
- 三态基础表单：`BasicCrudFormRecipe`
- 分步表单：`StepFormRecipe`

默认不迁移来源项目的：

- 品牌、菜单树、业务路由命名
- 业务 API 路径和业务枚举常量
- 强业务页面、强业务 mock、强业务权限 key
- 单一业务域的重字段组件和媒体能力

只有当能力满足“跨业务域可复用、错误模式稳定、starter 本身需要”三项条件，才允许沉淀到 `src/shared/*`。

## 4. Implementation Order

1. 先补类型与 API adapter，明确 request/response contract。
2. 再接入 route 与 permission，占位后再写页面。
3. 列表页先接 controller/filter/content/pagination，再接行操作和工具栏。
4. 表单页先接 mode/id 校验和 state gate，再接字段、回填、提交、重置。
5. 最后处理文案、列宽、主题、测试和手工点测。

旧页若先用 `validateField(nameList)` 只校验部分字段，再提交完整 `formData`，新页必须保留这两个独立动作：先完成局部校验，再从完整 form store 读取提交值。禁止直接把 `form.validateFields(nameList)` 的返回值作为完整 payload；只有旧接口明确是局部 patch 时，才允许提交字段子集。

非表单写动作必须先确认旧页是完整对象更新还是局部 patch；旧页若通过完整详情对象更新单个状态，新页不得简化成只提交状态字段，除非已有后端合同证明接口支持 patch 语义。

核心业务动作的 `visible` 默认先看权限、模式和旧页条件，`execute key` 再单独处理兼容与兜底；不能因为某条记录缺少通用 `id` 或 legacy 可空字段缺失，就把删除、编辑、营销设置、审核等动作整体隐藏。

不要为了迁移速度绕过 recipe；如果 recipe 不适合，明确标注为 `business override` 并说明原因。

## 5. Verification

先按 `docs/testing-standards.md` 选择并记录 `L0-L4`，再执行该等级要求；迁移并不自动等于全量
Admin 或 monorepo 验证。普通单页迁移通常从 `L2` 开始，共享 recipe、共享组件或跨页面合同变更
通常按 `L3`；只有发布收口、依赖/构建链升级、用户明确要求、无法用 import/reference 与
workspace/package 依赖证据界定影响范围，或项目明确要求的批次/PR closeout 才升级到 `L4`。

无论选择哪个行为变更等级，迁移验证都必须覆盖：

- 页面或 hook 的 focused happy path 测试
- 至少 1 条失败或边界测试
- 关键跳转链路手工点测
- 权限分支检查：有页面权限、无按钮权限、只读模式
- 核心动作存在性检查：删除、审核、导出、营销设置等动作不能因主键缺失、条件混绑或 legacy 可空字段缺失而误隐藏
- 动态表格、远程下拉、上传、富文本等复杂交互至少点测一次“能打开、能选择/写回、无运行时报错”
- 表单保存测试必须按旧接口完整保存合同严格断言实际请求 payload 的完整字段集合，优先使用 `toEqual` 或等价的精确白名单断言，不能只抽查代表字段；存在局部校验时，必须证明页面实际存在且未参与校验的普通字段、隐藏字段和上传字段仍被提交，并覆盖校验失败时不发送请求

typecheck、Browser Mode、E2E、全量测试和 build 是否执行由所选等级决定。代码稳定后只运行该
等级要求的最终检查一次；`build:test` 或 `build:production` 已包含 `tsc -b` 时不再单独
typecheck，较广检查已覆盖较窄检查时不重复执行。涉及真实浏览器行为、登录、跨页面、权限链路
或发布门禁时，仍按 `docs/testing-standards.md` 保留 Browser Mode/E2E；选择 E2E 时仍须先按
Admin 的 Playwright 合同构建候选，不得用较低等级规避。

迁移完成标准是“行为清单通过”，不是“页面能打开”。
