import type { HydrationStrategy } from "vue";

export const storefrontExperienceHydratedEvent = "storefront-experience:hydrated";

export interface StorefrontInteractionCapture {
  consume(): Event | undefined;
  stop(): void;
}

export function captureStorefrontInteraction(): StorefrontInteractionCapture {
  const browserWindow = window as Window & {
    __shopppStorefrontInteractionCapture?: StorefrontInteractionCapture;
  };
  const bootstrapped = browserWindow.__shopppStorefrontInteractionCapture;
  if (bootstrapped) {
    delete browserWindow.__shopppStorefrontInteractionCapture;
    return bootstrapped;
  }

  let captured: Event | undefined;
  const events = ["click", "keydown"];
  const capture = (event: Event) => {
    if (
      captured?.type === "keydown" &&
      event.type === "click" &&
      captured.target === event.target
    ) {
      captured = event;
      event.preventDefault();
      return;
    }
    if (captured) return;
    captured = event;
    if (event.type === "click") event.preventDefault();
  };
  const stop = () => {
    for (const eventName of events) document.removeEventListener(eventName, capture, true);
  };

  for (const eventName of events) document.addEventListener(eventName, capture, true);
  return {
    consume() {
      const interaction = captured;
      captured = undefined;
      return interaction;
    },
    stop,
  };
}

function currentInteractionTarget(event: Event): EventTarget | null {
  if (event.target instanceof Node && event.target.isConnected) return event.target;
  if (event instanceof MouseEvent && (event.clientX !== 0 || event.clientY !== 0)) {
    return document.elementFromPoint(event.clientX, event.clientY);
  }
  return document.activeElement;
}

export const hydrateOnStorefrontInteraction = (
  hydrate: Parameters<HydrationStrategy>[0],
  forEachElement: Parameters<HydrationStrategy>[1],
  earlyCapture?: StorefrontInteractionCapture,
): ReturnType<HydrationStrategy> => {
  let hydrated = false;
  let replayInteraction: (() => void) | undefined;
  const events = ["click", "keydown"];
  const teardown = () => {
    forEachElement((element) => {
      for (const eventName of events) element.removeEventListener(eventName, interaction);
    });
    if (replayInteraction) {
      window.removeEventListener(storefrontExperienceHydratedEvent, replayInteraction);
    }
  };
  const interaction = (event: Event) => {
    if (hydrated) return;
    hydrated = true;
    if (event.type === "click") event.preventDefault();
    teardown();
    replayInteraction = () => {
      // Nested async theme components can replace the SSR target after hydration starts. Wait for
      // the interactive shell to mount, then replay against the current DOM on the next frame.
      requestAnimationFrame(() => {
        const target = currentInteractionTarget(event);
        const replay =
          event instanceof KeyboardEvent
            ? new KeyboardEvent(event.type, event)
            : event instanceof MouseEvent
              ? new MouseEvent(event.type, event)
              : new Event(event.type, event);
        target?.dispatchEvent(replay);
      });
    };
    window.addEventListener(storefrontExperienceHydratedEvent, replayInteraction, { once: true });
    hydrate();
  };

  forEachElement((element) => {
    for (const eventName of events)
      element.addEventListener(eventName, interaction, { once: true });
  });
  const earlyInteraction = earlyCapture?.consume();
  earlyCapture?.stop();
  if (earlyInteraction) interaction(earlyInteraction);
  return teardown;
};
