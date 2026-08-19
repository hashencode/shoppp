import type { Ref } from "vue";

import { decorSourceContract } from "../source-contract";

type DecorRevealGroup = (typeof decorSourceContract.revealGroups)[number];
export type DecorRevealGroupId = DecorRevealGroup["id"];

export interface DecorRevealOptions {
  rootMargin?: string;
}

const revealGroupsById = new Map(
  decorSourceContract.revealGroups.map((group) => [group.id, group] as const),
);

function translateFor(group: DecorRevealGroup): { x: number; y: number } {
  if (group.direction === "x") return { x: group.distancePx, y: 0 };
  if (group.direction === "x-negative") return { x: -group.distancePx, y: 0 };
  if (group.direction === "y") return { x: 0, y: group.distancePx };
  return { x: 0, y: 0 };
}

export function useDecorRevealMotion(
  groupIds: readonly DecorRevealGroupId[],
  { rootMargin = "0px 0px -12%" }: DecorRevealOptions = {},
): Ref<HTMLElement | null> {
  const root = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | undefined;
  let reducedMotionQuery: MediaQueryList | undefined;

  function complete(): void {
    const element = root.value;
    if (!element || element.dataset.revealState === "complete") return;
    element.dataset.revealState = "complete";
    observer?.disconnect();
  }

  onMounted(() => {
    const element = root.value;
    if (!element) return;
    for (const groupId of groupIds) {
      const group = revealGroupsById.get(groupId);
      const groupElement = element.matches(`[data-reveal-group="${groupId}"]`)
        ? element
        : element.querySelector<HTMLElement>(`[data-reveal-group="${groupId}"]`);
      if (!group || !groupElement) continue;
      const { x, y } = translateFor(group);
      groupElement.style.setProperty("--decor-reveal-duration", `${group.durationMs}ms`);
      groupElement.style.setProperty("--decor-reveal-x", `${x}px`);
      groupElement.style.setProperty("--decor-reveal-y", `${y}px`);
      const items = groupElement.matches("[data-reveal-item]")
        ? [groupElement]
        : [...groupElement.querySelectorAll<HTMLElement>("[data-reveal-item]")];
      items.forEach((item, index) => {
        item.style.setProperty(
          "--decor-reveal-item-delay",
          `${group.delayMs + index * group.staggerMs}ms`,
        );
      });
    }
    element.dataset.revealRuntime = "true";

    reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
      complete();
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(({ isIntersecting }) => isIntersecting)) complete();
      },
      { rootMargin },
    );
    observer.observe(element);
  });

  onBeforeUnmount(() => observer?.disconnect());
  return root;
}
