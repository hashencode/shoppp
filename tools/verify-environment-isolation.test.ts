import { describe, expect, test } from "bun:test";
import {
  loadFashionEnvironmentProfile,
  loadSnapshots,
  verifyFashionEnvironmentProfile,
  verifySnapshots,
} from "./verify-environment-isolation";

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
        ADMIN_ORIGIN: "https://admin.staging.example.com",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "staging-db-id",
        ENVIRONMENT: "staging",
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
        ADMIN_ORIGIN: "https://admin.example.com",
        CLOUDFLARE_ACCOUNT_ID: "shared-cloudflare-account",
        D1_DATABASE_ID: "production-db-id",
        ENVIRONMENT: "production",
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

function fashionProfile() {
  return {
    deploymentProfile: "fashion-staging" as const,
    runtimeEnvironment: "staging" as const,
    workers: {
      api: "shoppp-api-fashion-staging",
      preview: "shoppp-storefront-fashion-preview",
    },
    databaseIdentity: "fashion-db-id::shoppp-fashion-staging",
    storageIdentifiers: [
      "shoppp-fashion-staging-media",
      "shoppp-fashion-staging-preview-artifacts",
    ],
    serviceCredentialRef: "fashion-staging-service-credential",
    checkoutProtection: {
      rateLimit: {
        binding: "CHECKOUT_RATE_LIMITER",
        limit: 10,
        namespaceId: "fashion-checkout-rate-limit",
        period: 60,
      },
      turnstile: {
        hostnames: ["shoppp-storefront-fashion-preview.example.com"],
        required: true,
        siteKey: "1x00000000000000000000AA",
        testMode: true,
      },
    },
    paymentTargets: {
      cancelUrl:
        "https://shoppp-storefront-fashion-preview.example.com/checkout/complete?return=canceled",
      successUrl:
        "https://shoppp-storefront-fashion-preview.example.com/checkout/complete?session_id={CHECKOUT_SESSION_ID}",
      webhookUrl: "https://shoppp-api-fashion-staging.example.com/webhooks/stripe",
    },
    lifecycle: {
      resourceProvisioning: "explicit-once" as const,
      ordinaryRuns: "verify-and-reuse" as const,
      credentialReplacement: "security-event-or-operator" as const,
    },
    origins: {
      api: "https://shoppp-api-fashion-staging.example.com",
      preview: "https://shoppp-storefront-fashion-preview.example.com",
    },
    serviceBindings: {
      PREVIEW_AUTH: {
        service: "shoppp-api-fashion-staging",
        intent: "preview-authorization" as const,
      },
      COMMERCE_API: {
        service: "shoppp-api-fashion-staging",
        intent: "commerce-api" as const,
      },
    },
  };
}

