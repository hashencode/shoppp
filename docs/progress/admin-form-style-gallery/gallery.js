(() => {
  "use strict";
  const catalog = window.ADMIN_FORM_GALLERY;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const roundFrom = (query) =>
    catalog.rounds.find((r) => r.id === query.get("round")) ||
    catalog.rounds.find((r) => r.id === (query.has("page") ? "history" : catalog.defaultRound));
  let data = roundFrom(params);
  const state = {
    page: data.pages.some((p) => p.id === params.get("page"))
      ? params.get("page")
      : data.pages[0].id,
    region: params.get("region") || "main",
    theme: params.get("theme") === "dark" ? "dark" : "light",
    view: params.get("view") === "side" ? "side" : "wipe",
    split: 50,
  };
  let zoom = null;
  const page = () => data.pages.find((p) => p.id === state.page);
  const region = () => page().regions.find((r) => r.id === state.region) || page().regions[0];
  const themeLabel = (theme) =>
    theme === "dark" ? "深色" : theme === "light" ? "浅色" : "原始主题";
  const currentPair = () => region()?.images[state.theme];
  const pairReady = () => Boolean(currentPair()?.before && currentPair()?.after);
  const press = (container, field, selected) =>
    container
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[field] === selected)));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const saveLocation = () => {
    const next = new URLSearchParams({
      round: data.id,
      page: state.page,
      region: state.region,
      theme: state.theme,
      view: state.view,
    });
    history.replaceState(null, "", "#" + next.toString());
  };

  function renderNavigation() {
    const needle = $("search").value.trim().toLocaleLowerCase();
    const filtered = data.pages.filter((p) =>
      `${p.title} ${p.id} ${p.group} ${p.note}`.toLocaleLowerCase().includes(needle),
    );
    const groups = [...new Set(filtered.map((p) => p.group))];
    $("navigation").replaceChildren();
    groups.forEach((group) => {
      const section = el("section", "nav-group");
      const children = filtered.filter((p) => p.group === group);
      const title = el("h2", "", group);
      title.append(el("span", "", String(children.length)));
      section.append(title);
      children.forEach((p) => {
        const button = el("button", "nav-item");
        button.type = "button";
        if (p.id === state.page) button.setAttribute("aria-current", "page");
        button.append(
          el("span", "nav-indicator"),
          el("span", "", p.title),
          el("small", "", p.reviewStatus || (p.regions.length ? `${p.regions.length} 处` : "原图")),
        );
        button.addEventListener("click", () => selectPage(p.id));
        section.append(button);
      });
      $("navigation").append(section);
    });
    $("empty-search").hidden = filtered.length > 0;
  }

  function selectPage(id) {
    state.page = id;
    state.region = page().regions[0]?.id || "main";
    renderPage();
    $("sidebar").dataset.open = "false";
    $("menu-toggle").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderPage() {
    const p = page();
    const i = data.pages.indexOf(p);
    state.region = region()?.id || "main";
    $("page-title").textContent = p.title;
    $("page-badge").textContent = p.badge;
    $("page-badge").dataset.kind = p.badge;
    $("page-note").textContent = p.note;
    $("round-select").value = data.id;
    $("round-date").textContent = (data.date || "2026-10-31").replaceAll("-", ".");
    $("round-note").textContent = data.label;
    $("counts").textContent =
      data.countsLabel || `${data.counts.groups} 组对比齐备 · ${data.counts.images} 张原图`;
    $("evidence-description").textContent = data.description;
    for (const key of ["index", "verification", "audit"])
      $(`evidence-${key}`).href = data.evidence[key];
    $("page-position").textContent = `${String(i + 1).padStart(2, "0")} / ${data.pages.length}`;
    $("navigation-position").textContent = `${i + 1} / ${data.pages.length} 个入口与情景`;
    $("previous-page").disabled = i === 0;
    $("next-page").disabled = i === data.pages.length - 1;
    document.title = `${p.title} · Shoppp 表单新旧对比`;
    $("comparison-panel").hidden = !p.regions.length;
    $("region-controls").replaceChildren();
    p.regions.forEach((r) => {
      const button = el("button", "", r.label);
      button.type = "button";
      button.dataset.region = r.id;
      button.setAttribute("aria-pressed", String(r.id === state.region));
      button.addEventListener("click", () => {
        state.region = r.id;
        renderComparison();
      });
      $("region-controls").append(button);
    });
    renderComparison();
    renderExtras();
    renderNavigation();
  }

  function renderComparison() {
    const p = page();
    press($("region-controls"), "region", state.region);
    press($("theme-controls"), "theme", state.theme);
    press($("view-controls"), "view", state.view);
    const ready = pairReady();
    $("wipe-view").hidden = !ready || state.view !== "wipe";
    $("side-view").hidden = !ready || state.view !== "side";
    $("evidence-pending").hidden = ready;
    $("zoom-main").disabled = !ready;
    $("image-load-error").hidden = true;
    $("view-controls")
      .querySelectorAll("button")
      .forEach((b) => {
        b.disabled = !ready;
      });
    const pair = currentPair();
    if (ready) {
      for (const version of ["before", "after"]) {
        for (const prefix of ["wipe", "side"]) {
          const image = $(`${prefix}-${version}`);
          image.src = pair[version].src;
          image.alt = `${p.title} · ${region().label} · ${themeLabel(state.theme)} · ${version === "before" ? "修改前" : "修改后"}`;
        }
      }
    } else {
      const missing = region()?.missing || [];
      $("evidence-pending-note").textContent =
        `证据未齐，不能视为已完成对比。尚缺：${missing.map((m) => `${themeLabel(m.theme)}·${m.phase === "before" ? "修改前" : "修改后"}`).join("、") || "本主题成对原图"}。下方只展示已有原图。`;
      const record = pair?.before || pair?.after;
      $("baseline-open").hidden = !record;
      if (record) {
        $("baseline-image").src = record.src;
        $("baseline-image").alt =
          `${p.title} · ${region().label} · ${themeLabel(state.theme)} · ${record.phase}（单张证据）`;
      } else $("baseline-image").removeAttribute("src");
      for (const prefix of ["wipe", "side"])
        for (const version of ["before", "after"]) $(`${prefix}-${version}`).removeAttribute("src");
    }
    updateSplit();
    saveLocation();
  }

  function updateSplit() {
    $("wipe-stage").style.setProperty("--split", `${state.split}%`);
    $("comparison-range").value = state.split;
    $("split-value").textContent = `${state.split} / ${100 - state.split}`;
    $("before-label").style.opacity = state.split < 10 ? "0" : "1";
    $("after-label").style.opacity = state.split > 90 ? "0" : "1";
    $("split-line").style.opacity = state.split === 0 || state.split === 100 ? "0" : "1";
    $("comparison-range").setAttribute(
      "aria-valuetext",
      `修改前 ${state.split}%，修改后 ${100 - state.split}%`,
    );
  }

  function renderExtras() {
    const p = page();
    $("extras-section").hidden = !p.extras.length;
    $("extras-title").textContent =
      p.extrasTitle || (p.id === "audit" ? "实际入口覆盖原图" : "补充状态");
    $("extras-note").textContent =
      p.extrasNote ||
      (p.id === "audit"
        ? "点击任意图片放大。这里保留排查时的原始主题与状态。"
        : "确认弹窗、校验与只读等状态，按原始主题保留。");
    $("extras-count").textContent = `${p.extras.length} 张`;
    $("extras-grid").replaceChildren();
    $("extras-grid").dataset.layout = data.id === "descriptions" ? "single" : "";
    p.extras.forEach((record) => {
      const button = el("button", "extra-card");
      button.type = "button";
      const image = el("img");
      image.src = record.src;
      image.alt = `${p.title} · ${record.label} · ${themeLabel(record.theme)} · ${record.phase}`;
      image.loading = "lazy";
      image.width = 1280;
      image.height = 900;
      const caption = el("span", "extra-caption");
      caption.append(
        el("strong", "", record.label),
        el("small", "", `${themeLabel(record.theme)} · ${record.phase}`),
      );
      button.append(image, caption);
      button.addEventListener("click", () => openExtra(record));
      $("extras-grid").append(button);
    });
  }

  function openPair(version = "after") {
    if (!pairReady()) return;
    zoom = {
      pair: currentPair(),
      version,
      title: `${page().title} · ${region().label}`,
      scale: "fit",
    };
    showZoom();
  }

  function openExtra(record) {
    zoom = { single: record, title: `${page().title} · ${record.label}`, scale: "fit" };
    showZoom();
  }

  function showZoom() {
    updateZoom();
    $("zoom-dialog").showModal();
    document.body.style.overflow = "hidden";
  }

  function updateZoom() {
    const record = zoom.single || zoom.pair[zoom.version];
    const image = $("zoom-image");
    $("zoom-title").textContent = zoom.title;
    $("zoom-versions").hidden = !zoom.pair;
    if (zoom.pair) press($("zoom-versions"), "version", zoom.version);
    $("zoom-image-note").textContent = `${themeLabel(record.theme)} · ${record.phase} · 1280 × 900`;
    image.src = record.src;
    image.alt = `${zoom.title} · ${themeLabel(record.theme)} · ${record.phase}`;
    $("open-original").href = record.src;
    $("zoom-canvas").dataset.scale = zoom.scale;
    press($("zoom-scales"), "scale", zoom.scale);
  }

  for (const round of catalog.rounds) {
    const option = el("option", "", round.label);
    option.value = round.id;
    $("round-select").append(option);
  }
  $("round-select").addEventListener("change", (event) => {
    data = catalog.rounds.find((r) => r.id === event.target.value);
    $("search").value = "";
    selectPage(data.pages.some((p) => p.id === state.page) ? state.page : data.pages[0].id);
  });
  $("baseline-open").addEventListener("click", () => {
    const record = currentPair()?.before || currentPair()?.after;
    if (record) openExtra(record);
  });
  for (const id of [
    "baseline-image",
    "wipe-before",
    "wipe-after",
    "side-before",
    "side-after",
    "zoom-image",
  ]) {
    $(id).addEventListener("error", () => {
      if (!$(id).getAttribute("src")) return;
      $("image-load-error").textContent =
        `截图无法加载：${$(id).alt}。请检查原图路径，当前显示不能作为验收证据。`;
      $("image-load-error").hidden = false;
    });
  }
  $("search").addEventListener("input", renderNavigation);
  $("clear-search").addEventListener("click", () => {
    $("search").value = "";
    renderNavigation();
    $("search").focus();
  });
  $("menu-toggle").addEventListener("click", () => {
    const open = $("sidebar").dataset.open !== "true";
    $("sidebar").dataset.open = String(open);
    $("menu-toggle").setAttribute("aria-expanded", String(open));
  });
  $("theme-controls").addEventListener("click", (e) => {
    const theme = e.target.closest("button")?.dataset.theme;
    if (theme) {
      state.theme = theme;
      renderComparison();
    }
  });
  $("view-controls").addEventListener("click", (e) => {
    const view = e.target.closest("button")?.dataset.view;
    if (view) {
      state.view = view;
      renderComparison();
    }
  });
  $("comparison-range").addEventListener("input", (e) => {
    state.split = Number(e.target.value);
    updateSplit();
  });
  $("reset-range").addEventListener("click", () => {
    state.split = 50;
    updateSplit();
  });
  let dragging = false;
  $("split-line").addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    $("split-line").setPointerCapture(e.pointerId);
  });
  $("split-line").addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = $("wipe-stage").getBoundingClientRect();
    state.split = Math.round(
      Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
    );
    updateSplit();
  });
  $("split-line").addEventListener("pointerup", () => {
    dragging = false;
  });
  $("split-line").addEventListener("pointercancel", () => {
    dragging = false;
  });
  $("split-line").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  for (const id of ["zoom-main", "wipe-open", "zoom-after", "side-after-open"])
    $(id).addEventListener("click", () => openPair("after"));
  for (const id of ["zoom-before", "side-before-open"])
    $(id).addEventListener("click", () => openPair("before"));
  $("previous-page").addEventListener("click", () => {
    const i = data.pages.indexOf(page());
    if (i > 0) selectPage(data.pages[i - 1].id);
  });
  $("next-page").addEventListener("click", () => {
    const i = data.pages.indexOf(page());
    if (i < data.pages.length - 1) selectPage(data.pages[i + 1].id);
  });
  $("close-zoom").addEventListener("click", () => $("zoom-dialog").close());
  $("zoom-dialog").addEventListener("close", () => {
    document.body.style.overflow = "";
    zoom = null;
  });
  $("zoom-dialog").addEventListener("click", (e) => {
    if (e.target === $("zoom-dialog")) $("zoom-dialog").close();
  });
  $("zoom-versions").addEventListener("click", (e) => {
    const version = e.target.closest("button")?.dataset.version;
    if (version && zoom?.pair) {
      zoom.version = version;
      updateZoom();
    }
  });
  $("zoom-scales").addEventListener("click", (e) => {
    const scale = e.target.closest("button")?.dataset.scale;
    if (scale && zoom) {
      zoom.scale = scale;
      updateZoom();
    }
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#main") return;
    const next = new URLSearchParams(location.hash.slice(1));
    data = roundFrom(next);
    if (data.pages.some((p) => p.id === next.get("page"))) state.page = next.get("page");
    else state.page = data.pages[0].id;
    state.region = next.get("region") || "main";
    state.theme = next.get("theme") === "dark" ? "dark" : "light";
    state.view = next.get("view") === "side" ? "side" : "wipe";
    renderPage();
  });
  renderPage();
})();
