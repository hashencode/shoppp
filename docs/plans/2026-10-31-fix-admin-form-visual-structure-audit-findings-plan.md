---
title: 表单视觉排查补修：只读详情与账号元信息
type: fix
date: 2026-10-31
parent: docs/plans/2026-10-31-2103-fix-admin-form-visual-structure-plan.md
execution: code
---

# 表单视觉排查补修：只读详情与账号元信息

本计划是父计划 U7 下的有界批次，只拥有排查确认的订单详情文字色、账号资料元信息及对应实际入口的修复和证据。父计划继续拥有统一规则、项目排查与整体验收；不改变产品 master、并行可视化编辑器、候选或发布权威，不重开已完成的历史计划。

继承父计划 R1、R5、R9、R14、R16–R22：保留 API、完整请求、版本与权限，普通字段单列、系统元信息只读、主题 token；每个入口先有当前基线，再完成适用检查并在同一网页交付两主题新旧原图。本批不提交、推送、部署或创建 PR。

## 单元

### U1. 订单只读详情的主题次要文字

- 文件：`apps/admin/src/pages/orders/order-detail.tsx`。
- 改动：三个固定灰色文字改用现有 colorTextSecondary 语义变量；不改变事实、金额、允许操作与确认。
- 验证：L1，现有 order-detail 6 项通过，changed-file 质量检查及浅／深色实际画面；网页两主题及放大已验收。
- 证据：父计划的 verification、`assets/admin-form-visual-structure/order-detail/` 和本轮 `page=order-detail` 深链。

### U2. 账号已保存资料改为单列只读字段

- 文件：`apps/admin/src/pages/iam/user-detail-page.tsx`、既有 `iam-pages.test.tsx`、必要翻译；同一组件消费于 UsersPage Drawer 与兼容独立 URL。
- 改动：邮箱、已保存状态、版本、更新时间不再双列 Descriptions；以普通轻分组及无 name 的纵向只读 Form.Item／Input 呈现。区分已保存状态和当前可编辑状态；不加入另一套表单 store。
- 保留：原普通字段、版本请求、dirty／reset、同步写锁、自身账号限制、受保护管理员、角色可见性、reauth／operation identity 及确认归属。不得为视觉变化开放原不可操作入口。
- 验证：L3，先保存两个实际入口的全部旧图；增强现有只读元信息及完整保存断言并观察预期失败，再实施；运行 IAM focused suites 与原 Drawer Browser Mode；最终 typecheck 与父计划共用一次。
- 交付：Drawer 与兼容独立页分别在同一网页提供两主题新旧图，实际检查字段、关闭／footer、主题与放大后才完成。

## 完成条件

两个单元的所有实际入口完成；原业务／安全合同通过适用验证；无待补必需图片；证据与父计划一致。全局排查的其余例外由父计划记录，本文件不维护第二个全项目队列。

## Execution Checkpoint

- 当前：U1、U2 完成；本有界计划已完成并冻结。
- 完成证据：订单 6 项、IAM 51 项 focused tests 与 IAM Drawer Browser Mode 2 项通过；三个实际入口各有浅／深色 before／after，已在网页检查主题、图片加载及放大。账号元信息无 name，仍使用原 Form；更新时间的两语言断言改为读取只读字段值，保留语言切换、未保存输入和不重复加载验证。
- 下一具体动作：无本批剩余实施；统一类型检查、总排查与整体收口由父计划 U7／U8 拥有。
- 阻塞：无；无提交或发布尾部。
- 完成证据统一在父计划 verification；整体关闭仍由父计划 U8 拥有。
