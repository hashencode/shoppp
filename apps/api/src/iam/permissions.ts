import type { Context } from "hono";
import type { AdminPermission, AdminRoleSummary } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "./audit";

export type PermissionKey = AdminPermission;

interface PrincipalBase {
  readonly displayName: string;
  readonly id: string;
  readonly permissions: readonly PermissionKey[];
  readonly role: AdminRoleSummary;
  readonly subject: string;
}

export interface HumanPrincipal extends PrincipalBase {
  readonly email: string;
  readonly principalKind: "human";
}

export interface ServicePrincipal extends PrincipalBase {
  readonly principalKind: "service";
  readonly serviceName: string;
}

export type Principal = HumanPrincipal | ServicePrincipal;

export function actorTypeForPrincipal(principal: Principal): "admin" | "machine" {
  return principal.principalKind === "service" ? "machine" : "admin";
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
): boolean {
  return permissions.includes(permission);
}

export async function requirePermission(
  context: Context<ApiEnvironment>,
  permission: PermissionKey,
  target?: { id?: string; type: string },
): Promise<void> {
  const principal = context.get("principal");
  if (hasPermission(principal.permissions, permission)) {
    return;
  }
  await recordAuditEvent(context.env.DB, {
    action: permission,
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    requestId: context.get("requestId"),
    result: "denied",
    targetType: target?.type ?? "permission",
    ...(target?.id ? { targetId: target.id } : {}),
  });
  throw new ApiError(403, "permission_denied", "You do not have permission for this action.");
}
