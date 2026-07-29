import type { CommerceFunnelEvent, CommerceFunnelPageRoute } from "@shoppp/contracts";

export function classifyStorefrontRoute(path: string): CommerceFunnelPageRoute {
  if (path === "/") return "home";
  if (path === "/cart") return "cart";
  if (path === "/checkout") return "checkout";
  if (path === "/checkout/complete") return "checkout_complete";
  if (path.startsWith("/collections/")) return "collection";
  if (path.startsWith("/products/")) return "product";
  if (path.startsWith("/orders/")) return "order_status";
  if (path.startsWith("/policies/")) return "policy";
  return "content";
}

export function pageViewEvent(path: string): CommerceFunnelEvent {
  return {
    event: "page_view",
    route: classifyStorefrontRoute(path),
  };
}

export function sendPageView(path: string): void {
  const body = JSON.stringify(pageViewEvent(path));
  const target = "/api/platform/events";
  if (
    typeof navigator.sendBeacon === "function" &&
    navigator.sendBeacon(target, new Blob([body], { type: "application/json" }))
  ) {
    return;
  }
  void fetch(target, {
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
