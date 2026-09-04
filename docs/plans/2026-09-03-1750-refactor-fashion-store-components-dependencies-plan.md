---
title: Fashion Store Shared Components and Dependency Consolidation
type: refactor
date: 2026-09-03
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
origin: docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md
execution: code
plan_role: active-bounded-successor
plan_alias: FS-R1
---

# Fashion Store 通用组件与依赖精简开发计划

## Goal Capsule

- **目标：** 让 Fashion Store 的重复控件行为一致、轮播更易操作，并减少购物者加载的无用资源。
- **方法：** Lucide 按图标导入、Swiper 统一轮播、轻量组件抽取、兼容弹层及模块化依赖，分批替换并比较可观察结果。
- **优先级：** 浏览器兼容性 → UI 与业务行为一致性 → 可维护性 → 体积和性能。
- **当前交付：** 用户于 2026-09-03 确认最低浏览器范围并授权实施，随后批准保留本地三引擎基线并将缺失历史浏览器/真机验证移出本轮实施和完成门槛，最低版本仍为实现目标。Q1/Q2 关闭，U1-U11 已于 2026-09-04 完成并交回 REL-Pre-DC；详见检查点和最终验证证据。
- **执行方式：** 使用现有主工作树和 codex/fashion-store-components-dependencies 分支，逐单元本地实现与验证；保留既有 WIP，不新建工作树、PR 或部署。
- **停止条件：** 已证实无法满足兼容实现目标、需要改变购物规则或出现未授权视觉差异时，记录具体问题及影响；单纯缺失历史浏览器/设备不再阻塞本轮实施或完成，不把未验证写成通过。
- **尾项归属：** 本计划独占新增重构单元、兼容问题和清理尾项；REL 继续拥有候选和生产判断。

---

## Authority and Lineage

- **产品上游：** docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md；origin 中的 FS Product Contract；Commerce/THEME 的产品和平台边界不变。
- **继承基线：** FS 已完成的 U1–U13 及其原有 R/F/AE/KTD 标识；FS-F2 的 U1–U4、R1–R5、KTD1–KTD4 及 docs/progress/fashion-store-shared-style-ownership.md。保留 Shell 中性默认身份、首页显式身份、共享组件样式归属和有意的页面变体。
- **重点继承：** FS 的 R1–R10、R20–R22、R28、R39–R45、R49–R52、R54–R55、R61、R70–R71；FS 的 F1/F2/F6/F8 及对应 AE；FS-H2 的 R1/R2/R5/R7/R9–R16、F2–F4、AE1–AE4、KTD2–KTD8/KTD11–KTD13。新局部标识均以计划别名 FS-R1 限定，例如 FS-R1-U1；不替换历史编号。
- **明确替代：** 本计划激活并完成对应单元后，以 R2/R3/R6 和 KTD1–KTD5 替代 FS-H1-R3 中“必须使用原图标字体、不得使用相近 SVG 图标”和“应用必须维持原五份 CSS 加载”的实现限制，以及 FS-H1-R4/KTD3/KTD5 中强制原 vendor 复用的对应限制。继承其中的字体、图片、布局、完整交互和清理要求。
- **差异范围：** Lucide 字形替换是用户选择的视觉变化；Swiper 的拖拽、循环实现可以改善，但布局、内容、导航目的和本文未明确改变的操作保持原义。不得据此豁免整页比较。
- **参考资产：** Crafto 源文件与 UPSTREAM.md 哈希仍作为独立参考；不修改源快照来制造通过。应用可停止导入这些源文件，改用可追溯的构建资源。
- **并行计划：** REL 当前仍在 Pre-DC；FS-F2 已完成。DS/DS-P1、Admin 和 CI 保持主计划的各自归属。正式跨模板候选回归属于 DC3。
- **验证范围修订（2026-09-03 用户批准）：** 保留 U1 的能力盘点、可复测本地基线及版本锁定；撤销原 R1/KTD10/U1/U11/Verification Contract/DoD 中“所有最低历史版本和真机实测齐备才可实施或完成”的门槛。本轮以可用 Playwright Chromium/Firefox/WebKit 及其实际版本完成回归，最低版本矩阵继续约束实现；缺失环境标为未验证，后续有设备时补测。FS-R1 保留这份未验证范围的归属和来源，不把它作为本轮未完成实现尾项；补测也不推定 DC/PG 通过。稳定 R/AE/KTD/U 标识保持。
- **激活及交回：** 2026-09-03 按用户指令激活 FS-R1，使用当前 codex/fashion-store-components-dependencies 分支及主工作树，同步更新本检查点与主计划；最终交回 REL，不把局部验证写成 DC/PG 通过。

---

## Execution Checkpoint

