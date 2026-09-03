# 后台页面防错骨架接入规范（第一期）

## 1. 文档定位

### 1.1 目标
这份文档用于约束当前项目的标准后台页如何优先复用 `recipe + spec + contract`。

第一期先收敛三类页面：
- 标准查询列表页
- 弹窗内轻量列表
- 基础三态表单页（`add / modify / readonly`）
- 分步表单页
- 一级业务 override / 自定义页的页头外壳

### 1.2 适用范围
- 页面类型：标准查询列表页、基础三态表单页、分步表单页、一级业务 override / 自定义页
- 技术基线：`src/shared/template-kit/*`
- 当前 recipe：
  - `StandardListPageRecipe`
  - `ModalListPageRecipe`
  - `BasicCrudFormRecipe`
  - `StepFormRecipe`
  - `CustomPageRecipe`

### 1.3 非适用范围
以下场景默认判定为 `business override`，暂不强行进入第一期标准骨架：
- 重交互工作台或复杂聚合页
- 依赖复杂字段能力块的页面（如权限树、复杂弹窗选择器、强动态字段）
- 请求源显著超出标准列表/表单生命周期的页面
- 布局层级明显突破标准骨架的页面
- 仅出现一次的高级动态表单页（例如动态成员表、跨卡片错误汇总、复合工具条）

## 2. 第一阶段架构

```text
业务页
  -> spec
  -> recipe
  -> template-kit 底座
  -> route / permission / api contracts
```

分层职责：
- `spec`：声明当前页面的结构化接入对象
- `recipe`：固化标准页布局、状态、权限和请求生命周期
- `template-kit` 底座：承载 controller、state gate、navigation 等基础能力
- `business override`：显式承接第一期 recipe 之外的特例逻辑

## 3. 可用 recipe

### 3.1 `StandardListPageRecipe`
适用于：
- 标准查询列表页
- 筛选区 + 内容区 + 状态反馈 + 权限动作结构稳定的页面

必须固化的模块：
- `filter`：统一筛选区；筛选变化不自动请求，只在点击“查询”后触发
- `content`：统一标题、卡片、工具栏、表格、分页；工具栏中的列设置面板由底座统一渲染，业务页只传结构化列配置；筛选动作顺序固定为“搜索设置 → 重置 → 查询”，内容工具顺序固定为“可见业务动作 → 条件分隔线 → 刷新 → 密度 → 列设置”
- `feedback`：统一 `loading / empty / error / partial`
- `permission`：页面级 permission 与按钮级动作分层

### 3.2 `BasicCrudFormRecipe`
适用于：
- `add / modify / readonly` 共用一套表单结构
- 详情默认复用 `readonly` 表单展示

必须固化的模块：
- `content`：统一页头、主卡片、字段区、固定底部操作条
- `feedback`：统一参数错误态、详情错误态、提交成功/失败反馈、只读阻断
- `permission`：`read / write` 与 `add / modify / readonly` 模式映射

校验滚动：
- 通过 `BasicCrudFormRecipe` 标准 submit 提交时已内建首个错误字段滚动，业务页面无需额外处理
- 自定义操作栏、分字段保存等流程若直接调用 `form.validateFields()`，必须改用 `validateFieldsWithScroll(form, ...fields)`，避免绕过 Form 的 `onFinishFailed / scrollToFirstError`
- 短表单、Modal 或局部表单不默认强制滚动；确有长内容和滚动容器时再显式复用共享工具

