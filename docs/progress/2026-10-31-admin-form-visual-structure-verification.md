# Admin 表单视觉结构验证证据

执行状态仅由 `../plans/2026-10-31-2103-fix-admin-form-visual-structure-plan.md` 的检查点拥有；本文件只保存实际观察和验证结果。

## 验证选择与保留边界

规则和证据文档按 L0；选项纯视觉按 L1；内容只读项组合和共享 picker／编辑字段按 L3，以实际 import 闭包映射 focused suites。代码稳定后统一执行一次 Admin typecheck，不默认全量测试或 build。

不改变值、权限、完整 payload、dirty、reset、写锁、精确版本状态操作及冲突恢复。纯视觉不写 class／Card 数量断言，以同条件实图和适用现有行为测试证明；状态只读项另验证不进入编辑 store 或 payload。

## 本轮基线

已有 WIP 已保存精确源副本及哈希。真实旧图与条件见 [拍摄清单](assets/admin-form-visual-structure/capture-manifest.json)。查看器和应用预览均绑定本机回环地址，fixture 拒绝写入且不连接数据库；历史截图未改写。

## 规则与查看器

- 八份权威／投影文档已更新：普通字段单列、关联组合例外、Drawer 轻分区、无断边标题、同列宽状态只读项及逐页网页 gate。原双列默认预算已从当前规则中替换，历史采用表明确其已不是当前默认。
- 同一网页新增 structure／history 轮次；无 round 的旧页面深链进入 history，原 226 图和 43 区域保留。实际浏览器已核对轮次切换、旧图单张展示和缺图提示，未将缺图隐藏为已完成。
- 生成器语法执行及 gallery.js 的 node --check 通过。原图加载异常有可见说明；现有图片的实际加载与放大另按入口检查。

## 选项展示

- 共用说明移到 Color／Size 前，两个平级标题之间使用主题 Divider，无 Card 或断边标题。复用原 sections；recipe 仅为无标题说明区省略空 h3，不更改其他有标题分区的默认样式或生命周期。
- 纯视觉改动，不新增 class／Card 数量测试。沿用并运行 catalog-form-page 与 crud-form-drawer-recipe 两 suite：53 项通过；admin-local-form-drawers.browser：3 项通过（包括商品展示、地点、集合的反向行为验证）。两份实际代码的 ESLint、Prettier 通过。
- 修改后实际 Drawer 稳定位置 x=560、width=720，footer 可达；浅／深色常规及 invalid HEX 错误态均保留并打开检查。重新补拍了打开动画完全结束后的浅色主图，未接受动画中的中间画面。
- [当页对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=color&region=main&theme=light&view=side) 已实际加载两主题、两区域的新旧原图，测试并排、区域切换、深色错误的 before／after 放大与 100% 原图（naturalWidth=1280）。
- 原 HEX、业务色值、完整提交、父商品草稿、取消／重置、权限及写锁保留。最终统一类型检查由收口时执行一次，不重复每页执行。

## 内容页面

- 状态 Card 全宽；内容状态、已保存版本使用无 name 的只读 Form.Item／Input，沿用原 Form，不新增字段 store。正文保存、精确版本状态操作及 footer owner 保留，版本引用详情继续折叠。
- 更新原有保存、readonly publisher、中文状态测试，实施前 3 项因缺少只读字段失败（content-red.log）；实施后 content-editor 22 项及 content-editor.browser 2 项通过，当前内容三文件 ESLint／Prettier 通过。
- 实际验证左／中／右偏好：SEO 和两个状态字段均为 752px，left 分别为 288／376／464；只读字段不改变发布可用性。[测量记录](assets/admin-form-visual-structure/alignment-checks.json)。
- 页面本轮浅／深色主区域、展开详情共 4 组前后原图已保存并在网页加载，实际核对主题、区域及原图放大。[内容页面对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=content-page&region=main&theme=light&view=side)。文章同入口组合仍单独交付。
- 翻译原 suite：7 通过、1 失败。隔离检查显示起始源码 102 项、当前 104 项缺词，均来自并行新编辑器／themes-page；本轮三条新词与受改生产文件无问题。原输出和当前／基线问题清单在 .artifacts/admin-form-visual-structure-2026-10-31/i18n.log 与 i18n-isolation.json。未把全量检查写成通过，也未扩大修改并行编辑器的翻译。

