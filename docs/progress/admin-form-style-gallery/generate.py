"""Build a local, dependency-free catalog from the retained screenshot evidence."""

from pathlib import Path
import json
import re


HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets" / "admin-form-style-unification"
PAGES = [
    ("color", "颜色／选项设置", "本次四个表单", "已修复", "Color、Size 分区和字段采用现有模板；保留色块与 HEX 的紧凑组合，统一错误提示和主题。"),
    ("product-presentation", "商品展示", "本次四个表单", "已修复", "统一展示、详情和规格分区，补齐中文字段标签及规格错误关联。"),
    ("location", "实体地点", "本次四个表单", "复核一致", "原 Drawer 已使用标准字段，本轮没有额外样式修改。复核长地址、错误、只读及草稿回填边界。"),
    ("collection", "商品集合", "本次四个表单", "复核一致", "原 Drawer 已符合字段规范；核验成员、SEO、兼容入口以及重置后的查询清空和迟到响应隔离。"),
    ("roles-create", "新增角色", "旧计划承接", "已修复", "新增与编辑使用同一权限树，保留可授予叶子范围、搜索和完整提交合同。"),
    ("content-page", "内容页面", "旧计划承接", "已修复", "发布、归档原因移入对应确认弹窗。对象、版本和动作绑定，失败保留原因，冲突后重新读取。"),
    ("content-article", "内容文章", "旧计划承接", "已修复", "与页面共用内容编辑器；文章入口单独验收。新增确认弹窗见下方补充状态。"),
    ("policies", "政策设置", "旧计划承接", "已修复", "原因随审批、发布和归档确认填写；生效日期填满原内容列，保留版本审阅及恢复边界。"),
    ("contact", "联系信息", "旧计划承接", "已修复", "无错误、版本对比和只读说明时移除空反馈容器，保留实际反馈分支。"),
    ("shipping", "配送设置", "后台排查修复", "已修复", "配送方式改用标准 Card 分区和单列普通字段，统一标题翻译、间距及主题边框。"),
    ("review-moderation", "评价审核", "后台排查修复", "已修复", "审核原因使用明确关联的标准标签，次要提示使用语义文字颜色。"),
    ("privacy", "隐私请求", "后台排查修复", "已修复", "身份核验说明使用语义次要文字颜色，保留原流程与业务原因。"),
    ("catalog-publish", "商品发布确认", "后台排查修复", "已修复", "发布原因补齐可见标签和原生关联，沿用既有确认与请求逻辑。"),
    ("published-product", "已发布商品修订", "后台排查修复", "已修复", "统一字段和分区，媒体使用标准排序操作组；底部操作留足滚动空间。宽高保留关联组合。"),
    ("structured-content", "页面动态正文", "后台排查修复", "已修复", "图片与链接补齐可见标签、控件名称和间距；内部资源类型本地化。"),
    ("structured-article", "文章动态正文", "后台排查修复", "已修复", "同一结构化内容组件在文章中的实际表现；图片和链接均为未保存测试草稿。"),
    ("structured-policy", "政策动态正文", "后台排查修复", "已修复", "同一结构化内容组件在政策中的实际表现；保留原内容与目标 payload。"),
    ("themes", "主题草稿列表", "后台排查修复", "已修复", "边框和元数据使用主题 token，验证状态本地化；同时复核新建表单。"),
    ("theme-editor", "主题编辑器", "后台排查修复", "已修复", "普通 schema 字段、链接及审批原因使用标准标签；复杂选择器保留分组语义并统一边框。"),
    ("theme-fields", "主题数值与素材", "后台排查修复", "补充情景", "使用明确的只读补充数据核验数值、开关及非空媒体。媒体来自仓库 favicon.svg，不是商品素材。"),
    ("theme-select", "主题文本与下拉", "后台排查修复", "补充情景", "核验普通文本和下拉 schema 字段的标准标签、整列宽度及主题。"),
    ("navigation-picker", "导航资源选择器", "后台排查修复", "已修复", "共享资源选择器在导航中的反向消费者验证；相同 Men 节点的未保存内部资源草稿。"),
    ("auth-login", "登录", "后台排查修复", "已修复", "页面背景改用主题 token。只观察测试空表单，没有输入或提交凭证。"),
    ("auth-forgot", "找回密码", "后台排查修复", "已修复", "页面背景跟随主题，原认证流程不变；未发送找回请求。"),
    ("auth-reset", "重置密码", "后台排查修复", "已修复", "使用测试 token 观察空表单，背景跟随主题；没有设置密码。"),
    ("auth-activate", "账号激活", "后台排查修复", "已修复", "使用测试 token 观察空表单，背景跟随主题；没有激活账号或设置密码。"),
    ("content-reset", "内容重置状态", "收尾验证", "已修复", "恢复原值后，旧版发布／归档仍禁用，新版恢复可用。版本冲突的额外恢复边界由行为测试验证。"),
    ("audit", "全后台排查原图", "收尾验证", "覆盖证据", "仅记录排查时的实际入口和状态，不代表每个入口都做过修改；这里没有对应的新旧对比。"),
]
REGIONS = {
    "": "主要表单", "error": "字段错误", "specifications": "规格分区",
    "members": "成员与 SEO", "date": "日期字段", "methods": "配送方式",
    "actions": "底部操作", "media": "媒体素材", "presentation": "商品展示",
    "variants": "变体字段", "image": "图片字段", "link": "链接字段",
    "pickers": "资源选择器", "create": "新建表单",
    "details": "版本引用详情",
}
EXTRAS = {
    "audit-product-presentation": "商品展示 Drawer",
    "audit-collection": "商品集合 Drawer",
    "audit-contact": "联系信息与地点",
    "audit-location": "地点 Drawer",
    "audit-shipping": "配送方式 Drawer",
    "audit-policies": "政策与版本审阅",
    "audit-identity": "店铺资料",
    "audit-role": "角色资料与权限树",
    "audit-user": "账号资料与访问操作",
    "long-values": "代表性长值", "confirmation": "操作确认弹窗", "request-error": "请求失败保留原因",
    "error": "字段校验", "reset": "确认重置后的状态", "readonly-compatible-url": "兼容入口只读",
    "internal": "内部资源类型", "user-detail-compatible": "用户兼容详情", "change-password": "修改密码空表单",
    "content-pages-filters": "内容页面筛选", "final-system-theme": "最终系统主题",
    "order-shipped": "已发货订单", "welcome": "引导页", "fulfillment-filters": "履约筛选",
    "launch-tail": "上线配置底部", "storefront-rollback": "店铺回滚确认", "report-filters": "报表筛选",
    "content-articles-filters": "文章筛选", "privacy-correction": "隐私更正", "order-refund": "退款确认",
    "user-detail": "用户详情", "role-protected-drawer": "受保护角色只读", "dashboard-clean": "首页筛选（校正样本）",
    "order-cancel": "订单取消", "report-export": "报表导出", "inventory-list": "库存列表",
    "contact-service-hours": "联系页营业时间", "orders-filters": "订单筛选", "jobs-replay": "任务重放",
    "contact-socials": "联系页社交链接", "store-identity-assets": "店铺身份素材", "storefront-publication": "店铺发布确认",
    "order-fulfill": "订单履约", "audit-filters": "审计筛选", "navigation-publication": "导航发布确认",
    "navigation-footer-picker": "页脚资源选择器", "store-identity": "店铺身份", "launch-main": "上线配置",
    "product-add": "新建商品", "user-invite": "用户邀请", "role-detail-compatible": "角色兼容详情",
    "theme-create": "主题创建", "dashboard": "首页", "inventory-adjust": "库存调整", "navigation": "导航编辑",
}


