# Shoppp Admin 统一表单采用记录

本次是批准统一计划的 U3 共享能力回流，只覆盖 `apps/admin`。业务页及实际入口整改由后续 U8 负责；共享能力通过不等于页面已完成统一。

## 来源与边界

- 批准来源：`codex-admin-quick-start@932cdf7f24d45cf8481f5162c58ef057c2cb8aa3`，已解析并核对。来源 L4 的 380 条单元、6 条浏览器和 build 证明仅属于来源。
- 目标起始 HEAD：`shoppp@13a0beba031c945b702820d39a436c8e03a932ea`，实施前工作区干净。
- 目标采用 commit：待宿主本地门禁及路径限定提交后登记；本文件不声称整仓或发布完成。
- 本地权威：`ai-rules.md` 第3.1节；布局：`drawer-form-layout-rules.md`；投影：AGENTS、README、recipe/catalog、迁移工作流与检查清单。原业务 API、权限、完整 payload、校验、外部集合、reset 与安全恢复合同保持。

## 采用内容

| 能力                      | 本地适配                                                                                                                                                                                                               | 本次证据                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 容器与布局                | 容器和结构分别判断；全部右 Drawer720；Modal仅实际模式；独立页及合法旧URL保留。320/656为常规双列基线，不引入来源课程/订单的局部阈值                                                                                     | 文档L0、YAML解析、diff与引用检查；未迁移业务入口                                            |
| 表单controller            | 增量加入readonly行为守卫、同轮提交锁、详情generation与alive隔离；保留现有converter、ApiError、初始化/reset接口                                                                                                         | 新守卫测试在行为修改前观察RED；controller本地9条通过                                        |
| 独立基础壳                | 保留分区、对齐及本地操作栏；行为层阻断readonly/权限/详情失败与busy。结构锁定的modify保留原禁用Save并禁用Reset，真正readonly按showActions隐藏                                                                           | 基础壳9条与直接消费者回归通过；未改业务页                                                   |
| Drawer recipe/spec/barrel | 从批准源本地采用720px壳、dirty确认、同步锁、actionBusy、nestedModalOpen、退出后清理、alive+exiting保护、一次父内容读取及普通成功Modal。失败类型使用目标ApiError；持久错误当前语言渲染，异步即时反馈用current-translate | Drawer34条本地单元通过，包含语言切换不丢草稿、不重写与权限阻断；3条浏览器用例已适配但未执行 |
| 缓存读取恢复              | 保留目标现有same-scope刷新失败partial状态与TemplateListContent的Alert+Reload，不叠第二条告警                                                                                                                           | 既有controller缓存数据保留、读取失败和内容重读用例通过；未改该能力                          |

`FormSubmitActions` 已具备本地化，本次保持原文件。grade/campus 的 `noDrawerEdit` 只属于未注册独立路由fixture，明确加注范围，未重设fixture配置体系。

IAM的reauth、operation identity、copy-once、版本冲突和专用结果，以及既有AppShell/accessibility行为继续保留；本次未增加通用Modal框架、RBAC、草稿服务、全局焦点/反馈/导航机制、依赖或跨仓运行时导入。

## 定向验证（L3 worker self-check）

修改前先增强现有controller与基础壳测试：17条中4条预期RED，分别观察readonly产生一次写、同轮调用产生两次写、旧modify详情覆盖新add草稿，以及基础壳程序化readonly触发提交；其余13条为现有/特征基线。

- 首轮8个共享单元文件：85条中84通过；新增权限测试的Close断言匹配了header和footer，改为footer内断言后Drawer34条通过。其余共享文件未改变，不重复执行。
- 追加Drawer、state gate及fixture：3文件42条全部通过。
- 直接消费者：商品表单、商品集合、内容编辑和基础参考页共4文件33条，32通过；商品结构锁定用例揭示本地禁用Save合同。基础壳保留该显示合同并禁用Reset后，基础壳与商品表单2文件21条全部通过。
- 最终各文件最后结果去重：14个相关文件、127条单元全部通过；零跳过。命令均为仓库根 `bun run --cwd apps/admin test <明确文件> --pool.maxWorkers=2`，未运行全套。
- 8个改动生产文件的定向ESLint通过，基础壳最后修正后再次定向通过；两份YAML由Bun解析通过，`git diff --check`通过。

