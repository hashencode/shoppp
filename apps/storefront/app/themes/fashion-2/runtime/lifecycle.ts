export interface Fashion2Lifecycle {
  addCleanup(cleanup: () => void): void;
  destroy(): void;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void;
  ownNode(node: Node): void;
  readonly destroyed: boolean;
}

export function createFashion2Lifecycle(): Fashion2Lifecycle {
  const cleanups: (() => void)[] = [];
  let destroyed = false;

  return {
    addCleanup(cleanup) {
      if (destroyed) cleanup();
      else cleanups.push(cleanup);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      let firstError: unknown;
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError) throw firstError;
    },
    get destroyed() {
      return destroyed;
    },
    listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      this.addCleanup(() => target.removeEventListener(type, listener, options));
    },
    ownNode(node) {
      this.addCleanup(() => node.parentNode?.removeChild(node));
    },
  };
}