def image_record(key, filename, assets=ASSETS):
    stem = Path(filename).stem
    theme = "dark" if "dark" in stem.split("-") else "light" if "light" in stem.split("-") else None
    semantic = re.sub(r"^(before|after|intermediate)-", "", stem)
    semantic = re.sub(r"(^|-)(light|dark)(-|$)", lambda m: "-" if m[1] and m[3] else "", semantic).strip("-")
    label = EXTRAS.get(semantic, REGIONS.get(semantic, semantic))
    phase = "中间版本" if stem.startswith("intermediate-") else "修改前" if stem.startswith("before-") else "修改后" if stem.startswith("after-") else "排查原图"
    return {"src": f"../assets/{assets.name}/{key}/{filename}", "label": label, "theme": theme, "phase": phase}


pages = []
paired_images = set()
all_images = set()
for key, title, group, badge, note in PAGES:
    directory = ASSETS / key
    filenames = {p.name for p in directory.glob("*.jpg")}
    all_images.update(directory / name for name in filenames)
    regions = []
    used = set()
    suffixes = sorted({re.fullmatch(r"before-light(.*)\.jpg", name)[1] for name in filenames if re.fullmatch(r"before-light(.*)\.jpg", name)})
    for suffix in suffixes:
        required = {f"{phase}-{theme}{suffix}.jpg" for phase in ("before", "after") for theme in ("light", "dark")}
        if not required <= filenames:
            continue
        used.update(required)
        paired_images.update(directory / name for name in required)
        regions.append({
            "id": suffix.lstrip("-") or "main",
            "label": REGIONS[suffix.lstrip("-")],
            "images": {theme: {phase: image_record(key, f"{phase}-{theme}{suffix}.jpg") for phase in ("before", "after")} for theme in ("light", "dark")},
        })
    pages.append({"id": key, "title": title, "group": group, "badge": badge, "note": note, "regions": regions, "extras": [image_record(key, name) for name in sorted(filenames - used)]})

