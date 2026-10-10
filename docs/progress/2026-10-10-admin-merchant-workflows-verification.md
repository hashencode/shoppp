# 管理后台重构验证证据

Owning plan: [管理后台商家任务与发布流程重构](../plans/2026-10-10-2307-refactor-admin-merchant-workflows-plan.md)。本文件只记录基线和验证，不维护执行队列。

## U1 实施前基线

- Checkout: `codex/fix-new-arrival-icon`，HEAD `c24e74729810ec156442abebf9a646ff0f208da1`。现有源代码无未提交修改；本会话计划为新增文档。无需 worktree。
- 所有现有菜单、隐藏表单/详情和直接访问权限均映射至计划 R1/R3；U2 保留 route key、URL、permission。集合入口目前隐藏，需要按 R1 显示。
- Catalog 候选只冻结 published 来源，创建权限为 catalog.publish 加六项来源 read（含 settings.read）；GET 只要求六项 read 与 human principal。U5 逐 endpoint 核验纠正早期将 GET 也记为七项的推断。私有候选禁止 public build/deploy；装修批准冻结 Snapshot，不代表生产激活。
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

## U2 菜单与消费者验证

- behavior_changed: true。七组菜单、菜单专用名称及系列入口已实现；32 个 route 的 key/path/title/permission/menuMode/breadcrumb/icon 保持，组件绑定一致。共享内容几何不变。
- 先更新 index/auth-route-guards/shell 既有测试：旧实现 65 tests，21 个业务合同失败（另 2 个几何断言选择器问题已修正）。
- 8 个 L3 consumer suites 共 124 tests：7 suites 80/80 通过；shell 选择器修正后 44/44 通过。选择器修正只适配 AntD 多菜单与图标 accessible name，不放宽业务断言。覆盖双语菜单、权限、深链/query/hash/Back/指南回程、路由标题与容器。
- Host 实际检查生产与测试 diff；另运行原 welcome/dashboard 2 suites，28/28 通过，覆盖正常、空、加载、错误、权限与数据状态。7/7 protected hashes 一致。
- changed-file ESLint、Prettier 和 diff check 通过。类型和原生浏览器收尾留给 U6。测试运行器使用本地回环端口，sandbox EPERM 后同命令升级权限运行；失败不是产品行为失败。
- 不引入导航 registry、焦点/ARIA 框架；保留原 AntD 与 recipe 合同。

## U3 动作与真实状态验证

- behavior_changed: true。移除无 storefront consumer 的商品 token 预览入口与 Admin adapter；保留商品检查、修订数据检查及真实发布。来源发布只表示供后续店铺版本使用，历史部署进入闭合详情；私有构建可预览与批准待正式发布明确区分。
- 既有 10 个页面 consumer suites 更新后先观察旧入口、历史状态与反馈的预期失败；最终 94/94 通过（`--pool.maxWorkers 2`，59.4 秒）。未修改超时；先前重型并行的七项超时未复现。Catalog 再检查 7/7 通过。纯按钮文案改名以 diff/引用检查验证，调用保持不变。
- 只读 content 编辑器中，发布确认的 OK/Cancel 继承了 Form 禁用状态。隔离测试先证明 OK disabled，再以局部按钮属性恢复已授权的确认与取消；保留 dirty、busy、reason、version 和权限 guards，没有 dirty 豁免。
- Host 审查生产 diff、测试变更和最终日志；changed-file ESLint 与 diff check 通过。Protected 页面、既有翻译值及后端合同保持；未实现 token 前台、新发布平台或 active 状态推断。
- 临时运行日志：`/tmp/shoppp-u3-focused-final.log`、`/tmp/shoppp-u3-content-confirm-red.log`、`/tmp/shoppp-u3-revision-red.log`。执行体以本计划 U3 完成项为准，日志不承担队列权威。

## U2/U3 简化检查

- 使用 ce-simplify-code 的复用、质量、效率三个完整规则审查已提交 `c24e747…5422ff7` 的人写代码；不包括正在编写的 U4，也不改变 session-settled KTD 和 protected 页面。
- 应用质量发现 1 项：content 发布/归档 Popconfirm 的重复禁用表达式改为两个局部派生布尔值。输出、顺序、Cancel 行为及运行时 version/reason/dirty/busy checks 保持；复用和效率无保留问题，无新增抽象。
- content-editor 原 consumer suite 通过；局部 ESLint、Prettier 通过。没有行为变化，无新增镜像测试。最终 Admin typecheck 统一在 U6 稳定代码后运行。

## U4 设置归属与保存验证

