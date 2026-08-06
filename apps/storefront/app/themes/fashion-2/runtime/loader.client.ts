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
  ownedScripts: HTMLScriptElement[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (result: "load" | "error" | "disposed") => {
      if (settled) return;
      settled = true;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (result === "load") resolve();
      else {
        reject(
          new Error(
            result === "error"
              ? `Fashion 2 ${definition.id} failed.`
              : `Fashion 2 ${definition.id} was disposed while loading.`,
          ),
        );
      }
    };
    const onLoad = () => finish("load");
    const onError = () => finish("error");
    script.dataset.fashion2RuntimeScript = definition.id;
    script.src = definition.url;
    script.async = false;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    lifecycle.addCleanup(() => finish("disposed"));
    lifecycle.ownNode(script);
    ownedScripts.push(script);
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
  const ownedScripts: HTMLScriptElement[] = [];
  const removeRuntimeGlobals = () => {
    for (const key of Object.getOwnPropertyNames(runtimeWindow)) {
      if (originalKeys.has(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(runtimeWindow, key);
      if (descriptor?.configurable) delete runtimeWindow[key];
    }
  };
  lifecycle.addCleanup(removeRuntimeGlobals);

  try {
    for (const script of runtimeScripts) {
      if (lifecycle.destroyed) throw new Error("Fashion 2 runtime was disposed while loading.");
      await loadScript(script, lifecycle, ownedScripts);
    }
    return runtimeWindow;
  } catch (error) {
    for (const script of ownedScripts) script.remove();
    removeRuntimeGlobals();
    throw error;
  }
}