assert len(all_images) == len(list(ASSETS.rglob("*.jpg"))), "Uncataloged screenshot directory"
history = {"id": "history", "label": "上一轮 · 表单基础统一", "date": "2026-10-31", "pages": pages, "counts": {"groups": sum(bool(p["regions"]) for p in pages), "regions": sum(len(p["regions"]) for p in pages), "images": len(all_images)}, "description": "上一轮历史证据，保留当时的界面与结论，不代表已满足本轮新增结构规则。地点、集合前后图为两次复核；动态图片／链接为未保存草稿，补充样本已明确标注。", "evidence": {"index": "../2026-10-31-admin-form-style-comparisons.md", "verification": "../2026-10-31-admin-form-style-unification-verification.md", "audit": "../2026-10-31-admin-form-style-audit.md"}}

CURRENT_ASSETS = ASSETS.parent / "admin-form-visual-structure"
CURRENT_PAGES = [
    ("color", "颜色／选项设置", "选项轻分区", "Color、Size 不使用 Card，用标题、留白和细分割线区分；保留色样关联及错误反馈。", ["main", "error"]),
    ("content-page", "内容页面", "状态与发布", "采用选定第三张结构：全宽 Card、与 SEO 对齐的单列只读状态和版本；业务动作保留原权限与确认。", ["main", "details"]),
    ("content-article", "内容文章", "状态与发布", "文章入口单独核验；共享内容编辑器不替代两入口各自的实际截图。", ["main", "details"]),
    ("theme-workspace", "主题编辑器 · 当前入口", "共享字段与单列", "当前实际可视化编辑器的属性字段单列；共享资源、媒体、链接不使用断边标题，保留一个可见标签。修改前来自当前消费者＋精确保留的原共享组件，只读隔离预览，非旧编辑器画面。", ["main", "media", "link"]),
    ("navigation-header", "导航 · 页头资源", "共享字段与单列", "同一资源选择器的页头消费者；Men 节点的内部资源是未保存测试草稿。", ["main"]),
    ("navigation-footer", "导航 · 页脚资源", "共享字段与单列", "页脚独立保存基线与对比，不以页头图片充当页脚证据。", ["main"]),
    ("order-detail", "订单只读详情", "同类排查修复", "只读事实和无可用操作说明的次要文字使用主题色，保留原事实、金额、操作权限及确认流程。", ["main"]),
    ("user-drawer", "账号详情 Drawer", "同类排查修复", "已保存的邮箱、状态、版本、更新时间采用单列只读字段，与当前编辑状态分开；保留权限、版本和安全确认。", ["main"]),
    ("user-compatible", "账号详情 · 兼容独立页", "同类排查修复", "与 Drawer 共用账号组件；兼容独立入口单独核验同条件新旧图，不由 Drawer 图片代替。", ["main"]),
]
current_pages = []
current_images = set()
for key, title, group, note, required_regions in CURRENT_PAGES:
    directory = CURRENT_ASSETS / key
    filenames = {p.name for p in directory.glob("*.jpg")}
    current_images.update(directory / name for name in filenames)
    regions = []
    used = set()
    for region_id in required_regions:
        suffix = "" if region_id == "main" else f"-{region_id}"
        images = {}
        missing = []
        for theme in ("light", "dark"):
            images[theme] = {}
            for phase in ("before", "after"):
                name = f"{phase}-{theme}{suffix}.jpg"
                if name in filenames:
                    images[theme][phase] = image_record(key, name, CURRENT_ASSETS)
                    used.add(name)
                else:
                    missing.append({"theme": theme, "phase": phase})
        regions.append({"id": region_id, "label": REGIONS.get("" if region_id == "main" else region_id, region_id), "images": images, "missing": missing})
    current_pages.append({"id": key, "title": title, "group": group, "badge": "对比已齐" if all(not r["missing"] for r in regions) else "证据未齐", "note": note, "regions": regions, "extras": [image_record(key, name, CURRENT_ASSETS) for name in sorted(filenames - used)]})

