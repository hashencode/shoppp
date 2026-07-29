import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      ACCESS_AUDIENCE: string;
      ACCESS_ISSUER: string;
      ACCESS_JWKS: string;
      DB: D1Database;
      ENVIRONMENT: "development" | "staging" | "production";
      EMAIL_FROM: string;
      PUBLIC_ORIGIN: string;
      RESOURCE_NAMESPACE: string;
      RESERVATION_TTL_MINUTES?: string;
      GUEST_ORDER_TOKEN_TTL_HOURS?: string;
      PAYMENT_CANCEL_URL?: string;
      PAYMENT_SUCCESS_URL?: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      MEDIA: R2Bucket;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
