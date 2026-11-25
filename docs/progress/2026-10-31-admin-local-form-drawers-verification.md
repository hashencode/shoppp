# Admin 局部表单 Drawer 验证

日期：2026-10-31。范围由 `docs/plans/2026-10-31-refactor-admin-local-form-drawers-plan.md` 拥有；不改变产品 master、候选或发布状态。

## 已验证行为

- 商品选项展示与商品展示从原页面的摘要入口打开标准 720px Drawer；保留独立 PATCH、共享商品版本与写锁、已发布／归档／只读限制。空选项仍不能保存。关闭放弃、重置、保存失败保留输入，API 回包更新父状态，原列表刷新频道只发送一次；商品主体未保存输入不因子保存被重读覆盖。
- 门店地址在 Drawer 内校验、确认和重置，确认只回填联系设置草稿。取消不增加地点，不写数据库；地点 ID、null、排序、公开状态与整页版本 payload 保留。新增／编辑期间阻止整页保存和重置，提示明确说明还需要保存联系设置页面。
- 商品集合列表新增、编辑、查看均使用 Drawer；原表单 URL 仍共享字段和提交实现。保留 handoffProductId、returnTo、完整顺序成员、封面、SEO、发布权限／原因、版本和依赖阻断。搜索及重置忽略旧请求响应，重置同时清空控件搜索文本。保存失败保留草稿；成功只刷新当前列表一次，结果确认不再重读。
- Drawer 继续由共享 recipe 持有关闭确认、busy、退出动画与结果提示，没有修改共享组件或添加全局 ARIA、焦点／草稿／导航机制。

## L3 验证结果

- `bun run --cwd apps/admin test src/pages/catalog/catalog-form-page.test.tsx src/pages/catalog/collection-form-page.test.tsx src/pages/catalog/collection-list-page.test.tsx src/pages/settings/contact-settings-page.test.tsx --pool.maxWorkers=2`：4 文件 **42 项通过**，无跳过。包含完整 payload、互斥版本、失败保留、取消零写、旧 URL、手递商品和迟到搜索响应等断言。
- `bun run --cwd apps/admin test:browser src/test/admin-local-form-drawers.browser.test.tsx`：**3 项通过**。真实 Portal、Esc／继续编辑、重置、保存后退出、未保存商品主体、门店整页保存、长规格与成员名称、720px／滚动／footer／无横向溢出均覆盖。
- Admin `bun run typecheck` 通过；11 个改动 TS/TSX 文件 ESLint 无错误、无警告；Prettier 和 `git diff --check` 通过。
- `bun test tools/check-admin-i18n.test.ts`：**8 项通过**，含当前生产调用与占位符覆盖检查。
- 未运行全应用测试、build、根 monorepo 或 API/storefront 门禁：没有修改共享运行时、依赖、contracts、API 或 storefront。

最先新增的商品入口测试在实现前观察到失败：旧页面仍直接渲染选项字段。实施中发现并修复了规范化函数的局部变量引用和集合重置后的迟到查询。测试里原有常驻字段入口已改为实际 Drawer 入口；Ant Design 的双标题、中文按钮空格、测试 ID 和隐藏 Popconfirm 按实际组件语义定位，未以删除断言规避问题。

## 截图与复核

截图位于忽略目录 `.artifacts/drawer-form-screenshots-2026-10-31/after/`，包含商品展示、规格下半部分、选项展示、门店地址、商品集合。真实当前组件与 AppShell 使用仓库已有测试样本，只替换本地只读 API transport；门店是未保存草稿，没有创建业务记录。默认浏览器视口随桌面窗口变化，因此这些截图用于界面验收，不声称像素级同视口前后比较。四个 Drawer 均实测宽 720px，body 没有横向溢出，footer 可达。

按项目 AGENTS 的 Task 映射，在主线程顺序完成 ce-simplify-code 与 ce-code-review 的正确性、项目规范、测试、维护性、权限、恢复、组合失败和前端时序检查；没有派发子代理或独立模型复核。保留本次证明行为的测试。复用 SortActionGroup 和现有 recipe；规格字段与记录操作按 Drawer 空间分行。最终没有未解决的阻塞性发现。

临时本地预览进程在截图后关闭。原有未跟踪的 2026-10-29 表单一致性计划保持原样；没有提交、推送、PR 或部署。
