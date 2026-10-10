# 管理后台重构验证证据

Owning plan: [管理后台商家任务与发布流程重构](../plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md)。本文件只记录基线和验证，不维护执行队列。

## U1 实施前基线

- Checkout: `codex/fix-new-arrival-icon`，HEAD `c24e74729810ec156442abebf9a646ff0f208da1`。现有源代码无未提交修改；本会话计划为新增文档。无需 worktree。
- 所有现有菜单、隐藏表单/详情和直接访问权限均映射至计划 R1/R3；U2 保留 route key、URL、permission。集合入口目前隐藏，需要按 R1 显示。
- Catalog 候选只冻结 published 来源，完整权限包含 settings.read。私有候选禁止 public build/deploy；装修批准冻结 Snapshot，不代表生产激活。
- `inclusion.live` 只证明历史部署命中，不能证明目标环境当前激活。U3 必须修正文案；U7 仍缺 REL elevation、公开构建、激活回执和 active tuple 查询合同。
- 商品 token 预览尚无 storefront consumer；U3 继续核验，不增加后端合同。装修计划 THEME-E1 未激活，本次不实现其新编辑器。
- 经营设置仍是 whole-object 原子写入；contact 邮箱由独立 owner 维护，旧经营表单保存须保留最新邮箱。库存、订单、权限、隐私和任务重试仍执行真实操作。
- L3 consumer closure：route metadata → router/auth guards、AppShell → recipe 标题；直接测试包括 routes/index、auth-route-guards、authorized-home、shell、guide-return、form-route-contract、audit、inventory。Admin workspace 仅依赖 contracts 作为业务合同，未改变其 API。各 U 追加对应页面/服务消费者证据。
- 本 U 仅文档，按计划不运行测试。后续 UI 验证沿用真实 provider 和现有 recipe。

## R2 受保护页面基线

| 项目         | 冻结值                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/welcome`   | key setup-guide；title Store setup guide / 开店指南；permission null；menuMode standalone；breadcrumb 未设置；原组件 WelcomePage                                     |
| `/dashboard` | key commerce-dashboard；title Commerce dashboard / 商业仪表盘；permission reporting.read；menuMode standalone；breadcrumb [Commerce dashboard]；原组件 DashboardPage |
| Shared shell | sidebar 224 / collapsed 80；既有内容容器与 recipe；两页无 shell breadcrumb；原登录落点 `/welcome`                                                                    |
| 代表状态     | 沿用 welcome-page.test.tsx、dashboard.test.tsx、dashboard.browser.test.tsx 的正常/加载/错误/权限与导航状态；U2/U6 在不改测试断言的前提下复验                         |

以下 SHA-256 覆盖页面与其同目录生产/测试文件，收尾逐项对比：

```json
{
  "apps/admin/src/pages/dashboard/dashboard-chart.tsx": "4e75324d015a34e679147d701f024524a479324002d16337d95840e4191f2f09",
  "apps/admin/src/pages/dashboard/dashboard-page.tsx": "aa2c6d38a129a6857aa3ce0a1ac7edb23073fcd1a39a67439fa7e45a6605bef8",
  "apps/admin/src/pages/dashboard/dashboard-test-data.ts": "46500c9593911e7387ac7ca6b16f73bc6ae6ed759c150b813cd3c25077a5a16d",
  "apps/admin/src/pages/dashboard/dashboard.browser.test.tsx": "09def580ef1fa73210c7147e929eeac363a7b703d43580309dd1adfa5ef5a9b8",
  "apps/admin/src/pages/dashboard/dashboard.test.tsx": "20bc6345fc4340b79c981aeb83cc012ccb5c35d90aeca6d9ab42feaefc51d8d2",
  "apps/admin/src/pages/home/welcome-page.test.tsx": "467353a6305a31e2f1519545ada17b5455c732927b40ee5f51452a13bf2aee6f",
  "apps/admin/src/pages/home/welcome-page.tsx": "6991fc0414f17068c3dc1182764cdf2019a4d3550772667045e0f182e2c32807"
}
```