retired_images = sorted((CURRENT_ASSETS / "theme-editor").glob("*.jpg"))
current_images.update(retired_images)
current_pages.append({"id": "theme-editor", "title": "旧主题编辑器 · 替换前基线", "group": "入口变更记录", "badge": "入口已替换", "note": "实施中并行编辑器切换了原路由，旧实现已退役。本组只保留当时拍摄的修改前原图，不伪造修改后；当前入口的独立新旧对比见“主题编辑器 · 当前入口”。", "regions": [], "extras": [image_record("theme-editor", p.name, CURRENT_ASSETS) for p in retired_images]})
audit_images = sorted((CURRENT_ASSETS / "audit").glob("*.jpg"))
current_images.update(audit_images)
if audit_images:
    current_pages.append({"id": "audit", "title": "本轮同类问题排查原图", "group": "本轮排查", "badge": "覆盖证据", "note": "本轮重新核对的实际表单与合法例外。这里只记录检查原图，不代表这些页面做过修改；已确认修复见各自的新旧对比入口。", "regions": [], "extras": [image_record("audit", p.name, CURRENT_ASSETS) for p in audit_images]})
assert len(current_images) == len(list(CURRENT_ASSETS.rglob("*.jpg"))), "Uncataloged current screenshot directory"
current = {"id": "structure", "label": "本轮 · 分区与单列修复", "date": "2026-10-31", "pages": current_pages, "counts": {"groups": sum(bool(p["regions"]) and all(not r["missing"] for r in p["regions"]) for p in current_pages), "regions": sum(not r["missing"] for p in current_pages for r in p["regions"]), "images": len(current_images)}, "description": "本轮使用实际组件与隔离 fixture，中文、1280×900、100%，无真实业务写入。每页先保存消费者旧图，再提供同主题同业务区域新图。新编辑器使用同一份冻结消费者恢复原共享组件补拍 before，预览会话只返回内存测试上下文。缺图明确保留，不混用上一轮 after 或 AI 示意图；图片齐备不代替行为验收。", "evidence": {"index": "../assets/admin-form-visual-structure/capture-manifest.json", "verification": "../2026-10-31-admin-form-visual-structure-verification.md", "audit": "../2026-10-31-admin-form-visual-structure-audit.md"}}
DESCRIPTION_ASSETS = ASSETS.parent / "admin-description-candidates-2026-10-31"
DESCRIPTION_PAGES = [
    ("account", "01 · 账号已保存资料", "优先候选", "4 项：邮箱、已保存状态、版本、更新时间。请判断这组纯展示资料是否改用 Descriptions；Drawer 与兼容独立页分别保留现状。", [("01-account-drawer", "账号 Drawer"), ("01-account-compatible", "账号兼容独立页")]),
    ("health", "02 · 运行健康", "优先候选", "5 项：总体状态与四类失败计数。请查看页面下方目前横向散排的健康信息。", [("02-health", "经营设置下方的运行健康")]),
    ("contact-conflict", "03 · 联系信息冲突核对", "优先候选", "5 项固定已保存资料及地点／社交列表。画面来自隔离 fixture 的 409 冲突与读取流程；没有保存业务值。", [("03-contact-conflict", "冲突后的当前已保存值")]),
    ("theme-package", "04 · 主题包资料", "优先候选", "4 项：平台契约、配置结构、支持页面、预设。当前展示方式是几行散排文字。", [("04-theme-package", "已批准主题包资料")]),
    ("editor-version", "05 · 编辑器版本详情", "优先候选", "6 项固定信息目前直接输出 JSON。请查看右侧审核与发布中的版本详情；未改变字段或生成正式预览。", [("05-editor-version", "右侧版本详情 JSON")]),
    ("online-version", "06 · 线上版本概览", "优先候选", "3 项：线上状态、主题包及版本、更新时间。线上状态为既有测试 publication 的隔离样本，不是实际部署状态。", [("04-theme-package", "店铺装修顶部线上版本概览（与主题包同页）")]),
    ("policy", "07 · 政策审阅元信息", "可选区域", "版本号目前在标题，正文前还有摘要与生效日期；可考虑将这三项集中为描述区。正文比较与审核动作保持各自职责。", [("07-policy", "政策审阅区域")]),
    ("location", "08 · 地点列表摘要", "可选区域", "地点名保留标题，城市、详细地址、公开状态共三项可考虑用描述组件。这里只查看地点列表摘要，不改变编辑 Drawer。", [("08-location", "实体地点列表摘要")]),
    ("single-version", "09 · 当前版本单项描述", "现有用法复核", "这一组 Descriptions 只有“当前版本”一项。请判断是否改回普通标签与文本；下方七项发布记录不是本次建议删除的对象。", [("09-single-version", "发布历史中的单项当前版本")]),
]
description_pages = []
description_images = set()
for key, title, group, note, shots in DESCRIPTION_PAGES:
    records = []
    for name, label in shots:
        path = DESCRIPTION_ASSETS / f"{name}.jpg"
        if path.exists():
            description_images.add(path)
            records.append({"src": f"../assets/{DESCRIPTION_ASSETS.name}/{path.name}", "label": label, "theme": "light", "phase": "现状截图"})
    description_pages.append({"id": key, "title": title, "group": group, "badge": "待判断", "note": note, "regions": [], "extras": records, "extrasTitle": "当前页面截图", "extrasNote": "点击图片可放大至 100%／200%。本组只有现状图，没有修改后效果，也不代表已批准实施。"})
