# Fashion 测试环境匹配候选部署建议（未执行）

本文件仅为当前统一表单外部验收的环境修复建议，不改变 Shoppp 产品计划、U/DC/PG 状态，不构成生产部署授权。

当前验收源码：`23b054b4144f4cb85b4da0ce68030ab40916d5ba`。Admin 当前源码 `build:test`（包含 tsc）通过，并以原允许的 `http://127.0.0.1:3418` preview 连接真实 Fashion API，以真实 human/admin 会话执行；API 没有 mock 或请求改写。

## 已执行失败

- 当前商品新增完整 JSON 固定预期相等，但部署 API 返回422，`unrecognized_keys: optionDefinitions`。
- 当前商品修改完整 JSON 固定预期相等，但部署 API 返回422，`unrecognized_keys: expectedVersion`。
- 不删除这两个业务字段迁就旧 API，不将旧 schema fixture 准备记成当前页面通过。

## 环境事实

- API active version `c3db7b4a-808c-4d22-8776-ccb089829af9`，2026-09-14 部署。
- 远程 Admin 2026-08-31 部署，未拿其旧页面验收当前规范。
- Fashion D1 已应用迁移仅到0026；只读 PRAGMA 证明 products 无 option_definitions_json/version。
- 已部署 Fashion API 缺 REPORT_EXPORTS 和 PRIVACY_EXPORTS；不能借普通 staging 的资源算通过。

## 供环境所有者审查的最小顺序

1. 冻结要验收的具体 API source/ref 与依赖；不得拿本地仓库 HEAD 自动当已部署候选。确认其实际数据库迁移依赖。
2. 针对唯一 `shoppp-fashion-staging` D1 生成精确备份，完成隔离恢复及外键检查，保留恢复证据；其他环境不操作。
3. 逐一审核该候选需要的尚未应用迁移。当前 HEAD 比实际 Fashion DB 少以下16个文件；存在多个相同数字前缀，不能只按序号猜迁移集合。
- `0027_product_option_definitions.sql`
- `0028_product_presentation.sql`
- `0029_published_product_revisions.sql`
- `0030_product_reviews.sql`
- `0031_product_review_consent.sql`
- `0032_storefront_control_authorities.sql`
- `0033_storefront_control_permissions_evidence.sql`
- `0034_catalog_release_v3_candidates.sql`
- `0035_catalog_candidate_shipping_freeze.sql`
- `0035_collection_version_transition_guard.sql`
- `0035_policy_approval_environment.sql`
- `0036_content_route_redirects.sql`
- `0037_navigation_product_references.sql`
- `0038_storefront_migration_catalog_identity.sql`
- `0039_commerce_analytics.sql`
- `0039_storefront_publications.sql`

4. 由环境所有者为 Fashion 自身提供隔离 REPORT_EXPORTS/PRIVACY_EXPORTS 及所需导出执行服务，确认媒体、邮件、支付仍为受控测试服务。不得从普通 staging 或生产复用。
5. 按适用 Fashion 环境、actor、备份和候选守卫部署匹配 API；不得把不适用的 U12 站立授权、旧 readiness 或普通 production release 流程当通行证。当前任务没有触发任何 workflow、provider 发布、迁移、资源创建、流量切换或 production promotion。
6. 用当前已构建 Admin 与真实测试 human 会话，复测原完整新增/修改 JSON、实际新读持久化、R2原字节、真实 CSV，以及被批准的测试支付/邮件/预览流程。保留自有 QA数据清单；库存若要调整必须先提供该自有新 variant 的独立库存位置，不改既有商品库存。

## 本轮保留样本

一条明确命名且未发布的 QA 商品及其媒体作为隔离 fixture 保留（获根任务授权，现有 API 没有产品删除合同）。旧 schema 准备只是准备数据，不是当前新增通过。单个自有 QA role 已经普通业务动作归档，未分配用户/邀请；不对既有业务记录作修改。详见 qa-owned-resources.json 和 qa-owned-role.json。
