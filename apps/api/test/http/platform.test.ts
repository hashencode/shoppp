import { describe, expect, test } from "vitest";

import { assertEnvironmentIsolation } from "../../src/http/environment";
import { redact } from "../../src/http/redaction";

describe("platform boundaries", () => {
  test("AE8: staging resources cannot name or address production", () => {
    expect(() =>
      assertEnvironmentIsolation({
        environment: "staging",
        publicOrigin: "https://staging.example.invalid",
        resourceNamespace: "shoppp-staging",
      }),
    ).not.toThrow();
    expect(() =>
      assertEnvironmentIsolation({
        environment: "staging",
        publicOrigin: "https://api.example.invalid",
        resourceNamespace: "shoppp-production",
      }),
    ).toThrow("isolation");
  });

  test("redacts secrets, tokens, payment credentials, and personal fields recursively", () => {
    const cardNumber = ["4242", "4242", "4242", "4242"].join("");
    const stripeCredential = ["sk", "test", "fixture"].join("_");
    expect(
      redact({
        authorization: "Bearer secret",
        email: "shopper@example.test",
        nested: {
          cardNumber,
          safe: "visible",
          stripeSecretKey: stripeCredential,
        },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      email: "[REDACTED]",
      nested: {
        cardNumber: "[REDACTED]",
        safe: "visible",
        stripeSecretKey: "[REDACTED]",
      },
    });
  });
});