assert len(description_images) == len(list(DESCRIPTION_ASSETS.glob("*.jpg"))), "Uncataloged description screenshot"
descriptions = {"id": "descriptions", "label": "待判断 · 描述组件候选", "pages": description_pages, "counts": {"groups": 0, "regions": 0, "images": len(description_images)}, "countsLabel": f"9 个待判断区域 · {len(description_images)} 张现状图", "description": "本组新拍摄当前实际组件，中文、1280×900、浅色；使用本地隔离测试样本，没有修改 Admin 页面代码或样式。冲突仅由本地 fixture 返回 409，线上版本使用既有 publication 测试样本，无真实业务写入、批准、发布或部署。", "evidence": {"index": "../assets/admin-description-candidates-2026-10-31/capture-manifest.json", "verification": "../2026-10-31-admin-description-candidates-screenshots.md", "audit": "../2026-10-31-admin-description-candidates-screenshots.md"}}
READONLY_ASSETS = ASSETS.parent / "admin-readonly-descriptions-2026-11-02"
READONLY_PAGES = [
    ("account", "01 · 账号已保存资料", "账号", "四项已保存资料改为单列 Descriptions；Drawer 与兼容独立页分别留图。", [("drawer", "账号 Drawer"), ("compatible", "兼容独立页")]),
    ("health", "02 · 运行健康", "经营设置", "总体状态与四类失败计数改为五项单列描述；健康加载和恢复保留。", [("main", "运行健康")]),
    ("contact-conflict", "03 · 联系信息冲突核对", "联系信息", "五项固定当前值改为描述信息；地点、社交及替换输入动作仍沿用原边界。", [("main", "当前已保存值")]),
    ("theme-package", "04 · 主题包资料", "店铺装修", "平台契约、配置结构、支持页面、预设四项分别展示。", [("main", "已批准主题包")]),
    ("editor-version", "05 · 编辑器版本详情", "编辑器", "六项固定版本事实替换原 JSON；空快照与构建状态保持真实，不生成正式预览。", [("main", "版本详情")]),
    ("online-version", "06 · 线上版本概览", "店铺装修", "已验证线上状态、主题包及版本、更新时间三项；使用隔离测试发布记录。", [("main", "线上版本概览")]),
    ("policy", "07 · 政策审阅元信息", "政策", "版本、摘要、生效日期集中为三项描述；正文比较、确认与权限保持原合同。", [("main", "政策审阅")]),
    ("location", "08 · 地点列表摘要", "联系信息", "地点名称保留标题，城市、地址、公开状态改为三项描述；编辑 Drawer 保持表单。", [("main", "地点摘要")]),
    ("single-version", "09 · 当前版本单项", "编辑器", "单项当前版本使用普通文本；下方七项发布记录继续保留 Descriptions。", [("main", "发布历史")]),
]
readonly_pages = []
readonly_images = set()
for key, title, group, note, required_regions in READONLY_PAGES:
    directory = READONLY_ASSETS / key
    filenames = {p.name for p in directory.glob("*.jpg")}
    readonly_images.update(directory / name for name in filenames)
    regions = []
    used = set()
    for region_id, label in required_regions:
        suffix = "" if region_id == "main" else f"-{region_id}"
        images = {theme: {} for theme in ("light", "dark")}
        missing = []
        for theme in images:
            for phase in ("before", "after"):
                name = f"{phase}-{theme}{suffix}.jpg"
                if name in filenames:
                    images[theme][phase] = image_record(key, name, READONLY_ASSETS)
                    used.add(name)
                else:
                    missing.append({"theme": theme, "phase": phase})
        regions.append({"id": region_id, "label": label, "images": images, "missing": missing})
    readonly_pages.append({"id": key, "title": title, "group": group, "badge": "对比已齐" if all(not r["missing"] for r in regions) else "证据未齐", "note": note, "regions": regions, "extras": [image_record(key, name, READONLY_ASSETS) for name in sorted(filenames - used)]})