- **计划分类：** Complete / U1-U11 Complete；2026-09-03 激活，2026-09-04 按已批准的 Q1/KTD 和本地验证范围完成。
- **当前单元：** 无活动实施单元；U11 已完成，执行已交回 REL-Pre-DC。
- **单元状态：** U1 Complete（按用户批准的本地验证范围）；U2 Complete；U3 Complete；U4 Complete；U5 Complete；U6 Complete；U7 Complete；U8 Complete；U9 Complete；U10 Complete；U11 Complete。
- **阻塞：** FS-R1 范围内无阻塞。历史浏览器/真机/内嵌宿主仍未验证，按批准范围不阻塞本计划完成；最低版本实现目标保留。
- **下一具体动作：** FS-R1 无后续实施动作。REL-Pre-DC 恢复产品执行权，继续能力范围审计及完整候选身份强制；本计划完成不推进 DC/PG。
- **本次证据：** [能力清单](../progress/fashion-store-dependency-inventory.md)、[兼容基线](../progress/fashion-store-compatibility-baseline.md)及其 JSON；84 项首轮矩阵与受影响的 60 项补强复测通过，源码比较及预算口径差异见证据。U2 的三引擎 × 三视口 27/27 检查及图标状态检查通过，见 [图标映射](../progress/fashion-store-icon-mapping.md)。U3 的三处受控数量消费者及输入/提交/失败恢复验证见 [数量证据](../progress/fashion-store-quantity-controls.md)。U4 的局部 Tooltip 迁移与三引擎/消费者验证见 [Tooltip 证据](../progress/fashion-store-tooltip.md)。U5/U6 的首页、Product、Shop 与 About 轮播/画廊迁移和交互证据见 [轮播证据](../progress/fashion-store-carousel-migration.md)；U7 Bootstrap Modal 的键盘、计数、关闭、滚动解锁与焦点恢复见 [灯箱证据](../progress/fashion-store-product-lightbox.md)。U8 的复用边界及 Cart/Checkout 验证见 [购物复用证据](../progress/fashion-store-commerce-reuse.md)。U9/U10 的旧运行时退出、CSS 入口、关键源码区域及五路由 56.2%-69.9% 累计压缩资源下降见 [运行时与 CSS 证据](../progress/fashion-store-runtime-and-css.md)和 [JSON 明细](../progress/fashion-store-final-resource-baseline.json)。U11 的完整 fixture/live、三引擎、reduced-motion、无 JS、路由重挂载、性能、静态预算、类型、lint 及代码审查见 [最终验证](../progress/fashion-store-modernization-verification.md)。未提交、未部署、未推进 DC/PG。
- **检查点规则：** 状态、当前/下一单元、顺序或完成结论改变时，同步更新主计划。证据文件只记录输入、结果和差异，不维护第二套执行队列。
- **工作区保护：** 规划时 apps/storefront/app/generated/active-experience.ts 有用户改动；后续构建前记录生成文件基线，不能用恢复命令覆盖用户内容。

---

## Product Contract

### Summary

先形成页面与能力清单，建立同浏览器、同视口的视觉和行为基线。再替换图标、小控件、轮播和图片弹层，最后退出整包 vendor、jQuery 及失效样式。每一批替换都移除对应重复实现并提供回归证据。

### Problem Frame

Fashion Store 已有共享 Shell、Header、Footer、ProductCard、MiniCart 和搜索组件，但数量输入、轮播、加购状态与部分表单展示仍分散实现。应用加载的 vendor 包包含远多于当前显式初始化的功能。已有测试主要依赖 Chromium 视口，不能证明旧版 Safari、Firefox 或应用内浏览器可用。单纯换库或删除文件，可能造成样式、手势、状态同步和加载行为退化。

### Requirements

**兼容、视觉与业务**

- R1. 以 Q1 最低版本矩阵作为实现和依赖选型目标；本轮在可用 Chromium/Firefox/WebKit 的实际版本验证指定页面与关键购物交互。缺失历史浏览器、真机及内嵌宿主列为未验证，后续具备环境时补测，不阻塞本轮实施和完成；不得以现代引擎或静态展示冒充这些环境的完整支持。
- R2. 除已登记的图标字形及轮播操作改善外，保留现有布局、字体、图片、响应式规则、文案和业务结果。
- R3. 交互不得仅依赖目标矩阵未覆盖的新原生元素或 API；应用负责一致的视觉样式，标准弹层行为由经过验证的原语负责。
- R4. 保留现有路由、Composer/ViewModel、稳定商品/变体 ID、购物车唯一状态源、服务端金额与库存校验；fixture 不产生真实交易请求。

**组件与依赖**

- R5. 抽取图标、数量输入、Tooltip、轮播/画廊和有证据的购物/表单重复部分；同类控件使用同一行为来源，页面保留必要变体。
- R6. 普通 UI 图标统一 Lucide；品牌标识保持正确品牌图形，只纳入已使用资产。
- R7. 现有真实轮播统一一个兼容版本的 Swiper；停止维护 Fashion Store 自写的拖拽、定时循环和尺寸控制引擎。
- R8. 最终应用不加载 Fashion Store 整包 vendors.min.js 和 jquery.js；剩余必要库有明确用途、锁定版本、许可证与加载入口。
- R9. 删除已无消费者的 JS、插件 CSS 和图标字体加载；保留必要基础样式与本地字体，静态资源不依赖公共 CDN 回退。
- R10. 保留 Turnstile、支付跳转及业务 API 的原有职责与安全边界；按流程加载，不能以精简为由削弱校验或放宽 CSP。

**证明与维护**

- R11. 使用既有测试框架，覆盖普通动态模式、减少动态效果模式、无 JS、失败路径和路由重挂载；保留行为 ID，替换过时实现断言。
- R12. 相同输入与测量条件下，指定页面的 JS/CSS/字体累计压缩传输总量降低，单页初始资源不回退，并满足既有初始 JS 300 KiB 上限和性能预算；未测量前不承诺百分比。
- R13. 完成时不存在双轮播引擎、重复 Tooltip 初始化或本次废弃试验代码；给出短维护说明和逐库去留依据。

### Scope Boundaries

- **主范围：** fashion-store 的现有页面及控件，涵盖 fixture 和 live 的实际消费者。复用平台已有能力；只有具体复用证据才修改 theme-engine 边界。
- **保留的业务差异：** 直接加购与选择变体、fixture 本地状态与 live 交易、账单地址与运费估算字段不能为统一而合并语义。
- **不新增：** 真实首页轮播、真实商品详情画廊/灯箱目前不存在的完整功能。它们列为后续独立功能扩展；本次只让新增共享组件能够接受类型化输入，不增加未用的配置层。
- **暂不引入：** Tailwind/shadcn、另一套状态管理、第二个测试平台、通用全站弹层管理器、跨模板组件大迁移。
- **CSS 范围：** Bootstrap 基础布局、Reboot 和在用工具类保留；不把全量重写 Crafto 样式当作本次完成条件。
- **交付边界：** 本地代码和验证；不包含部署、真实支付、候选冻结或生产激活。

### Acceptance Examples

