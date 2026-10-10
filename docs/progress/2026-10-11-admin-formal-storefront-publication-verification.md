# 管理后台正式发布验证证据

Owning plan: [管理后台商家任务与发布流程重构](../plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md)，U7 / R8、R12 / F5 / AE8。实现基线为 `6cd04e6b`；合同提交 `9ae900cd`，生产者与交付提交 `36701cde`；审查问题与公开消费者修正提交 `3c08a176`。本文件记录验证证据，不维护执行队列。

## 合同与实际行为

- 人类发布权限 `themes.publish` 独立于保存、预览和批准；机器 build credential 不能创建人类授权。发布绑定批准的 Catalog 原始字节、Snapshot、Contact 和 Theme 身份，保留私有 manifest 的用途与摘要。
- API 持久化精确请求后 dispatch；重复请求不重复交付。queued/building、failed、unresolved 与已核实的当前线上版本分别处理。成功历史记录自身不能证明现在在线。
- 公开 compiler 消费已批准的 live Snapshot，生成同一不可变身份和原始 Catalog 字节；公开产物不含私有预览凭据、fixture 或预览 noindex。Worker 观察接口加入实际运行版本，生产者核对配置的真实店铺后才接受激活回执。
- source environment 与 activation environment 保持分离。production 来源的 staging 证明不回调生产激活、不复制生产 D1；staging Commerce 仅可核对当前公开 Worker 的精确目录产物，production 不使用该旁路。
- 交付前将旧 Worker 基线保存在同次受保护任务的产物中。交付或回执失败恢复并核对旧版本；无法确认恢复时保留 unresolved。强制终止后的恢复使用保留基线并另需环境操作授权。
- 授权回滚恢复旧成功回执中的精确 Worker，不重新构建、不回滚交易数据或数据库迁移。已成功激活的 Catalog 可继续供现有购物车使用，不依赖原私有预览租期。

## 生产者、公开消费者与交付验证

| 边界                        | 命令与结果                                                                                                                                                                                                                                          | 证明范围                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Shared contracts            | `bun run --cwd packages/contracts test`：72 pass；contracts、db typecheck 通过                                                                                                                                                                      | 发布 identity、角色权限、回执、环境与严格输入合同                                                           |
| API/D1 正式发布             | `bun run --cwd apps/api test:workers test/catalog/storefront-publication.test.ts test/security/redaction.test.ts`：16 pass                                                                                                                          | 真实路由、D1 状态、授权、过期私有来源、幂等/CAS、乱序回调、实际 observation、失败与回滚                     |
| 既有 API 消费者             | candidate-release、cart、experience-api、retirement-policy、public-boundaries、audit-reason 六个文件：首次 96 pass / 1 fail / 1 skip；关闭失败后 experience-api 全文件 42/42 pass                                                                   | 候选、安全、审批审计与 Commerce 兼容；外部 U9 handshake 未配置的既有 skip 不算通过                          |
| Storefront 与 gateway       | `bun test apps/storefront/tests/storefront-publication.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/generation.test.ts apps/storefront/tests/catalog-release-source.test.ts tools/environment-gateway.test.ts`：87 pass | 精确编译输入、公开/private/fallback 分支、运行身份、原始 Catalog、source/environment 边界                   |
| Runner / release / workflow | `bun test tools/storefront-publication.test.ts tools/release-validate.test.ts tools/deploy-workflow.test.ts`：95 pass                                                                                                                               | 同一产物证明、生产门禁、基线保存顺序、恢复、回执丢失与终态重读、exact rollback；两份 workflow YAML 解析通过 |
| 实际公开构建                | `STOREFRONT_BUILD_MODE=public STOREFRONT_EXPERIENCE_FILE=/tmp/shoppp-u7-public-input.json bun run --cwd apps/storefront build`，随后同输入 `verify:static`：通过                                                                                    | 实际 Nuxt generation、Vue 类型检查、276 assets、Wrangler dry-run 和公开静态检查；未部署                     |

API、工具和 Storefront 的 scoped lint/type checks 通过。构建产生的 tracked generated/public 文件在核验后恢复至构建前版本，临时构建和截图产物不提交。

## 复验发现与关闭

