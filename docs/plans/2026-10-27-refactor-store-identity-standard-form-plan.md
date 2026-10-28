---
title: 店铺资料基础表单标准化
type: refactor
date: 2026-10-27
---

# 店铺资料基础表单标准化

## 目标与边界

用户授权改造 `/settings/identity`，先截图，再统一内容宽度、固定保存／重置、校验及状态反馈，交付真实浏览器前后对比。本计划独立有界，不变更主产品 REL-Pre-DC、候选范围、DC/PG 或产品顺序。继承既有 Store Identity 业务合同，取代该页早期散装展示，不重开已完成的角色／导航计划。

保留一级设置页 `CustomPageRecipe` 页头；单例设置没有列表或 add/modify URL，不引入 CRUD 子页返回语义。内部复用基础表单同源的内容宽度、Form 校验定位、QueryStateBlock 和 FormSubmitToolbar；不新增共享 recipe 或改动其他页面。沿用两个职责独立的 Card，Card 全宽，各 Card 内 compact 800px，并遵循用户对齐偏好。备注归入基本资料区，保存后果在保存操作旁只显示一次。

## 业务对照合同

| 边界     | 保留内容                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 读取     | GET `/admin/settings/store-identity`；null 表示允许首次填写，不当作读取失败                                                                                        |
| 权限     | identity.read / identity.write；只读隐藏操作、禁用编辑、行为层零写                                                                                                 |
| 写入     | PUT 原 endpoint；全量 payload；expectedVersion 为当前版本或 null；Logo 四种 variant，仅非空项提交；选填资产 trim 后 null；SEO 空值、tagline 和选填 reason 语义不变 |
| 校验     | 店铺名称与主 Logo 必填、原长度限制；全量表单校验，错误定位并聚焦                                                                                                   |
| 来源版本 | 保存是新已发布来源版本，不误称草稿或部署；回填服务端新版本，不隐式重试冲突写                                                                                       |
| 媒体     | ContentMediaSelect source=identity；远程搜索、清空、原 ID、媒体专用权限及全部六个选择器保留                                                                        |
| 失败恢复 | 保留输入、原版本及 Theme backlink 修复链接；读取失败可重试；显式重新读取前确认放弃修改                                                                             |
| 重置     | 恢复最近读取／成功保存的完整值；清空备注、校验、失败提示、backlinks 及媒体选择器搜索等临时状态，不写服务器                                                         |

## 实施单元与验证

- U1：保存当前 index、相关源文件与真实页修改前截图。已确认无 unmerged 文件，既有 WIP 保持。桌面 1440×1050 顶部／页尾，窄屏 390×844；同语言、主题、权限、数据及滚动位置。
- U2：按上述合同改造页面与文案；增强既有失败后重置用例，先验证缺少重置的预期失败，再实施。补齐读取重试、成功反馈、只读和提交锁的定向断言。
- U3：L2，店铺资料现有 unit 与 Browser Mode、changed-file lint/format、稳定后一次 typecheck；宽度、固定工具条、媒体选择／重置及校验滚动用真实浏览器检查。无全套测试、构建、API 或依赖改动。收口源文件与截图清单，交付前后对比。

执行方式为当前 checkout 原生、同线程；不创建 worktree、提交、推送、PR 或部署。保留既有 index，包括本会话先前修改的 translations；本轮只增加必要词条。

## 执行检查点

- U1 已完成：修改前真实页为空资料状态，截图已保存；基线备份在 `/var/folders/nm/g5cp7rkx4gqflh548086923c0000gn/T/shoppp-identity-standardization-20261027-jlvg0pfy/`。
- U2 已完成：页面已接入共享宽度、操作栏、校验定位与状态反馈；payload 和 source=identity 保持，重置红测已转绿。
- U3 已完成：8 个页面测试、2 个 Browser Mode 测试、changed-file lint/format、typecheck 与页面 34 处翻译检查通过；桌面首屏／页尾及窄屏前后截图已核对。
- 计划已完成（2026-10-27）。无下一实施单元。收尾审查发现的页尾保存失败反馈可见性已修复并通过浏览器验证。
- 阻塞：无。
- 本计划拥有本地验证与截图尾部；证据写入本计划对应 progress 文件，不维护另一执行队列。
- 完成证据：`docs/progress/2026-10-27-store-identity-standard-form-verification.md`；截图与基线源文件保留于本地 `store-identity-standardization-20261027` 可视化目录。
