(() => {
  if (location.pathname !== "/" || !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let captured;
  const events = ["click", "keydown"];
  const capture = (event) => {
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
  window.__shopppStorefrontInteractionCapture = {
    consume() {
      const interaction = captured;
      captured = undefined;
      return interaction;
    },
    stop,
  };
})();