- AE1. Covers R1/R2/R7：首页手机横向拖动切换图片，纵向滑动仍能滚动页面；商品集合的拖动不影响主视觉轮播，卡片链接不会在拖动后误触发。
- AE2. Covers R1/R3/R7：商品缩略图、主图与灯箱显示同一图片；打开灯箱暂停自动播放，关闭后恢复正确的暂停状态、焦点与页面滚动。
- AE3. Covers R4/R5：live 购物车改数量后，Header MiniCart、购物车和结账摘要显示同一权威结果；接口失败不显示虚假的成功金额。
- AE4. Covers R1/R3/R5：Tooltip 鼠标悬停或键盘聚焦可见，Escape 可关闭；靠屏幕边缘和滚动容器时可阅读，触屏关键功能不依赖悬停。
- AE5. Covers R8–R10：普通页面无整包 vendor/jQuery 和旧图标字体请求；结账有配置且需要挑战时仍能加载 Turnstile，支付跳转原样工作。
- AE6. Covers R2/R11：首页 → 商品 → 分类 → 首页及浏览器前进/后退后，轮播、提示、滚动进度和共享样式不残留前页状态。

### Browser Support Matrix — Q1 已关闭

2026-09-03 用户采用推荐的最低版本。以下最低版本仍为 R1 的实现目标，不是已通过的兼容性声明。用户后续批准本轮验收使用可用三引擎，表中缺失的正式浏览器/历史版本/设备环境保留为非阻塞未验证项。

| 浏览器或环境 | 最低版本 | 有对应环境时的验证方式 |
| --- | --- | --- |
| 桌面 Chrome | 111 | 鼠标、键盘；最低版本和验收时当前稳定版 |
| Android Chrome | 111 | 真机触屏、页面滚动、横竖屏及购物流程 |
| Edge（Chromium） | 111 | 鼠标、键盘；不能以 Chrome 测试直接替代 |
| Firefox | 115 | 鼠标、键盘；最低版本和验收时当前稳定版 |
| macOS Safari | 16.4 | 对应真实 Safari/系统组合；不能用当前 Playwright WebKit 冒充 |
| iPhone / iPad Safari | iOS / iPadOS 16.4 | 对应真机或可验证版本环境，包含触屏、弹层和购物流程 |
| Android WebView | Chromium 内核 111 | 同时记录宿主 App、系统和内核；普通 Chrome 结果不能替代 |
| 微信等应用内浏览器 | 沿用对应平台的上述最低内核/系统要求 | 单列实际 App/系统/内核组合及真机证据，不仅凭 App 或 Android 版本判定 |

- IE、EdgeHTML 不在支持范围；Safari/iOS 15.6 不纳入本轮完整支持目标。其他操作系统须能运行上述浏览器，实际系统版本记录在 U1 证据中。
- U1 为每一行登记已知版本/环境、输入模式和可执行验证方式；缺失环境明确记录未验证，不要求为不可得设备虚设验收人。对内嵌浏览器只为列明并验收的宿主组合出具通过结论，不泛称所有 App 均支持。
- 最低版本与正式稳定版在有环境时补测；本轮仅声明实际已测引擎版本的结果，缺失环境不阻塞 U1–U11。依赖升级不得自动提高本矩阵。不能用 Nuxt compatibilityDate 或仅设置编译目标代替 API、CSS 和实际交互验证。
- 完整支持包含 UI 布局、关键交互和购物流程。Turnstile 自动化采用官方测试密钥，真实挑战在正常人工真机环境验证；测试密钥通过不能代替真实服务兼容证据。不包含真实支付交易。

### Open Questions

- **Q2 — 已关闭：** 精确锁定 swiper 11.2.10 与 bootstrap 5.3.2，Vue SSR、生产构建和三引擎模块验证见 [版本证据](../progress/fashion-store-dependency-versions.md)。Modal 只能客户端动态导入，并使用标准触发契约继承焦点恢复；模块迁入产品后的完整状态验证仍归 U5–U7。
- **Q3 — 非阻断：** 图标语义无法完全对应及评分/收藏填充形态，由 U2 对照表标记局部差异；不能把品牌 Logo 替换成含义相近的普通图标。

---

## Planning Contract

### Key Technical Decisions

