---
title: Admin 原生 Card Tabs 与贯通分割线
type: fix
date: 2026-10-21
---

# Admin 原生 Card Tabs 与贯通分割线

## 范围与权威

用户要求将 Card 原生 `tabList` 写入规范、替换树展开／收起图标，并按 gmxgy-admin-new 视频库的无间隙分区改进分割线。本计划是独立有界修正，上游为已完成的 `2026-10-20-2145-refactor-admin-navigation-tree-interactions-plan.md`，继承 R1–R10 中仍存在的草稿、权限、只读、确认及截图合同；仅取代模拟 Card head、加减号工具图标和工作区外侧 padding 导致的分割线缩进。不变更产品序列、REL 检查点、候选或 DC/PG，历史计划冻结。

参考事实：gmxgy-admin-new 本地 master 的视频库仍为多 Card；`origin/codex/continue-order-batch-invoice`（82acc55）的 `video-depot-page.tsx` 使用原生 Card body padding 0、无 gap grid、分区 padding 及主题边框。只读参考，不改动该仓库。

## 实施与验证

- U1：保留修改前截图和 index；修改规范与导航 Card，使用原生 tabList / activeTabKey / onTabChange；已访问编辑器保持挂载，隐藏非当前草稿及工具条。
- U2：导航与角色权限工具图标采用 Lucide UnfoldVertical / FoldVertical，保留名称、Tooltip 与只读浏览能力；导航及角色兼容独立页的工作区分区内留白、边界贯通。角色 Drawer 继续既有 720px 与上下结构。
- U3：L2，现有导航／IAM focused tests、changed-file lint/format、一次 typecheck；因边框位置与响应式属于几何风险，目标 Browser Mode 和真实浏览器核对边界、窄屏及草稿。样式／图标无业务分支变化，不添加镜像实现测试；加强既有布局与草稿测试。真实组件 fixture 前后截图，固定中文浅色、同数据与选择状态，桌面 1440×1050、窄屏 390×844。

本计划拥有本地实现、验证和截图交付；不提交、推送、创建 PR 或部署。原有 staged WIP 与 IDE 文件保留，不改 index。

## 执行检查点

- 状态：已完成，正文冻结。
- U1、U2、U3 均完成；原生 Card、Lucide 图标、贯通分区与规范已落地，完成 L2 和目标浏览器验证。
- 下一步：无本计划实施尾部；等待用户审阅本地改动。
- 阻塞：无；无合并冲突。
- 基线与 index 快照：`/private/tmp/shoppp-card-tabs-refinement-20261021/`。
- 验证与截图：`docs/progress/2026-10-21-admin-card-tabs-dividers-verification.md`。
