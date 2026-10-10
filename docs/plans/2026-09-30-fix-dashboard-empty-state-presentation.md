# 商业仪表盘精简提示与空数据展示

独立有界修复。上游为已完成 CDA 计划与 `2026-09-29-fix-dashboard-template-reuse.md`；沿用其统计合同和共享模板呈现。用户本次明确要求取代仪表盘的常驻解释、无法计算比例文案及空排名占位，不改变产品成员、执行顺序或 REL/master 的权威。

## 范围

- 成功返回空数据的指标显示 0；不可计算的比较项不显示，不补解释文字。
- 移除今天未结束、商品金额口径、采集起始时间等常驻段落，以及重复加载文字。
- 商品销售额与商品访问量排名无数据时隐藏整个排名区域，图表使用完整宽度。
- 真正的请求失败保留简短重试入口；不把请求失败伪装成真实的 0。保留独立请求恢复、币种和日期条件、竞态隔离。
- 用户的本次展示要求优先于通用 loading/empty 文案规范。继续使用已有 Skeleton、Button 和模板组件，不增加状态体系。

## 执行检查点

- U1 页面展示与回归断言：Complete。
- U2 验证与收口：Complete。
- 当前单元：无；下一动作：无。本修复完成，执行正文冻结。
- Tail owner：本修复。原计划正文保持冻结；REL-Pre-DC 产品检查点不变。

## 验证

L2：页面内展示行为变更。运行 dashboard focused tests、变更文件 lint/format、一次 Admin typecheck。隐藏排名改变图表宽度，补现有 Browser Mode 的空排名宽度检查，限定此 suite；不扩大到全量测试、build 或后端探针。

- `bun run test src/pages/dashboard/dashboard.test.tsx`：11/11。覆盖成功空数据四项指标为 0、两类空排名隐藏、无意义比较文案移除，以及独立失败恢复和请求隔离。
- `bun run test:browser src/pages/dashboard/dashboard.browser.test.tsx`：5/5。覆盖真实图表无排名时占满可用宽度、模板使用方、主题、日期及失败重试。
- `bun run typecheck`：通过。
- 三个变更 dashboard 文件的 ESLint、Prettier，以及本计划格式与 `git diff --check`：通过。
- 统计接口、存储、部署及产品主计划无变更；原模板复用修复保留。
