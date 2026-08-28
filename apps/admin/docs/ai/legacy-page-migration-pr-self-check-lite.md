# 旧页迁移 PR 自检模板（10 条必查版）

适用范围：reviewer 或作者在 PR 页快速扫一遍，只查最容易出问题的 10 条。

- [ ] 页面已明确归类到正确 recipe，没有把标准页散装实现
- [ ] 普通筛选项没有使用 `custom`
- [ ] 日期范围没有使用 `custom + RangePicker`
- [ ] 列表查询不是“改筛选就自动请求”，而是点击“查询”后请求
- [ ] 表单没有无依据设置 `requiredMark={false}`
- [ ] 详情优先复用了 `readonly`，没有无理由单独造 detail page
- [ ] 编辑/查看/详情路由遵守“列表路径前缀 + 子路径”
- [ ] `Navigate / useNavigate` 只从 `react-router-dom` 引入
- [ ] 操作列宽度已按“可见动作集合”计算，并写了注释
- [ ] 已按 `docs/testing-standards.md` 选择 `L0-L4` 并完成对应 focused checks：迁移行为仍覆盖 happy path、edge case 和关键跳转；`L3` 已用引用与 workspace/package 依赖证据界定影响，无法界定才升 `L4`；最终 typecheck/build 不重复，必要 Browser Mode/E2E 与“先构建候选”要求未弱化

## 快速备注

- recipe：
- 是否有业务 override：
- 是否使用 legacy 接口：
- 本次最大风险点：
- 验证等级、理由与结果：
