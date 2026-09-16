# List Column Width Rules

适用范围：后台列表页的操作列和关键标识列。

## 1. Core Rule

操作列宽度必须在开发阶段按“同一时刻可见的按钮集合”计算并固化。每个动作声明固定 `contentWidth`，页面枚举可达组合；禁止依赖运行时测量撑开列宽。

所有可见动作直接展示；不得用“更多”聚合规避宽度合同。

## 2. Calculation

默认口径：

- 每个中文字符按 `14px`
- 2 字按钮按 `28px`
- 4 字按钮按 `56px`
- 相邻按钮分隔占位按 `17px`
- 额外余量默认 `16px`
- 最终列宽上限 `280px`

公式：

```text
sum(contentWidth) + 17 * (visibleButtonCount - 1) + densityPadding
```

示例：

- `查看` 正文：`28`
- `编辑 + 删除` 正文：`28 * 2 + 17 = 73`
- `查看 + 编辑 + 删除` 正文：`28 * 3 + 17 * 2 = 118`
- 最终列宽由正文预算加当前表格密度 padding 求得；单行超过上限时按原顺序选择最均衡的连续双行切点

## 3. Code Requirements

- 常量建议拆为 `ACTION_CONTENT_WIDTHS` 与 `ACTION_COMBINATIONS`
- 使用 `resolveActionColumnLayout` 生成 `columnWidth`、`layoutMode` 与 `maxRowContentWidth`
- 互斥动作只计算同一分支可同时出现的一组
- 权限放开时可能同时出现的动作必须纳入计算
- 所有可见操作项默认直出，不再用“更多”菜单压缩操作列宽度
- 双行必须保持动作顺序；隐藏动作在布局前过滤，行尾不渲染分隔线

## 4. Recipe Helper

recipe 暴露 `resolveActionColumnLayout(contentWidths, combinations, options?)`，用于按表格密度和 280px 上限求解稳定布局。

旧的 `resolveActionColumnWidth(baseWidth, maxWidth?)` 只保留为渐进迁移兼容入口。新页面必须声明正文宽度和可达组合，不要把宽度计算责任推给运行时。

## 5. Audit Workflow

修改或新增表格列宽前，先运行静态审计：

```bash
bun run qa:table-widths
```

审计报告用于快速发现：

- 缺少 `width` 的高置信列定义
- 缺少 `scroll.x` 的 `Table`
- 已知列宽总和大于当前 `scroll.x` 的表格
- 已采用组合合同但动作缺少 `contentWidth`，或布局预算未传给 `ListRowActions`
- 使用动态列或无法解析宽度的人工复核项

静态审计只负责发现问题，不自动修复代码。模板仓库只沉淀通用检查口径；具体业务项目仍应结合真实接口数据和页面视觉复核固化最终列宽。

默认命令为非阻断报告模式，适合在已有历史表格的仓库中先落地工作流。若后续要接入 CI 阻断，可使用：

```bash
bun run qa:table-widths -- --strict
```
