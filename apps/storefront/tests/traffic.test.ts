import { describe, expect, spyOn, test } from "bun:test";
import { createTrafficClient } from "../app/utils/traffic";

describe("automatic traffic", () => {
  test("counts real route entries and retries one delivery without changing event identity", async () => {
    const events: Record<string, unknown>[] = [];
    let first = true;
    const client = createTrafficClient({
      releaseId: "public",
      request: async (url, init) => {
        if (url.endsWith("identity"))
          return Response.json({
            data: { ticket: "signed", expiresAt: new Date(Date.now() + 60000).toISOString() },
          });
        events.push(JSON.parse(String(init?.body)));
        if (first) {
          first = false;
          throw new Error("network");
        }
        return new Response(null, { status: 204 });
      },
    });
    await client.visit("/products/a", "a");
    await client.visit("/products/a", "a");
    await client.visit("/cart");
    await client.visit("/products/a", "a");
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual(events[1]);
    expect(events[2]?.eventId).not.toBe(events[3]?.eventId);
    expect(events[0]?.productId).toBe("a");
    expect(JSON.stringify(events)).not.toContain("/products/a");
  });
  test("identity failure stays silent and an unknown product does not create false product traffic", async () => {
    let requests = 0;
    const client = createTrafficClient({
      releaseId: "public",
      request: async () => {
        requests++;
        throw new Error("offline");
      },
    });
    await client.visit("/products/missing");
    expect(requests).toBe(0);
    await client.visit("/");
    expect(requests).toBe(1);
  });
  test.each(["expired", 401, 403] as const)(
    "renews identity on the next route after %p without retrying rejected events",
    async (reason) => {
      let now = Date.now();
      const clock = spyOn(Date, "now").mockImplementation(() => now);
      try {
        let identities = 0;
        const events: Record<string, unknown>[] = [];
        const client = createTrafficClient({
          releaseId: "public",
          request: async (url, init) => {
            if (url.endsWith("identity")) {
              identities++;
              return Response.json({
                data: { ticket: `signed-${identities}`, expiresAt: new Date(now + 60000).toISOString() },
              });
            }
            events.push(JSON.parse(String(init?.body)));
            return new Response(null, {
              status: events.length === 1 && reason !== "expired" ? reason : 204,
            });
          },
        });
        await client.visit("/");
        expect(identities).toBe(1);
        expect(events).toHaveLength(1);
        if (reason === "expired") now += 61000;
        await client.visit("/cart");
        expect(identities).toBe(2);
        expect(events).toHaveLength(2);
        expect(events.map((event) => event.ticket)).toEqual(["signed-1", "signed-2"]);
        expect(events[1]?.eventId).not.toBe(events[0]?.eventId);
        expect(events.map((event) => event.route)).toEqual(["home", "cart"]);
      } finally {
        clock.mockRestore();
      }
    },
  );
  test.each(["identity", "event"] as const)(
    "preserves rapid A to B to A entries while the first %s request is pending",
    async (deferredRequest) => {
      let release!: () => void;
      let entered!: () => void;
      const deferred = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let identities = 0;
      const events: Record<string, unknown>[] = [];
      const client = createTrafficClient({
        releaseId: "public",
        request: async (url, init) => {
          if (url.endsWith("identity")) {
            identities++;
            if (deferredRequest === "identity") {
              entered();
              await deferred;
            }
            return Response.json({
              data: { ticket: "signed", expiresAt: new Date(Date.now() + 60000).toISOString() },
            });
          }
          events.push(JSON.parse(String(init?.body)));
          if (deferredRequest === "event" && events.length === 1) {
            entered();
            await deferred;
          }
          return new Response(null, { status: 204 });
        },
      });
      const first = client.visit("/products/a", "a");
      await started;
      const second = client.visit("/cart");
      const third = client.visit("/products/a", "a");
      try {
        expect(identities).toBe(1);
        expect(events).toHaveLength(deferredRequest === "identity" ? 0 : 1);
      } finally {
        release();
      }
      await Promise.all([first, second, third]);
      expect(identities).toBe(1);
      expect(events.map((event) => event.route)).toEqual(["product", "cart", "product"]);
      expect(events.map((event) => event.productId)).toEqual(["a", undefined, "a"]);
      expect(new Set(events.map((event) => event.eventId)).size).toBe(3);
      expect(events.map((event) => event.ticket)).toEqual(["signed", "signed", "signed"]);
    },
  );
  test("deadlines release identity initialization and let queued visits proceed after stalled fetches or bodies", async () => {
    await Promise.all(
      ["identity-fetch", "identity-body", "event-fetch", "event-retry"].map(async (stall) => {
        const stallsEvent = stall.startsWith("event-");
        let identityRequests = 0;
        let initializing = false;
        let initializationReleases = 0;
        let stalledSignal: AbortSignal | null | undefined;
        const events: string[] = [];
        const client = createTrafficClient({
          releaseId: "public",
          initialize: async (operation) => {
            expect(initializing).toBe(false);
            initializing = true;
            try {
              return await operation();
            } finally {
              initializing = false;
              initializationReleases++;
            }
          },
          request: async (url, init) => {
            if (url.endsWith("identity")) {
              identityRequests++;
              if (identityRequests === 1 && !stallsEvent) {
                stalledSignal = init?.signal;
                if (stall === "identity-fetch") return new Promise<Response>(() => {});
                // Headers arrive, but the JSON body never finishes streaming.
                return new Response(new ReadableStream<Uint8Array>({ start() {} }));
              }
              return Response.json({
                data: { ticket: "signed", expiresAt: new Date(Date.now() + 60000).toISOString() },
              });
            }
            events.push(String(init?.body));
            if (stall === "event-retry" && events.length === 1) throw new Error("network");
            if (
              (stall === "event-fetch" && events.length === 1) ||
              (stall === "event-retry" && events.length === 2)
            ) {
              stalledSignal = init?.signal;
              return new Promise<Response>(() => {});
            }
            return new Response(null, { status: 204 });
          },
        });
        const firstVisit = client.visit("/");
        const queuedVisit = client.visit("/cart");
        await Promise.all([firstVisit, queuedVisit]);
        expect(stalledSignal?.aborted).toBe(true);
        expect(initializing).toBe(false);
        expect(initializationReleases).toBe(stallsEvent ? 1 : 2);
        expect(events).toHaveLength(stallsEvent ? 3 : 1);
        if (stallsEvent) {
          expect(events[0]).toBe(events[1]);
          expect(JSON.parse(events[2]!).eventId).not.toBe(JSON.parse(events[0]!).eventId);
        }
        expect(JSON.parse(events.at(-1)!).route).toBe("cart");
      }),
    );
  }, 30000);
});