- KTD1. **图标按需 SVG。** 复用已声明的 @lucide/vue，不引入全图标命名空间；FashionStoreIcon 只包含实际语义映射。品牌 SVG 按需保留准确图形及许可证。Governs R5/R6/R9。（session-settled: user-directed — chosen over Bootstrap Icons and multiple ordinary icon fonts: 用户看过对比后选择 Lucide。）
- KTD2. **Swiper 是统一轮播目标。** 使用官方 Vue 适配及独立模块/CSS；FashionStoreCarousel 仅共享稳定默认行为，页面传入内容和局部配置。动画、键盘及焦点优先使用库能力，应用只处理已明确的页面暂停策略。Governs R1/R5/R7。（session-settled: user-directed — chosen over continuing custom carousel engines: 用户要求成熟库覆盖边界并统一维护；Swiper 为本计划首选，精确版本由 Q2 关闭。）
- KTD3. **Tooltip 小范围自建。** 普通 Vue 控件与局部 CSS 实现已有触发、延迟、位置和关闭行为；不使用原生 Popover/Anchor Positioning 作为必要能力。先证明当前定位场景可覆盖，复杂定位导致明显额外负担时记录比较再调整，不暗中加入整套 UI 框架。Governs R1/R3/R5。
- KTD4. **灯箱采用普通 DOM/CSS 和成熟模态原语。** 优先验证现有 Bootstrap 家族的 Modal 独立模块，不再以 HTMLDialogElement 作为唯一实现。保留 FashionStoreProductLightbox 外部事件接口，视图与画廊状态分离。按库的触发契约接入默认焦点/关闭行为，不复制一套全局焦点逻辑。Governs R1/R3/R5。（session-settled: user-directed — chosen over native-only dialog: 用户要求低版本兼容及跨浏览器一致。）
- KTD5. **从依赖源重新构建，不手切压缩文件。** 每个能力有调用证据、包来源、锁版本与卸载规则；现有包头 Bootstrap 5.3.2 只是来源记录，不能作为整个运行环境兼容保证。应用入口同时覆盖 registry.ts 和 nuxt.config.ts 的 preview CSS 列表。Governs R8/R9/R13。
- KTD6. **商业状态不下沉到主题控件。** 数量和字段组件受控；购物操作通过现有 action/cart/checkout ports。重复加购逻辑先在现有 verifyProductCartAdd 边界收敛；不新增 store、请求队列或自行计算权威金额。Governs R4/R5。
- KTD7. **保留 FS-F2 样式归属。** 组件拥有内部必要规则，页面负责布局；核对全局级联、子组件/slot 和明确变体。原始字体、图像和正文样式不随图标迁移重设。Governs R2/R5/R9。
- KTD8. **按能力退出旧 runtime。** 先迁移 Isotope 和 Bootstrap Tooltip 的实际调用，再关闭整包加载。保留生命周期清理需求，移除仅服务旧脚本的全局变量扫描；不得删除 decor 仍使用的 theme-engine/interaction-controller.ts。Governs R4/R8/R13。
- KTD9. **保留独立比较源。** 基线包含修复后的应用与哈希固定的原模板；本计划明确的新效果记录在最小区域差异中，不更换源资产或放宽整页阈值。Governs R2/R11。
- KTD10. **本轮使用可得三引擎并如实保留未验证范围。** Playwright Chromium/Firefox/WebKit 只覆盖其实际版本；历史最低版本、正式 Safari 和移动/内嵌宿主无环境时移出本轮完成门槛，后续具备对应真机或可验证版本时补证。当前 WebKit 不能代替 Safari。（session-settled: user-approved — 2026-09-03 用户批准取消不可得设备的实施/完成前置门槛，保留最低版本实现目标。）Governs R1/R11。
- KTD11. **已知简单效果不机械换库。** CSS 跑马灯仍用 CSS；规则等高商品网格先验证 Grid/Flex 等价，真正依赖不等高排列时保留独立 Isotope。避免 CSS columns 改变视觉与阅读顺序。Governs R2/R8/R9。
- KTD12. **以已批准的最低版本约束构建和选型。** 采用 Q1 矩阵，先审查当前输出和在用 CSS/API（含 :has、动态视口单位与弹层），再选择依赖版本；需要时提供局部兼容实现，不提高门槛逃避问题。Governs R1/R3。（session-settled: user-approved — chosen over latest-browser-only support or an unbounded legacy-browser promise: 用户采用 Chrome/Edge 111、Firefox 115、Safari/iOS 16.4 及对应 WebView 的推荐范围。）

### Verified Baseline and Proposed Dependency Decisions

| 能力 | 已核实状态 | 计划处置 |
| --- | --- | --- |
| 图标 | @lucide/vue 已在 storefront 依赖，Fashion 仍使用多套字体 class | U2 统一普通 SVG，清理动态 class 和伪元素消费者 |
| 首页/集合轮播 | FashionStoreHome.vue 含共享控制器消费与自写集合定时器 | U5 使用两个独立 Swiper 实例 |
| 详情/Shop/About | 各自有 index、timer、gesture 逻辑 | U6 统一库，页面保留不同配置 |
| 跑马灯 | fixture/live 首页使用 CSS 动画，即便保留 swiper class | 保留 CSS；只清理误导性耦合且不改变轨迹 |
| Tooltip | runtime/capabilities.ts 显式初始化 Bootstrap Tooltip | U4 替换为局部组件，然后移除该初始化 |
| Isotope | capabilities.ts 对 .grid 初始化 masonry | U9 根据真实布局决定 CSS 替代或独立保留 |
| 灯箱 | 仅 fixture 商品页使用原生 dialog | U7 改成熟模态底层，保留现有入口 |
| jQuery/vendor | loader.client.ts 按序注入两份本地脚本 | U9 退出整包，建立明确模块依赖 |
| 动画/统计/滚动插件 | 存在于包内不代表页面实际运行 | U1 检查触发及自动初始化，U9 删除无消费者部分 |
| CSS/字体 | registry 与 preview config 双入口；字体已本地化 | U10 同步两入口，保留本地字体，精简插件与图标样式 |
| 外部服务 | Turnstile 条件加载；支付由现有流程跳转 | 保留职责，验证无额外静态 CDN 请求 |

### Component Boundaries

| 组件/逻辑 | 归属 | 不承担的责任 |
| --- | --- | --- |
| FashionStoreIcon | themes/fashion-store/components/shared | 动态加载整套图标、替换品牌语义 |
| FashionStoreQuantityInput | 同上 | 库存查询、购物车持久化、价格计算 |
| FashionStoreTooltip | 同上 | 可交互表单浮层、全站弹层管理 |
| FashionStoreCarousel | 同上 | 自写拖拽物理、复制 Swiper API |
| FashionStoreProductGallery | 同上 | 接管商品选择、图片 API 请求 |
| FashionStoreProductLightbox | 沿用现有组件 | 商品数据所有权、全局焦点状态机 |
| 加购公共逻辑 | 现有 theme-engine action 边界及窄 composable | 第二个购物车或网络重试平台 |
| 地址字段子集 | 优先现有 features/checkout/address.vue 的可复用部分 | 统一所有表单提交和动态报价 |

### Execution Dependencies

顺序以 Execution Checkpoint 为准。U2–U4 依赖 U1；U5 依赖 U1/U2；U6 依赖 U5；U7 依赖 U6；U8 依赖 U3；U9 依赖 U4/U6/U7；U10 依赖 U2/U9；U11 汇总全部单元。

U9 必须先清除活跃调用再停止旧包。迁移中不能让两套代码同时控制同一控件；允许短期整包仍存在，但必须在 U9 移除，不能把阶段状态当作最终成果。

---

## Implementation Units

### Unit Index

下表用于导航；详细范围和验收由对应单元正文定义，执行状态只记录在 Execution Checkpoint。

