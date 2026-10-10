# 仪表盘无活动空态与日期国际化

独立有界展示改进，上游为已完成 CDA 与模板复用修复。本计划取代 `2026-09-30-fix-dashboard-empty-state-presentation.md` 中完全无活动时仍显示空图表的呈现；保留四张指标卡的真实 0、卡内币种及日期控制，不改变统计接口、产品顺序或 REL/master。

## 展示规则

- 不使用任意的最低订单数或访客数。当前与对比期间的销售、订单、退款、UV/PV 均为 0，且两类商品排名成功返回空数组，才展示空态。
- 有任何有效活动，即使只有一笔订单或一次访问，仍展示仪表盘；历史有活动而本期为 0 仍展示比较。
- 接口失败、未完成加载或部分数据缺失不判定为空态。
- 默认保留顶部指标卡与币种选择，在报表卡内用已有 Ant Design Empty 替换空图表。日期控制继续可用，切换币种或日期能恢复正常展示。
- 文案仅说明当前范围没有活动，不声称数据少就无法计算总量。
- 补齐 Today 中文翻译；日期按钮和下拉使用同一组已翻译标签，避免动态字典查找绕过现有 i18n 检查。

## 执行检查点

- U1 日期国际化：Complete。
- U2 无活动空态与边界：Complete。
- U3 验证与收口：Complete。
- 当前单元：无；下一动作：无。本计划完成，执行正文冻结。
- Tail owner：本计划；既有本地统计迁移修复保持完成，不修改其冻结记录。

## 验证

L2：dashboard 局部展示行为及其翻译键。Today 的应用源代码消费仅在此页，未改动 i18n 基础设施。运行 dashboard focused tests、限定翻译键审计、变更文件 lint/format、一次 Admin typecheck；用现有 Browser Mode 覆盖语言切换及空态日期恢复，并检查实际本地页面。

- `bun run test src/pages/dashboard/dashboard.test.tsx`：16/16。覆盖空态切换与日期恢复、一笔零金额订单、一次访问、仅退款、仅上期活动，以及流量失败时仍保留恢复入口。
- `bun run test:browser src/pages/dashboard/dashboard.browser.test.tsx`：6/6，含空态中保留筛选、动态语言切换无重复请求，以及日期变更恢复真实 ECharts。
- 限定 dashboard-page/dashboard-chart 的现有翻译扫描：35 个消息，缺失键/空翻译/占位符问题均为 0，无未解析动态翻译。
- Admin typecheck、限定变更文件 ESLint/Prettier 和 diff 检查通过。首次 typecheck 发现 jsdom getByRole 不支持 exact 选项；移除该冗余选项（name 默认精确匹配），单测与类型检查复验通过。
- 当前本地真实页面确认：顶部指标为 0、报表区标准 Empty、日期按钮“今天”，无英文 Today、无商品空排名或重试按钮。
- 未增加新的 UI 状态组件或统一配置框架，仍直接使用共享模板与 Ant Design Empty。
