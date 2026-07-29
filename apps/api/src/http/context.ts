import type { Principal } from "../iam/permissions";

export interface ApiBindings {
  ACCESS_AUDIENCE: string;
  ACCESS_ISSUER: string;
  ACCESS_JWKS: string;
  DB: D1Database;
  ENVIRONMENT: "development" | "staging" | "production";
  PUBLIC_ORIGIN: string;
  RESOURCE_NAMESPACE: string;
}

export interface ApiVariables {
  principal: Principal;
  requestId: string;
}

export interface ApiEnvironment {
  Bindings: ApiBindings;
  Variables: ApiVariables;
}
