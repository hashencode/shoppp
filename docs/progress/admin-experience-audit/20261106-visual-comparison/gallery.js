const records = window.REVIEW_DATA;
const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
let current =
  records.find((r) => r.id === decodeURIComponent(location.hash.slice(1))) ||
  records.find((r) => r.id === "UX-020");
let frameIndex = 0,
  full = false;
function renderDirectory() {
  const previousScroll = $("directory").scrollTop;
  const q = $("find").value.trim().toLowerCase(),
    type = $("category").value;
  const list = records.filter(
    (r) =>
      (type === "all" || r.classification.group === type) &&
      (!q || (r.id + " " + r.title).toLowerCase().includes(q)),
  );
  $("directory").replaceChildren();
  for (const r of list) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "directory-item" + (r.id === current.id ? " active" : "");
    item.setAttribute("aria-current", r.id === current.id ? "true" : "false");
    item.innerHTML =
      "<small>" +
      escape(r.id) +
      " · " +
      escape(r.priority) +
      "</small><span>" +
      escape(r.title) +
      "</span>";
    item.addEventListener("click", () => selectIssue(r.id));
    $("directory").append(item);
  }
  if (!list.length) $("directory").textContent = "没有匹配的问题。";
  $("directory").scrollTop = previousScroll;
  const active = $("directory").querySelector(".active");
  if (active) {
    const item = active.getBoundingClientRect(),
      region = $("directory").getBoundingClientRect();
    if (item.top < region.top) $("directory").scrollTop += item.top - region.top;
    else if (item.bottom > region.bottom) $("directory").scrollTop += item.bottom - region.bottom;
  }
}
function selectIssue(id) {
  const selected = records.find((r) => r.id === id);
  if (!selected) return;
  current = selected;
  frameIndex = 0;
  full = false;
  if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
  renderDirectory();
  renderIssue();
  window.scrollTo({ top: 0 });
}
function renderIssue() {
  $("badges").innerHTML =
    '<span class="badge ' +
    current.classification.group +
    '">' +
    escape(current.classification.label) +
    '</span><span class="badge priority">' +
    escape(current.priority + " · " + current.id) +
    '</span><span class="badge status' +
    (current.current_status === "未完成复现" ? " unverified" : "") +
    '">本轮：' +
    escape(current.current_status) +
    "</span>";
  $("issue-title").textContent = current.title;
  $("observation").textContent = current.current_observation;
  $("design-note").textContent = current.design_note;
  $("target-link").href = current.target;
  $("target").title = current.id + " 目标设计示意";
  $("target").src = current.target;
  $("goal-list").innerHTML = current.goals.map((g) => "<li>" + escape(g) + "</li>").join("");
  $("rationale").innerHTML =
    "<p><b>为什么改：</b>" +
    escape(current.impact) +
    "</p><p><b>建议：</b>" +
    escape(current.proposal) +
    "</p><p><b>验收：</b>" +
    escape(current.acceptance) +
    "</p><p><b>逻辑判断：</b>" +
    escape(current.classification.logic_assessment) +
    "</p>";
  $("old-detail").href = "../20261031-234330-admin-ux/report.html#" + current.id.toLowerCase();
  const i = records.indexOf(current);
  $("position").textContent = i + 1 + " / " + records.length + " 项";
  $("previous").disabled = i === 0;
  $("next").disabled = i === records.length - 1;
  $("frame-tabs").replaceChildren();
  current.frames.forEach((f, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = f.label + (current.frames.length > 1 ? " · " + (i + 1) : "");
    button.setAttribute("aria-pressed", i === frameIndex ? "true" : "false");
    button.addEventListener("click", () => {
      frameIndex = i;
      full = false;
      renderFrame();
    });
    $("frame-tabs").append(button);
  });
  renderFrame();
}
function renderFrame(focusOverride) {
  const f = current.frames[frameIndex],
    base = focusOverride || f.focus,
    x = Math.max(0, base[0] - 25),
    y = Math.max(0, base[1] - 15),
    focus = full
      ? [0, 0, f.width, f.height]
      : [x, y, Math.min(f.width - x, base[2] + 50), Math.min(f.height - y, base[3] + 30)],
    color = current.current_status === "未完成复现" ? "#a77729" : "#cc414b";
  const markers = $("marks").checked
    ? f.marks
        .map((m) => {
          const [x, y, w, h] = m.rect;
          return (
            '<g><rect x="' +
            x +
            '" y="' +
            y +
            '" width="' +
            w +
            '" height="' +
            h +
            '" rx="5" fill="' +
            color +
            '" fill-opacity=".045" stroke="' +
            color +
            '" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="' +
            (x - 10) +
            '" cy="' +
            (y + 14) +
            '" r="14" fill="' +
            color +
            '" stroke="white" stroke-width="2"/><text x="' +
            (x - 10) +
            '" y="' +
            (y + 20) +
            '" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="700" fill="white">' +
            m.n +
            "</text></g>"
          );
        })
        .join("")
    : "";
  $("stage").innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    focus[2] +
    '" height="' +
    focus[3] +
    '" viewBox="' +
    focus.join(" ") +
    '" role="img" aria-label="' +
    escape(current.id + " " + f.label + "，编号框标示需要关注的位置") +
    '"><image href="' +
    escape(f.file) +
    '" width="' +
    f.width +
    '" height="' +
    f.height +
    '"/>' +
    markers +
    "</svg>";
  $("shot-label").textContent = f.capture + (full ? " · 完整截图" : " · 局部放大");
  $("shot-meta").textContent =
    "2026-11-06 · " +
    f.capture +
    " · 1600 × 934原图 · " +
    new Date(f.time).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) +
    "（北京时间）";
  $("original").href = f.file;
  $("zoom").textContent = full ? "查看问题局部" : "查看完整截图";
  $("mark-list").replaceChildren();
  f.marks.forEach((m) => {
    const li = document.createElement("li");
    if (current.current_status === "未完成复现") li.className = "unverified";
    const number = document.createElement("b");
    number.textContent = m.n;
    const text = document.createElement("button");
    text.type = "button";
    text.textContent = m.text;
    text.title = "放大这个位置";
    text.addEventListener("click", () => {
      const [x, y, w, h] = m.rect;
      const padding = 75;
      const rw = Math.min(f.width, Math.max(450, w + padding * 2)),
        rh = Math.min(f.height, Math.max(230, h + padding * 2));
      const xx = Math.max(0, Math.min(f.width - rw, x - (rw - w) / 2)),
        yy = Math.max(0, Math.min(f.height - rh, y - (rh - h) / 2));
      renderFrame([xx, yy, rw, rh]);
    });
    li.append(number, text);
    $("mark-list").append(li);
  });
  Array.from($("frame-tabs").children).forEach((b, i) =>
    b.setAttribute("aria-pressed", i === frameIndex ? "true" : "false"),
  );
}
$("target").addEventListener("load", () => {
  try {
    const h = $("target").contentDocument.body.scrollHeight + 20;
    $("target").style.height = Math.max(420, Math.min(820, h)) + "px";
  } catch {
    $("target").style.height = "650px";
  }
});
$("find").addEventListener("input", renderDirectory);
$("category").addEventListener("change", renderDirectory);
$("marks").addEventListener("change", () => renderFrame());
$("zoom").addEventListener("click", () => {
  full = !full;
  renderFrame();
});
$("previous").addEventListener("click", () =>
  selectIssue(records[records.indexOf(current) - 1]?.id),
);
$("next").addEventListener("click", () => selectIssue(records[records.indexOf(current) + 1]?.id));
window.addEventListener("hashchange", () =>
  selectIssue(decodeURIComponent(location.hash.slice(1))),
);
selectIssue(current.id);