| 单元 | 交付 | 主要文件范围 | 依赖 |
| --- | --- | --- | --- |
| U1 | 兼容矩阵、能力清单、比较基准 | storefront Playwright 配置、页面契约、证据文件 | Q1 关闭 |
| U2 | Lucide/品牌图标统一 | FashionStoreIcon、图标消费者、双 CSS 入口 | U1 |
| U3 | 受控数量输入 | QuantityInput、商品与购物车页面 | U1 |
| U4 | 局部 Tooltip | Tooltip、capabilities、消费者 | U1 |
| U5 | 首页两类轮播 | Carousel、Home、Fashion runtime 消费端 | U1/U2 |
| U6 | 其余轮播与画廊 | ProductGallery、Product/Shop/About | U5 |
| U7 | 兼容灯箱 | ProductLightbox、ProductGallery | U6 |
| U8 | 有证据的购物/字段复用 | ProductCard、Cart/Checkout、现有 ports/字段 | U3 |
| U9 | vendor/jQuery 退出 | loader、capabilities、依赖清单 | U4/U6/U7 |
| U10 | CSS/字体/加载精简 | registry、nuxt.config、派生 CSS、预算 | U2/U9 |
| U11 | 完整回归与维护交付 | 既有测试、证据、runbook、计划 | U1–U10 |

### U1. 锁定兼容矩阵、能力清单和比较基准

**目标 / 需求：** 将 Q1 决策变成可执行验收矩阵，完成 R1/R2/R11/R12 的基准。**依赖：** Q1 已关闭并激活计划。

**文件：** apps/storefront/playwright.fashion-store.config.ts；apps/storefront/playwright.fashion-store-live.config.ts；apps/storefront/playwright.performance.config.ts；apps/storefront/e2e/support/theme-capture-contract.ts；apps/storefront/e2e/fashion-store-theme.spec.ts；apps/storefront/app/themes/fashion-store/page-contracts.ts；docs/progress/fashion-store-dependency-inventory.md、fashion-store-compatibility-baseline.md（新增证据）。

**方法：**
1. 按页面记录实际组件、动态状态、CSS 类、插件自动初始化、运行时网络、加载/销毁链，标出 fixture/live。
2. 对 Q1 每行记录已得版本/环境或明确的未验证范围。比对 Vue/Nuxt 输出语法、CSS、Swiper 和模态底层，不只检查 dialog 支持。
3. 按 KTD9 捕获组件区域和状态基线。建立普通动态与 reduced-motion 独立验证入口，保留原无 JS 约定。
4. 固定页面、商品数据、视口、缓存、网络与构建方式，记录 JS/CSS/字体压缩传输和现有性能预算；关闭 Q2 的精确版本选择。

**验证场景：**
1. 三引擎各打开首页、商品、分类、购物车、结账代表路由；控制台、布局和共享控件状态有记录。
2. 普通动态模式观察多次自动播放和循环边界；reduced-motion 下内容完整且不强制自动播放。
3. 历史浏览器样本不足时标为未验证，不用现代仿真冒充；按用户批准不阻塞 U1 完成。

**完成：** 每个能力有去留假设、每个浏览器有验证方式或未验证说明，已有本地三引擎/源码区域/资源基线可复测，Q2 有锁定版本、来源及本地模块验证。每批组件的完整交互/失败路径在对应单元验证，U11 汇总；不把全部后续交互验收前移到 U1。只读盘点本身不写镜像单元测试。

### U2. 统一 Lucide 与品牌图标资产

**目标 / 需求：** 完成 R5/R6，准备 R9。**依赖：** U1。

**文件：** 新增 apps/storefront/app/themes/fashion-store/components/shared/FashionStoreIcon.vue；该主题 components/ 下实际图标消费者；fixtures/ 中动态图标数据；integration.css；registry.ts；source-contract.ts；apps/storefront/nuxt.config.ts；apps/storefront/tests/theme-font-contract.test.ts；apps/storefront/tests/theme-resources.test.ts；apps/storefront/e2e/fashion-store-theme.spec.ts。

**方法：** 按 KTD1 做“旧 class/语义/目标 SVG/使用处/视觉差异”映射；复用已安装包，处理评分、收藏实心状态及动态分享图标；调整行框、尺寸、基线。只有 CSS 伪元素和所有动态消费者均迁移后，才退出图标字体入口。

**验证场景：**
1. Header、Footer、商品卡、数量、分页、表单状态及灯箱图标在三种视口尺寸和本轮可用三引擎中显示正确；旧浏览器保留未验证范围。
2. 收藏、评分、禁用/悬停状态保留差异；仅图标按钮的可访问名称不因字形迁移丢失。
3. 动态分享项品牌正确，无空方框、布局跳动或旧图标字体网络请求。

**完成：** 映射清单逐项闭合，普通图标单一来源，品牌只按需加载；前后区域比较只接受已标记字形差异。

### U3. 抽取受控数量输入

**目标 / 需求：** R4/R5。**依赖：** U1。

**文件：** 新增 apps/storefront/app/themes/fashion-store/components/shared/FashionStoreQuantityInput.vue；components/pages/FashionStoreProductPage.vue、FashionStoreLiveProductPage.vue、FashionStoreCartPage.vue；apps/storefront/e2e/fashion-store-product.spec.ts、fashion-store-cart.spec.ts、fashion-store-live-commerce.spec.ts；必要时扩展 apps/storefront/tests/fashion-store-cart.test.ts。

**方法：** 按 KTD6 提供值、最小/最大、禁用、名称及提交意图；商品页和购物车保留各自视觉变体及现有合法范围。先整理空值到提交值的归一规则，限制不从 fixture 推断给 live。

**验证场景：**
1. 加减及直接输入更新数量；最小、最大、空值、非数字、小数和越界输入有确定结果。
2. 更新 pending 时反复输入不产生重复提交；失败保留权威数量并能再次修改。
3. fixture 不请求 Commerce；live 一次已提交变更只产生一次相应动作，购物车相关区域一致。

**完成：** 三处控件共用输入行为；库存及购物车规则仍由原业务边界决定。

### U4. 实现局部 Tooltip 并移除 Bootstrap Tooltip 初始化

**目标 / 需求：** R1/R3/R5/R8。**依赖：** U1。

