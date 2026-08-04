import { describe, expect, test } from "bun:test";
import { loadSnapshots, verifySnapshots } from "./verify-environment-isolation";

function snapshots() {
  return [
    {
      adminHostname: "admin.staging.example.com",
      environment: "staging" as const,
      applicationNames: ["shoppp-api-staging", "shoppp-admin-staging", "shoppp-storefront-staging"],
      resourceIdentifiers: ["shoppp-staging", "staging-db-id", "staging-bucket"],
      remoteDatabaseIdentities: ["staging-db-id::shoppp-staging"],
      endpointValues: [
        "https://api.staging.example.com",
        "https://shop.staging.example.com",
        "https://shop.staging.example.com/checkout",
      ],
      apiVariables: {
        ACCESS_AUDIENCE: "staging-access-audience",
        ACCESS_APPLICATION_ID: "staging-access-application",
        ADMIN_ORIGIN: "https://admin.staging.example.com",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "staging-db-id",
        ENVIRONMENT: "staging",
        IDP_ASSIGNMENT_ID: "staging-idp-assignment",
        RESOURCE_NAMESPACE: "shoppp-staging",
        SERVICE_CREDENTIAL_REF: "staging-service-credential",
        TURNSTILE_REQUIRED: "true",
        TURNSTILE_SITE_KEY: "staging-site-key",
        TURNSTILE_TEST_MODE: "false",
        STOREFRONT_ORIGIN: "https://shop.staging.example.com",
        PAYMENT_SUCCESS_URL: "https://shop.staging.example.com/checkout/complete",
        PAYMENT_CANCEL_URL: "https://shop.staging.example.com/checkout",
      },
    },
    {
      adminHostname: "admin.example.com",
      environment: "production" as const,
      applicationNames: [
        "shoppp-api-production",
        "shoppp-admin-production",
        "shoppp-storefront-production",
      ],
      resourceIdentifiers: ["shoppp-production", "production-db-id", "production-bucket"],
      remoteDatabaseIdentities: ["production-db-id::shoppp-production"],
      endpointValues: [
        "https://api.example.com",
        "https://shop.example.com",
        "https://shop.example.com/checkout",
      ],
      apiVariables: {
        ACCESS_AUDIENCE: "production-access-audience",
        ACCESS_APPLICATION_ID: "production-access-application",
        ADMIN_ORIGIN: "https://admin.example.com",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "production-db-id",
        ENVIRONMENT: "production",
        IDP_ASSIGNMENT_ID: "production-idp-assignment",
        RESOURCE_NAMESPACE: "shoppp-production",
        SERVICE_CREDENTIAL_REF: "production-service-credential",
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
  test("repository config resolves to exactly the test and production remote D1 identities", async () => {
    const actual = await loadSnapshots();
    expect(actual.map(({ remoteDatabaseIdentities }) => remoteDatabaseIdentities)).toEqual([
      ["0c84c9e0-5ef1-4897-815e-5ec7efb7582e::shoppp-staging"],
      ["00000000-0000-0000-0000-000000000030::shoppp-production"],
    ]);
  });

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

  test.each([
    "D1_DATABASE_ID",
    "RESOURCE_NAMESPACE",
    "ACCESS_AUDIENCE",
    "ACCESS_APPLICATION_ID",
    "ADMIN_ORIGIN",
    "IDP_ASSIGNMENT_ID",
    "SERVICE_CREDENTIAL_REF",
  ])(
    "fails closed when %s crosses environments",
    (variable) => {
      const fixture = snapshots();
      fixture[1]!.apiVariables[variable] = fixture[0]!.apiVariables[variable]!;
      expect(() => verifySnapshots(fixture)).toThrow(
        /share deployment resources|ADMIN_HOSTNAME must match/,
      );
    },
  );

  test("fails closed when a third shared remote development database is configured", () => {
    const fixture = snapshots();
    fixture[0]!.remoteDatabaseIdentities.push("development-db-id::shoppp-development");
    expect(() => verifySnapshots(fixture)).toThrow(/exactly one remote D1|exactly two shared remote D1/i);
  });

  test("does not count disposable local migration databases as shared remote D1", () => {
    const fixture = snapshots().map((snapshot) => ({
      ...snapshot,
      localDatabaseIdentities: ["miniflare-only::disposable-local"],
    }));
    expect(() => verifySnapshots(fixture)).not.toThrow();
  });

  test("fails closed when a binding crosses environments", () => {
    const fixture = snapshots();
    fixture[1]!.resourceIdentifiers.push("staging-db-id");
    expect(() => verifySnapshots(fixture)).toThrow(/share deployment resources|staging resource/);
  });

  test("fails closed when test and production reuse a Worker identity", () => {
    const fixture = snapshots();
    fixture[1]!.applicationNames[0] = fixture[0]!.applicationNames[0]!;
    expect(() => verifySnapshots(fixture)).toThrow(/share deployment resources/);
  });

  test("fails closed when an admin Worker hostname disagrees with the API origin policy", () => {
    const fixture = snapshots();
    fixture[0]!.adminHostname = "other-admin.staging.example.com";
    expect(() => verifySnapshots(fixture)).toThrow(/ADMIN_HOSTNAME must match/);
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
