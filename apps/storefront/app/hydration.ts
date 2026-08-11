import type { HydrationStrategy } from "vue";

export const storefrontExperienceHydratedEvent = "storefront-experience:hydrated";

function currentInteractionTarget(event: Event): EventTarget | null {
  if (event.target instanceof Node && event.target.isConnected) return event.target;
  if (event instanceof MouseEvent && (event.clientX !== 0 || event.clientY !== 0)) {
    return document.elementFromPoint(event.clientX, event.clientY);
  }
  return document.activeElement;
}

export const hydrateOnStorefrontInteraction: HydrationStrategy = (hydrate, forEachElement) => {
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
  return teardown;
};