- behavior_changed: true。经营页链接指向联系/配送/政策唯一 owner，保留查询与指南回程；实际编辑后局部 AntD 确认离开，取消保留修改。加载、复原、重置和保存后不误报 dirty。保持 whole-object PUT 与 preserveContactEmails。
- 五个既有 settings suites 先更新再运行：31 tests，10 个目标失败；最终 32/32 通过，13.397 秒。测试覆盖 owner 权限/query/回退、未保存处理、非法政策 URL、来源/冻结联系边界与 policy 精确版本/reason/conflict。
- Host 审查实际生产 diff。真实浏览器 Launch desktop 2/2、390px narrow 2/2 通过：Cancel 保留 EUR；显式 discard 跳转；原子保存精确 payload/preserveContactEmails；Save 就近说明在窄屏内可见。jsdom 不重复要求库弹层动画/重复标题 DOM，保留应用拥有的状态与导航断言。
- 原 API contact-profile/candidate-release/experience-api/public-boundaries 4 suites：85 pass / 1 skipped（外部 U9 handshake 未配置）。较新邮箱后保存旧经营表单的既有 API 测试通过；没有服务合同改变。
- Worker ESLint、diff check 通过；日志 `/private/tmp/shoppp-u4-green-confirmed.log`。没有 settings hub、复制表单、拆 writer 或 protected 内容变化。

## U5 自动店铺预览验证

- behavior_changed: true。移除商品列表候选面板；装修 Preview store 顺序为保存 → 授权候选 POST → 精确 GET/ID/digest 检查 → 保存版本与候选校验 → snapshot/build/grant。每次显式准备新预览，旧打开预览身份不跟随；不隐式发布来源或公开构建。
- POST 七项权限与 GET 六项 read 分开；只读操作者可恢复已授权固定预览，但不能调用 draft validation。既有 awaiting_operator/approved run 保持冻结身份，不自动换来源。
- proof-first 11 个目标失败；3 个 focused suites 70 pass。最终 7 个 consumer suites 82 tests 中 81 pass；原 rejected Block command 10 秒超时，隔离同一用例 1 pass，无产品或超时设置改动。覆盖来源三类缺项、每项读取/准备权限、同装修新来源重校验、无 publish 的只读恢复、精确绑定及延迟保存离开。
- 两个新 native 场景通过：Save 后精确候选/校验/预览/授权/批准等待正式发布；空商品来源保留已保存装修并提供处理入口。Host 检查 actual production/test diff；补齐 Router Link 的 `/admin` basename/指南 query 和延迟保存的 load generation。技术版本/构建/批准审计和失败码进入关闭详情；没有新请求框架。
- 无 consumer 的旧候选 GET/status adapters 与面板删除。结构搜索确认 10 个面板专用翻译不再被生产消费者使用后删除；其他既有翻译值不改。预览产物过期/授权撤销不等同候选失效，保留原恢复合同。
- 日志：`/tmp/admin-u5-red.log`、`/tmp/admin-u5-final-authoring.log`、`/tmp/admin-u5-consumers-final.log`、`/tmp/admin-u5-isolated.log`、`/tmp/admin-u5-browser-final.log`。局部 Prettier、diff check 通过；完整原生浏览器与类型/审查由 U6 收尾。

## U4/U5 简化检查

- ce-simplify-code 三个完整 reviewer 规则检查 `dc193840` 后的限定 U4/U5 人写代码，排除受保护页面、早期 U2/U3 和主机 U6 文件。三个终态结果均已收集。
- 应用质量发现 2 项：三个 source recovery 分支改为平铺 if/else；Catalog 列表只剩一个 recipe 后移除无作用 fragment。权限条件、输出与调用顺序保持。复用 0、效率 0；效率观察 1 项跳过：保存后后台 preview-context GET 的抑制可能改变失败恢复，没有行为等价证据，故不为减请求改合同。
- 三类来源恢复 3 pass；最终权限清理修正后同组及六项 read 缺失矩阵 9 pass。类型和 changed-file lint 统一通过下述 U6 gate，不重复整套业务测试。

## U6 核心验收

L3 范围：U2 route/shell 消费者、U3 内容与商品动作、U4 settings 原子 writer 和局部 owner links、U5 preview 编排/局部 source feedback/Catalog 与 storefront adapters。contracts/API 行为未改；候选及公开边界沿用 U4 已验证的 4 个 API suites（85 pass，外部 U9 exact handshake 1 skip，未配置 `U9_EXACT_HANDSHAKE_URL`），不冒充 hosted/生产证据。

原生 Browser Mode 只替换 HTTP transport，使用真实页面、AntD、router、i18n 和浏览器 CSS：

