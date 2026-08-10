import type { FashionStoreVendorRuntime } from "./loader.client";
import type { FashionStoreLifecycle } from "./lifecycle";

function exposeStaticContent(root: ParentNode): void {
  for (const grid of root.querySelectorAll(".grid-loading")) grid.classList.remove("grid-loading");
  for (const element of root.querySelectorAll<HTMLElement>("[data-anime]")) {
    element.style.opacity = "1";
    element.style.transform = "none";
    element.style.visibility = "visible";
  }
}

function initializeDesktopDropdowns(root: ParentNode, lifecycle: FashionStoreLifecycle): void {
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

export function initializeFashionStoreCapabilities(
  root: ParentNode,
  runtime: FashionStoreVendorRuntime,
  lifecycle: FashionStoreLifecycle,
  reducedMotion: boolean,
): void {
  exposeStaticContent(root);
  initializeDesktopDropdowns(root, lifecycle);
  const stickyWrap = root.querySelector<HTMLElement>(".sticky-wrap");
  const scrollProgress = root.querySelector<HTMLElement>(".scroll-progress");
  stickyWrap?.classList.add("shadow-in");
  lifecycle.addCleanup(() => stickyWrap?.classList.remove("shadow-in", "sticky-hidden"));
  document.body.setAttribute(
    "data-fashion-store-visual-runtime",
    reducedMotion ? "static" : "ready",
  );
  lifecycle.addCleanup(() => document.body.removeAttribute("data-fashion-store-visual-runtime"));
  if (reducedMotion) return;

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
    const progress = Math.min(1, scrollY / maximum);
    document.documentElement.style.setProperty("--fashion-store-scroll-progress", String(progress));
    scrollProgress?.classList.toggle("visible", scrollY > 200);
    const footer = root.querySelector("footer");
    stickyWrap?.classList.toggle(
      "sticky-hidden",
      Boolean(footer && footer.getBoundingClientRect().top < innerHeight),
    );
  };
  lifecycle.listen(window, "scroll", updateScrollProgress, { passive: true });
  lifecycle.addCleanup(() =>
    document.documentElement.style.removeProperty("--fashion-store-scroll-progress"),
  );
  updateScrollProgress();
}
