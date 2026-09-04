# Fashion Store compatibility baseline — 2026-09-03

本文件记录 FS-R1-U1 的输入、实测与缺口；执行状态和下一动作只由
[FS-R1](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md)
的 Execution Checkpoint 决定。没有任何 DC/PG、历史浏览器或真机通过结论。

## 固定输入与工作区保护

- Checkout：`/Users/studio/Documents/GitHub/shoppp`；分支 `codex/fashion-store-components-dependencies`。
- 基准 HEAD：`ff2f10239ac518bc34d597f1104b27a7eb8a2da8`；保留已有所有未提交改动。
- 用户原有 `app/generated/active-experience.ts` SHA-256：
  `8d6d803a0221c03e24a6087819b65b52faaa90e64888cb173d12c3b3402071e6`。
  构建使用已经生成的 Fashion fixture 输入，绕过 prepare，不以 Git restore 覆盖用户文件。
- 原始三份 WIP 的字节副本与 hash：`/tmp/shoppp-fs-r1-u1-20260903/pre-work.json`。
- 数据：现有 `snapshot-fashion-store-fixture-1`、fixture-preview；没有真实购物或支付请求。
- 系统：macOS 15.7.5 / 24G624，arm64。浏览器视口 1440×1000、390×844，DPR 1。
  `mobile` 在本入口仅表示窄视口，**不表示触屏或手机设备认证**。
- 每项测试使用新 context/冷缓存、localhost、无人工网络限速；静态服务器按 Accept-Encoding
  返回 gzip。记录初始页面和搜索打开/Escape/滚至 Footer 后的资源，二者为同一资源时间线的
  两个快照，不能相加。零 transferSize 保留为缓存/无可见传输信息，不补造字节。
- 时间基线：普通动态和 reduced-motion 独立 context；首页每 2 秒采样，共 16 秒，覆盖
  3 张 hero 的 4 秒自动播放循环；没有冻结时间或注入静态比较 CSS。
- 图片证据：每条路由 initial 全页、search-open 视口；无 JS 首页全页。动态截图只是时间点，
  不能当作稳定像素金图；后续同环境命名状态比较仍沿用原阈值。

## Q1 环境核实与验收方法

最低版本和当前稳定版本均须独立验收。执行者收集自动化记录，设备操作者提供实际系统、
浏览器/宿主和输入证据；当前未提供的设备没有指定完成责任人，不伪造验收签字。

| 目标                    | 本次可核实环境                                                              | 最低版本结果 / 补证方法                                          | 输入及验收责任                           |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| Chrome ≥111             | 已安装 Chrome 152.0.7977.75；自动化 Chromium 151.0.7922.34                  | 111 未提供；取得可验证 111 + 当前稳定安装并执行代表路由/购物流程 | 执行者：鼠标、键盘                       |
| Android Chrome ≥111     | `adb devices -l` 无设备                                                     | 未验证；连接实际 111/当前 Chrome 设备并记录系统                  | 设备操作者：触摸、纵向滚动、横竖屏、购物 |
| Edge ≥111               | `/Applications` 未发现 Edge                                                 | 未验证；需要真实 Edge 111/当前版，不能复用 Chrome 结论           | 执行者：鼠标、键盘                       |
| Firefox ≥115            | 已下载 Playwright Firefox 153.0 / revision 1538                             | 115 未提供；Playwright patched Firefox 不代表正式发行版验收      | 执行者：鼠标、键盘，补 115/当前正式版    |
| macOS Safari ≥16.4      | 已安装 Safari 26.4；本次 Playwright WebKit 26.5 / revision 2336             | 16.4 未提供；需真实 Safari/系统组合；WebKit 不代替 Safari        | 设备操作者：鼠标、键盘                   |
| iOS/iPadOS Safari ≥16.4 | `xcrun simctl list devices available` 只有 iOS 26.0 iPhone 17 Pro（未启动） | 16.4 与 iPad 环境均缺；需真机或可验证版本环境                    | 设备操作者：触摸、弹层、横竖屏、购物     |
| Android WebView ≥111    | 无 adb 设备/宿主记录                                                        | 未验证；实际宿主 App + 系统 + WebView 内核版本须一起记录         | 设备操作者：宿主内完整购物流程           |
| 微信等内嵌浏览器        | 桌面 WeChat 安装不构成移动宿主证据                                          | 未验证；逐一列出 Android/iOS 宿主、App、系统和内核组合           | 设备操作者：实际宿主触摸/弹层/购物       |

本次测试 Chromium 151.0.7922.34、Firefox 153.0、WebKit 26.5。Playwright 引擎的版本来自运行中的 `browser.version()`，不称为验收时当前正式稳定版。
真实 Turnstile 挑战仍需正常人工设备环境；本次 fixture 检查未触发挑战。

## Q2 版本研究与构建边界

本次只在 `/tmp/shoppp-fs-r1-u1-20260903/dependencies/` 解包研究，不修改 package.json/bun.lock。
精确候选和 npm tarball integrity 已核对，但最低环境、真实 Vue 组件构建及交互验证未齐，
**Q2 未关闭，不能把候选写成已经验证和锁定的依赖**。

