import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      ACCESS_AUDIENCE: string;
      ACCESS_ISSUER: string;
      ACCESS_JWKS: string;
      DB: D1Database;
      ENVIRONMENT: "development" | "staging" | "production";
      PUBLIC_ORIGIN: string;
      RESOURCE_NAMESPACE: string;
      MEDIA: R2Bucket;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
