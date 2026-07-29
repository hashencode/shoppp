import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      ACCESS_AUDIENCE: string;
      ACCESS_ISSUER: string;
      ACCESS_JWKS: string;
      BACKUP_BUCKET: R2Bucket;
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
      PRIVACY_EXPORTS: R2Bucket;
      REPORT_EXPORTS: R2Bucket;
      RESTORE_DB: D1Database;
      STOREFRONT_ORIGIN: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