| 能力            | 精确候选 / 来源                                                                                                                                                                      | 实测或已核实                                                                                                                   | 尚缺                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Swiper          | `11.2.10`，MIT，[固定版本源码](https://github.com/nolimits4web/swiper/tree/v11.2.10)，[npm 元数据](https://registry.npmjs.org/swiper/11.2.10)                                        | Vue 适配、模块和 CSS 独立入口存在；无 window/document 的 Vue SSR 探针输出 slide HTML；探针同时有 slot 调用时机警告，原日志保留 | 真实 SFC 构建、最低浏览器交互、loop/方向/图片迟到验证；官方当前文档不是该旧版本最低支持保证 |
| Bootstrap Modal | `5.3.2`，MIT，与现有 vendor 基础版本对齐；[固定 Modal 源码](https://github.com/twbs/bootstrap/blob/v5.3.2/js/src/modal.js)，[npm 元数据](https://registry.npmjs.org/bootstrap/5.3.2) | 独立 Modal 模块直接 SSR import 实测抛 `document is not defined`；data-api trigger 注册默认焦点恢复；Modal 的依赖图不含 Popper  | 客户端动态加载/失败重试、标准 trigger 焦点契约、最低浏览器和 CSS 验证                       |
| Lucide          | 现有 `@lucide/vue` 声明 `^1.24.0`                                                                                                                                                    | 继续既有按图标导入决策                                                                                                         | U2 逐 glyph 和品牌映射；不批量导入图标集                                                    |

原始 integrity 记录保存在上述目录各包 `registry.json`；Swiper：
`sha512-RMeVUUjTQH+6N3ckimK93oxz6Sn5la4aDlgPzB+rBrG/smPdCTicXyhxa+woIpopz+jewEloiEE3lKo1h9w2YQ==`；
Bootstrap：`sha512-D32nmNWiQHo94BKHLmOrdjlL05q1c8oxbtBphQFb9Z5to6eGRDCm0QgeaZ4zFBHzfg2++rqa2JkqCcxDy0sH0g==`。

安装依赖为 Nuxt 4.5.1 / Vue 3.5.40 / Vite 8.1.5；当前项目未显式设置 Vite build target。
本机 Vite 的 baseline 常量是 chrome111、edge111、firefox114、safari16.4、ios16.4，
但升级可改变默认值，且编译目标不能证明 CSS/API 与实际交互。

确定的兼容缺口：`integration.css` 的 Shop 桌面 Header 规则使用 `:has()`；Firefox 115
不支持该选择器（[Mozilla 的兼容数据](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has)）。
本次记录改动前样本，不将现代 Firefox 通过写成最低版本通过。灯箱的 `showModal` 和
`100dvh` 已纳入后续实际环境检查；没有为了检查提前改变页面功能。

## 复测入口

以下命令工作目录为 `apps/storefront`。先确认 generated 模块仍对应目标 fixture，且输入文件存在。
构建和服务器均为本地，不执行部署脚本。保留生成文件前后 hash。

```sh
STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-preview-input.json bunx --no-install nuxt generate
bun scripts/finalize-static.ts
STOREFRONT_BUILD_MODE=preview bun scripts/verify-static.ts
bun scripts/check-bundle-budget.ts
bun scripts/serve-static.ts 3426
```

另一个终端：

```sh
STOREFRONT_FASHION_STORE_COMPATIBILITY=1 STOREFRONT_FASHION_STORE_BASE_URL=http://127.0.0.1:3426 PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx --no-install playwright test --config playwright.fashion-store.config.ts
```

显式入口共 12 个 project：三引擎 × 两种动态模式 × 两个视口；每个 project 7 项测试。
默认 Fashion 四视口 suite 和原有 JSON 行为报告路径保持原义；本入口单独输出
`test-results/fashion-store-compatibility-results.json` 和 `test-results/fashion-store-compatibility/`。
设置外部 base URL 时不启动构建或源服务器，避免覆写当前生成输入。

## 证据边界

- [能力清单](fashion-store-dependency-inventory.md) 属于只读盘点，无镜像单元测试。
- 新增浏览器测试是生产行为不变情况下的 characterization；不要求制造红灯后改生产代码。
- typecheck 与 16 项路由/捕获契约/验收 runner 测试通过；静态校验和所有 15 条路由初始 JS
  300 KiB 预算通过（75,203 字节为首页初始 JS，最大初始入口 76,758 字节 gzip）。
- 初始 JS 预算不含所有运行期 vendor/CSS/font，不能把它替代 R12 的累计传输。
- 本次资源的“交互后”只含共享搜索和滚动，不含完整加购、灯箱、结账挑战，也不是 live 基线。
- live 构建、失败路径完整基线、集合轮播暂停/循环边界、全命名状态及最低版本证据尚未齐备。
  这些缺口不因新增测试成功而消失；完整计划不能据此完成。

## 本次三引擎与资源结果

- 初始完整矩阵：84/84 通过，0 skipped、0 flaky，6.7 分钟。
- 核对发现 runtime fallback 可被共享控件 smoke 掩盖，且中途失败会丢初始记录；
  已补充 runtime status/error 断言与 finally 附件，受影响的 60 条路由项复测全部通过。
  普通动态为 ready，reduced-motion 交互后为 static，错误字段为空。
- 未改的 12 项时间循环和 12 项无 JS 检查引用首轮结果，没有为纯记录补强重复执行。
- [结构化摘要与文件 hash](fashion-store-compatibility-baseline.json) 保留浏览器版本、
  每项目/路由两阶段几何、JS/CSS/font 分类字节、runtime、错误和时间样本。
- 原始 JSON（含逐资源 URL）、PNG 与日志保存在
  `apps/storefront/test-results/fs-r1-u1-20260903/`（本地 ignored）；首轮与复测分目录，
  普通后续测试不会覆盖这份命名归档。截图没有设置匹配通过阈值，本次只建立样本。
- 默认 Fashion suite 列出 416 项，不包含新增显式基线测试；新增文件 lint/format 检查通过。

普通动态 Chromium 桌面冷缓存记录如下，单位为 gzip encoded body 字节；全部资源域名
为本地服务器。这里的“初始”是首次导航至 networkidle，不是构建 manifest 的入口闭包。
搜索和 Footer 滚动没有增加该组合的 JS/CSS/font 请求；其他组合详见 JSON。

| 页面                               |      JS |     CSS |    字体 |      累计 |
| ---------------------------------- | ------: | ------: | ------: | --------: |
| `/`                                | 394,667 | 199,819 | 837,917 | 1,432,403 |
| `/shop`                            | 389,875 | 199,819 | 486,123 | 1,075,817 |
| `/products/relaxed-corduroy-shirt` | 397,949 | 200,727 | 511,603 | 1,110,279 |
| `/cart`                            | 390,985 | 199,819 | 329,559 |   920,363 |
| `/checkout`                        | 395,209 | 199,819 | 329,559 |   924,587 |

首次导航实际 JS 已超过 307,200 字节。现有 `check-bundle-budget.ts` 的静态入口闭包
通过并不证明这些运行期请求低于 300 KiB；U9/U10 必须同时比较上述实测和原预算，
不能用两者口径差异掩盖回退。该超额属于改动前基线，当前未宣称 R12 达成。

## 独立源码比较与既有性能入口

既有 `fashion-store-theme.spec.ts` 的 Header/Hero/首张商品卡源码比较在 desktop/mobile
各通过一次（2/2）。参考服务器使用仓库原 Crafto 目录，未改源文件、截图阈值或允许差异。
这是两视口区域比较，不能扩展为全部页面/命名状态的完整比较已通过。
原始报告与区域 PNG 在命名归档的 `source-comparison/`、`source-comparison.json`。

性能命令复用相同静态构建，未与基线浏览器采样并行：

```sh
STOREFRONT_THEME=fashion-store STOREFRONT_PERF_BASE_URL=http://127.0.0.1:3426 PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bun run test:perf:fashion-store -- --output test-results/fs-r1-u1-20260903/performance
```

该入口按既有配置强制 reduced-motion，使用 mobile Lighthouse 模拟网络，最多三次尝试；
它不能证明普通动态时的性能。逐次结果保存在归档 `performance.log`，不会只保留最好值。
首页首次 performance 为 0.75，LCP 5860.9ms，CLS 0.00510，TBT 44ms；低于 0.90 预算。
既有入口自动重试后为 1.00、LCP 1127.3ms。必须将首次未达标与重试通过同时继承到
后续比较，不能将本次描述为冷缓存性能无回退或全部首次通过。


## 用户批准的验证范围调整与 U1 本地收尾

2026-09-03 用户批准保留 U1 的能力盘点与本地基线，缺失历史浏览器/真机验证移出本轮实施和完成门槛；最低版本仍约束实现，未验证行保持原样。上文因缺设备不能完成的说法记录的是调整前条件，新的完成条件以活动计划为准。

依赖已精确锁定，并完成 [SSR/模块与三引擎验证](fashion-store-dependency-versions.md)。
Nuxt Vite 的 JS/CSS target 显式固定为 Chrome/Edge 111、Firefox 115、Safari/iOS 16.4。
再次检查级联确认 `:has` 的 Shop Header 声明只是重复规则，Header.vue 已用不含 :has 的 `top:40px !important` 覆盖它；原先将此推断为实际 Header 失效并不充分。本次删除冗余声明，不新增路由类或状态。
相同 fixture 重新构建/静态验证/15 路由入口预算通过，三引擎桌面 Shop 的现有基线测试 3/3 通过。此项为配置及冗余样式删除，使用既有几何检查代替镜像单元测试。后续各组件单元承担自己的交互/失败路径，U11 汇总可用环境完整回归。
