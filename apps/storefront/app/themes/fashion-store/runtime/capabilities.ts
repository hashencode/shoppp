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
  const navbar = root.querySelector<HTMLElement>(".navbar[data-header-hover]");
  const syncHeaderTone = (): void => {
    const menuOpen = dropdowns.some((dropdown) => dropdown.classList.contains("open"));
    const tone = navbar?.dataset.headerHover;
    navbar?.classList.toggle("submenu-light", menuOpen && tone === "light");
    navbar?.classList.toggle("submenu-dark", menuOpen && tone === "dark");
  };
  const close = (dropdown: HTMLElement): void => {
    dropdown.classList.remove("open", "menu-left");
    syncHeaderTone();
  };
  for (const dropdown of dropdowns) {
    lifecycle.listen(dropdown, "mouseenter", () => {
      if (innerWidth < 992) return;
      for (const sibling of dropdowns) if (sibling !== dropdown) close(sibling);
      dropdown.classList.add("open");
      syncHeaderTone();
    });
    lifecycle.listen(dropdown, "mouseleave", () => close(dropdown));
  }
  lifecycle.addCleanup(() => {
    dropdowns.forEach((dropdown) => dropdown.classList.remove("open", "menu-left"));
    navbar?.classList.remove("submenu-light", "submenu-dark");
  });
}

export function initializeFashionStoreCapabilities(
  root: ParentNode,
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
