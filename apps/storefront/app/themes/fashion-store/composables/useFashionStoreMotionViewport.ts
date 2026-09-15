import type { Ref } from "vue";

export function fashionStoreMotionIntersectionVisible(
  entry: Pick<IntersectionObserverEntry, "intersectionRatio" | "isIntersecting">,
): boolean {
  return entry.isIntersecting && entry.intersectionRatio > 0;
}

export function useFashionStoreMotionViewport(target: Ref<HTMLElement | undefined>) {
  const visible = ref(false);
  let observer: IntersectionObserver | undefined;
  let mounted = true;

  onMounted(() => {
    const element = target.value;
    if (!element || !("IntersectionObserver" in window)) {
      visible.value = true;
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (!mounted) return;
        const entry = entries.find(({ target: observedTarget }) => observedTarget === element);
        if (entry) visible.value = fashionStoreMotionIntersectionVisible(entry);
      },
      { threshold: 0 },
    );
    observer.observe(element);
  });

  onBeforeUnmount(() => {
    mounted = false;
    observer?.disconnect();
    observer = undefined;
  });

  return readonly(visible);
}
