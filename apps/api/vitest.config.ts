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
          r2Buckets: ["MEDIA"],
          bindings: {
            ACCESS_AUDIENCE: "test-audience",
            ACCESS_ISSUER: "https://shoppp.cloudflareaccess.com",
            ACCESS_JWKS: '{"keys":[]}',
            ENVIRONMENT: "staging",
            PUBLIC_ORIGIN: "https://staging.example.invalid",
            RESOURCE_NAMESPACE: "shoppp-staging",
            TEST_MIGRATIONS: migrations,
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
