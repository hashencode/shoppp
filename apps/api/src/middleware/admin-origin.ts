import type { MiddlewareHandler } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isAllowedAdminBrowserOrigin(
  environment: Pick<ApiEnvironment["Bindings"], "ADMIN_ORIGIN" | "ENVIRONMENT"> &
    Partial<Pick<ApiEnvironment["Bindings"], "ADMIN_DEVELOPMENT_ORIGIN">>,
  origin: string | undefined,
  fetchSite: string | undefined,
): boolean {
  if (!origin || fetchSite !== "same-origin") return false;
  if (origin === environment.ADMIN_ORIGIN) return true;
  if (
    environment.ENVIRONMENT !== "production" &&
    environment.ADMIN_DEVELOPMENT_ORIGIN &&
    origin === environment.ADMIN_DEVELOPMENT_ORIGIN
  ) {
    return true;
  }
  return false;
}

export function adminOriginProtection(): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    if (SAFE_METHODS.has(context.req.method)) {
      await next();
      return;
    }
    const principal = context.get("principal");
    if (principal.principalKind === "service") {
      await next();
      return;
    }
    const origin = context.req.header("Origin");
    const fetchSite = context.req.header("Sec-Fetch-Site");
    if (!isAllowedAdminBrowserOrigin(context.env, origin, fetchSite)) {
      await recordAuditEvent(context.env.DB, {
        action: "security.admin_origin",
        actorId: principal.id,
        actorType: "admin",
        id: crypto.randomUUID(),
        reason: "origin_or_fetch_metadata_mismatch",
        requestId: context.get("requestId"),
        result: "denied",
        targetType: "admin_request",
      });
      throw new ApiError(
        403,
        "admin_origin_denied",
        "The admin mutation origin could not be verified.",
      );
    }
    await next();
  };
}