## 内容文章

- article 入口单独拍摄同一草稿的两主题主区域／展开详情，源数据及字段合同与本轮 before 一致。22 项内容 focused tests 和 2 项 Browser Mode 同时覆盖共享组件的适用保留行为，无新增重复 suite。
- [文章对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=content-article&region=main&theme=light&view=side) 已加载实际新旧原图，主题／区域切换与深色详情放大通过。另保留标题行打开发布确认的浅色补充图；实际取消后零写入，没有创建或发布记录。
- page 与 article 的状态只读项均不注册 name，原完整保存请求精确断言、readonly publisher、失败保留、冲突重读及重置恢复用例保持通过。

## 当前主题工作区与共享字段

- 原主题编辑器在实施中被并行产品工作退役，兼容文件现 re-export 新 VisualThemeEditorPage。原普通字段双列已随旧实现消失；没有恢复或重复改写退役实现。查看器单独保留其 6 张当时基线，当前入口使用独立 12 张新旧原图。
- 新 before 在只读源副本中恢复起始时三份 picker／link 精确源码，并使用当前冻结消费者及当前中文词条；after 为实际运行入口。最初中文未同步的补拍不作为最终证据，保留在忽略目录 superseded-editor-before。两端使用同一静态 fixture；内存预览 session 仅服务真实 Vue iframe，无数据库或业务写入。
- 三个组件复用本地 StorefrontFieldGroup：保留原生有名 fieldset，去掉四周边框，普通标题与主题细线分组；外层已有 Form.Item 时通过 showLabel=false 保留一个可见 label。新 inspector 仅增加这三处标签归属属性，业务状态、搜索、选择、完整值及错误帮助保持。
- 5 个当前 consumer focused suites（resource／media／link、navigation、visual-editor）36 项通过；navigation Browser Mode 3 项通过。共享 5 文件 ESLint 通过，原未格式化 inspector 已按项目格式整理。纯呈现不新增 class／边框断言，使用现有行为验证与实际画面。
- 实际 Vue 预览为“预览已更新”，三类字段普通单列，资源、媒体和链接无重复标题或断边。图片结果网格及结构／预览工作区保留，未改协议与保存生命周期。
- [当前主题入口对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=theme-workspace&region=main&theme=light&view=side) 已在网页加载两主题、三个区域新旧原图，核对主题、区域及链接原图放大。导航两个实际消费者仍分别交付。
- 并行编辑器已补齐词条后，重新运行原翻译 suite：8／8 通过（i18n-final.log）。此前全量失败现已消除，未修改测试排除或弱化门禁。

## 导航页头与页脚

- 共享字段在导航两种 placement 均采用无断边外框的轻分组。两份状态始终保留 Men／内部资源／页面／page.placeholder 的未保存草稿，与 before 相同，没有写入。
- 两入口各自保留浅／深色 before／after，实际在同一网页分别检查主题切换、并排和原图放大（naturalWidth=1280）。[页头对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=navigation-header&region=main&theme=light&view=side)、[页脚对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=navigation-footer&region=main&theme=light&view=side)。未用一个 placement 的图片代替另一个。
- 值、查询／清空／翻页、迟到响应、树选中、重置、dirty、权限和发布动作继续由原页面与共享组件持有；前述 focused tests 和 3 项导航 Browser Mode 覆盖适用保留行为。当前所需 6 组、11 区域的配对实图已齐；旧编辑器与补充确认不充当修改后配对。

## 排查补修：订单与账号