内容宽度：
- 默认不传 `contentWidthPreset`，等同 `compact` 窄栏单列基线，最大宽度 800px
- 富文本不单独触发 `wide`；单 Card 内容命中单行表单项超过 3 个的动态表单、多层级动态表单、或列数大于等于 4 个的列表时，才可显式声明 `wide`，最大宽度 1200px
- `full` 不设置最大宽度，仅用于工作台、编排器、矩阵、画布、超宽批量编辑等 `wide` 仍明显影响操作效率的模块，必须特殊声明
- preset 无法表达的特例才使用 `maxWidthClassName`，并在实现说明中写明原因
- 普通单列编辑页字段控件默认填满表单内容列，禁止用字段级固定宽度替代模板内容宽度
- 多 Card 表单页保持外层 Card 全宽；宽度 preset 按每个 Card 独立判断，只作用于 Card body 或 Card 内表单内容容器，不作用于包裹多个 Card 的 Form 根节点
- 自定义内容容器、Card body 或模板页若手动控制宽度，必须复用 `FORM_CONTENT_ALIGN_CLASS_NAME` / `FORM_CARD_BODY_WIDTH_CLASS_NAME`，不得手写 `mx-auto` 或左右 margin 覆盖用户的表单对齐偏好

### 3.3 `ModalListPageRecipe`
适用于：
- 弹窗内承载的轻量列表
- 需要标准筛选、分页、表格状态，但不需要整页标题/路由壳子的列表

必须固化的模块：
- `filter`：复用标准筛选字段和查询/重置行为
- `content`：统一表格、分页、空态、错误态
- `density`：固定使用 Ant Design `middle` 标准表格密度
- `pagination`：复用 `buildModalListTableProps`，在列表左下角展示“共 N 条数据”
- `position`：遵守通用 Modal 合同，数值宽度大于等于 `1000px` 时复用 `buildStandardModalProps`，统一设置 `top: 24px`

复杂选择器或跨多步状态机若判定为 business override，只是不接入完整 recipe；表格密度与分页总数仍必须复用 `src/shared/template-kit/list/modal-list-rules.ts`，宽弹窗位置复用 `src/shared/template-kit/standard-modal-rules.ts`。
独立无分页 Modal 表格至少复用 `MODAL_LIST_TABLE_SIZE`，不得回退为 `small`。

不适用于：
- 需要独立路由、页面权限和主工具栏的完整列表页
- 复杂选择器或跨多步状态机的业务弹窗

### 3.4 `StepFormRecipe`
适用于：
- 自然分为 2-5 个阶段的分步表单页
- 后续步骤依赖前一步数据确认

必须固化的模块：
- `content`：统一页头、步骤条、表单容器、阶段操作区
- `feedback`：统一步骤切换与完成态承载区
- `flow`：仅收敛步骤骨架，不隐式接管业务状态机

### 3.5 `CustomPageRecipe`
适用于：
- 一级路由下的业务 override / 自定义页
- 工作台、生成器、复杂组合页等不适合 `StandardListPageRecipe` 的页面
- 需要内容区主标题，但不应在页面内散装手写 `Typography.Title` 的页面

必须固化的模块：
- `content`：统一外层间距、内容区主标题和可选右侧扩展操作
- `route meta`：默认从 `AppShell` 注入的当前 route title 获取标题
- `breadcrumb`：只读取 route meta 供页面判断，不负责渲染；面包屑仍由 `AppShell` 统一渲染

可用 slot：
- `title`：覆盖默认 route title
- `titleHidden`：用于嵌入式或特殊场景隐藏内容区主标题
- `extra`：承载页头右侧操作
- `onBack`：需要返回动作时复用 `PageHeaderWithBack`

### 3.6 高级表单页（当前不进入第一期 recipe）
适用于：
- 动态字段块较多
- 页面同时包含多卡片业务区、跨区错误汇总、动态表格编辑或复杂联动

当前结论：
- 第一阶段不提供 `AdvancedFormRecipe`
- 统一按 `business override` 处理

原因：
- 当前仓库只有一个高级表单样本，未达到“至少出现 3 次”的晋升条件
- 差异主要来自业务状态与动态字段能力，而不是单纯页面壳子
- 过早抽象容易把复杂度转移到一层看似通用、实际不稳定的 recipe 上

## 4. spec 接入规则

### 4.1 只允许结构化 spec，不允许散装 props
标准页接入必须通过：
- `StandardListPageSpec`
- `BasicCrudFormSpec`