- 宽 API 回归发现旧审计脱敏把部分合法 Snapshot ID 判为银行卡数据，审批重试返回 `fashion_u8_operator_approval_conflict`。先确定性复现，再仅让审批权威审计完整保留固定非敏感身份字段；通用日志脱敏保持。相关 experience-api 42/42 通过。
- 实际公开构建发现合法空 collections 被生成成 `never[]`，使 Storefront 类型检查失败。生成器显式输出 readonly compact Catalog collection 类型，原始内容和摘要不变；随后真实 build/static verification 通过。
- 上下文原先按草稿过滤发布记录，但 active 与 pending 约束均为环境级，导致切换装修后看不到其他草稿的进度和恢复目标。真实 API/D1 先复现空记录，再去掉该 draft join/filter；当前批准仍精确绑定草稿，跨环境记录仍排除。修改后的完整 publication suite 13/13、API typecheck 和局部 ESLint 通过。
- 构建输入是本地代表性 fixture，包含有效 live binding、商品/集合和冻结 Contact。它用于编译闭包验证，不是候选或任何真实环境批准记录。

## Admin 共享消费者闭包

按 Admin L3 验证。`rg` 引用搜索及 workspace metadata 确认 `@shoppp/contracts` 的权限目录由 IAM permission-checklist、权限策略和 i18n provider 消费；新增发布服务由主题编辑器的局部发布面板消费。没有新增路由、菜单或共享表单框架。

- `bun run --cwd apps/admin test src/pages/iam/iam-pages.test.tsx src/shared/contexts/i18n-context.test.tsx src/test/permissions.test.ts --pool.maxWorkers 2`：44/44 pass，覆盖权威权限集合、新目录项双语标签、IAM 交互和语言切换。
- `bun test tools/check-admin-i18n.test.ts`：8/8 pass，覆盖生产调用、注册目录、插值和未知错误句子的边界。
- `bun run --cwd apps/admin test src/pages/storefront/storefront-publication-panel.test.tsx src/pages/storefront/theme-editor-page.test.tsx src/pages/storefront/themes-page.test.tsx`：91/91 pass，3 files、无 skip。覆盖重载恢复、精确发布、独立权限、dirty/source/Contact 失效、迟到响应、真实当前身份、失败恢复、回滚 CAS 与语言切换；旧预览/批准消费者完整复验。
- 复验修正了保留批准详情在 context 重载时消失的问题，历史详情继续可见但不能授予发布资格。实际 hook 错误 `build_hook_failed` / `build_hook_not_configured` 分别提供服务恢复与管理员配置动作。
- jsdom 复验曾因 AntD 退出动画断言、重复状态选择器和重型全页 role 重试查询失败；改为确认失效后不 dispatch、就近状态断言及明确标签/操作文本查询。长流程采用该文件既有的 20 秒模式，业务、安全和语言状态断言保留；临时请求诊断及无收益的 session fixture 修改移除。
- R2 基线检查：7 个受保护页面/测试文件、31 项 route 元数据及 1556 条既有翻译保持；无意外移除。仅 U5 已批准的 10 个旧候选面板专用 key 被移除。开店指南和商业仪表盘的内容不变。
- 最后新增 failed rollback 的原目标/current pointer 重试断言后，仅 panel test file 再验：20/20 pass。该变更没有改生产代码、editor 或 Themes tests。
- 原生 Browser Mode 完整 ThemeEditor file：desktop en-US / Asia/Shanghai 12/12 pass；390px narrow zh-CN / UTC 12/12 pass，均无 skip。只替换 HTTP transport，实际 AntD、CSS、reason/confirm/refresh/rollback 控件、语言状态及历史详情 viewport 检查通过。Modal 关闭动画和遮罩行为由 AntD 保持；语言切换 fixture 通过 provider 事件触发，不尝试穿透原生遮罩点击背景控件。
- `bun run --cwd apps/admin typecheck` 通过；9 个 Admin 变更文件的 scoped Prettier、ESLint 通过，`git diff --check` 通过。

## 简化与质量检查

三个独立简化 reviewer 均完成：复用 2 项、质量 1 项、效率 0 项，共应用 3 项，没有未采纳的 finding。API 审批沿用完全等价的 shared canonical serializer；静态输出沿用既有 identity 比较；两个发布去重分支复用局部纯 predicate。安全检查、比较顺序、错误、数据库操作及部署观察顺序保持。

- 简化后 `bun run --cwd apps/api test:workers test/catalog/storefront-publication.test.ts test/storefront-experience/experience-api.test.ts`：55/55 pass；API typecheck 与三个修改文件的 scoped ESLint、Prettier 通过。
- 简化后相同 public input 的实际 `build` 与 `verify:static` 再验通过；构建没有部署，12 个 tracked generated/public 文件再次恢复到构建前 HEAD。
- Admin 最后仅修改测试后的 typecheck 再验通过。

