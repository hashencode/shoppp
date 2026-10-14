# Shoppp：Fashion 真实测试环境补验

当前源码已 build:test（含类型检查）通过，使用已构建 preview 的原允许 origin `127.0.0.1:3418` 及原代理连接实际 Fashion API，真实 human/admin 登录，无业务 API mock。未用远程旧页面替当前源码验收。[逐项证据](./form-test-environment-acceptance-2026-10-14.json)。

本次必选验收限于受影响表单及完整提交。下表保留已开展的额外联调；邮件、支付、导出和发布全链路不作为表单交付门槛。商品真实保存422属于受影响表单的未通过项，仍明确保留。

| 原组 | 结果 | 实际证据 / 缺口 |
| --- | --- | --- |
| SP-EXT-01 账号/邮件/恢复 | 部分通过 | 真登录、HttpOnly会话、IAM角色完整新增/修改/归档与新GET相等，版本+1、一次父刷新；受保护管理员线上重置403且未发邮件。邮件送达/激活及受控凭据恢复未测。 |
| SP-EXT-02 R2媒体 | 通过 | 实际PUT201、对象GET200；68字节原PNG及SHA完全相同。 |
| SP-EXT-03 订单/库存/隐私 | 未通过/环境阻塞 | 当前商品新增与修改分别422；没有自有库存位置、受控订单/支付样本，实际缺PRIVACY_EXPORTS。 |
| SP-EXT-04 CSV导出 | 环境阻塞 | 实际部署缺REPORT_EXPORTS，无法验证worker完成和下载CSV。 |
| SP-EXT-05 发布/私密预览 | 环境阻塞 | 匹配API/数据库/provider候选流程尚未建立；未部署、调工作流或生成preview grant。 |
| SP-EXT-06 技术视觉样本 | 通过（有限范围） | 当前独立表单、720px Drawer、成功Modal、readonly强制提交零写、footer可达、无横溢；不是人工批准或114行全部真实交易。 |

两次商品保存的完整请求均与独立冻结预期相等，实际API分别拒绝`optionDefinitions`和`expectedVersion`。只读真实Fashion D1证实仅迁移到0026，products缺option_definitions_json/version；当前候选仍需16个迁移文件。不能删除业务字段迁就旧API，也不能只部署前端或更新API而不核对数据迁移。环境修复顺序见[匹配候选方案](./form-test-environment-matching-api-2026-10-14.md)，本轮未执行。

一条明确命名、未发布QA商品及引用媒体作为隔离样本保留（无产品删除合同）；用旧schema准备该fixture不算当前新增通过。单个QA角色已普通业务归档，未分配用户或邀请；未修改既有商品库存、订单、付款、权限或生产数据。当前会话正常logout204后session401，浏览器和自有preview已关闭；前两次探针错误退出的QA会话客户端cookie丢失，等待12小时自然过期，未直接SQL撤销会话或更改密码。