禁止做法：
- 直接在业务页重复拼装 `controller + state + toolbar + table + action bar`
- 为了临时接入，在 recipe 上继续堆大量无边界 props

### 4.2 有限 slot，禁止通用逃生口
第一期仅允许语义明确的 slot，例如：
- `toolbarExtra`
- `renderAfterContent`
- `renderAfterForm`

禁止做法：
- `renderAnything`
- `beforeRender`
- `afterRenderEverything`
- 大范围 `customNode` 注入

如果页面差异已经超出有限 slot，可直接判定为 `business override`。

## 5. 第一阶段 contract

### 5.1 状态反馈 contract
标准页必须统一承接这些状态：
- 列表页：`loading / empty / error / partial`
- 表单页：参数错误、详情加载错误、提交成功/失败、只读阻断

要求：
- 状态文案必须页面语义化
- 状态必须带恢复动作，不能只显示提示

### 5.2 权限 contract
统一分层：
- 页面级权限：`PermissionKey`
- 按钮级权限：业务动作自行声明
- 表单模式权限：`readonly -> read`，`add/modify -> write`
- 按钮权限必须以后端按钮权限契约为依据；没有按钮 ID、`isBtn` 或等价后端按钮权限数据时，不得按“写操作”或 `*.write` 自行推导按钮隐藏/禁用。
- 若后端按本项目契约明确页面内没有按钮权限控制（例如按钮权限列表为空、无按钮权限字段、或约定的空值语义），前端默认不额外增加页内按钮权限控制。

禁止做法：
- 在页面里叠加拍脑袋 role 判断覆盖旧逻辑
- 同一按钮同时依赖多套无文档约束的权限口径
- 在缺少后端按钮权限依据时，用本地 `*.write`、路由写权限或操作语义推导页面内按钮权限。

### 5.3 `resetAll contract`
重置必须是整页状态重置，而不是只做 `form.resetFields()`。

至少要覆盖：
- 表单字段
- 分页状态
- 临时筛选状态
- 已接入 recipe 的状态块
- 页面额外挂载的复杂组件状态

### 5.4 请求生命周期 contract
第一期 recipe 只允许显式请求源：
- initial load
- query submit
- resetAll reload
- detail fetch
- save submit
- explicit refresh

禁止 recipe 隐式新增请求源。

### 5.5 标题来源 contract
页面主标题只保留一个来源：
- 标准一级列表页：由 `StandardListPageRecipe.pageTitle` 承载，并与 route `title` 保持同义。
- 一级业务 override / 自定义页：由 `CustomPageRecipe` 承载内容区主标题，默认读取 `AppShell` 注入的当前 route title。
- 二级、表单、详情、子列表页：通过 `PageHeaderWithBack` 承载标题与返回动作。

面包屑只允许由 `AppShell` 统一渲染。禁止在页面内容区再散装手写与 route/title 同义的 `Typography.Title`，也不要给首个主 `Card` 设置同义标题造成双主标题。`Card title` 只用于表达内容分区，例如“基本信息”“列表明细”。

面包屑显示规则统一由 `AppShell` 根据 route contract 决定，不允许页面各自打补丁：

- 独立一级菜单入口（`inMenu: true` 且 `menuMode: 'standalone'`）不显示面包屑；即使历史配置包含业务分类词，也不把分类词当作真实导航层级。
- 不足两级的面包屑不显示。真实分组导航、二级/表单/详情页保留多级面包屑。
- 使用路由匹配器解析静态与参数化路径，确保详情页读取自己的 title/breadcrumb；隐藏面包屑不删除页面可读取的 route meta。
- 新增页面遵循同一规则，并由共享布局测试保障；不得增加单页隐藏开关或在内容区重新渲染。

## 6. 晋升规则
只有满足以下条件，能力才允许从业务特例晋升到 recipe 或后续 field block：
- 至少出现 3 次
- 错误模式稳定重复
- 跨业务域可复用

