# Shoppp Admin 统一表单采用记录

本次是批准统一计划的 U3 共享能力回流，只覆盖 `apps/admin`。业务页及实际入口整改由后续 U8 负责；共享能力通过不等于页面已完成统一。

## 来源与边界

- 批准来源：`codex-admin-quick-start@932cdf7f24d45cf8481f5162c58ef057c2cb8aa3`，已解析并核对。来源 L4 的 380 条单元、6 条浏览器和 build 证明仅属于来源。
- 目标起始 HEAD：`shoppp@13a0beba031c945b702820d39a436c8e03a932ea`，实施前工作区干净。
- 目标采用 commit：待宿主本地门禁及路径限定提交后登记；本文件不声称整仓或发布完成。
- 本地权威：`ai-rules.md` 第3.1节；布局：`drawer-form-layout-rules.md`；投影：AGENTS、README、recipe/catalog、迁移工作流与检查清单。原业务 API、权限、完整 payload、校验、外部集合、reset 与安全恢复合同保持。

## 采用内容

| 能力 | 本地适配 | 本次证据 |
| --- | --- | --- |
| 容器与布局 | 容器和结构分别判断；全部右 Drawer720；Modal仅实际模式；独立页及合法旧URL保留。320/656为常规双列基线，不引入来源课程/订单的局部阈值 | 文档L0、YAML解析、diff与引用检查；未迁移业务入口 |
| 表单controller | 增量加入readonly行为守卫、同轮提交锁、详情generation与alive隔离；保留现有converter、ApiError、初始化/reset接口 | 新守卫测试在行为修改前观察RED；controller本地9条通过 |
| 独立基础壳 | 保留分区、对齐及本地操作栏；行为层阻断readonly/权限/详情失败与busy。结构锁定的modify保留原禁用Save并禁用Reset，真正readonly按showActions隐藏 | 基础壳9条与直接消费者回归通过；未改业务页 |
| Drawer recipe/spec/barrel | 从批准源本地采用720px壳、dirty确认、同步锁、actionBusy、nestedModalOpen、退出后清理、alive+exiting保护、一次父内容读取及普通成功Modal。失败类型使用目标ApiError；持久错误当前语言渲染，异步即时反馈用current-translate | Drawer34条本地单元通过，包含语言切换不丢草稿、不重写与权限阻断；3条浏览器用例已适配但未执行 |
| 缓存读取恢复 | 保留目标现有same-scope刷新失败partial状态与TemplateListContent的Alert+Reload，不叠第二条告警 | 既有controller缓存数据保留、读取失败和内容重读用例通过；未改该能力 |

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
