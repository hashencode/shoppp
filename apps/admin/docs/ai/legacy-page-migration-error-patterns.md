# Legacy Page Migration Error Patterns

本文记录迁移时高频出错点，用于方案评审和 PR 自检。

## 1. 查询触发漂移

症状：筛选项一变化就请求，或重置后分页/筛选状态不同步。

处理：
- 标准列表接入 `useTemplateListController`
- 筛选变更只更新本地 filter state
- 查询按钮提交后才触发请求，重置走 `resetAll`

## 2. 请求竞态

症状：快速切换筛选或刷新时，旧请求覆盖新请求。

处理：
- 使用模板请求控制器或 `useLatestRequest`
- 只让最后一次请求写入页面状态
- refresh/reload 需要明确 loading 与错误归属

## 3. 重置不完整

症状：表单字段已重置，但树、搜索关键字、分页、临时缓存仍保留旧值。

处理：
- 表单页使用 `useDynamicFormReset` 或显式 `resetAll`
- 列表页重置需覆盖 filter、pagination、selection、临时状态
- 每个复杂局部状态都要进入迁移对照清单

## 4. 权限分层混乱

症状：页面可进但按钮误显，或只读模式仍能触发写操作。

处理：
- 页面级权限使用 `PermissionKey`
- 按钮级权限在 action spec 或页面逻辑中单独表达
- `readonly` 必须 UI 禁用且行为硬阻断

## 5. 操作列宽错误

症状：行操作换行、表格横向跳动，或操作列仍沿用旧折叠宽度导致全部直出后空间不足。

处理：
- 按 `docs/ai/list-column-width-rules.md` 计算固定列宽
- 按同一行全部可见直出按钮集合计算
- recipe 内使用 `resolveActionColumnWidth` 适配表格密度

## 6. 路由前缀丢失

症状：从列表跳转表单后左侧菜单高亮丢失。

处理：
- 编辑/查看/新增路径使用“列表路径前缀 + 子路径”
- `navigate`、`window.open`、表单导航 helper 的目标路径保持同前缀

## 7. 复杂字段降级

症状：来源页是远程搜索或树选择，新页被简化成普通输入，导致回填或提交语义变化。

处理：
- 远程搜索优先使用 `RemoteSearchSelect`
- 树或级联选择优先使用 Ant Design 原生组件和结构化 adapter
- 无法等价迁移时，标注 `business override`，不要沉淀为 starter 通用组件

## 8. 验证只覆盖 happy path

症状：类型通过但错误态、空态、权限态没有验证。

处理：
- 每个迁移页至少覆盖 happy path + 失败或边界路径
- 涉及权限时至少点测有权限与受限账号
- 涉及路由参数时必须覆盖非法参数态

## 9. 写动作请求合同误判

症状：启用/禁用、状态切换、审核、绑定、过滤等按钮能点，但接口报参数缺失、校验失败，或保存后丢字段。

处理：
- 先确认旧页请求体是完整对象更新还是局部 patch。
- 对每个非表单写动作冻结 `endpoint / method / payload 来源 / 状态值映射 / 成功判定`。
- 至少补一条测试断言请求体字段集合，避免把完整对象保存接口误迁成 `{ id, status }`。

## 10. 核心动作存在性被主键/条件混绑吞掉

症状：页面能打开、权限也对，但删除、编辑、营销设置、审核等关键按钮直接消失；常见于列表行只有 `questionId/modelId/orderId` 没有通用 `id`，或旧页允许局部记录、`uploadFlag` 等 legacy 可空字段缺失时仍展示动作的场景。

处理：
- 核心动作默认先按权限、模式和旧页条件决定展示，再在执行阶段消费业务主键或 fallback key。
- 不要把 `visible`、`disabled`、`execute key` 混成同一条判断，也不要把 `record.id`、`typeof uploadFlag === 'number'` 直接当作动作展示前提。
- 至少补一条“缺少通用 `id` 但业务主键存在时动作仍可见/可执行”或“legacy 可空字段缺失但旧页仍显示动作”的回归测试。

## 11. 标题来源漂移

症状：外层已显示页面名，内容区或首个 Card 又重复同名标题；或测试为了证明页面加载成功，反向要求保留重复标题。

处理：
- 先确认主标题来源：标准一级列表页走 `StandardListPageRecipe.pageTitle`，一级业务 override / 自定义页走 `CustomPageRecipe` 默认读取 route title，二级表单页走 `PageHeaderWithBack`。
- `Card title` 只表达内容分区。
- 测试改断言业务内容、关键控件或状态块，不用页面主标题证明加载成功。

## 12. 局部校验被误迁成局部提交

症状：页面保存成功，但未参与必填校验的普通字段、隐藏主键或上传字段没有进入请求，编辑后表现为字段不更新、被清空或回退到旧值。

处理：
- 分别冻结旧页的“校验字段集合”和“实际提交对象”，不要根据校验 API 的返回形态推断提交合同。
- 旧页 `validateField(nameList)` 后若提交完整 `formData`，新页应先执行局部校验，再读取完整 form store 组装 payload。
- 禁止直接把 `validateFields(nameList)` / `validateFieldsWithScroll(form, nameList)` 的返回值当完整 payload，除非接口合同明确是局部 patch。
- 补充请求 payload 全字段精确断言，并覆盖局部校验失败时不发送请求。
