---
title: 已发布商品修订表单 - Plan
type: fix
date: 2026-10-31
---

# 已发布商品修订表单

本有界子计划承接 [父计划](./2026-10-31-0307-fix-admin-form-style-unification-plan.md) U9，修复 U8 实际核验的 A05。继承父计划 R1、R9、R13–R16 及 Visual Evidence Protocol，不改变产品顺序、候选、master 或发布尾部。

## 范围与实现

保留局部修订编辑器和受控 state；Form.Item 与标准 Card 分区；媒体使用现有 SortActionGroup，保留操作名称；底部为父固定工具栏留出可滚动空间。

文件：
- `apps/admin/src/pages/catalog/published-product-revision-editor.tsx`

## 验证与完成条件

- 等级：L2，既有发布修订 payload／媒体顺序测试＋实际 UI 操作可达性。
- 复用既有 suites：catalog-form-page.test.tsx、admin-local-form-drawers.browser.test.tsx（原产品子表单边界），仅对真实语义或行为缺口补用例。
- 改动文件 format/lint；稳定批次 typecheck；涉及翻译时执行已有国际化检查。
- 每个受影响页面／入口保留同 fixture、中文、1280×900 的浅色／深色前后原图。长表单按对应锚点补图；当页在会话展示后才完成。
- 原 API、权限、只读、busy、版本／恢复合同不得改变；不提交、推送、PR 或部署。
- 基线：`docs/progress/assets/admin-form-style-unification/baseline-manifest.json` 的 `u9_baseline`；精确源码保存在本轮忽略 scratch，修改前原图已持久保存。
- 证据归档于 `docs/progress/2026-10-31-admin-form-style-unification-verification.md`；审计报告仅记录发现和验收事实，不维护执行队列。

## 执行检查点

- 当前单元：已完成；F1–F3 完成，执行体冻结。
- 顺序：F1 实现 → F2 行为与视觉验证 → F3 逐页截图交付和收尾。
- 下一动作：无。19 tests、typecheck、format/lint 与全部分区两主题实际验收通过，新旧图已交付。
- 阻塞：无。
- 尾部 owner：本子计划拥有本批实现、验证、截图；父计划 U6 拥有整体收尾。