**文件：** 新增 apps/storefront/app/themes/fashion-store/components/shared/FashionStoreTooltip.vue；实际 tooltip 消费者；runtime/capabilities.ts；integration.css；apps/storefront/e2e/fashion-store-theme.spec.ts、fashion-store-product.spec.ts。

**方法：** 按 KTD3 复现当前样式、触发和延迟；必要时用 Vue Teleport 避免容器裁切，并限于现有位置种类处理边缘。清除同一控件的 data-bs 初始化入口和旧监听。

**验证场景：**
1. 悬停、聚焦、移出、失焦、Escape 的显示与关闭结果正确，焦点仍留在触发控件。
2. 屏幕边缘、滚动容器、缩放和页面滚动后文字可读、不闪烁；手机首触不会被提示层吞掉。
3. 路由切换及触发元素卸载后无悬浮残留；reduced-motion 下功能仍存在。

**完成：** 全部实际 Tooltip 消费者迁移，无双重提示；未构建复杂 popover 框架。

### U5. 首页主视觉与集合轮播迁移 Swiper

**目标 / 需求：** R1/R2/R5/R7。**依赖：** U1/U2。

**文件：** 新增 apps/storefront/app/themes/fashion-store/components/shared/FashionStoreCarousel.vue；components/FashionStoreHome.vue；composables/useFashionStoreRuntime.ts；interaction-contract.ts、behavior-contract.ts、page-contracts.ts；integration.css；apps/storefront/package.json；bun.lock；apps/storefront/e2e/fashion-store-theme.spec.ts；apps/storefront/tests/fashion-store-interaction-contract.test.ts。

**方法：** 两个独立实例，仅装入需要的模块。初始保留主视觉 4 秒自动播放、约 1 秒切换及桌面纵向/手机横向的已记录意图；数字分页、文案和图片布局保持。手势交给 Swiper，应用保留悬停、焦点、页面隐藏、reduced-motion 的暂停组合；不新增滚轮劫持与复杂特效。

**验证场景：**
1. Covers AE1：拖动、点击分页、键盘、自动播放均能切换；集合按钮只控制自身实例。
2. 断点两侧、窗口 resize、零/一/少量 slide 时布局完整；不足循环条件时不留空白。
3. 滑动不误触链接，纵向页面滚动可用；失焦和返回可见时只恢复原来允许的播放状态。
4. 首屏静态 HTML 可读，无 hydration 错误及明显布局跳动；路由重挂载只保留一个实例。

**完成：** 首页对比通过，自写 hero/集合引擎退出；只移除 Fashion 消费端，不删除其他模板还在用的共享控制器。

### U6. 统一详情、Shop 与 About 轮播

**目标 / 需求：** R2/R5/R7。**依赖：** U5。

**文件：** 新增 apps/storefront/app/themes/fashion-store/components/shared/FashionStoreProductGallery.vue；components/pages/FashionStoreProductPage.vue、FashionStoreShopPage.vue、FashionStoreAboutPage.vue；contracts/pages/product.ts、shop.ts、about.ts；apps/storefront/e2e/fashion-store-product.spec.ts、fashion-store-shop.spec.ts、fashion-store-information-pages.spec.ts；apps/storefront/tests/fashion-store-product.test.ts。

**方法：** 详情主图/缩略图使用同版本 Swiper，保留一个当前图片状态，通过语义图片序号同步灯箱，不能将 loop 内部索引直接当商品序号。Shop 和 About 使用薄轮播组件的不同配置；保留 About 尾部留白的已批准几何。删除各页自写 timer/gesture/track 尺寸计算。

**验证场景：**
1. 主图、缩略图、键盘与边界循环对应同一图片；桌面竖缩略图与手机横缩略图布局正确。
2. 详情初始 2 秒自动播放、约 300 毫秒过渡的意图保留；不得无故新增主图箭头。
3. Shop 不同侧栏布局的卡片数量与导航正确；About 自动播放、拖动及尾部区域保持。
4. 卸载重进、图片迟到/失败、单图片时无失效计时器或空白区域。

**完成：** 所有现有轮播使用同一库，CSS 跑马灯不因 class 名被机械迁移。

### U7. 替换原生唯一灯箱底层

**目标 / 需求：** R1/R2/R3/R5。**依赖：** U6。

**文件：** apps/storefront/app/themes/fashion-store/components/shared/FashionStoreProductLightbox.vue；FashionStoreProductGallery.vue；components/pages/FashionStoreProductPage.vue；必要的模态模块入口；apps/storefront/e2e/fashion-store-product.spec.ts；apps/storefront/package.json 及锁文件。

**方法：** 按 KTD4 接入 U1 选定版本，保持现有 opened/closed/next/previous 语义。遮罩、按钮和图片样式由主题提供；焦点包含、Escape 与标准触发恢复使用库契约。核对 Bootstrap 程序化触发的焦点恢复是否需要其标准触发 API，避免假定存在默认恢复。库只控制容器，不改写 Vue 内容。

模态实例仅在客户端 DOM 就绪后建立；SSR 导入不得访问 window/document。延迟加载失败时不先锁页面滚动，保留可见恢复入口并允许重试。

**验证场景：**
1. Covers AE2：点击主图或键盘打开；切图、计数及缩略图保持同步。
2. 关闭按钮、背景、Escape 都正确关闭；焦点回到有效触发控件，滚动位置和原 overflow 恢复。
3. 重复开关、打开时路由离开、图片失败时可关闭；不存在悬挂遮罩或被锁死页面。
4. 实现不依赖 showModal；在本轮可用引擎和横竖视口验证无裁切，最低 Safari/Android 等设备无环境时列未验证。
5. 与 Header 搜索或购物车浮层顺序切换时无层级冲突；不新增嵌套 modal。

**完成：** 现有灯箱入口在本轮可用三引擎通过，未向真实商品页偷偷增加功能。

### U8. 收敛购物操作与表单的已证实重复

**目标 / 需求：** R4/R5。**依赖：** U3。

