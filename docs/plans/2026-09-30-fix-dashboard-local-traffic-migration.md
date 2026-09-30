# 修复本地仪表盘流量报表失败

独立有界运行环境修复。上游为已完成 CDA 计划及其 runtime setup；保留模板复用与提示精简修复，不重新打开已冻结计划，不改变 REL/master、产品顺序或线上部署状态。

## 已确认原因与范围

- 当前本地后台重新登录后，`GET /admin/reporting/traffic` 返回 HTTP 500；重试稳定复现。
- API 本地开发进程使用 `wrangler.local.jsonc` 的本地 D1。只读检查确认缺少 `traffic_collection`、`traffic_pv_buckets`、`traffic_uv_buckets`，且唯一待执行迁移是 `0039_commerce_analytics.sql`。
- 后端报表直接查询这些表，缺表导致失败；前端共享同一流量请求，故独立访客及访问量同时显示重试。前次观察到的 401 是另一次会话失效，不能解释重新登录后的 500。
- 执行已有本地增量迁移，随后用同一个已登录浏览器的真实请求和页面验证。无需修改业务代码或用 0 掩盖错误。
- 既有单测初始化时自动应用完整迁移，不能证明已运行的开发数据库也已升级；真实本地重试请求是本修复的红绿验证边界。
- 不变更线上数据库、采集开关、签名密钥、权限或认证逻辑。

## 执行检查点

- U1 本地迁移：Complete。
- U2 真实请求与页面复验：Complete。
- 当前单元：无；下一动作：无。本修复完成，执行正文冻结。
- Tail owner：本修复，无产品主计划状态变化。

## 验证

L0 代码与文档范围：仅新增运行修复记录，使用已有迁移，无源代码修改。检查限定文档的格式/diff，并执行本地迁移状态与真实浏览器请求验证；不重复 Admin 单测、typecheck 或 build。

- 修复前：已登录浏览器重试流量报表稳定返回 500；本地只读表查询与迁移列表确认统计表不存在，唯一待执行项为 0039。
- `bunx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc`（apps/api）：成功应用 0039，8 条 SQL 执行成功。
- 同一个已登录页面、相同日期及 Asia/Shanghai 时区重试：HTTP 200，UV 0、PV 0、商品排名 0 项、日序列 30 项；页面无重试按钮。
- 正常刷新复验：session、revenue、products、traffic 全部 HTTP 200；切回访问量，图表正常显示，空排名隐藏。
- `bunx wrangler d1 migrations list DB --local --config wrangler.local.jsonc`：无待执行迁移。
- 因果证据：`apps/api/src/reporting/traffic.ts:55` 首先查询流量表，`:69` 读取采集表；`packages/db/migrations/0039_commerce_analytics.sql:2` 起创建这些表。
- 预防：新增迁移后，运行中的开发服务热更新只加载代码，不会自动升级数据库。现有 `tools/dev-admin-local.ts` 在启动时应用迁移；热更新期间需执行上述本地迁移命令。没有新增代码或用虚构数据规避失败。
- Quality：文档限定检查与人工范围审查；没有业务代码改动，跳过代码简化和多角色审查。无待处理发现。
- Confidence：High，真实原始请求已完成 500 → 200 的红绿验证。