测试新增/增强落在controller、BasicCrud与Drawer；导航、校验分类/滚动、独立页保存确认、缓存列表/state gate/fixture和业务消费者复用原测试。Drawer是目标的新能力，没有可运行的目标旧recipe；来源测试作为场景经目标harness与locale改写后独立验证，不计来源通过数。

本次只做本地单元self-check。3条Drawer Browser Mode已适配，真实720px/footer/body/退出动画、嵌套Esc和滚动结论仍待宿主运行；未启动浏览器、全量套件、typecheck、build、根monorepo验证、依赖安装、Git暂存或提交。宿主仍负责权威L3/L4门禁、目标版本登记及后续U8消费者整改。没有真实业务账号或业务页面布局验收。

## 宿主共享采用门禁

最终来源包含业务阻断态动作保留；本地既有商品结构锁定状态已按该合同适配，不新增行为改动。宿主14文件127条unit、Drawer浏览器3条、typecheck通过，worker8个改动生产文件ESLint通过。来源通过数仅属于底座，本仓U8业务整改与最终采用收口仍待执行；路径限定采用提交SHA在U10登记。

## U8 消费者实施交还

完整 36 项消费者、五批归属、shipping 分类及业务保留记录见 [form-consumer-unification.md](./form-consumer-unification.md)。本地 IAM 增加明确的取消结果，轻量 Modal 只共用生命周期 hook；来源采用版本保持不变。U8 worker 的定向单元证据由宿主检查后收口，浏览器、类型与提交仍由宿主负责；该追加记录不把共享采用或保留源码等同于全仓业务验收。

## U8 消费者反馈的来源采用

当前采用来源为 `codex-admin-quick-start@d84e1013bd8d9b5da853a7d8a47cf9fe31318de7`。U3 来源与原证据保留。U8 从真实工作空间消费者发现页内返回忙碌保护和卸载后迟到校验写入问题，先观察失败并修正本地 Basic；同一合同已回流并固化到底座。保留本地 locale/spec、业务状态、字段与权限，不整文件覆盖。宿主独立验证实际 Admin 消费者；源382条不计入目标通过数。

## 当前来源：必要业务确认中性取消

最终来源推进至 `codex-admin-quick-start@dee59a3c6f3a4ec999c40e392956bab053a48c8c`，继承 F3 的基础页返回/存活保护。普通 Drawer 的提交结果允许 `{ cancelled: true }`：保持输入、释放锁且无失败/成功、关闭、刷新；保留业务后果确认和实际写入条件。Shoppp 已有权限变化消费者采用此合同，fzzx 教室迁移使用同一合同。当前来源的383条不计作本仓验证；本地 Drawer 合同与业务消费者分别记录。

## U8 宿主本地采用门禁

36项消费者均有明确归类：4普通Drawer、11局部输入Modal、10独立工作空间、3嵌入字段/辅助选择、4独立认证入口、3独立表单示例、1非表单详情Drawer。主入口与合法旧URL共用字段，权限/版本/locale/幂等身份/最近认证、媒体与附加写、业务替代动作保留。

L4宿主完整Admin unit：98文件773项通过，无跳过；最终build:test（含类型检查）通过，仅Admin范围。随后补齐columns中已使用的open依赖，实际已由openEditor依赖触发的行为保持；shipping完整4项再次通过，仍按773唯一用例计。5个实际Browser文件9项全部通过，包括IAM权限确认、720IAM/shipping长内容、普通Modal差异/改回/Escape/locale、结果和反馈。45个改动代码路径ESLint通过；shipping唯一新memo依赖警告已修正并定向检查通过。测试类型问题已按实际AdminSession、BrowserPage API和role查询声明修正，断言未降低。

本地U8实施与自动门禁完成；业务账号/运营验收另记，不把32文件307项worker证据与宿主773相加，不将来源383计作目标证据。无root/API/storefront源码改动，无依赖安装、worktree或远程发布。最终路径限定本地提交版本由U10汇总。
