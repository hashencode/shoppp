import type { AdminUser, UpdateAdminUserRequest } from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent, recordAuditEvent } from "./audit";
import { loadAssignableRole } from "./admin-roles";
import { actorTypeForPrincipal } from "./permissions";

interface UserRow {
  created_at: string;
  display_name: string;
  enabled: number;
  id: string;
  normalized_email: string;
  role_enabled: number;
  role_id: string;
  role_key: string;
  role_name: string;
  role_protected: number;
  role_system: number;
  role_version: number;
  updated_at: string;
  version: number;
}

const USER_SELECT = `SELECT identity.id, identity.normalized_email, identity.display_name,
  identity.enabled, identity.version, identity.created_at, identity.updated_at,
  role.id AS role_id, role.key AS role_key, role.name AS role_name,
  role.protected AS role_protected, role.system AS role_system,
  role.enabled AS role_enabled, role.version AS role_version
  FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id`;

function dto(row: UserRow): AdminUser {
  return {
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.normalized_email,
    id: row.id,
    role: {
      enabled: row.role_enabled === 1,
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      protected: row.role_protected === 1,
      system: row.role_system === 1,
      version: row.role_version,
    },
    status: row.enabled === 1 ? "active" : "disabled",
    updatedAt: row.updated_at,
    version: row.version,
  };
}

async function findUser(db: D1Database, id: string): Promise<UserRow | null> {
  return db
    .prepare(`${USER_SELECT} WHERE identity.id = ? AND identity.principal_kind = 'human'`)
    .bind(id)
    .first<UserRow>();
}

export async function getAdminUser(db: D1Database, id: string): Promise<AdminUser> {
  const user = await findUser(db, id);
  if (!user) throw new ApiError(404, "admin_user_not_found", "The user was not found.");
  return dto(user);
}

export async function listAdminUsers(
  db: D1Database,
  input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    status?: "active" | "disabled" | undefined;
  },
): Promise<{ items: AdminUser[]; page: number; pageSize: number; total: number }> {
  const clauses = ["identity.principal_kind = 'human'"];
  const bindings: unknown[] = [];
  if (input.status) {
    clauses.push("identity.enabled = ?");
    bindings.push(input.status === "active" ? 1 : 0);
  }
  if (input.search) {
    clauses.push("(identity.normalized_email LIKE ? OR lower(identity.display_name) LIKE ?)");
    const search = `%${input.search.trim().toLowerCase()}%`;
    bindings.push(search, search);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const [count, rows] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM admin_identities identity JOIN admin_roles role ON role.id = identity.role_id ${where}`,
      )
      .bind(...bindings)
      .first<{ count: number }>(),
    db
      .prepare(
        `${USER_SELECT} ${where} ORDER BY identity.display_name, identity.id LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
      .all<UserRow>(),
  ]);
  return {
    items: rows.results.map(dto),
    page: input.page,
    pageSize: input.pageSize,
    total: count?.count ?? 0,
  };
}

async function denied(
  context: Context<ApiEnvironment>,
  userId: string,
  code: string,
  status: 403 | 409,
): Promise<never> {
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "iam.users.update",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: { code },
    reason: code,
    requestId: context.get("requestId"),
    result: "denied",
    targetId: userId,
    targetType: "admin_identity",
  });
  throw new ApiError(status, code, "The user change violates an access invariant.");
}

export async function updateAdminUser(
  context: Context<ApiEnvironment>,
  userId: string,
  input: UpdateAdminUserRequest,
): Promise<AdminUser> {
  const principal = context.get("principal");
  const before = await findUser(context.env.DB, userId);
  if (!before) throw new ApiError(404, "admin_user_not_found", "The user was not found.");
  const statusOrRoleChange = input.enabled !== undefined || input.roleId !== undefined;
  if (principal.id === userId && statusOrRoleChange) {
    return denied(context, userId, "self_user_change_denied", 403);
  }
  if (before.role_protected === 1 && statusOrRoleChange && !principal.role.protected) {
    return denied(context, userId, "protected_admin_change_denied", 403);
  }
  const nextRoleId = input.roleId ?? before.role_id;
  if (input.roleId) {
    await loadAssignableRole(context, input.roleId, {
      action: "iam.users.update",
      id: userId,
      type: "admin_identity",
    });
  }
  const nextEnabled = input.enabled === undefined ? before.enabled === 1 : input.enabled;
  const removesProtectedAdmin =
    before.enabled === 1 &&
    before.role_protected === 1 &&
    (!nextEnabled || nextRoleId !== before.role_id);
  const now = new Date().toISOString();
  const nextVersion = input.expectedVersion + 1;
  const [updateResult] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_identities
          SET display_name = ?, enabled = ?, role_id = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND principal_kind = 'human' AND version = ?
          AND EXISTS (SELECT 1 FROM admin_roles WHERE id = ? AND enabled = 1)
          AND (? = 0 OR (
            SELECT COUNT(*) FROM admin_identities identity
            JOIN admin_roles role ON role.id = identity.role_id
            WHERE identity.principal_kind = 'human' AND identity.enabled = 1
              AND role.protected = 1 AND role.enabled = 1
          ) > 1)`,
    ).bind(
      input.displayName ?? before.display_name,
      nextEnabled ? 1 : 0,
      nextRoleId,
      now,
      userId,
      input.expectedVersion,
      nextRoleId,
      removesProtectedAdmin ? 1 : 0,
    ),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "iam.users.update",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: {
          after: { enabled: nextEnabled, roleId: nextRoleId, version: nextVersion },
          before: {
            enabled: before.enabled === 1,
            roleId: before.role_id,
            version: before.version,
          },
        },
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: userId,
        targetType: "admin_identity",
      },
      {
        bindings: [userId, nextVersion, now],
        sql: "SELECT 1 FROM admin_identities WHERE id = ? AND version = ? AND updated_at = ?",
      },
    ),
  ]);
  if ((updateResult?.meta.changes ?? 0) < 1) {
    const selectedRole = await context.env.DB.prepare(
      "SELECT enabled FROM admin_roles WHERE id = ?",
    )
      .bind(nextRoleId)
      .first<{ enabled: number }>();
    if (!selectedRole || selectedRole.enabled !== 1) {
      return denied(context, userId, "role_unavailable", 409);
    }
    const current = await findUser(context.env.DB, userId);
    if (current?.version === input.expectedVersion && removesProtectedAdmin) {
      return denied(context, userId, "last_admin_change_denied", 409);
    }
    throw new ApiError(409, "stale_user_version", "The user was changed by another request.");
  }
  const after = await findUser(context.env.DB, userId);
  if (!after) throw new ApiError(500, "admin_user_update_failed", "The user update failed.");
  return dto(after);
}
