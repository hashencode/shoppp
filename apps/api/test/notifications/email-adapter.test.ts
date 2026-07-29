import { describe, expect, test, vi } from "vitest";

import { createHttpEmailProvider } from "../../src/notifications/email-adapter";

const message = {
  from: "orders@example.test",
  html: "<p>Order confirmed</p>",
  idempotencyKey: "order.receipt:ord_001",
  subject: "Order confirmed",
  text: "Order confirmed",
  to: "shopper@example.test",
};

describe("HTTP email adapter", () => {
  test("uses the business deduplication identity and returns provider truth", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ id: "provider-message-001" }, { status: 202 }),
    );
    const provider = createHttpEmailProvider({
      apiKey: "secret-api-key",
      endpoint: "https://email.example.test/messages",
      fetcher,
    });

    await expect(provider.send(message)).resolves.toEqual({ id: "provider-message-001" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://email.example.test/messages",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-api-key",
          "Idempotency-Key": "order.receipt:ord_001",
        }),
        method: "POST",
      }),
    );
  });

  test("classifies invalid recipients as permanent and provider outages as transient", async () => {
    const invalid = createHttpEmailProvider({
      apiKey: "secret-api-key",
      endpoint: "https://email.example.test/messages",
      fetcher: async () => new Response(null, { status: 422 }),
    });
    await expect(invalid.send(message)).rejects.toMatchObject({
      code: "email_request_invalid",
      retryable: false,
    });

    const timeout = createHttpEmailProvider({
      apiKey: "secret-api-key",
      endpoint: "https://email.example.test/messages",
      fetcher: async () => {
        throw new Error("socket secret-api-key");
      },
    });
    await expect(timeout.send(message)).rejects.toMatchObject({
      code: "email_provider_timeout",
      retryable: true,
    });
  });
});
