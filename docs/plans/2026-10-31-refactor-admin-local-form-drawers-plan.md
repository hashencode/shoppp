---
title: Admin 局部表单 Drawer 迁移
type: refactor
date: 2026-10-31
execution: code
---

# Admin 局部表单 Drawer 迁移

## 范围与权威

按本会话截图及用户实施指令，将商品展示、商品选项展示、单个门店地址、商品集合维护改为 720px Drawer。这是独立有界计划，不改变产品 master 的 REL-Pre-DC 指针、候选或发布尾部。沿用 `apps/admin/docs/ai/ai-rules.md` §3.1 和 Drawer 布局规范。

保留现有 API、完整 payload、权限、版本检查、商品互斥写及已发布商品限制。商品主体和联系设置仍为独立页面；门店 Drawer 仅确认到联系设置草稿，最终统一保存。商品集合列表的新增、编辑、查看打开 Drawer，原表单 URL 共享同一字段与提交实现，兼容 handoffProductId、returnTo、顺序成员与依赖阻断信息。

已有未跟踪的 `2026-10-29-0018-refactor-admin-form-consistency-plan.md` 是并行计划，本轮不修改或执行其角色权限、状态确认、政策日期等工作。集合搜索清理由本轮 Drawer 实例隔离和完整重置所需范围实现，不接管并行计划其余单元。

## 实施与验证

1. 商品两个独立子保存移入标准 Drawer，主页面显示摘要与维护入口；保留共享版本和写锁，成功后以 API 回包更新父状态并沿原频道通知列表一次，避免重读覆盖商品主体未保存输入。
2. 门店使用摘要列表及新增／编辑 Drawer，字段校验、隐藏 ID、null、排序与公开状态保留；确认后回填父草稿，取消不改变草稿，不新增单门店写接口。
3. 集合复用现有字段与提交组装，列表维护打开标准 Drawer；旧路由继续独立可达，保留完整成员、封面、SEO、发布权限、原因、版本与阻断恢复。
4. L3：现有 catalog、collection、contact 套件补入口与生命周期断言，覆盖严格 payload、失败保留、零写取消和一次刷新；目标 Drawer 浏览器验证，changed-file lint/format、一次 Admin typecheck、翻译检查。当前源码的测试样本用于前后截图，不创建真实业务数据。

不修改共享 recipe、不新增依赖、不提交／推送／创建 PR／部署。

## 执行 checkpoint

- 当前：四处 Drawer 已完成，本地实现与验证尾部结束。
- 状态：已完成，执行内容冻结。
- 下一动作：无；验证及截图记录见 `docs/progress/2026-10-31-admin-local-form-drawers-verification.md`。
- 阻塞：无。
- 尾部 owner：本计划负责本地实现、验证与截图。
