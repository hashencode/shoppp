---
title: 主题编辑器共享字段与草稿列表 - Plan
type: fix
date: 2026-10-31
---

# 主题编辑器共享字段与草稿列表

本有界子计划承接 [父计划](./2026-10-31-0307-fix-admin-form-style-unification-plan.md) U9，修复 U8 实际核验的 A04、A06。继承父计划 R1、R9、R13–R16 及 Visual Evidence Protocol，不改变产品顺序、候选、master 或发布尾部。

## 范围与实现

普通 schema 字段与链接内部使用无 name 的 Form.Item；保留复杂 picker 原生 fieldset，边界使用 token；草稿列表 token 与本地化状态；审批原因增加可见标签。

文件：
- `apps/admin/src/pages/storefront/themes-page.tsx`
- `apps/admin/src/pages/storefront/theme-editor-page.tsx`
- `apps/admin/src/pages/storefront/storefront-resource-picker.tsx`
- `apps/admin/src/pages/storefront/catalog-media-picker.tsx`
- `apps/admin/src/pages/storefront/storefront-link-editor.tsx`

## 验证与完成条件

- 等级：L3；ResourcePicker 消费者 ThemeEditorPage 与 NavigationPage；其余 picker/link 只由 ThemeEditorPage 使用，页面两主题截图＋现有 Browser 边界。
- 复用既有 suites：themes-page.test.tsx、theme-editor-page.test.tsx、theme-editor-page.browser.test.tsx、navigation-page.test.tsx、navigation-page.browser.test.tsx、storefront-link-editor.test.tsx、catalog-media-picker.test.tsx、storefront-resource-picker.test.tsx（仅存在者），仅对真实语义或行为缺口补用例。
- 改动文件 format/lint；稳定批次 typecheck；涉及翻译时执行已有国际化检查。
- 每个受影响页面／入口保留同 fixture、中文、1280×900 的浅色／深色前后原图。长表单按对应锚点补图；当页在会话展示后才完成。
- 原 API、权限、只读、busy、版本／恢复合同不得改变；不提交、推送、PR 或部署。
- 基线：`docs/progress/assets/admin-form-style-unification/baseline-manifest.json` 的 `u9_baseline`；精确源码保存在本轮忽略 scratch，修改前原图已持久保存。
- 证据归档于 `docs/progress/2026-10-31-admin-form-style-unification-verification.md`；审计报告仅记录发现和验收事实，不维护执行队列。

## 执行检查点

- 当前单元：已完成；F1–F3 完成，执行体冻结。
- 顺序：F1 实现 → F2 行为与视觉验证 → F3 逐页截图交付和收尾。
- 下一动作：无。105 tests、最终 15 Browser、typecheck、format/lint、8 翻译检查通过；原情景、数字／开关／下拉／非空媒体及导航入口两主题图已交付。
- 阻塞：无。
- 尾部 owner：本子计划拥有本批实现、验证、截图；父计划 U6 拥有整体收尾。
