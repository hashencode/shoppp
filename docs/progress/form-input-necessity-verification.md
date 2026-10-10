# Form input necessity — verification evidence

执行日期：2026-09-30 至 2026-10-01（Asia/Shanghai）。范围以 [独立改进计划](../plans/2026-09-30-refactor-form-input-necessity.md) 的 R1–R7 为准。本文件只保留证据；产品执行 authority 仍属于原 active plan。

## 行为与契约

| 要求  | 已验证的界面、API 与保存边界                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1    | 输入必要性集中在 Admin ai-rules §4.2；迁移规则引用同一原则，保留现有表单布局与标识。                                                                                                                                                                                                                                                                                               |
| R2–R3 | 体验创建/保存/Block/校验/预览、预览授权/撤销、迁移试算、私有 candidate build/abandon，以及 Content、草稿 Collection、Navigation、Identity、Policy 普通保存接受无备注。审计保留 actor/action/target/version，reason 为 null；短备注可保留，提供的备注继续清洗和脱敏。Snapshot/migration approval、Content/Navigation/Policy transition、涉及已发布/已归档 Collection 的写入仍严格。 |
| R4    | Content/Collection/Identity 请求允许 SEO 标题缺省/空白；服务端以真实业务标题/名称补足，保存和返回仍非空，显式值保留。未批量修改历史实体。                                                                                                                                                                                                                                          |
| R5    | 新建英文标题/名称在 blur 时预填 Slug；自填、既有与非英文 Slug 不覆盖。内容和集合实际表单测试覆盖保存请求。                                                                                                                                                                                                                                                                         |
| R6    | Identity 品牌素材与 Collection cover 复用 ContentMediaSelect 和现有 RemoteSearchSelect，支持服务端搜索、分页、失败重试，提交稳定 ID。真实浏览器找到初始 100 项之外的主标志并保存；Workers 验证 digit-leading UUID、当前 published revision 素材、identity-only/catalog-only 权限及跨域拒绝，原 Content media 权限保持。可选素材清空按 null 保存，保存中禁止再改选择。              |
| R7    | Phone (optional) 移除原生 required、保留 max 40；浏览器无手机号触发预览操作及 live checkout 地址请求。Workers 使用无手机号地址完成 hosted session、幂等重放与确认订单链路。                                                                                                                                                                                                        |

审计拒绝回归：新增失败用例证实非法备注曾在主题校验/迁移试算返回 422 前写入记录（数量分别 1 而非 0、7 而非 6）。现先校验备注，再写入；两项断言及既有 API suites 通过。Policy 新增普通保存测试同时发现结构化正文未注册到 Form，保存请求缺少 sections；修复后提交完整正文，并保持 1–40 项契约。

审查确认的六项问题全部修复，具体边界如下：

| Finding                              | 修复与实际证据                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1：非法备注导致部分写入             | 七项新增 Workers 回归先复现 422 后仍写入草稿/版本/successor、迁移批准、预览授权/撤销和 candidate 状态（含 expiry）。所有对应动作在 mutation 前清洗，七项全部通过；experience-api + candidate-release 为 74 passed、1 existing skipped。                                                                                 |
| #2：Identity 拒绝真实媒体 UUID       | Contract red 用例复现六个字段拒绝 digit-leading UUID；输入和实体沿用既有媒体 ID union，contracts 12 passed、Store Identity Workers 8 passed，覆盖真实 UUID 的 PUT→GET 与 D1 值。                                                                                                                                        |
| #4：Policy 正文错误缺少字段关联      | 空正文提交先复现可见错误未关联到结构化正文 group；将 Form 提供的 id/ARIA 传给现有 group 并对齐标签后，Policy/Content/shared editor 15 passed，断言实际 error ID 关联及无请求。                                                                                                                                          |
| #5：Identity 保存中仍可改素材        | Held PUT 用例先复现保存中仍可选择；六个 selector 使用现有 saving 状态禁用，Identity Admin 4 passed。                                                                                                                                                                                                                    |
| #6：素材只能访问首 100 项            | Selector 回归先复现旧素材搜索和第二页不可达；复用现有 RemoteSearchSelect 的服务端搜索、分页、乱序响应保护和重试后，四个具名 suites 46 passed、最终 selector recovery 5 passed。真实 Identity Chromium 1 passed，搜索首 100 项之外的素材、选择保存稳定 ID 并清空可选项；Collection 的选择/清空保存分别提交稳定 ID/null。 |
| #8：遗漏当前 published revision 素材 | Workers 先复现当前 revision 独有素材未列出；按既有最新 published authority 合并、以稳定 ID 去重并优先当前 revision metadata，再搜索/分页。Catalog + media/library 39 passed，覆盖选择后保存、历史/草稿 registry 素材排除及权限拒绝。                                                                                    |

## L3 consumers 与测试映射

