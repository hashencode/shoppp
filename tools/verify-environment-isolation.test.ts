import { describe, expect, test } from "bun:test";
import { verifySnapshots } from "./verify-environment-isolation";

function snapshots() {
  return [
    {
      environment: "staging" as const,
      applicationNames: ["shoppp-api-staging", "shoppp-admin-staging", "shoppp-storefront-staging"],
      resourceIdentifiers: ["shoppp-staging", "staging-db-id", "staging-bucket"],
      endpointValues: [
        "https://api.staging.example.com",
        "https://shop.staging.example.com",
        "https://shop.staging.example.com/checkout",
      ],
      apiVariables: {
        ENVIRONMENT: "staging",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "staging-site-key",
        STOREFRONT_ORIGIN: "https://shop.staging.example.com",
        PAYMENT_SUCCESS_URL: "https://shop.staging.example.com/checkout/complete",
        PAYMENT_CANCEL_URL: "https://shop.staging.example.com/checkout",
      },
    },
    {
      environment: "production" as const,
      applicationNames: [
        "shoppp-api-production",
        "shoppp-admin-production",
        "shoppp-storefront-production",
      ],
      resourceIdentifiers: ["shoppp-production", "production-db-id", "production-bucket"],
      endpointValues: [
        "https://api.example.com",
        "https://shop.example.com",
        "https://shop.example.com/checkout",
      ],
      apiVariables: {
        ENVIRONMENT: "production",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "production-site-key",
        STOREFRONT_ORIGIN: "https://shop.example.com",
        PAYMENT_SUCCESS_URL: "https://shop.example.com/checkout/complete",
        PAYMENT_CANCEL_URL: "https://shop.example.com/checkout",
      },
    },
  ];
}

describe("environment isolation", () => {
  test("accepts distinct staging and production resources", () => {
    expect(() => verifySnapshots(snapshots())).not.toThrow();
  });

  test("fails closed when a binding crosses environments", () => {
    const fixture = snapshots();
    fixture[1]!.resourceIdentifiers.push("staging-db-id");
    expect(() => verifySnapshots(fixture)).toThrow(/share deployment resources|staging resource/);
  });

  test("fails closed when a payment target crosses environments", () => {
    const fixture = snapshots();
    fixture[1]!.apiVariables.PAYMENT_SUCCESS_URL =
      "https://shop.staging.example.com/checkout/complete";
    expect(() => verifySnapshots(fixture)).toThrow(/crosses storefront origin/);
  });

  test("strict release mode rejects placeholders", () => {
    const fixture = snapshots();
    fixture[1]!.endpointValues.push("https://shop.example.invalid");
    expect(() => verifySnapshots(fixture, { strictProduction: true })).toThrow(
      /placeholder resources/,
    );
  });

  test("fails closed when Turnstile environments share a site key", () => {
    const fixture = snapshots();
    fixture[1]!.endpointValues.push("staging-site-key");
    expect(() => verifySnapshots(fixture)).toThrow(
      /share deployment resources|references a staging resource/,
    );
  });
});
