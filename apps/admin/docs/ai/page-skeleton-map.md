# 页面骨架地图

## 1. 目标
这份文档用于回答一个实际问题：
- 当前仓库里的页面，分别该接入哪一类骨架？
- 哪些页面应该优先复用 recipe？
- 哪些页面当前应保留为 `business override`？

它是 `docs/ai/page-recipes.yaml` 与 `docs/ai/page-guardrail-recipes.md` 的执行索引，帮助在真正开始写代码前先选对路径。

## 2. 总览

| 页面类型 | 当前路径 | 推荐接入路径 | 当前状态 |
| --- | --- | --- | --- |
| 标准查询列表页 | `src/pages/templates/list/table-query-page.tsx` | `StandardListPageRecipe` | 已接入 |
| 基础三态表单页 | `src/pages/templates/form/basic-form-page.tsx` | `BasicCrudFormRecipe` | 已接入 |
| 分步表单页 | `src/pages/templates/form/step-form-page.tsx` | `StepFormRecipe` | 已接入 |
| 高级表单页 | `src/pages/templates/form/advanced-form-page.tsx` | `business override` | 明确保留特例 |
| 默认详情展示 | 优先复用 `readonly` 表单 | `BasicCrudFormRecipe` readonly | 推荐默认路径 |
| 特殊详情页 | `src/pages/templates/profile/basic-profile-page.tsx` | `business override` 或后续 `ProfileRecipe` | 暂不抽象 |
| 自定义/业务 override 一级页 | `src/pages/templates/list/list-prompt-generator-page.tsx` | `CustomPageRecipe` | 已接入页头壳 |
| 结果页 | `src/pages/templates/dashboard/result-*.tsx` | 页面级模板直接复用 | 暂不 recipe 化 |
| 异常页 | `src/pages/templates/exception/*.tsx` | 页面级模板直接复用 | 暂不 recipe 化 |
| 仪表盘/分析页 | `src/pages/templates/dashboard/analysis-page.tsx` | `business override` | 暂不 recipe 化 |

## 3. 列表页

### 3.1 标准查询列表页
推荐路径：`StandardListPageRecipe`

适用条件：
- 页面核心是“筛选 + 表格 + 分页 + 状态反馈”
- 查询仅在点击“查询”后触发
- 空态、错误态、部分成功态有统一出口
- 查看/编辑/新增跳转可按“列表路径前缀 + 子路径”组织

参考页面：
- `src/pages/templates/list/table-query-page.tsx`

优先复用：
- `src/shared/template-kit/recipes/standard-list-page-recipe.tsx`
- `src/shared/template-kit/specs/standard-list-page-spec.ts`
- `src/shared/template-kit/list/*`

不要这样做：
- 在业务页重新拼 `filter + toolbar + state + table`
- 为了单页差异给 recipe 增加无边界 slot

## 3.5 自定义/业务 override 一级页
推荐路径：`CustomPageRecipe`

适用条件：
- 页面挂在一级路由下，但不符合标准列表、基础表单或分步表单
- 页面需要内容区主标题，并且标题应默认跟随 route `title`
- 页面内容布局需要业务自定义，但页头、外层间距和标题来源应统一

参考页面：
- `src/pages/templates/list/list-prompt-generator-page.tsx`

优先复用：
- `src/shared/template-kit/recipes/custom-page-recipe.tsx`
- `src/shared/layout/route-page-meta-context.tsx`
- `src/shared/layout/app-shell.tsx`

必须满足：
- 面包屑仍只由 `AppShell` 渲染
- 不在页面内散装手写与 route `title` 同义的 `Typography.Title`
- 首个主 `Card title` 只表达内容分区，不重复页面主标题

## 4. 表单页

### 4.1 基础三态表单页
推荐路径：`BasicCrudFormRecipe`

适用条件：
- 页面具备 `add / modify / readonly`
- 详情默认可复用 `readonly` 表单
- 主体是同一套字段结构

参考页面：
- `src/pages/templates/form/basic-form-page.tsx`

优先复用：
- `src/shared/template-kit/recipes/basic-crud-form-recipe.tsx`
- `src/shared/template-kit/specs/basic-crud-form-spec.ts`
- `src/shared/template-kit/form/*`

