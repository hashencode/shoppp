import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      AUTH_TOKEN_SECRET: string;
      ADMIN_ORIGIN: string;
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
      PREVIEW_ARTIFACTS: R2Bucket;
      PREVIEW_BUILD_CALLBACK_TOKEN: string;
      PREVIEW_ORIGIN: string;
      PREVIEW_SERVICE_TOKEN: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      MEDIA: R2Bucket;
      PRIVACY_EXPORTS: R2Bucket;
      REPORT_EXPORTS: R2Bucket;
      RESTORE_DB: D1Database;
      STOREFRONT_ORIGIN: string;
      TEST_MIGRATIONS: D1Migration[];
      TURNSTILE_SITE_KEY?: string;
      TURNSTILE_TEST_MODE?: string;
    }
  }
}

export {};
