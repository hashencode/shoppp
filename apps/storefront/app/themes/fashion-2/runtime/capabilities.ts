import type { Fashion2VendorRuntime } from "./loader.client";
import type { Fashion2Lifecycle } from "./lifecycle";

function sliderOptions(element: HTMLElement): Record<string, unknown> {
  const serialized = element.dataset.sliderOptions;
  if (!serialized) return {};
  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Fashion 2 slider options must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function exposeStaticContent(root: ParentNode): void {
  for (const grid of root.querySelectorAll(".grid-loading")) grid.classList.remove("grid-loading");
  for (const element of root.querySelectorAll<HTMLElement>("[data-anime]")) {
    element.style.opacity = "1";
    element.style.transform = "none";
    element.style.visibility = "visible";
  }
}

function initializeDesktopDropdowns(root: ParentNode, lifecycle: Fashion2Lifecycle): void {
  const dropdowns = [...root.querySelectorAll<HTMLElement>(".navbar .nav-item.dropdown")];
  const close = (dropdown: HTMLElement): void => dropdown.classList.remove("open", "menu-left");
  for (const dropdown of dropdowns) {
    lifecycle.listen(dropdown, "mouseenter", () => {
      if (innerWidth < 992) return;
      for (const sibling of dropdowns) if (sibling !== dropdown) close(sibling);
      dropdown.classList.add("open");
    });
    lifecycle.listen(dropdown, "mouseleave", () => close(dropdown));
  }
  lifecycle.addCleanup(() => dropdowns.forEach(close));
}

export function initializeFashion2Capabilities(
  root: ParentNode,
  runtime: Fashion2VendorRuntime,
  lifecycle: Fashion2Lifecycle,
  reducedMotion: boolean,
): void {
  exposeStaticContent(root);
  initializeDesktopDropdowns(root, lifecycle);
  document.body.dataset.fashion2VisualRuntime = reducedMotion ? "static" : "ready";
  lifecycle.addCleanup(() => delete document.body.dataset.fashion2VisualRuntime);
  if (reducedMotion) return;

  if (runtime.Swiper) {
    for (const element of root.querySelectorAll<HTMLElement>(
      ".swiper.slider-three-slide, .swiper.swiper-width-auto",
    )) {
      const instance = new runtime.Swiper(element, sliderOptions(element));
      lifecycle.addCleanup(() => instance.destroy(true, true));
    }
  }

  if (runtime.Isotope) {
    for (const element of root.querySelectorAll<HTMLElement>(".grid")) {
      const instance = new runtime.Isotope(element, {
        itemSelector: ".grid-item",
        layoutMode: "masonry",
        percentPosition: true,
      });
      lifecycle.addCleanup(() => instance.destroy());
    }
  }

  if (runtime.bootstrap?.Tooltip) {
    for (const element of root.querySelectorAll('[data-bs-toggle="tooltip"]')) {
      const tooltip = new runtime.bootstrap.Tooltip(element);
      lifecycle.addCleanup(() => tooltip.dispose());
    }
  }

  const updateScrollProgress = (): void => {
    const maximum = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    document.documentElement.style.setProperty(
      "--fashion-2-scroll-progress",
      String(Math.min(1, scrollY / maximum)),
    );
  };
  lifecycle.listen(window, "scroll", updateScrollProgress, { passive: true });
  lifecycle.addCleanup(() =>
    document.documentElement.style.removeProperty("--fashion-2-scroll-progress"),
  );
  updateScrollProgress();
}
