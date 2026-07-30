import type { NotificationQueuePayload } from "../automation/queue-consumer";
import type { NotificationWorkflowPayload } from "../automation/workflows";
import type { Principal } from "../iam/permissions";

export interface ApiBindings {
  ACCESS_AUDIENCE: string;
  ACCESS_ISSUER: string;
  ANALYTICS_RATE_LIMITER?: RateLimit;
  BACKUP_BUCKET: R2Bucket;
  BACKUP_WORKFLOW?: Workflow;
  CHECKOUT_RATE_LIMITER?: RateLimit;
  DB: D1Database;
  MEDIA: R2Bucket;
  PRIVACY_EXPORTS: R2Bucket;
  PREVIEW_ARTIFACTS: R2Bucket;
  REPORT_EXPORTS: R2Bucket;
  ENVIRONMENT: "development" | "staging" | "production";
  PUBLIC_ORIGIN: string;
  PREVIEW_TOKEN_SECRET?: string;
  RESOURCE_NAMESPACE: string;
  STOREFRONT_BUILD_HOOK?: string;
  BUILD_HOOK_TOKEN?: string;
  BUILD_MANIFEST_TOKEN?: string;
  PREVIEW_BUILD_CALLBACK_TOKEN?: string;
  PREVIEW_BUILD_HOOK?: string;
  PREVIEW_BUILD_HOOK_TOKEN?: string;
  PREVIEW_ORIGIN: string;
  PREVIEW_SERVICE_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  D1_DATABASE_ID?: string;
  D1_REST_API_TOKEN?: string;
  MEDIA_PUBLIC_ORIGIN: string;
  STOREFRONT_ORIGIN: string;
  TAX_MODE: "zero";
  RESERVATION_TTL_MINUTES?: string;
  GUEST_ORDER_TOKEN_TTL_HOURS?: string;
  PAYMENT_CANCEL_URL?: string;
  PAYMENT_SUCCESS_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  EMAIL?: SendEmail;
  TURNSTILE_HOSTNAMES?: string;
  TURNSTILE_REQUIRED?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_TEST_MODE?: string;
  EMAIL_FROM: string;
  EMAIL_PROVIDER_API_KEY?: string;
  EMAIL_PROVIDER_URL?: string;
  NOTIFICATION_QUEUE?: Queue<NotificationQueuePayload>;
  NOTIFICATION_WORKFLOW?: Workflow<NotificationWorkflowPayload>;
  OBSERVABILITY?: AnalyticsEngineDataset;
}

export interface ApiVariables {
  principal: Principal;
  requestId: string;
}

export interface ApiEnvironment {
  Bindings: ApiBindings;
  Variables: ApiVariables;
}