## 正式代码审查

`ce-code-review mode:agent base:6cd04e6b plan:docs/plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md` 的实际完成回执为 [review.json](../ce-code-review/20261011-041618-e3aad574/review.json)：`status: complete`，run `20261011-041618-e3aad574`。12 个选定视角均返回终态；MERGE 后的 6 项问题经独立 validator 全部确认，最终 reviewed-source drift 为空。

当前主机没有可用的独立模型路由，adversarial 视角在本进程执行；没有对外发送审查内容，也没有宣称跨模型覆盖。四项仅以文件大小要求拆分的建议因缺少项目标准或实际故障依据被审查合并阶段拒绝，不作为未完成工作。

审查覆盖本地接口、构建、交付与消费者；没有测量真实线上故障发生率。后续修正复用该完成回执，不以再次启动完整审查代替问题闭环。

## 正式审查问题闭环

沿用上述已完成审查回执，六项保留问题均已应用最小修正：

| 审查项                                         | 修正与验证                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 — 正式发布被旧 rehearsal 门禁拒绝           | `--formal-publication` 独立核对受保护 deploy workflow、exact validated SHA、staging 目标、发布身份与同次实际 observation；既有 rehearsal 门禁保持。测试直接使用解析后的正式任务环境，不伪造 rehearsal 标志。                                                                                       |
| #2 — hosted proof 选错 renderer / 缺少准备数据 | 专用正式配置保留 publication、payment recovery、admin fulfillment/access、accessibility 等必要任务；购买使用当前 Fashion Store 原生控件。预检查批准目录与 REL 准备的 staging 数据，run-scoped 操作 fixture 使用既有凭据并清理；不复制生产 D1。共享购买步骤经实际编译页面和本地 HTTP fixture 验证。 |
| #3 — 新公开版本使旧购物车失效                  | Worker 分开公开目录选择与私有预览 header；公开 A→B→回滚后，旧 A 购物车仍可读、调整数量和结账，向 A 加 B 的新行仍拒绝。实际 Worker→Hono→D1 测试同时保留 private mismatch 和过期 lease 边界。                                                                                                        |
| #4 — 公开产物被 fixture 验证替代               | browser/a11y/performance 保留批准 public input 并复用同一已编译产物；路线、商品名、canonical 和身份来自保留字节。普通 fixture 配置保持，17 个 release gate 与 report 命令合同不变。                                                                                                                |
| #5 — 交付前失败留下 building                   | browser 安装、backup/capture 与基线保留失败在同次 run 收尾；已核实旧基线为 failed，无法核实为 unresolved。仅 deliver 未开始时走预交付收尾，开始后的不确定结果仍由 runner 恢复逻辑负责。                                                                                                            |
| #6 — input upload 失败没有收尾                 | 同次 request 失败回调移至 input artifact upload 之后，区分验证与保留失败；保留原 run/attempt 绑定、pending lock 和显式新 intent。                                                                                                                                                                  |

四项仅建议按文件长度拆分的审查意见未被保留；本次没有新增一般化状态、缓存、导航、焦点或发布框架。六项已确认问题没有未关闭项；最终 Verification Contract 和 Definition of Done 复核没有新增实施尾部。正式 rollback 跳过破坏性购买证明和 fixture 准备，仅恢复并观察精确旧版本；成功激活后 cleanup/evidence upload 失败不能覆盖已核实结果。

## 修正后的真实消费者复验

