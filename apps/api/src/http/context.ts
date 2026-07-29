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
}

export interface ApiVariables {
  principal: Principal;
  requestId: string;
}

export interface ApiEnvironment {
  Bindings: ApiBindings;
  Variables: ApiVariables;
}