不满足时，保持业务特例实现，不要为了“看起来通用”提前上升抽象。

当前明确保留为 `business override` 的样本：
- `src/pages/templates/form/advanced-form-page.tsx`

## 7. 接入清单

### 7.1 标准列表页
- [ ] 已确认页面属于标准查询列表页，而不是特例工作台/复杂聚合页
- [ ] 业务页通过 `StandardListPageSpec` 接入
- [ ] 页面内容区未重复渲染与 route `title` 同义的主标题或主 `Card title`
- [ ] 查询只在点击“查询”后触发
- [ ] 搜索设置位于重置和查询之前，刷新显示图标和文本，业务动作可见时才显示工具栏分隔线
- [ ] `empty / error / partial` 都有统一出口
- [ ] 新增/编辑/查看跳转保持同前缀路由
- [ ] 重置走统一 `resetAll`

### 7.1.1 弹窗内轻量列表
- [ ] 已确认列表不需要独立路由和整页布局
- [ ] 业务页通过 `ModalListPageRecipe` 接入
- [ ] 筛选、分页、空态、错误态与整页列表保持一致
- [ ] 表格通过 `buildModalListTableProps` 使用 `middle` 标准密度并在左下角展示总数
- [ ] 独立无分页 Modal 表格至少复用 `MODAL_LIST_TABLE_SIZE`
- [ ] 数值宽度大于等于 `1000px` 的 Modal 通过 `buildStandardModalProps` 设置 `top: 24px`
- [ ] 操作列宽度按弹窗内直出动作集合计算

### 7.2 基础表单页
- [ ] 已确认页面属于 `basic` 表单，而不是 `step / advanced`
- [ ] 业务页通过 `BasicCrudFormSpec` 接入
- [ ] 已使用 `PageHeaderWithBack` 承载页头，主 `Card title` 未重复页头文案
- [ ] `mode/id` 参数错误有首层可见错误态
- [ ] `readonly` 模式禁用提交且行为硬阻断
- [ ] 底部固定操作条只在可编辑模式展示
- [ ] 提交成功/失败反馈统一
- [ ] 标准 submit 校验失败时由 Recipe 自动滚动并聚焦首个错误字段
- [ ] 手动校验长表单时使用 `validateFieldsWithScroll`，未在页面内重复实现滚动逻辑
- [ ] 重置走统一 `resetAll`

### 7.3 分步表单页
- [ ] 已确认页面属于 `step` 表单，而不是 `basic / advanced`
- [ ] 业务页通过 `StepFormSpec` 接入
- [ ] 步骤数量控制在 2-5 个自然阶段
- [ ] 步骤切换前校验与确认逻辑保持页面语义
- [ ] 完成态与返回动作保持可见

### 7.4 高级表单页（business override）
- [ ] 已确认页面不适合 `basic / step`，且确实命中动态字段或复杂联动条件
- [ ] 动态表单中的“上移/下移/删除/编号”复用 `SortActionGroup`
- [ ] 重置行为覆盖字段与复杂局部状态
- [ ] 跨区错误汇总与字段校验信息保持一致
- [ ] 未为单页特例新增无边界通用 recipe

### 7.5 一级自定义页（business override）
- [ ] 已确认页面不适合标准列表、基础表单或分步表单
- [ ] 页面通过 `CustomPageRecipe` 承载内容区标题，未散装手写同义 `Typography.Title`
- [ ] 标题默认来自 route title；仅在业务确有不同表达时传 `title` 覆盖
- [ ] 页面内容区未重复渲染面包屑
- [ ] 首个主 `Card title` 未重复页面主标题

## 8. 红线
1. 不要把重特例页硬塞进第一期标准 recipe。
2. 不要为临时页面差异新增无边界通用逃生口。
3. 不要让业务页继续重复实现状态区、固定操作条、基础导航规则。
4. 不要在 recipe 中隐式新增请求。
5. 不要把一次性 workaround 直接升级为长期平台规则。
