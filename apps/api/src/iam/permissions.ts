import type { Context } from "hono";
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "./audit";

export type AdminRole = "admin" | "catalog_manager" | "operations" | "support" | "analyst";
export type PermissionKey = AdminPermission;

export interface Principal {
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly role: AdminRole;
  readonly subject: string;
}

const ALL_PERMISSIONS: readonly PermissionKey[] = ADMIN_PERMISSION_KEYS;
const ROLE_PERMISSIONS: Readonly<Record<AdminRole, readonly PermissionKey[]>> = {
  admin: ALL_PERMISSIONS,
  catalog_manager: ["catalog.read", "catalog.write", "catalog.publish", "inventory.read"],
  operations: [
    "catalog.read",
    "inventory.read",
    "inventory.adjust",
    "orders.read",
    "orders.fulfill",
    "orders.cancel",
    "orders.refund",
    "audit.read",
    "operations.replay",
    "operations.jobs.read",
  ],
  support: ["catalog.read", "inventory.read", "orders.read"],
  analyst: ["catalog.read", "inventory.read", "orders.read", "reporting.read", "reporting.export"],
};

export function isAdminRole(value: string): value is AdminRole {
  return value in ROLE_PERMISSIONS;
}

export function permissionsForRole(role: AdminRole): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: AdminRole, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function requirePermission(
  context: Context<ApiEnvironment>,
  permission: PermissionKey,
  target?: { id?: string; type: string },
): Promise<void> {
  const principal = context.get("principal");
  if (hasPermission(principal.role, permission)) {
    return;
  }
  await recordAuditEvent(context.env.DB, {
    action: permission,
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    requestId: context.get("requestId"),
    result: "denied",
    targetType: target?.type ?? "permission",
    ...(target?.id ? { targetId: target.id } : {}),
  });
  throw new ApiError(403, "permission_denied", "You do not have permission for this action.");
}
