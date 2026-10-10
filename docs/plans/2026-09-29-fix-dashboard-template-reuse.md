# 商业仪表盘复用模板 UI

独立有界修复；用户要求纠正 CDA 页面重新设计 UI 的偏差。上游范围为已完成的 `2026-09-29-2128-feat-commerce-dashboard-analytics-plan.md`；本修复仅拥有模板呈现复用，不改变产品顺序、REL/master、统计语义或部署范围，不重新打开其冻结执行正文。

## 范围

- 从现有 analysis 模板提取指标卡、主卡、图表和排名序号呈现，模板与正式页共同引用。
- 正式页沿用模板卡头、Statistic、分隔线、圆角柱图、区域/柱状迷你图、日期区和排名布局。
- 保留真实数据、UV/PV区别、卡内币种、日期与请求竞态、加载/失败/空状态。财务指标不能用模板演示进度百分比替代。
- 不增加通用仪表盘配置框架。

## 验证与执行检查点

L3：共享呈现仅由 AnalysisPage 与 DashboardChart/DashboardPage 消费。受影响 suite 为 dashboard.test.tsx 与 dashboard.browser.test.tsx（增加原模板使用方 smoke）；浏览器覆盖桌面/窄屏、图表 resize、日期和主题，最后一次 Admin typecheck及限定文件 lint/format。

- U1 复用模板呈现：Complete。
- U2 使用方回归与收口：Complete。
- 当前单元：无；下一动作：无。本修复完成，执行正文冻结。
- 结果：dashboard 单测11/11；桌面和390px窄屏Browser Mode各4/4（含原模板使用方）；Admin typecheck、限定变更代码文件ESLint、格式及diff检查通过。
- 初次模板smoke发现原模板仅导入useState而测试JSX模式需要React标识；补齐标准React导入后两种浏览器上下文均通过。
- 实际使用方：AnalysisPage直接引用四个共享呈现组件；DashboardPage引用卡片和排名，DashboardChart仅负责金额/语言格式并调用共享AnalysisChart。未修改API、统计口径或数据存储。
- Tail owner：本修复；无产品主计划状态变化。
