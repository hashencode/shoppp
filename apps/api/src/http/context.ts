import type { Principal } from "../iam/permissions";

export interface ApiBindings {
  ACCESS_AUDIENCE: string;
  ACCESS_ISSUER: string;
  ACCESS_JWKS: string;
  DB: D1Database;
  MEDIA: R2Bucket;
  ENVIRONMENT: "development" | "staging" | "production";
  PUBLIC_ORIGIN: string;
  PREVIEW_TOKEN_SECRET?: string;
  RESOURCE_NAMESPACE: string;
  STOREFRONT_BUILD_HOOK?: string;
  BUILD_HOOK_TOKEN?: string;
  BUILD_MANIFEST_TOKEN?: string;
  MEDIA_PUBLIC_ORIGIN: string;
  STOREFRONT_ORIGIN: string;
  TAX_MODE: "zero";
  RESERVATION_TTL_MINUTES?: string;
  GUEST_ORDER_TOKEN_TTL_HOURS?: string;
  PAYMENT_CANCEL_URL?: string;
  PAYMENT_SUCCESS_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export interface ApiVariables {
  principal: Principal;
  requestId: string;
}

export interface ApiEnvironment {
  Bindings: ApiBindings;
  Variables: ApiVariables;
}