**文件：** apps/storefront/app/themes/fashion-store/components/shared/FashionStoreProductCard.vue、FashionStoreMiniCart.vue；components/pages/FashionStoreLiveProductPage.vue、FashionStoreCartPage.vue、FashionStoreCheckoutPage.vue；apps/storefront/app/theme-engine/actions.ts、cart-state.ts、checkout.ts；apps/storefront/app/features/cart/presentation.ts；apps/storefront/app/features/checkout/address.vue；apps/storefront/e2e/fashion-store-live-commerce.spec.ts、fashion-store-cart.spec.ts、fashion-store-checkout.spec.ts；apps/storefront/tests/fashion-store-live-commerce.test.ts。

**方法：** 先列重复证据，按 KTD6 复用 verified-add 及现有 ports；只提取共享 pending/error 展示、金额行和字段子集。账单地址的国家、第二地址行、姓名拆合及运费估算字段保留完整；不把现有仅 US 的 address.vue 原样覆盖更丰富表单。不存在两个等价消费者的抽取项记录“不抽取”理由。

**验证场景：**
1. Covers AE3：加购前库存/价格变化、需选变体、缺货、失败后重试均保留原结果。
2. 加购成功后移除商品，再次加购仍可用；所有 cart 消费者观察唯一状态。
3. 快速修改地址期间旧报价晚返回，不覆盖新地址报价；选中运输方式保持现有失效规则。
4. 可选电话、第二地址行、不同收货地址切换与字段错误关联不丢失；fixture 保持本地交互。

**完成：** 有证据的重复收敛，服务端金额/库存和现有请求时序不变；不为代码量目标重写整个交易流程。

### U9. 拆分 vendor、处理布局依赖并退出 jQuery

**目标 / 需求：** R8/R10/R13。**依赖：** U4/U6/U7。

**文件：** apps/storefront/app/themes/fashion-store/runtime/loader.client.ts、capabilities.ts、lifecycle.ts；composables/useFashionStoreVisualRuntime.ts；integration.css；apps/storefront/package.json 及锁文件；apps/storefront/tests/fashion-store-runtime.test.ts；apps/storefront/e2e/fashion-store-theme.spec.ts、fashion-store-shop.spec.ts、fashion-store-live-commerce.spec.ts。

**方法：**
1. 关闭 U1 每条 vendor 清单，含 jQuery 插件和非 jQuery 库。库存在、class 存在都不能单独证明有运行用途。
2. 按 KTD11 验证规则网格替换；真实 masonry 需求则独立导入 Isotope，保留排序/间距。图片尺寸和加载完成逻辑仅在实际需要时保留。
3. 移除不再调用的动画、计数、视差、滚动、弹窗等模块及它们的隐式 CDN 回退；实际需要的能力保留完整链条。
4. 停止 jquery.js/vendors.min.js 注入，改为显式能力导入；清除仅服务旧加载器的 Window 全局扫描，保留新能力自身销毁机制。

**验证场景：**
1. 网格等高/不等高、图片慢加载/失败、断点与筛选状态保持布局和阅读顺序。
2. 阻断第三方静态域名后，普通页面仍可交互；没有 mousewheel 等隐式 CDN 请求。
3. Covers AE5：Turnstile 与支付流程仍遵守原配置/CSP，fixture 测试不执行真实支付。
4. Covers AE6：多次路由进出无重复事件、幽灵 timer 或其他模板运行时被清理。
5. 动态模块加载失败时首屏及关键导航可读，控件不表现为可点击却无响应。

**完成：** Fashion 构建/网络中整包 vendor、jQuery 退出；每个保留依赖均有消费者和来源记录。

### U10. 精简 CSS、字体和页面加载入口

**目标 / 需求：** R2/R9/R12。**依赖：** U2/U9。

**文件：** apps/storefront/app/themes/fashion-store/registry.ts、integration.css、resources.ts、source-contract.ts；新增 styles/vendor.css（按需派生入口）；apps/storefront/nuxt.config.ts；apps/storefront/scripts/check-bundle-budget.ts；apps/storefront/tests/theme-resources.test.ts、theme-font-contract.test.ts；apps/storefront/e2e/fashion-store-theme.spec.ts；apps/storefront/e2e/performance.spec.ts。

**方法：** 两个 CSS 入口同步调整。保留当前 Bootstrap 基础版本/布局，先退出已删除插件及图标字体，再按真实页面依赖拆分其余样式。可追溯派生 CSS 保留许可证；不修改哈希固定源文件。动态 class、伪元素、SSR 与 Vue 生成状态都进入保留清单；不使用盲目 purge。首屏必要 CSS/字体不延迟到交互后。

当前远程字体移除转换只匹配 fashion-store/upstream 路径。派生到 styles/ 的资源必须在生成时移除相同远程导入，或窄范围调整已有转换；不得因换路径恢复 Google Fonts 请求。

**验证场景：**
1. fixture preview 与 live 构建分别直接打开代表路由，共享组件、模态和导航不丢样式。
2. 本地 Figtree/Outfit 的字重和换行保持，无远程字体或已退出插件 CSS/图标字体请求。
3. Header/MiniCart 首页与内页变体、滚动按钮 1399/1400 断点等 FS-F2 基线保留。
4. 冷缓存首屏无明显闪动、重复字体和布局漂移，后续页面加载没有补入第二份 Swiper。

**完成：** 达到 R12；提交页面资源前后对照和保留 CSS 原因，不能只报告 npm 包数量或源码行数。

### U11. 完成跨浏览器回归及维护交付

**目标 / 需求：** R1/R2/R11–R13。**依赖：** U1–U10。

**文件：** 既有 fashion-store e2e/tests、playwright 配置；docs/progress/fashion-store-modernization-verification.md（新增）；docs/runbooks/source-equivalent-html-template-port.md；本计划与主计划。

**方法：** 按 Verification Contract 汇总关键交互、页面 smoke、视觉及性能证据。检查临时兼容分支、废弃组件、重复库、无人消费样式与文档是否清理；更新组件使用和依赖引入约定。

