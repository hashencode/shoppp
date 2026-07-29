import type { JSONWebKeySet } from "jose";
import type { MiddlewareHandler } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { verifyAccessJwt, type AccessIdentity } from "../iam/access-jwt";
import { isAdminRole } from "../iam/permissions";

export type AccessVerifier = (
  token: string,
  config: { audience: string; issuer: string; jwks: JSONWebKeySet },
) => Promise<AccessIdentity>;

export function adminAuthentication(
  accessVerifier: AccessVerifier,
): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    const token = context.req.header("Cf-Access-Jwt-Assertion");
    if (!token) {
      throw new ApiError(401, "access_required", "Cloudflare Access authentication is required.");
    }
    let identity: AccessIdentity;
    try {
      identity = await accessVerifier(token, {
        audience: context.env.ACCESS_AUDIENCE,
        issuer: context.env.ACCESS_ISSUER,
        jwks: JSON.parse(context.env.ACCESS_JWKS) as JSONWebKeySet,
      });
    } catch {
      throw new ApiError(401, "invalid_access_token", "Cloudflare Access authentication failed.");
    }
    const principal = await context.env.DB.prepare(
      "SELECT id, email, role, enabled FROM admin_identities WHERE access_subject = ?",
    )
      .bind(identity.subject)
      .first<{ enabled: number; email: string; id: string; role: string }>();
    if (!principal || principal.enabled !== 1 || !isAdminRole(principal.role)) {
      throw new ApiError(401, "identity_not_enabled", "The Access identity is not enabled.");
    }
    context.set("principal", {
      email: principal.email,
      id: principal.id,
      role: principal.role,
      subject: identity.subject,
    });
    await next();
  };
}

export const defaultAccessVerifier: AccessVerifier = verifyAccessJwt;
