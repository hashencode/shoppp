import type { TrafficEvent, TrafficIdentity } from "@shoppp/contracts";
import { trafficIdentitySchema } from "@shoppp/contracts";
import { classifyStorefrontRoute } from "./analytics";

async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Traffic request timed out"));
      controller.abort();
    }, 10000);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function createTrafficClient(options: {
  releaseId: string;
  request?: typeof fetch;
  initialize?: (operation: () => Promise<TrafficIdentity>) => Promise<TrafficIdentity>;
}) {
  const request = options.request ?? fetch;
  let identity: TrafficIdentity | null = null;
  let lastPath = "";
  let pending = Promise.resolve();
  async function identify(): Promise<TrafficIdentity> {
    return withDeadline(async (signal) => {
      const response = await request("/api/platform/traffic/identity", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: options.releaseId }),
        signal,
      });
      if (!response.ok) throw new Error("Traffic unavailable");
      const envelope = (await response.json()) as { data: unknown };
      return trafficIdentitySchema.parse(envelope.data);
    });
  }
  async function send(route: TrafficEvent["route"], productId?: string) {
    try {
      if (!identity || Date.parse(identity.expiresAt) <= Date.now() + 1000) {
        identity = await (options.initialize ? options.initialize(identify) : identify());
      }
      const event: TrafficEvent = {
        eventId: crypto.randomUUID(),
        ticket: identity.ticket,
        releaseId: options.releaseId,
        route,
        ...(productId ? { productId } : {}),
      };
      const body = JSON.stringify(event);
      const expiresAt = Date.parse(identity.expiresAt);
      for (let attempt = 0; attempt < 2; attempt++) {
        if (expiresAt <= Date.now()) return;
        try {
          const result = await withDeadline((signal) =>
            request("/api/platform/traffic/events", {
              method: "POST",
              credentials: "same-origin",
              keepalive: true,
              headers: { "Content-Type": "application/json" },
              body,
              signal,
            }),
          );
          if (result.status === 401 || result.status === 403) identity = null;
          return; // Do not retry rejected or throttled events with a new identity/ticket.
        } catch {
          if (attempt === 1) return;
        }
      }
    } catch {
      /* Analytics never blocks shopping or exposes visitor credentials in logs. */
    }
  }
  return {
    visit(path: string, productId?: string): Promise<void> {
      const route = classifyStorefrontRoute(path);
      if (path === lastPath || (route === "product" && !productId)) return pending;
      lastPath = path;
      pending = pending.then(() => send(route, productId));
      return pending;
    },
  };
}
