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
        ACCESS_AUDIENCE: "staging-access-audience",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "staging-db-id",
        ENVIRONMENT: "staging",
        RESOURCE_NAMESPACE: "shoppp-staging",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "staging-site-key",
        TURNSTILE_TEST_MODE: "false",
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
        ACCESS_AUDIENCE: "production-access-audience",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "production-db-id",
        ENVIRONMENT: "production",
        RESOURCE_NAMESPACE: "shoppp-production",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "production-site-key",
        TURNSTILE_TEST_MODE: "false",
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

  test("allows one Cloudflare account when every mutable resource remains distinct", () => {
    const fixture = snapshots();
    expect(fixture[0]!.apiVariables.CLOUDFLARE_ACCOUNT_ID).toBe(
      fixture[1]!.apiVariables.CLOUDFLARE_ACCOUNT_ID,
    );
    expect(() => verifySnapshots(fixture)).not.toThrow();
  });

  test.each(["D1_DATABASE_ID", "RESOURCE_NAMESPACE", "ACCESS_AUDIENCE"])(
    "fails closed when %s crosses environments",
    (variable) => {
      const fixture = snapshots();
      fixture[1]!.apiVariables[variable] = fixture[0]!.apiVariables[variable]!;
      expect(() => verifySnapshots(fixture)).toThrow(/share deployment resources/);
    },
  );

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

  test("strict production mode rejects production placeholders", () => {
    const fixture = snapshots();
    fixture[1]!.endpointValues.push("https://shop.example.invalid");
    expect(() => verifySnapshots(fixture, { strictEnvironment: "production" })).toThrow(
      /placeholder resources/,
    );
  });

  test("strict staging mode ignores production placeholders", () => {
    const fixture = snapshots();
    fixture[1]!.endpointValues.push("https://shop.example.invalid");
    expect(() => verifySnapshots(fixture, { strictEnvironment: "staging" })).not.toThrow();
  });

  test("strict staging mode rejects staging placeholders", () => {
    const fixture = snapshots();
    fixture[0]!.endpointValues.push("https://shop.staging.example.invalid");
    expect(() => verifySnapshots(fixture, { strictEnvironment: "staging" })).toThrow(
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

  test("fails closed when production enables Turnstile test mode", () => {
    const fixture = snapshots();
    fixture[1]!.apiVariables.TURNSTILE_TEST_MODE = "true";
    expect(() => verifySnapshots(fixture)).toThrow(/production cannot enable Turnstile test mode/);
  });
});