必须满足：
- 非法 `mode/id` 参数首层错误态
- `readonly` 禁用提交且行为硬阻断
- 底部固定操作条只在可编辑模式展示

### 4.2 分步表单页
推荐路径：`StepFormRecipe`

适用条件：
- 自然分为 2-5 个阶段
- 后续步骤依赖前一步数据确认
- 想统一页头、步骤条、操作区，但不想抽走业务状态机

参考页面：
- `src/pages/templates/form/step-form-page.tsx`

优先复用：
- `src/shared/template-kit/recipes/step-form-recipe.tsx`
- `src/shared/template-kit/specs/step-form-spec.ts`

边界说明：
- recipe 只负责步骤壳子
- 页面自己保留 `currentStep`、`goNext`、步骤前校验和完成态数据

### 4.3 高级表单页
推荐路径：`business override`

当前样本：
- `src/pages/templates/form/advanced-form-page.tsx`

命中特征：
- 多卡片业务区
- `Form.List` 动态字段块
- 跨区错误汇总
- 复杂操作区与局部状态

当前规则：
- 第一阶段不抽 `AdvancedFormRecipe`
- 至少出现 3 个稳定样本前，不做整页骨架抽象
- 优先复用字段块与局部组件能力，例如 `SortActionGroup`

## 5. 详情页

### 5.1 默认详情路径
推荐路径：优先复用基础表单 `readonly`

适用条件：
- 展示结构与编辑结构基本同构
- 只是“查看记录”，不是复杂聚合详情

推荐做法：
- 直接走 `BasicCrudFormRecipe` 的 `readonly` 模式
- 不额外新建 profile 页面

### 5.2 特殊详情页
当前样本：
- `src/pages/templates/profile/basic-profile-page.tsx`

适用条件：
- 大量只读聚合信息
- 结构与编辑表单明显不同
- 需要 Descriptions / Table / 进度信息等复合展示

当前结论：
- 暂不抽 `ProfileRecipe`
- 默认按 `business override` 处理

## 6. 结果页

当前样本：
- `src/pages/templates/dashboard/result-success-page.tsx`
- `src/pages/templates/dashboard/result-fail-page.tsx`

推荐路径：页面级模板直接复用

原因：
- 结构较轻
- 差异主要是文案和返回动作
- 当前没有必要再包一层 recipe

## 7. 异常页

当前样本：
- `src/pages/templates/exception/forbidden-page.tsx`
- `src/pages/templates/exception/server-error-page.tsx`
- `src/pages/templates/exception/not-found-page.tsx`

推荐路径：页面级模板直接复用

原因：
- 结构单一
- 关键在于状态文案与回退动作
- recipe 收益较低

## 8. 仪表盘与分析页

当前样本：
- `src/pages/templates/dashboard/analysis-page.tsx`

推荐路径：`business override`

原因：
- 卡片、图表、统计区、排行区高度组合化
- 布局结构与标准列表/表单骨架差异很大
- 当前没有第二个稳定样本支撑抽象

## 9. 快速决策

新页面接入前，先问自己这 7 个问题：
1. 它是不是“筛选 + 表格 + 分页”的标准列表？
2. 它是不是 `add / modify / readonly` 同构表单？
3. 它是不是自然拆成 2-5 步的分步表单？
4. 它的详情能不能直接复用 `readonly` 表单？
5. 它是不是只有结果反馈，不需要复杂状态机？
6. 它是不是标准异常页？
7. 它是不是一级业务 override / 自定义页，需要 `CustomPageRecipe` 承载标题？
8. 如果都不是，它大概率应先归入 `business override`。

## 10. 当前稳定基线
当前仓库已稳定的骨架基线：
- `StandardListPageRecipe`
- `BasicCrudFormRecipe`
- `StepFormRecipe`
- `CustomPageRecipe`

当前明确保留特例的页面类型：
- 高级表单页
- 特殊详情页
- 仪表盘/分析页

后续只有在“样本数量 + 错误模式 + 跨域复用”都满足晋升规则后，才继续抽新的 recipe。