- API/D1 五个文件（publication、cart、experience、candidate、public boundaries）：106 pass / 1 skip。skip 是既有 U9 外部 exact-handshake 未配置，不计为通过。
- Runner、release、workflow、formal context、public config、Storefront compiler/source/generation 与 gateway 十个文件：147 pass、0 fail、1104 assertions。解析真实 YAML 的失败注入覆盖 gate/upload/browser/backup/capture/baseline retention；真实 SQLite 检查 staging 商品价格和选项，不以静态字符串断言替代。
- 两个 Playwright CLI discovery 调用在并发构建时超过 Bun 默认五秒；仅该跨进程用例设为十五秒，断言和全局超时保持。后续发现六条 Lighthouse 路线共用三分钟会提前结束，改为每条路线独立测试；每页仍三分钟、最多三次尝试、原评分阈值保持。相应 consumer discovery 4/4 再验通过。
- 用不同于 committed fixture 的 `approved-travel-case`、`Approved travel case` 与 `https://storefront.example.test` 输入实际 public build 三次通过，最后一次包含下述无障碍和首屏跳动修正。产物保留批准身份与原始 Catalog；它是合格的本地合成输入，不是真实环境批准或候选。
- 公开 browser：最终 14 pass / 1 skip，覆盖 desktop、mobile、no-JavaScript 的真实 HTML、marker、canonical、Product JSON-LD、404 和导航，以及 cart/checkout 三种输入模式的操作限制与恢复入口。skip 仅是 no-JavaScript 项目有意不执行 JS 商品列表导航；该项目静态内容验证已通过。
- 公开 Axe：7/7 pass。首次实际 checkout 检出 `li role=status` 破坏原生列表语义和错误文字对比不足，最小修正为保留 `li` 并把既有 status 放在内层 span、只调整 checkout 错误文字颜色；重建后整组通过。
- 原生购买本地主机复验：最终 1/1 pass（10.1 秒），共享步骤执行批准商品选项 → 键盘 Tab/Enter 加购 → 保持商品页 → 原生购物车 → 地址/配送/条款 → 结账请求。断言准确 variant/价格、CartToken、地址、邮箱、配送和 consent；仅本地 HTTP Commerce 与模拟 provider handoff，浏览器阻止外部请求，没有 Stripe 或 hosted 付款结果。显式 `.browser.ts` local config 不被 hosted/rehearsal suite 自动选择。
- 新公开 Commerce 首次 Lighthouse cart 三次均失败（86/84/87 分），CLS 均为 0.2056。实际 SSR 中普通 JavaScript 页面显示“需 JavaScript”说明，hydration 后立即删除造成跳动。保留共享 Shell 中唯一的原生 noscript 操作说明，局部返回入口沿用既有 `noscript v-html` 静态模式；Cart/Checkout 仍禁止无 JavaScript 交易。三次同输入构建、最终 14 个 browser 检查、7 个 Axe 检查及共享原生购买全部通过；无新增焦点/状态协议。旧 Cart/Checkout no-JavaScript 测试改在实际共享 Shell 查询说明，并保留主页面操作/返回断言。
- 同一最终公开产物的 Lighthouse：7/7 pass（身份检查 + 六个页面，5.8 分钟）。最终 performance 为 / 94、/shop 96、/products/approved-travel-case 95、/cart 93、/checkout 95、/magazine 95；首页首次 74 分后按既有重试通过，其余页首次通过。公开索引页 SEO 100，cart/checkout 69 符合其 noindex 事务页合同；原性能/无障碍/最佳实践阈值保持。cart CLS 从稳定复现的 0.2056 降至 0.0610，checkout CLS 为 0。
- 商品标题选择器先在实际产物复现失败：旧 live marker 不存在，所选标题的可访问级别也不同。改用当前组件稳定根节点和 `.product-info > h4`，标题文字和可见性都继续断言；正式 hosted 与 local proof 共用同一购买步骤。
- 正式审查 artifacts 经仓库 formatter 处理；33 个 JSON 的解析内容与处理前逐一相同，完成回执、findings 和验证结论没有改变。

## 最终质量与交接

完成后的工具/e2e/scoped Storefront 类型检查及全部变更的局部 ESLint、Prettier、diff 检查通过。最终本地构建的 12 个 tracked generated/public 文件已按原 HEAD 字节恢复；截图、浏览器输出、构建及输入 fixture 均未加入提交。受保护的开店指南、商业仪表盘、route/layout 和既有翻译内容没有新增修改。

本计划的 R1–R12、F1–F5、AE1–AE9 与 U1–U7 完成边界已复核，保留所有稳定 ID；U7 只有核实目标环境当前版本才显示上线。实现/审查/验证尾部结束，产品 pointer 回交 REL-Pre-DC；真实环境及候选权限不随本地测试转移。

## 验证边界

本次完成本地实现和验证，没有执行真实 staging/production 部署、候选冻结、DC 或 PG。现有 hook 仍须转发 publication/source environment，运行环境须应用 migration `0039` 并满足既有受保护发布门禁；配置与强制终止恢复见 [正式发布架构](../architecture/storefront-publication.md)。本地测试不会产生生产操作许可或线上验收回执。
