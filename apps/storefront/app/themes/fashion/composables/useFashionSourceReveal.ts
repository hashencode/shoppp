import type { Ref } from "vue";

export interface FashionSourceRevealOptions {
  delayMs: number;
  durationMs: number;
  easing?: string;
  initialTransform: string;
  itemSelector: string;
  staggerMs: number;
}

export function useFashionSourceReveal(
  root: Readonly<Ref<HTMLElement | null>>,
  options: FashionSourceRevealOptions,
): void {
  let observer: IntersectionObserver | undefined;
  let reducedMotionQuery: MediaQueryList | undefined;
  let items: HTMLElement[] = [];

  const reveal = (): void => {
    for (const item of items) item.dataset.sourceReveal = "revealed";
    observer?.disconnect();
  };

  onMounted(() => {
    if (!root.value) return;
    items = [...root.value.querySelectorAll<HTMLElement>(options.itemSelector)];
    reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    root.value.dataset.sourceRevealGroup = "ready";

    for (const [index, item] of items.entries()) {
      item.dataset.sourceReveal = reducedMotionQuery.matches ? "revealed" : "pending";
      item.style.setProperty(
        "--fashion-reveal-delay",
        `${options.delayMs + options.staggerMs * index}ms`,
      );
      item.style.setProperty("--fashion-reveal-duration", `${options.durationMs}ms`);
      item.style.setProperty(
        "--fashion-reveal-easing",
        options.easing ?? "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      );
      item.style.setProperty("--fashion-reveal-transform", options.initialTransform);
    }

    if (reducedMotionQuery.matches) return;
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) reveal();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(root.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    items = [];
  });
}