| Consumer        | desktop | 390px narrow | 验证范围                                                                                        |
| --------------- | ------- | ------------ | ----------------------------------------------------------------------------------------------- |
| AppShell        | 1 pass  | 1 pass       | 七组、键盘菜单、深链和原标题/面包屑；224/80 几何保持                                            |
| Launch settings | 2 pass  | 2 pass       | Cancel 保留编辑、显式 discard、guide query、原子 PUT/保留邮箱与保存后果                         |
| Theme editor    | 10 pass | 10 pass      | 自动精确预览/授权/批准待发布、空来源、失效候选、冲突/持续错误、语言切换、键盘/触控和无 URL 凭据 |
| Content editor  | 1 pass  | 1 pass       | 粘贴内容、键盘及版本冲突恢复                                                                    |
| 原 Dashboard    | 7 pass  | 7 pass       | 原正常/空/错误/主题/时区和 resize 场景，原测试与页面不改                                        |

- 合计 42 个 native 场景 pass；按消费者边界运行，无全仓库、全模板 build 或生产操作。日志 `/tmp/shoppp-native-{shell,launch,preview}-desktop.log`、对应 `-narrow.log`；Dashboard desktop 实际日志 `/tmp/shoppp-native-protected-content-desktop.log` 只含 Dashboard，Content 单独 `/tmp/shoppp-native-content.log`；窄屏两者 `/tmp/shoppp-native-protected-content-narrow.log`。
- 类型首次 gate 发现 3 个测试文件共 4 个类型错误：未声明 matcher、ByRole 无 exact option、Element/HTMLElement 不匹配；修正为等价 value 断言、标准名称匹配和已知 HTML 节点类型。确认 `bun run --cwd apps/admin typecheck` pass。没有断言放宽或新类型兼容层。
- changed-file ESLint 覆盖 41 个 Admin TS 文件，另检查两个 tools 文件，pass。权限变化 effect 的 React 检查错误通过沿用现有零延迟 callback 清理 UI 修正；session/ref/generation 在 effect 立即失效，未削减安全检查；六项权限缺失与三类恢复 9 pass。
- `bun test tools/check-admin-i18n.test.ts --timeout 20000`：8 pass。首次新菜单目录断言观察到缺少 dynamic catalog，注册 route menu-only fields、revision status labels、candidateSourceMessages 后通过。20 秒仅为该 CPU audit 命令上限（并行初验曾超默认 5 秒），不改变仓库 timeout 配置或业务断言；最终实际 2.12 秒。
- 最后保护核对：7/7 页面/测试 SHA 相同；31 个业务 route key/path/title/permission/menuMode/breadcrumb/icon 相同；保留的 1,556 条旧翻译值相同，仅删除 10 条已证明无消费者的旧面板专用键。原 welcome/dashboard 28 个 jsdom 场景证据沿用 U2；没有共享几何、protected metadata 或内部内容改动。
- 类型/质量日志：`/tmp/shoppp-admin-typecheck-confirmed.log`、`/tmp/shoppp-admin-eslint-confirmed.log`、`/tmp/shoppp-admin-preview-access-final.log`、`/tmp/shoppp-admin-i18n-final.log`。`git diff --check` pass。只更新实际变化的 guardrail inventory，不新增规范抽象。

## 正式审查与局部修正

- ce-code-review 实际回执 `status: complete`；run `20261011-005234-a40cdb2f`，artifact `/tmp/compound-engineering-501/ce-code-review/20261011-005234-a40cdb2f`。审查 base `c24e74729810ec156442abebf9a646ff0f208da1` → HEAD `ec81d1443efd50bce8ef1a0499a020c499d82847`，完整十个方向与独立 validator 终态齐备。无 P0/P1；三个 P2 confirmed，原 verdict 为 Ready with fixes。跨模型 CLI 不具备，采用本地 adversarial lens，无内容外传，不冒称外部独立模型。
- Root 消费实际回执并重读 apply reference；以下三项均在已读局部代码内联修正，无新的 authoring 子代理、后端合同或权限调整。审查快照保留原发现，修正结果以本节追加证据为准。