- 订单三个次要文字由固定灰色改为主题 colorTextSecondary；实际浅色 rgba(0,0,0,.65)、深色 rgba(255,255,255,.65)。原 order-detail 6 项、changed-file ESLint／Prettier 通过。[订单对比](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=order-detail&region=main&theme=dark&view=side) 已检查两主题及放大。
- 账号原双列 Descriptions 改为轻分组内无 name 的只读 Form.Item／Input，Drawer 放在原 Form 的字段区，兼容独立页仍在原 Form／Card 中；没有新增 store 或 payload 字段。区分“已保存状态”与可编辑“状态”。邮箱、版本、更新时间保留原值和本地时间格式。
- 先补强两个既有测试并观察 2 项缺少 label 的预期失败；实现后两条时间本地化测试因改用 input 而更新查询方式，继续验证两语言切换、未保存输入和不重复加载。最终 IAM 51 项、IAM Drawer Browser Mode 2 项通过；没有弱化保存／权限／确认／写锁断言。
- 两入口分别保存同一 Disabled User 的浅／深色 before／after。Drawer 实测 x=560、width=720，四个元信息均 readOnly、无 name，footer 可见。[账号 Drawer](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=user-drawer&region=main&theme=light&view=side)、[兼容独立页](http://127.0.0.1:4381/admin-form-style-gallery/#round=structure&page=user-compatible&region=main&theme=light&view=side) 已实际核对两主题、naturalWidth=1280、原图放大。

## 最终质量与交付核对

| 检查                                                                           | 本轮最后有效结果                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| catalog-form-page + crud-form-drawer-recipe                                    | 2 文件 53 项通过                                                                                       |
| content-editor                                                                 | 1 文件 22 项通过                                                                                       |
| resource／media／link + navigation + 当前 visual-editor                        | 5 文件 36 项通过                                                                                       |
| order-detail                                                                   | 1 文件 6 项通过                                                                                        |
| iam-pages                                                                      | 1 文件 51 项通过                                                                                       |
| Browser Mode：local-form-drawers／content-editor／navigation／iam-form-drawers | 4 文件 10 项通过                                                                                       |
| tools/check-admin-i18n.test.ts                                                 | 最终 8 项通过；含新增账号两条词，先前并行缺词失败已消除                                                |
| Admin typecheck                                                                | 稳定后一次 bun run typecheck（tsc -b），退出 0                                                         |
| changed-file 质量                                                              | 本轮 13 个 TS／TSX 文件 ESLint、Prettier 通过；八份规范及本轮计划、证据、查看器格式检查通过            |
| 查看器与投影                                                                   | gallery.js node --check、generate.py、两份 YAML 解析通过；297 个图片引用唯一且存在、65 个 HTML ID 唯一 |

unit 合计是 10 文件 168 个互异用例；Browser 与 i18n 分列，不与历史或来源结果相加。没有默认运行全量 Admin、monorepo、build 或真实业务写入。原命令与完整日志保存在忽略的 .artifacts/admin-form-visual-structure-2026-10-31/。

- 本轮共 71 张实际原图：九个修复入口、14 个必需区域的 56 张成对证据，文章确认补图 1 张、替换前旧入口基线 6 张和其余实际检查原图 8 张。全部本轮原图是 1280×900；历史 226 张仍可通过旧深链访问。[完整性及当前图片哈希](assets/admin-form-visual-structure/gallery-integrity.json)。
- 最终实际网页核对：旧无 round 深链进入 history；切回 structure 显示 9 组／71 图；八张排查原图可见、原图放大无新旧切换，未冒充修改对比。各修改入口此前已分别核对选页、浅深色、适用区域及放大。跟随系统主题切换后当前解析为浅色，背景为 rgb(245,247,250)，未覆盖主题实现。
- 简化按项目要求在主线程串行检查 reuse／quality／efficiency／test value，现有三消费者轻分组已足够，无必要追加抽象或删改证明测试。没有引入依赖、运行时布局配置或无消费者通用能力。
- ce-code-review 对本轮冻结 WIP 差量完成正确性、规范、测试及组合风险复核，未保留待处理发现；遵照用户 AGENTS 在同一主线程串行执行，没有声称独立模型或独立代理审查。[审查回执](assets/admin-form-visual-structure/review-receipt.json)。收口已消除一处规则措辞歧义，明确独立页 Card 与 Drawer 原 Form 轻分组的边界。
- 只读基线副本和被替换补拍保留在忽略目录用于来源复现，不作为正式 after；没有将临时测试依赖或失败方案写入产品代码。保留静态截图网页服务供查看，关闭本轮专用应用和 fixture 预览进程。不提交、推送、开 PR 或部署；并行产品计划／master 的改动不归本轮声称。
