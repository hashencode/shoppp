export const decorStoreRevolutionPaths = [
  "js/jquery.js",
  "revolution/js/jquery.themepunch.tools.min.js",
  "revolution/js/jquery.themepunch.revolution.min.js",
  "revolution/js/extensions/revolution.extension.actions.min.js",
  "revolution/js/extensions/revolution.extension.layeranimation.min.js",
  "revolution/js/extensions/revolution.extension.navigation.min.js",
  "revolution/js/extensions/revolution.extension.slideanims.min.js",
] as const;

export const decorStoreScriptLoadTimeoutMs = 2_000;

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(source: string): Promise<void> {
  const existing = loadedScripts.get(source);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        script.remove();
        loadedScripts.delete(source);
        reject(error);
      } else resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error(`Decor Revolution dependency timed out: ${source}`)),
      decorStoreScriptLoadTimeoutMs,
    );
    script.src = source;
    script.async = false;
    script.dataset.decorStoreRuntime = "";
    script.addEventListener("load", () => finish(), { once: true });
    script.addEventListener(
      "error",
      () => finish(new Error(`Decor Revolution dependency failed to load: ${source}`)),
      { once: true },
    );
    document.head.append(script);
  });
  loadedScripts.set(source, promise);
  return promise;
}

export async function loadDecorStoreRevolutionChain(resolveSource: (path: string) => string) {
  for (const path of decorStoreRevolutionPaths) await loadScript(resolveSource(path));
  const jquery = (window as typeof window & { jQuery?: DecorRevolutionJQuery }).jQuery;
  if (!jquery?.fn?.revolution) {
    throw new Error("Decor Revolution core loaded without jQuery.fn.revolution.");
  }
  return jquery;
}

export interface DecorRevolutionCollection {
  data(): Record<string, unknown>;
  off(namespace?: string): DecorRevolutionCollection;
  on(events: string, callback: () => void): DecorRevolutionCollection;
  revolution(options: Record<string, unknown>): DecorRevolutionCollection;
  revkill(): void;
  revnext(): void;
  revpause(): void;
  revresume(): void;
  show(): DecorRevolutionCollection;
}

export interface DecorRevolutionJQuery {
  (selector: string | HTMLElement): DecorRevolutionCollection;
  fn?: { revolution?: unknown };
}

export const decorStoreRevolutionOptions = {
  sliderType: "standard",
  delay: 9000,
  sliderLayout: "fullscreen",
  autoHeight: "off",
  stopLoop: "on",
  stopAfterLoops: 0,
  stopAtSlide: 1,
  navigation: {
    keyboardNavigation: "on",
    keyboard_direction: "horizontal",
    mouseScrollNavigation: "off",
    mouseScrollReverse: "default",
    onHoverStop: "off",
    touch: {
      touchenabled: "on",
      touchOnDesktop: "on",
      swipe_threshold: 75,
      swipe_min_touches: 1,
      swipe_direction: "horizontal",
      drag_block_vertical: true,
    },
    arrows: {
      enable: false,
      style: "uranus",
      rtl: false,
      hide_onleave: false,
      hide_onmobile: false,
      hide_under: 0,
      hide_over: 778,
      hide_delay: 200,
      hide_delay_mobile: 1200,
      left: {
        container: "slider",
        h_align: "left",
        v_align: "center",
        h_offset: 10,
        v_offset: 10,
      },
      right: {
        container: "slider",
        h_align: "right",
        v_align: "center",
        h_offset: 10,
        v_offset: 10,
      },
    },
  },
  lazyType: "smart",
  spinner: "spinner0",
  fullScreenAlignForce: "off",
  hideThumbsOnMobile: "off",
  hideSliderAtLimit: 0,
  hideCaptionAtLimit: 0,
  hideAllCaptionAtLilmit: 0,
  responsiveLevels: [1240, 1024, 778, 480],
  gridwidth: [1220, 1024, 778, 480],
  gridheight: [900, 1000, 960, 720],
  visibilityLevels: [1240, 1024, 1024, 480],
  fallbacks: {
    simplifyAll: "on",
    nextSlideOnWindowFocus: "off",
    disableFocusListener: false,
  },
} as const;
