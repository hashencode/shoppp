import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    new URL("../../packages/db/migrations", import.meta.url).pathname,
  );

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          d1Databases: ["RESTORE_DB"],
          r2Buckets: ["BACKUP_BUCKET", "MEDIA", "PRIVACY_EXPORTS", "REPORT_EXPORTS"],
          bindings: {
            ACCESS_AUDIENCE: "test-audience",
            ACCESS_ISSUER: "https://shoppp.cloudflareaccess.com",
            ACCESS_JWKS: '{"keys":[]}',
            ENVIRONMENT: "staging",
            EMAIL_FROM: "orders@staging.example.test",
            PUBLIC_ORIGIN: "https://staging.example.invalid",
            RESOURCE_NAMESPACE: "shoppp-staging",
            RESERVATION_TTL_MINUTES: "30",
            GUEST_ORDER_TOKEN_TTL_HOURS: "720",
            PAYMENT_CANCEL_URL: "https://storefront-staging.example.invalid/checkout",
            PAYMENT_SUCCESS_URL:
              "https://storefront-staging.example.invalid/checkout/complete?session_id={CHECKOUT_SESSION_ID}",
            TAX_MODE: "zero",
            TEST_MIGRATIONS: migrations,
            TURNSTILE_HOSTNAMES: "storefront-staging.example.invalid",
            TURNSTILE_REQUIRED: "false",
          },
        },
        wrangler: {
          configPath: "./wrangler.jsonc",
          environment: "staging",
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
