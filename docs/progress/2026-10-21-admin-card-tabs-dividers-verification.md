# Admin 原生 Card Tabs 与贯通分区验证

2026-10-21，本地独立修正，owner 为 `docs/plans/2026-10-21-fix-admin-card-tabs-dividers-plan.md`；不提供 REL/DC/PG 候选结论。

## 实现事实

- 导航采用原生 Card `tabList / activeTabKey / onTabChange / tabBarExtraContent`，移除模拟 `.ant-card-head` 和自定义 Tabs 底线 CSS。仅首次访问挂载对应 MenuEditor，之后保持实例并隐藏非当前内容及固定工具条。
- 导航与权限树批量展开／收起使用 16px Lucide `UnfoldVertical / FoldVertical`，保留原有 Tooltip、名称、禁用条件和只读浏览。Tree 自身节点开关不变。
- Card 分区不留 gap，内边距由分区承担。导航结构列 340px、角色独立页资料列 360px（均包含 padding），沿用 900px 容器断点、wide 内容宽度和对齐偏好。角色的页级容器仅作用于兼容独立页，局部覆盖 AppShell 默认 Card padding；720px Drawer 不采用该覆盖。
- Admin 分割线直接衔接 Card 上下边界；普通角色有归档／错误区时，以横线划出全宽底部分区，竖线与之相接。API、版本、权限、确认及只读硬阻断不变。
- `ai-rules.md` §4.4 和 `page-guardrail-recipes.md` §2.1 写入原生头部 API、禁止模拟头部、工作区分割线贯通和分区 padding 责任。
- 参考来源为 gmxgy-admin-new 的 `origin/codex/continue-order-batch-invoice`（82acc55）视频库；本地 master 尚为多 Card。仅参考该分区实现，未修改来源仓库。

## 验证

选择 L2；边界、宽度和溢出风险升级为目标 Browser Mode 与真实浏览器几何核对，不跑全应用构建或端到端发布检查。

| 验证                               | 结果                                        |
| ---------------------------------- | ------------------------------------------- |
| 导航集成 24、树规则 8、IAM 页面 51 | 83/83 通过                                  |
| 导航 Browser Mode 3、IAM Drawer 1  | 4/4 通过                                    |
| `bun run typecheck`                | 通过；首次测试断言类型问题修复后重跑一次    |
| changed-file ESLint                | 通过                                        |
| changed-file Prettier              | 通过；角色文件格式修复后仅复查该文件及规范  |
| `git diff --check`                 | 通过                                        |
| Git index                          | 与修改前 binary diff 字节一致，未暂存或提交 |

定向检查原始日志位于 `/private/tmp/shoppp-card-tabs-refinement-20261021/`：`focused-final.log`、`browser-fixed.log`、`typecheck-final.log`、`lint-final.log`、`format-final.log` 与 `format-repaired.log`。曾误从根目录启动测试命令，立即终止，未作为本次验证证据。

初次布局断言失败是 Browser Mode 默认窄容器实际处于堆叠状态；桌面用例明确 1100px 内容宽度后通过，独立窄容器用例仍检查横线和无溢出。四个 IAM 只读用例曾在重复全树 role 查询时超时：诊断显示读取已完成约 0.24 秒，后续按钮查询累计超过 10 秒；关闭动画或换回旧图标均未消除耗时。改用页面拥有的按钮文案及 `aria-label` 定位，保留 disabled、勾选、零写及浏览断言；四例 2.7 秒通过，未延长超时。所有临时诊断与图标替换均已移除。

采用样式／图标不增加镜像测试的例外；加强既有 Browser Mode 的真实几何断言和导航完整草稿测试。最终代码通过同线程 lite 检查与简化检查，无待修复发现；未调度子代理或外部审查。检查收据：`/private/tmp/compound-engineering-501/ce-code-review/20261021-admin-card-tabs-dividers/report.md`。

## 截图证据

[前后对比](/Users/studio/.codex/visualizations/2026/10/11/01a12af4-21cd-7df1-bdc4-47f27f0b26fe/card-tabs-refinement/comparison.md) 包含导航桌面、Admin 和导航窄屏三组配对，另有普通角色修改后补充图。使用真实组件、AppShell、主题与浏览器，仅替换 transport 为固定测试数据，无业务环境写入。中文浅色、同权限与数据、同选中／展开状态；桌面 1440×1050，窄屏 390×844。

实测：桌面导航头部底线与激活条均在 y=185，body/divider y=184–699（原生 Card 的 -1px border 合并）；Admin body/divider y=157.42–763.42；普通角色竖线终点与底部横线同在 y=725.42；窄屏导航 body 与横线区域均为 x=120–350，document scrollWidth=390，无横向溢出。源文件 hash、fixture 与截图清单保存在同一截图目录，基线从本轮修改前采集，无复用更早历史图。