describe("environment isolation", () => {
  test("repository config resolves to exactly the test and production remote D1 identities", async () => {
    const actual = await loadSnapshots();
    expect(actual.map(({ remoteDatabaseIdentities }) => remoteDatabaseIdentities)).toEqual([
      ["0c84c9e0-5ef1-4897-815e-5ec7efb7582e::shoppp-staging"],
      ["e17ef1dc-d87c-40c7-b218-e4827d815168::shoppp-production"],
    ]);
  });

  test("repository config resolves the dedicated Fashion Worker, D1, storage, and binding profile", async () => {
    const profile = await loadFashionEnvironmentProfile();
    expect(profile).toMatchObject({
      databaseIdentity: "eb1ca4ef-3121-4d02-b20e-e619eac1cecc::shoppp-fashion-staging",
      deploymentProfile: "fashion-staging",
      runtimeEnvironment: "staging",
      checkoutProtection: {
        rateLimit: {
          binding: "CHECKOUT_RATE_LIMITER",
          limit: 10,
          namespaceId: "14001",
          period: 60,
        },
        turnstile: {
          hostnames: ["shoppp-storefront-fashion-preview.hashencode.workers.dev"],
          required: true,
          siteKey: "1x00000000000000000000AA",
          testMode: true,
        },
      },
      paymentTargets: {
        webhookUrl: "https://shoppp-api-fashion-staging.hashencode.workers.dev/webhooks/stripe",
      },
      serviceBindings: {
        COMMERCE_API: { service: "shoppp-api-fashion-staging" },
        PREVIEW_AUTH: { service: "shoppp-api-fashion-staging" },
      },
      workers: {
        api: "shoppp-api-fashion-staging",
        preview: "shoppp-storefront-fashion-preview",
      },
    });
    expect(profile.storageIdentifiers).toEqual([
      "shoppp-fashion-staging-media",
      "shoppp-fashion-staging-preview-artifacts",
    ]);
    expect(() => verifyFashionEnvironmentProfile(snapshots(), profile)).not.toThrow();
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

  test.each(["D1_DATABASE_ID", "RESOURCE_NAMESPACE", "ADMIN_ORIGIN", "SERVICE_CREDENTIAL_REF"])(
    "fails closed when %s crosses environments",
    (variable) => {
      const fixture = snapshots();
      fixture[1]!.apiVariables[variable] = fixture[0]!.apiVariables[variable]!;
      expect(() => verifySnapshots(fixture)).toThrow(
        /share deployment resources|ADMIN_HOSTNAME must match|D1_DATABASE_ID must match/,
      );
    },
  );

  test("fails closed when a third shared remote development database is configured", () => {
    const fixture = snapshots();
    fixture[0]!.remoteDatabaseIdentities.push("development-db-id::shoppp-development");
    expect(() => verifySnapshots(fixture)).toThrow(
      /exactly one remote D1|exactly two shared remote D1/i,
    );
  });

  test("fails closed when either environment renames or misidentifies its canonical D1", () => {
    const renamed = snapshots();
    renamed[0]!.remoteDatabaseIdentities = ["staging-db-id::shoppp-test"];
    expect(() => verifySnapshots(renamed)).toThrow(/shoppp-staging/);

    const mismatched = snapshots();
    mismatched[1]!.apiVariables.D1_DATABASE_ID = "other-production-db-id";
    expect(() => verifySnapshots(mismatched)).toThrow(/must match its bound remote D1/);
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

  test.each([
    ["staging", "SERVICE_CREDENTIAL_REF", "replace-with-staging-service-credential"],
    ["production", "SERVICE_CREDENTIAL_REF", "replace-with-production-service-credential"],
  ] as const)(
    "strict %s mode rejects placeholder %s identity metadata",
    (environment, variable, placeholder) => {
      const fixture = snapshots();
      const snapshot = fixture.find((entry) => entry.environment === environment)!;
      snapshot.apiVariables[variable] = placeholder;
      expect(() => verifySnapshots(fixture, { strictEnvironment: environment })).toThrow(
        /placeholder resources/,
      );
    },
  );

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

describe("fashion-staging deployment profile", () => {
  test("accepts a distinct API and private Preview profile with staging runtime semantics", () => {
    expect(() => verifyFashionEnvironmentProfile(snapshots(), fashionProfile())).not.toThrow();
  });

  test.each(["api", "preview"] as const)(
    "rejects a Fashion %s Worker identity reused from legacy staging",
    (worker) => {
      const fixture = fashionProfile();
      fixture.workers[worker] = snapshots()[0]!.applicationNames[0]!;
      if (worker === "api") {
        fixture.serviceBindings.PREVIEW_AUTH.service = fixture.workers.api;
        fixture.serviceBindings.COMMERCE_API.service = fixture.workers.api;
      }
      expect(() => verifyFashionEnvironmentProfile(snapshots(), fixture)).toThrow(
        /Fashion profile reuses an existing deployment identity/,
      );
    },
  );

  test("rejects Fashion D1 and storage identities reused from existing environments", () => {
    const reusedDatabase = fashionProfile();
    reusedDatabase.databaseIdentity = snapshots()[0]!.remoteDatabaseIdentities[0]!;
    expect(() => verifyFashionEnvironmentProfile(snapshots(), reusedDatabase)).toThrow(
      /Fashion profile reuses an existing deployment identity/,
    );

    const reusedStorage = fashionProfile();
    reusedStorage.storageIdentifiers[0] = snapshots()[1]!.resourceIdentifiers[2]!;
    expect(() => verifyFashionEnvironmentProfile(snapshots(), reusedStorage)).toThrow(
      /Fashion profile reuses an existing deployment identity/,
    );
  });

  test("rejects missing Fashion resource configuration", () => {
    const fixture = fashionProfile();
    fixture.storageIdentifiers = [];
    expect(() => verifyFashionEnvironmentProfile(snapshots(), fixture)).toThrow(
      /Fashion profile must define at least one storage identity/,
    );
  });

  test("rejects ordinary runs that create resources or rotate credentials", () => {
    const createsOnDemand = fashionProfile();
    createsOnDemand.lifecycle.ordinaryRuns = "create-if-missing" as "verify-and-reuse";
    expect(() => verifyFashionEnvironmentProfile(snapshots(), createsOnDemand)).toThrow(
      /ordinary runs must only verify and reuse provisioned resources/,
    );

    const automaticRotation = fashionProfile();
    automaticRotation.lifecycle.credentialReplacement = "automatic" as "security-event-or-operator";
    expect(() => verifyFashionEnvironmentProfile(snapshots(), automaticRotation)).toThrow(
      /credential replacement must require a security event or operator action/,
    );
  });

  test("rejects production runtime semantics and legacy deployment targets", () => {
    const productionRuntime = {
      ...fashionProfile(),
      runtimeEnvironment: "production",
    };
    expect(() => verifyFashionEnvironmentProfile(snapshots(), productionRuntime)).toThrow(
      /Fashion API runtime must remain staging/,
    );

    const legacyTarget = {
      ...fashionProfile(),
      deploymentProfile: "staging",
    };
    expect(() => verifyFashionEnvironmentProfile(snapshots(), legacyTarget)).toThrow(
      /deployment profile must be fashion-staging/,
    );
  });

  test("keeps Preview authorization and Commerce calls as separate binding intents", () => {
    const missingCommerce = fashionProfile();
    delete (missingCommerce.serviceBindings as Partial<typeof missingCommerce.serviceBindings>)
      .COMMERCE_API;
    expect(() => verifyFashionEnvironmentProfile(snapshots(), missingCommerce)).toThrow(
      /must define COMMERCE_API/,
    );

    const wrongIntent = fashionProfile();
    wrongIntent.serviceBindings.COMMERCE_API.intent = "preview-authorization" as "commerce-api";
    expect(() => verifyFashionEnvironmentProfile(snapshots(), wrongIntent)).toThrow(
      /COMMERCE_API must have commerce-api intent/,
    );
  });

  test("fails closed unless Fashion checkout uses its exact Turnstile and rate-limit profile", () => {
    const disabled = fashionProfile();
    disabled.checkoutProtection.turnstile.required = false;
    expect(() => verifyFashionEnvironmentProfile(snapshots(), disabled)).toThrow(
      /Fashion checkout must require Turnstile/,
    );

    const wrongHost = fashionProfile();
    wrongHost.checkoutProtection.turnstile.hostnames = ["shoppp-storefront-staging.example.com"];
    expect(() => verifyFashionEnvironmentProfile(snapshots(), wrongHost)).toThrow(
      /Turnstile hostname must match the private Preview origin/,
    );

    const sharedRateLimit = fashionProfile();
    sharedRateLimit.checkoutProtection.rateLimit.namespaceId = "staging-rate-limit";
    const existing = snapshots();
    existing[0]!.resourceIdentifiers.push("staging-rate-limit");
    expect(() => verifyFashionEnvironmentProfile(existing, sharedRateLimit)).toThrow(
      /Fashion profile reuses an existing deployment identity/,
    );
  });

  test("fails closed when Fashion payment targets leave the isolated origins", () => {
    const wrongSuccess = fashionProfile();
    wrongSuccess.paymentTargets.successUrl =
      "https://shoppp-storefront-staging.example.com/checkout/complete?session_id={CHECKOUT_SESSION_ID}";
    expect(() => verifyFashionEnvironmentProfile(snapshots(), wrongSuccess)).toThrow(
      /Fashion payment success target must use the private Preview origin/,
    );

    const wrongWebhook = fashionProfile();
    wrongWebhook.paymentTargets.webhookUrl = "https://api.example.com/webhooks/stripe";
    expect(() => verifyFashionEnvironmentProfile(snapshots(), wrongWebhook)).toThrow(
      /Fashion Stripe webhook must use the dedicated API origin/,
    );
  });

  test("rejects a binding that falls back to a legacy API Worker", () => {
    const fixture = fashionProfile();
    fixture.serviceBindings.COMMERCE_API.service = snapshots()[0]!.applicationNames[0]!;
    expect(() => verifyFashionEnvironmentProfile(snapshots(), fixture)).toThrow(
      /COMMERCE_API must target the dedicated Fashion API Worker/,
    );
  });
});