assert len(readonly_images) == len(list(READONLY_ASSETS.rglob("*.jpg"))), "Uncataloged readonly screenshot"
readonly = {"id": "readonly", "label": "本轮 · 只读描述信息", "date": "2026-11-02", "pages": readonly_pages, "counts": {"groups": sum(all(not r["missing"] for r in p["regions"]) for p in readonly_pages), "regions": sum(not r["missing"] for p in readonly_pages for r in p["regions"]), "images": len(readonly_images)}, "description": "用户已批准的只读展示修复。Descriptions 仅用于同组至少三项独立只读信息；中文、1280×900、100%、浅／深色、本地隔离测试数据。每页新旧图完成后立即加入本轮，缺图明确标记；不改写候选原图或历史轮次。", "evidence": {"index": "../assets/admin-readonly-descriptions-2026-11-02/capture-manifest.json", "verification": "../2026-11-02-admin-readonly-descriptions-verification.md", "audit": "../2026-11-02-admin-readonly-descriptions-verification.md"}}
history["label"] = "历史 · 表单基础统一"
current["label"] = "历史 · 分区与单列修复"
descriptions["label"] = "历史 · 描述组件候选原图"
readonly["label"] = "历史 · 只读描述信息"
readonly["description"] = "2026-11-02 实施时的浅／深色新旧证据，保留当时界面；不代表全部获得用户认可。01 的描述组件决定已于 2026-11-06 撤回，最新反馈和修正请看“当前 · 用户反馈复核”。"
FEEDBACK_ASSETS = ASSETS.parent / "admin-readonly-feedback-2026-11-06"
feedback_pages = []
for key, title, status, note, required_regions in [
    ("account", "01 · 账号已保存资料", "已恢复", "已按用户意见撤回描述组件，恢复原只读表单；查看与编辑复用同一结构。以下为 2026-11-06 两个实际入口的修正前后图。", [("drawer", "账号 Drawer"), ("compatible", "账号兼容独立页")]),
    ("health", "02 · 运行健康", "待复核", "健康内容与上方表单使用相同 compact 内容宽度和对齐偏好；居中的是内容列，键值文字保持正常阅读。以下为 2026-11-06 修正前后图。", [("main", "健康信息对齐")]),
]:
    regions = []
    for region_id, label in required_regions:
        suffix = "" if region_id == "main" else f"-{region_id}"
        images = {theme: {} for theme in ("light", "dark")}
        missing = []
        for theme in images:
            for phase in ("before", "after"):
                name = f"{phase}-{theme}{suffix}.jpg"
                if (FEEDBACK_ASSETS / key / name).is_file():
                    images[theme][phase] = image_record(key, name, FEEDBACK_ASSETS)
                else:
                    missing.append({"theme": theme, "phase": phase})
        regions.append({"id": region_id, "label": label, "images": images, "missing": missing})
    feedback_pages.append({"id": key, "title": title, "group": "本次调整", "badge": status if all(not r["missing"] for r in regions) else "证据未齐", "reviewStatus": status if all(not r["missing"] for r in regions) else "补图中", "note": note, "regions": regions, "extras": []})