| 共享改变                                                         | 实际消费者与具名 suites                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| optionalAuditReasonSchema / 各 write schemas                     | contracts 的 contracts、storefront-experience、storefront-content、catalog-release；Workers 的 experience-api、pages、articles、policies、navigation、store-identity、catalog、candidate-release、audit-reason。                                                                                      |
| ContentMediaSelect / fetchContentMedia / RemoteSearchSelect 复用 | ContentEditorPage（Page/Article）、StructuredContentEditor（Content/Policy）、CollectionFormPage、StoreIdentityPage；content-media-select、remote-search-select、structured-content-editor、content-editor、policies-page、collection-form-page、store-identity-page tests 及 Identity browser test。 |
| StructuredContentEditor 的 Form 字段语义                         | Content/Policy 的现有 group；shared editor、content-editor、policies-page tests，验证生成的 field error ID 关联。                                                                                                                                                                                     |
| listCatalogMedia 当前 published registry 合并                    | Collection 与 Identity 同域素材入口；Workers catalog/catalog、media/library、operations/store-identity，验证当前素材、ID、搜索/分页与权限。                                                                                                                                                           |
| suggestEnglishSlug                                               | 新建 ContentEditorPage、CollectionFormPage；各表单 suite 验证预填、自填与既有值保留，Content suite 验证非英文不生成。                                                                                                                                                                                 |
| 草稿/预览按钮与原因字段                                          | themes-page、theme-editor-page、catalog-preview-candidate-panel、navigation-page tests；Theme browser controls 和 Content browser validation/conflict recovery。                                                                                                                                      |
| Fashion checkout phone                                           | checkout、runtime-commerce、fashion-store-checkout unit tests；Fashion checkout desktop/mobile 与 live browse-to-order Playwright；Workers payments/checkout。                                                                                                                                        |

## 执行结果

| 检查                                                                        | 实际结果                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contracts：4 个具名 suite                                                   | 最终 55 passed                                                                                                                                                                                                 |
| Workers：上述 9 个 form/security suites + payments/checkout + media/library | 最终 11 个 suites：161 passed，1 existing skipped                                                                                                                                                              |
| Storefront：3 个具名 unit suites                                            | 17 passed                                                                                                                                                                                                      |
| Admin focused tests                                                         | 最终 10 个 consumer suites：84 passed，无 skipped；覆盖无备注保存、严格审批、默认值、素材 ID、冲突恢复与正文提交                                                                                               |
| Admin browser                                                               | Theme/Content/Identity 的真实 Chromium：10 passed；Theme 原生 narrow profile：8 passed。审查修复后最终重跑受影响的 Content/Identity：2 passed                                                                  |
| Storefront preview checkout browser                                         | desktop/mobile 7 passed，5 按原 suite 约定仅 desktop 执行而跳过；空手机号原生校验和真实本地操作断言通过                                                                                                        |
| Storefront live browse-to-order browser                                     | 1 passed；无手机号地址提交，捕获 shippingAddress.phone 为空，走到 payment return                                                                                                                               |
| Admin i18n coverage                                                         | tools/check-admin-i18n.test.ts：8 passed，包含全生产翻译调用与注册 catalog 检查                                                                                                                                |
| 类型与静态质量                                                              | 最终 Admin/API/contracts/Storefront typecheck 全部通过；本次 24 个 Admin 和 25 个 API/contracts/Storefront owned files 的 scoped ESLint、按所属配置执行的 Prettier、import boundaries 与 git diff --check 通过 |

浏览器里的 Commerce/支付响应由现有 E2E fixture 提供；并未向真实支付服务创建会话。API 持久化、审计和权限由 Workers/D1 测试单独验证；不把浏览器 fixture 当作真实支付证据。预览浏览器按既有脚本完成静态构建、static 验证及 bundle budget。

素材选择器的实际集成验证同时确认主标志必填语义及字段错误的关联。组件只转交 Form 提供的 id、aria-required、aria-invalid 与 aria-describedby，不接管 UI 库的焦点或键盘行为。浏览器验证后恢复本次运行产生的 tracked catalog/sitemap 文件；这些文件在任务开始时未修改，未纳入交付。

## Review 与交付边界

文档 review 的 coherence、feasibility、design、security、scope、adversarial 六个 lens 完成，无保留 finding；没有可用的不同供应商 CLI，因此未运行跨模型 review。

ce-simplify-code 的 reuse/quality/efficiency 三个 reviewer 完成：复用现有 blockControlsDisabled 的 6 处等价条件；保留各素材字段独立加载/错误/重试，避免为此增加缓存协调。

代码 review 已实际完成：`status: complete`，`run_id: 20260930-220607-b9926087`，artifact 为 `/tmp/compound-engineering-501/ce-code-review/20260930-220607-b9926087/review.json`。正确性、项目规范、测试、可维护性、安全、API 契约、可靠性及本地 adversarial 八个 reviewer 全部完成；六项主 finding 经独立源码核对确认。审查时结论为 Ready with fixes；六项均已由本计划 U5 修正，上表保留失败复现与修复验证，最终集成通过，无遗留确认项。重复媒体路由抽取建议因没有实际缺陷而关闭，不作为遗留工作；Collection select/clear-to-save 覆盖建议已落实。

当前 checkout 的原 dashboard 文件、translation 既有改动及其他任务的并行改动保留；本任务只新增 13 个翻译键。没有新建 worktree、提交、PR、部署或修改 master/REL/Candidate/DC/PG 状态。本计划于 2026-10-01 完成，执行体冻结。