| finding | 位置、依据与后果                                                                                                                                                        | 最小修正                                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1      | `theme-editor-page.browser.test.tsx` 的成功装修仍引用 removed-product，候选仅含 product-atlas，但校验 stub 无条件 valid；该数据会被真实 resolver 拒绝，旧成功证据无效。 | 用真实选择器选 Atlas；断言 PUT 保存的引用及 validate stub 的已保存引用属于该候选。错误恢复用例的缺失引用保留。                                                             |
| #2      | `theme-editor-page.tsx` 的较早 catalog 列表可以覆盖刚准备的新候选，导致 validate/startPreview 丢弃结果，甚至恢复无关旧预览。                                            | 沿用局部请求序号模式；安装精确候选使旧列表结果、失败与完成回调失效，不新增统一状态引擎。                                                                                   |
| #3      | 同页保存新版本、准备新来源或重新加载后，旧 approvedSnapshot 仍触发无版本限定的成功提示。                                                                                | 当前成功只在无本地修改且 sourceDraftId/version/sourceValidationId 匹配当前草稿及所选来源的校验时显示；历史审计仍可展开，同一身份保留成功。旧 v1 批准测试改为真实 v1 回执。 |

- 预期失败先成立：两种晚到列表时序、编辑/新来源后的旧批准，以及加载 v2 后的旧批准可在本地复现。加载相同 v1 保持成功；浏览器直接断言保存的 removed-product 与候选 product-atlas 不一致而失败。初版恢复测试误依赖折叠内按钮，改用可见的预览授权失败 → Reload saved draft 路径；不修改超时。只读请求日志断言适配现有绝对 URL，不放宽写入限制。
- 两个有实际收益的 testing gaps 已补齐：分别改变 manifestDigest/sourceDigest 时拒绝且不执行 validation/preview、不选新候选；有精确有效绑定的只读用户显式点 Preview store，只有对应预览 POST，没有 PUT、候选准备或写入校验。
- 最终装修页完整 consumer suite **69/69 pass**（86.772 秒），覆盖八个新增场景和全部既有测试；未修改 timeout 或跳过用例。日志 `/tmp/shoppp-admin-review-unit-final.log`。预期失败日志 `/tmp/shoppp-admin-review-unit-red.log`、`/tmp/shoppp-admin-review-reload-red-confirmed.log`、`/tmp/shoppp-admin-review-browser-red-confirmed.log`。
- 修正后真实 Browser Mode 桌面 **10/10 pass**（6.173 秒）、390px narrow **10/10 pass**（6.186 秒），日志 `/tmp/shoppp-admin-review-browser-desktop.log`、`/tmp/shoppp-admin-review-browser-narrow.log`。这 20 项替换上表 Theme editor 的同场景先前证据，不累计为 62 个独立 native 场景；核心合计仍为 **42**，成功数据现已有效。
- 新改动后的 Admin typecheck 与三份 TS 变更文件 ESLint pass：`/tmp/shoppp-admin-review-typecheck.log`、`/tmp/shoppp-admin-review-eslint.log`。Prettier pass。收尾保护检查仍为 7 个文件 SHA 相同、31 个 route 元数据相同、1,556 条保留翻译值相同；无 protected 内部或共享几何变化。
- 合并审查拒绝了缺少具体收益证据的统一 preview state transition 抽象建议：现有局部 request/ref 模式足以修复已证明的竞争条件，新增抽象会扩大本次维护面。该项不是延期工作。三个 primary findings 和两个 testing gaps 均关闭，无已确认但未解决的核心审查问题。

## 收尾合同复核与发布交接证据

- 按用户 ce-plan 复核规则重新对照 R1–R12、F1–F5、AE1–AE9、U1–U6、Verification Contract 与 Definition of Done：核心证据与菜单、原链接/权限、真实保存和预览边界一致；修正 #2/#3 后 R6/R8 的局部缺口关闭。没有受保护页面内部变化，未新增导航、设置 hub、全局焦点/状态或发布证据平面。
- 实际计划修订仅收录必要消费者/验证场景、纠正 GET 六项 read 与 POST 七项权限、区别候选失效和预览产物失效，以及按实际证据同步核心完成/正式发布受阻。保留 R/F/AE/KTD/U、既定产品目标和 tail 权限，无需再调整方案。不存在需要用户重选的核心设计事项。
- U7 前置证据：`apps/api/src/publishing/candidate-releases.ts` 的 `assertCatalogReleaseLifecycle` 明确以 catalog_candidate_private 拒绝 deploy/public-build/public-build-status/public-manifest-read；`apps/api/test/catalog/candidate-release.test.ts` 的公开 manifest/build-status 回归拒绝私有候选。现行 HTTP 只具 private prepare/read/status/abandon，未提供同一 ID/digest 的受权公开化、精确批准 tuple 激活和 active tuple 读取合同。
- REL 仍拥有该合同、候选冻结及 DC/PG/生产权限；本次不能用新 public Release 冒充已批准候选，不执行生产操作。整体正式发布接入没有完成；owning plan 和 master 的当前指针同步到具名受阻的 U7，验证文件不维护第二队列。
