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
- [ ] 已完成 `tsc`、最少 2 条测试（happy path + edge case）、一轮关键跳转手工点测

## 快速备注

- recipe：
- 是否有业务 override：
- 是否使用 legacy 接口：
- 本次最大风险点：