**验证场景：**
1. AE1–AE6 在本轮可用三引擎和可模拟输入模式覆盖，最低版本/真机/内嵌宿主逐行列实测或未验证；缺失设备不阻塞完成。
2. 所有 fashion-store 页面有结构/共享区域 smoke；深测集中在新共享控件和商品/购物车/结账路径。
3. 跨路由重挂载、浏览器历史、普通动态、reduced-motion、无 JS 的约定分别通过。
4. 视觉差异仅限登记区域；资源和性能满足 R12；共享底层被改时做相应非目标兼容观察。

**完成：** 本计划 DoD 全部满足，检查点同步交回 REL；正式候选资格和跨模板 DC3 仍由其原计划判断。

---

## Verification Contract

### 证据与通过条件

- **行为证据：** 使用上述 U 单元指定测试；保留原行为 ID 和真实结果，删除只验证旧 transform/clone 阶段等实现细节的断言时补上等价行为证明。
- **视觉证据：** 同浏览器/版本/系统/字体环境做改动前后比较；跨引擎检查布局和控件外观一致，不要求字体抗锯齿像素完全相同。沿用现有约束：计算样式偏差 ≤0.5px、锚点几何 ≤2px、页面高度偏差 ≤0.5%、命名状态像素差 ≤0.5%、整页 ≤1%，仅允许登记的局部图标/轮播差异。
- **动态证据：** 真实时间推进下观察 autoplay、暂停恢复、loop 边界与布局；不能以 reduced-motion 截图证明轮播已通过。
- **兼容证据：** Q1 的每个浏览器最低版本逐行列实测环境/结果或未验证说明。完成本轮可用三引擎回归、最低目标的源码/API/CSS审查和已发现兼容缺口修正即可满足调整后的 R1；缺失历史/真机环境为非阻塞补测范围，不构成这些浏览器已通过的声明。
- **资源证据：** 按页面列初始与完整交互后的 JS、CSS、字体压缩传输，去重缓存和共享 chunk，列外部域名。测试输入/网络/缓存相同，最终满足 R12，退出项请求数为零。
- **性能证据：** 复用当前预算，记录 LCP/CLS/主线程阻塞等现有报告；初始化多次或新库引入导致的退化必须定位。微小计时波动只在超预算或连续回退时复测。
- **本地门槛：** typecheck、相关单元/浏览器测试、完整 Fashion suite 和性能检查通过。标准库内部无障碍套件不复制；应用拥有的名称、标签、焦点异常和关键输入路径需要验证。
- **保护范围：** 运行前记录用户生成文件，测试不得覆盖；无真实交易、无部署、无候选/生产状态推进。

### 既有执行入口

命令工作目录为 apps/storefront。以下是执行阶段使用的入口，本次规划没有运行它们。

| 入口 | 使用时机 |
| --- | --- |
| bun run typecheck | 每批涉及 Vue/TypeScript API 时 |
| bun test tests/对应文件.test.ts | 相关业务/契约发生变化时 |
| PLAYWRIGHT_FORCE_ASYNC_LOADER=1 bunx playwright test --config playwright.fashion-store.config.ts 对应.spec.ts | 各批 fixture 浏览器验证；按 U1 配置覆盖动态/三引擎 |
| bun run test:fashion-store-live | 涉及真实数据呈现、数量及 action 边界 |
| bun run test:fashion-store | U11 完整模板验证 |
| bun run test:perf:fashion-store | U1 基线与 U10/U11 最终资源/性能对照 |

---

## Definition of Done

1. Q1/Q2 关闭，所有 R1–R13 有证据；U1–U11 完成或经明确范围修订后保留可追溯结论。
2. 已确认重复的控件行为使用共享实现，购物状态仍只有原权威来源；无虚假的通用组件或闲置抽象。
3. Fashion Store 普通图标统一 Lucide，所有现有轮播统一一个 Swiper 版本，灯箱不再依赖原生 dialog 唯一能力。
4. 整包 vendor/jQuery、旧普通图标字体和无消费者资源退出应用加载；必要服务完整，保留库可追溯。
5. 兼容、视觉、交互和资源/性能验证满足 Verification Contract；按用户批准的本轮范围完成；未验证的历史浏览器/真机/内嵌宿主继续明确保留为待环境补测，不虚报通过，也不阻塞本轮完成。
6. 清理本次废弃实验、重复初始化和临时兼容代码，保留必要许可证和短维护规则。
7. 更新本检查点及主计划登记/指针，证据只作证据；不重写 FS/FS-F2 历史完成结论，不推定 DC/PG 成功。

---

## Sources and Research

- apps/storefront/app/themes/fashion-store/runtime/loader.client.ts、capabilities.ts：实际整包加载与 Isotope/Tooltip 初始化。
- apps/storefront/app/themes/fashion-store/components/ 及 fixture-registry.ts、registry.ts：现有轮播和 fixture/live 边界。
- apps/storefront/app/theme-engine/cart-state.ts、actions.ts、apps/storefront/app/features/cart/use-guest-cart.ts：唯一购物状态和操作边界。
- apps/storefront/app/features/checkout/address.vue：已有字段子集的能力限制。
- docs/solutions/workflow-issues/html-source-parity-reconstruction-workflow-2026-08-06.md：完整能力链和可观察验收。
- docs/plans/2026-09-03-1417-fix-fashion-store-shared-styles-plan.md：共享样式继承基线。
- [Swiper Vue](https://swiperjs.com/vue)：核心/模块/CSS 分开导入；只采用 Q1 验证的版本。
- [Swiper API](https://swiperjs.com/swiper-api)：方向、循环条件、事件和销毁，支撑 U5/U6 边界。
- [Lucide Vue](https://lucide.dev/guide/vue)：按图标组件引用，避免整包动态映射。
- [Bootstrap Modal](https://getbootstrap.com/docs/5.3/components/modal/) 与 [浏览器支持](https://getbootstrap.com/docs/5.3/getting-started/browsers-devices/)：普通 DOM 弹层候选及移动端限制；不是旧版本支持的空白支票。