for key in ["online-version", "contact-conflict", "location", "theme-package", "editor-version", "single-version", "policy"]:
    source = next(p for p in readonly_pages if p["id"] == key)
    accepted = key != "online-version"
    feedback_pages.append({**source, "group": "已认可（保留）" if accepted else "本轮未评价", "badge": "已认可" if accepted else "待确认", "reviewStatus": "已认可" if accepted else "待确认", "note": ("用户已于 2026-11-06 明确认可，保留实现；" if accepted else "本次未提及，尚未获用户判断；") + "沿用 2026-11-02 的真实新旧证据，没有重新拍摄。" + source["note"]})

for key in ["color", "content-page", "content-article", "theme-workspace", "navigation-header", "navigation-footer", "order-detail"]:
    source = next(p for p in current_pages if p["id"] == key)
    feedback_pages.append({**source, "id": f"previous-{key}", "title": f"前轮 · {source['title']}", "group": "前轮最终效果（集中复核）", "badge": "前轮留档", "reviewStatus": "前轮图", "note": "前轮独立页面的最终效果集中展示，截图拍摄于 2026-10-31，并非本次重拍或已获用户认可；账号重复入口已合并到 01。可直接看修改后图，无需逐个历史轮次重看。" + source["note"], "extras": []})

feedback = {"id": "feedback", "label": "当前 · 用户反馈复核", "date": "2026-11-06", "pages": feedback_pages, "counts": {"groups": sum(all(not r["missing"] for r in p["regions"]) for p in feedback_pages), "regions": sum(not r["missing"] for p in feedback_pages for r in p["regions"]), "images": sum(len(theme) for p in feedback_pages for r in p["regions"] for theme in r["images"].values())}, "countsLabel": "本轮：6 项已认可 · 01 已恢复 · 02 待复核 · 06 待确认；另汇总前轮 7 项", "description": "本次反馈和前轮独立最终效果集中查看，历史轮次仅供追溯，无需逐轮逐张重复判断。01、02 使用 2026-11-06 实拍；其余沿用明确标注日期的证据。用户认可、实现状态和图片齐备分别表达，不互相代替。", "evidence": {"index": "../assets/admin-readonly-feedback-2026-11-06/capture-manifest.json", "verification": "../2026-11-06-admin-readonly-review-feedback-verification.md", "audit": "../2026-11-06-admin-readonly-review-feedback-verification.md"}}
data = {"defaultRound": "feedback", "rounds": [feedback, readonly, descriptions, current, history]}
(HERE / "gallery-data.js").write_text("window.ADMIN_FORM_GALLERY = " + json.dumps(data, ensure_ascii=False, indent=2).replace("<", "\\u003c") + ";\n")
print(json.dumps({r["id"]: r["counts"] for r in data["rounds"]}, ensure_ascii=False))
