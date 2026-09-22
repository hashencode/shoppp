# FS-F13 联系方式管理：本地验证记录

本文件只记录 2026-09-18 的聚焦验证及其边界。当前单元、完成状态和下一步以 FS-F13 计划的 Execution Checkpoint 和产品总计划指针为准。

## 数据与快照身份

- `launch_configuration` 继续保存客服及隐私邮箱；`contact_profile` 保存公开选择、电话、时间、实体地址和社交链接。`settings.contact.update` 审计保存原因和资料版本。
- 新的 Experience 预览/批准快照包含 `contact.publicContact` 和 `contact.version`。版本是规范化 JSON 中资料版本及公开投影的 SHA-256；预览去重键也包含此版本。历史快照的字节不随后台编辑改变。
- 本地 Worker 测试创建了先后两个不同的联系方式版本，验证旧快照仍保留旧邮箱、新快照读取新邮箱；版本值由测试中的随机资料版本生成，测试未输出固定哈希。本次没有对实际商家资料建立或批准候选快照，因此**没有可提交给 REL 的具体联系版本、预览 ID 或上线批准**。

## 执行结果

| 验证                                                                                                                                                                                                                | 结果                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun test packages/contracts/test/platform-contact.test.ts`                                                                                                                                                         | 3 通过；覆盖完整公开字段、地址/手机号/HTTPS 地图限制和服务时间时区组合。                                                                                                                                         |
| 在 `apps/api` 运行 `bun run test:workers -- test/operations/contact-profile.test.ts test/operations/setup-guide.test.ts test/storefront-experience/experience-api.test.ts --maxWorkers=1`                           | 3 个文件、41 个测试通过；覆盖权限、冲突、审计、旧商业表单并发保存、指南、旧/新联系方式快照及已有 Experience API。                                                                                                |
| `bun run --cwd apps/admin test -- contact-settings-page.test.tsx`                                                                                                                                                   | 4 通过；覆盖保存、排序/删除、冲突、只读和双语。                                                                                                                                                                  |
| `bun test packages/contracts/test/platform-contact.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fashion-store-content.test.ts apps/storefront/tests/fashion-store-live-contact.test.ts` | 55 通过；覆盖结构化字段校验、公开投影、在线商店与多地址/社交链接、fixture 与 live 分离。                                                                                                                         |
| 使用已运行的本地 Fashion Store 开发服务，在桌面、平板、手机执行 Contact 源展示与本地表单 Playwright 用例                                                                                                            | 4 通过、2 个按测试设计跳过；fixture 地址、地图标记和本地表单行为仍符合对照基线。使用外部 base URL，未运行会改写 generated 输入的预览准备脚本。                                                                   |
| 使用临时 Admin test 模式开发服务运行 `e2e/setup-guide.spec.ts --workers=1`                                                                                                                                          | 6 通过；含桌面/手机返回旅程、只读与无权角色、撤销权限、中文深色移动视图。服务已停止。                                                                                                                            |
| 在本地 Admin test 模式开发服务运行 `e2e/setup-guide.spec.ts -g 'contact editor saves' --workers=1`                                                                                                                  | 新增 2 个浏览器用例通过：英文桌面、中文手机端的地点排序、社交链接编辑、保存、重新加载、无横向溢出，以及校验失败后首个错误字段聚焦。服务已停止。                                                                  |
| 在不带 Git 元数据的临时副本中，用合成的已冻结联系方式启动实时 Fashion Store，并用 Chromium 检查 390、768、1440 px 的 `/contact`                                                                                     | 三种宽度均显示 2 个地址、2 条社交链接、1 条外部地图链接和公开邮箱；无表单、固定地图标记、演示社交目的地或横向溢出。修正旧占位文案、社交链接间距和手机页脚邮箱换行后复测通过。原工作区的 generated 输入未被改写。 |

最初把 Worker 测试交给普通 `bun test`，因缺少 Workers runtime 中的 `cloudflare:workers` 导入而失败；改用仓库规定的 Vitest Workers runner 后通过。Admin Playwright 首次使用默认 4 workers 时有 2 个页面加载时序失败；同一测试文件串行复跑 6/6 通过。以上失败不计作产品逻辑通过证据，也没有修改测试断言。

Admin 变更按 `apps/admin/docs/testing-standards.md` 选 **L3**：新联系方式页接入路由、权限和设置指南，影响页面间导航；`rg` 的引用检查覆盖 `routes.config.ts`、`welcome-page.tsx`、商业设置页和对应组件/E2E 用例。稳定后运行改动文件 ESLint、联系方式组件测试、指南和编辑器浏览器用例以及 `bun run --cwd apps/admin typecheck`，均通过。审查发现并修复旧商业设置保存覆盖新邮箱、公开邮箱与开关跨查询读取、后台长表单错误定位、独立页标题规范四项问题；新增旧表单并发回归用例。

本轮最终 `bun run lint` 通过，`bun run --cwd apps/api typecheck`、`bun run --cwd packages/contracts typecheck`、`bun run --cwd apps/storefront typecheck` 和 `bun run --cwd apps/admin typecheck` 通过。根目录 `bun run typecheck` 仍在 `apps/storefront/app/theme-engine/composer.ts:119`、`home-merchandising.ts:83`、`tools/build-fashion-store-product-content-catalog.ts:197` 报三个既存的 `exactOptionalPropertyTypes`/状态字面量错误；`composer.ts:119` 在 FS-F13 基线提交中即有相同行为，其他两文件未纳入本功能。两个新增编辑器 Playwright 用例首次运行时因测试夹具使用非 UUID 版本值及中文按钮空格匹配失败；修正夹具/选择器后 2/2 通过。

## 尚需的发布核验

- Fixture Contact 由当前开发服务的浏览器用例覆盖；实时 Contact 的 Chromium 检查使用临时副本内的合成快照和样例商家资料，并非真实商家批准快照。尚需对实际拟发布版本完成 Contact、Header、Footer 的人工预览、键盘核验及实际外链核验。现有仓库 live Playwright 启动器会改写已有脏状态的 `apps/storefront/app/generated/active-theme.ts`、`active-experience.ts` 等输入，因此没有在原工作区运行该启动器。
- 尚无实际商家联系方式、所批准联系版本与预览 ID；发布前由操作员用新预览核对 Contact、Header、Footer、外部地图及社交目的地，并记录快照 `contact.version` 和快照 ID。此项不得被本地测试替代。
- 这些测试不推进 REL 的 Pre-DC、DC、PG，也不证明远端已部署。

## 2026-09-22 当前工作区复核

- 在后续独立计划 `docs/plans/2026-09-21-1754-refactor-contact-settings-structured-fields-plan.md` 的结构化服务时间、固定社交平台和系统生成审计原因改动之上，重新运行联系方式关键回归：Contracts/Storefront 57 项通过，API Worker 42 项通过，Admin 组件 8 项通过，Admin 联系方式编辑器桌面英文及手机中文浏览器用例 2 项通过。
- `packages/contracts`、`apps/api`、`apps/admin`、`apps/storefront` 的独立 typecheck 均通过；仓库 `bun run lint` 通过。独立结构化字段计划明确以系统生成的固定审计原因取代联系方式页面的操作员手填原因；这不改变其他敏感操作的原因要求。
- 检查本地两个 Miniflare D1 数据库时，没有发现可作为商家批准依据的 `contact_profile` 或 `launch_configuration` 记录。现有 `snapshot-fashion-store-local-footer-demo-v1/v2` 是合成 Footer 演示快照；最终 U5 开发验收改用下述带固定版本身份、三档截图和专项回归证据的新合成 Preview。
- 本轮最初因无法记录真实商家 `contact.version` 或商家 Preview snapshot ID 而保留 U5 未完成；用户随后在 2026-09-22 明确开发阶段无需真实商家资料，因此该开发门槛由下述版本化合成 Preview 取代。真实商家资料确认保留为候选发布前操作。
- 经用户同意，为本地演示生成了明确为合成用途的联系方式快照 `snapshot-preview-contact-u5-synthetic-20260922`，其 `contact.version` 为 `5a18a45a0747572f01bda388f26d34513c0ab5ccf3fa8a09ccbdb84ce2860157`。资料使用 `shoppp.example`、示例地址与 `example.com` 外链，不能解释为真实商家资料或发布批准。
- 合成快照的 Contact 页面在 390、768、1440 三档完成静态预览与截图；截图保存在 `/Users/studio/.codex/visualizations/2026/09/21/01a0c3a5-e335-7ac2-a4bf-776202bd9919/fs-f13-u5/`。检查确认 Contact 不暴露表单或 fixture 地图标记，三档没有横向溢出，Footer 使用同一份公开联系方式。
- 预览同时发现 Header 联系方式原本在全部桌面宽度被 CSS 隐藏。现改为 1400px 及以上显示公开支持邮箱和社交链接，992–1399px 为导航空间继续隐藏；新增 live Playwright 用例验证 Contact、Header、Footer 共享同一冻结联系方式，聚焦用例 1 项通过。
- 当前分支完整 Fashion Store live 套件为 15 项通过、3 项失败；失败分别是集合标题、商品次要操作数量与现有根路径 URL predicate，不涉及联系方式链路，单独复跑仍可复现。本轮不在 FS-F13-U5 中修改这些越界行为，也不把该完整套件记为全绿放行证据；它们随产品指针返回 FS-F12 后继续由对应 Product/Storefront 工作处理。
- 用户确认开发阶段允许使用清晰标记的合成资料后，U5 的版本身份、三档人工预览、Contact/Header/Footer 共享投影及专项自动化证据均已齐备。FS-F13 于 2026-09-22 完成，产品指针同步返回 FS-F12-U2；这不表示真实商家资料、候选发布、远端部署、DC 或 PG 已完成。
