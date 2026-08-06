import type { Fashion2Lifecycle } from "./lifecycle";

export interface Fashion2VendorRuntime {
  Isotope?: new (element: Element, options: Record<string, unknown>) => { destroy(): void };
  Swiper?: new (
    element: Element,
    options: Record<string, unknown>,
  ) => { destroy(...args: boolean[]): void };
  bootstrap?: {
    Tooltip?: new (element: Element) => { dispose(): void };
  };
}

const runtimeScripts = [
  { id: "jquery", url: new URL("../upstream/js/jquery.js", import.meta.url).href },
  { id: "vendors", url: new URL("../upstream/js/vendors.min.js", import.meta.url).href },
] as const;

function loadScript(
  definition: (typeof runtimeScripts)[number],
  lifecycle: Fashion2Lifecycle,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.fashion2RuntimeScript = definition.id;
    script.src = definition.url;
    script.async = false;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Fashion 2 ${definition.id} failed.`)),
      {
        once: true,
      },
    );
    lifecycle.ownNode(script);
    document.head.append(script);
  });
}

export async function loadFashion2VendorRuntime(
  lifecycle: Fashion2Lifecycle,
): Promise<Fashion2VendorRuntime> {
  const runtimeWindow = window as unknown as Window &
    Fashion2VendorRuntime &
    Record<string, unknown>;
  const originalKeys = new Set(Object.getOwnPropertyNames(runtimeWindow));
  for (const script of runtimeScripts) {
    if (lifecycle.destroyed) throw new Error("Fashion 2 runtime was disposed while loading.");
    await loadScript(script, lifecycle);
  }
  const runtimeKeys = Object.getOwnPropertyNames(runtimeWindow).filter(
    (key) => !originalKeys.has(key),
  );
  lifecycle.addCleanup(() => {
    for (const key of runtimeKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(runtimeWindow, key);
      if (descriptor?.configurable) delete runtimeWindow[key];
    }
  });
  return runtimeWindow;
}
