import type {
  AdminPermission,
  AdminRole,
  CreateAdminRoleRequest,
  UpdateAdminRoleRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent, recordAuditEvent } from "./audit";
import { actorTypeForPrincipal, type Principal } from "./permissions";

interface RoleRow {
  created_at: string;
  description: string | null;
  enabled: number;
  id: string;
  key: string;
  name: string;
  protected: number;
  system: number;
  updated_at: string;
  version: number;
}

interface RoleDependencyCounts {
  readonly identities: number;
  readonly pendingInvitations: number;
}

function roleSummary(row: RoleRow) {
  return {
    enabled: row.enabled === 1,
    id: row.id,
    key: row.key,
    name: row.name,
    protected: row.protected === 1,
    system: row.system === 1,
    version: row.version,
  } as const;
}

async function permissionsForRole(db: D1Database, roleId: string): Promise<AdminPermission[]> {
  const rows = await db
    .prepare(
      `SELECT permission_key FROM admin_role_permissions
        WHERE role_id = ? ORDER BY permission_key`,
    )
    .bind(roleId)
    .all<{ permission_key: AdminPermission }>();
  return rows.results.map(({ permission_key }) => permission_key);
}

async function findRole(db: D1Database, roleId: string): Promise<RoleRow | null> {
  return db
    .prepare(
      `SELECT id, key, name, description, protected, system, enabled, version,
              created_at, updated_at
         FROM admin_roles WHERE id = ?`,
    )
    .bind(roleId)
    .first<RoleRow>();
}

export async function roleDependencyCounts(
  db: D1Database,
  roleId: string,
  now = new Date().toISOString(),
): Promise<RoleDependencyCounts> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM admin_identities WHERE role_id = ?) AS identities,
         (SELECT COUNT(*) FROM admin_invitations
           WHERE role_id = ? AND status = 'pending' AND expires_at > ?) AS pending_invitations`,
    )
    .bind(roleId, roleId, now)
    .first<{ identities: number; pending_invitations: number }>();
  return {
    identities: row?.identities ?? 0,
    pendingInvitations: row?.pending_invitations ?? 0,
  };
}

function assertPermissionSubset(
  principal: Principal,
  permissions: readonly AdminPermission[],
): void {
  const unique = new Set(permissions);
  if (unique.size !== permissions.length) {
    throw new ApiError(422, "duplicate_permissions", "Role permissions must be unique.");
  }
  if (permissions.some((permission) => !principal.permissions.includes(permission))) {
    throw new ApiError(
      403,
      "permission_escalation_denied",
      "A role cannot grant permissions the caller does not hold.",
    );
  }
}

export async function loadAssignableRole(
  db: D1Database,
  principal: Principal,
  roleId: string,
): Promise<void> {
  const role = await findRole(db, roleId);
  if (!role || role.enabled !== 1) {
    throw new ApiError(409, "role_unavailable", "The selected role is not enabled.");
  }
  if (role.protected === 1 && !principal.role.protected) {
    throw new ApiError(
      403,
      "protected_role_assignment_denied",
      "Only a protected administrator may assign the protected role.",
    );
  }
  const permissions = await permissionsForRole(db, roleId);
  assertPermissionSubset(principal, permissions);
}

export async function listAdminRoles(
  db: D1Database,
  input: { page: number; pageSize: number; search?: string | undefined },
): Promise<{ items: AdminRole[]; page: number; pageSize: number; total: number }> {
  const search = input.search?.trim().toLowerCase();
  const where = search ? "WHERE lower(role.name) LIKE ? OR lower(role.key) LIKE ?" : "";
  const bindings = search ? [`%${search}%`, `%${search}%`] : [];
  const [count, rows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS count FROM admin_roles role ${where}`)
      .bind(...bindings)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT role.id, role.key, role.name, role.description, role.protected, role.system,
                role.enabled, role.version, role.created_at, role.updated_at
           FROM admin_roles role
          ${where}
          ORDER BY role.name, role.id
          LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
      .all<RoleRow>(),
  ]);
  if (!rows.results.length) {
    return { items: [], page: input.page, pageSize: input.pageSize, total: count?.count ?? 0 };
  }
  const placeholders = rows.results.map(() => "?").join(", ");
  const permissionRows = await db
    .prepare(
      `SELECT role_id, permission_key FROM admin_role_permissions
        WHERE role_id IN (${placeholders}) ORDER BY permission_key`,
    )
    .bind(...rows.results.map(({ id }) => id))
    .all<{ permission_key: AdminPermission; role_id: string }>();
  const permissionsByRole = new Map<string, AdminPermission[]>();
  for (const row of permissionRows.results) {
    const permissions = permissionsByRole.get(row.role_id) ?? [];
    permissions.push(row.permission_key);
    permissionsByRole.set(row.role_id, permissions);
  }
  return {
    items: rows.results.map((row) => ({
      ...roleSummary(row),
      description: row.description,
      permissions: permissionsByRole.get(row.id) ?? [],
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: count?.count ?? 0,
  };
}

export async function createAdminRole(
  context: Context<ApiEnvironment>,
  input: CreateAdminRoleRequest,
): Promise<AdminRole> {
  const principal = context.get("principal");
  assertPermissionSubset(principal, input.permissions);
  const id = `role_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const role: RoleRow = {
    created_at: now,
    description: input.description ?? null,
    enabled: 1,
    id,
    key: input.key,
    name: input.name,
    protected: 0,
    system: 0,
    updated_at: now,
    version: 1,
  };
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO admin_roles
             (id, key, name, description, protected, system, enabled, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 0, 1, 1, ?, ?)`,
      ).bind(id, input.key, input.name, input.description ?? null, now, now),
      ...input.permissions.map((permission) =>
        context.env.DB.prepare(
          `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
             VALUES (?, ?, ?)`,
        ).bind(id, permission, now),
      ),
      prepareAuditEvent(context.env.DB, {
        action: "iam.roles.create",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: { after: { enabled: true, permissions: input.permissions, version: 1 } },
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "admin_role",
      }),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) {
      throw new ApiError(409, "role_key_conflict", "A role with this key already exists.");
    }
    throw error;
  }
  return {
    ...roleSummary(role),
    description: role.description,
    permissions: [...input.permissions],
  };
}

async function auditRoleDenial(
  context: Context<ApiEnvironment>,
  roleId: string,
  code: string,
  metadata: Record<string, unknown> = {},
): Promise<never> {
  const principal = context.get("principal");
  await recordAuditEvent(context.env.DB, {
    action: "iam.roles.update",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: { code, ...metadata },
    requestId: context.get("requestId"),
    result: "denied",
    targetId: roleId,
    targetType: "admin_role",
  });
  throw new ApiError(409, code, "The role change violates an access invariant.", metadata);
}

export async function updateAdminRole(
  context: Context<ApiEnvironment>,
  roleId: string,
  input: UpdateAdminRoleRequest,
): Promise<AdminRole> {
  const principal = context.get("principal");
  const before = await findRole(context.env.DB, roleId);
  if (!before) throw new ApiError(404, "role_not_found", "The role was not found.");
  if (
    input.name === undefined &&
    input.description === undefined &&
    input.enabled === undefined &&
    input.permissions === undefined
  ) {
    throw new ApiError(422, "role_change_required", "At least one role field must change.");
  }
  if (principal.role.id === roleId) {
    return auditRoleDenial(context, roleId, "self_role_edit_denied");
  }
  if (before.protected === 1 || before.system === 1) {
    return auditRoleDenial(context, roleId, "system_role_edit_denied");
  }
  const beforePermissions = await permissionsForRole(context.env.DB, roleId);
  const permissions = input.permissions ?? beforePermissions;
  assertPermissionSubset(principal, permissions);
  if (input.enabled === false) {
    const dependencies = await roleDependencyCounts(context.env.DB, roleId);
    if (dependencies.identities > 0 || dependencies.pendingInvitations > 0) {
      return auditRoleDenial(context, roleId, "role_has_dependencies", { ...dependencies });
    }
  }
  const now = new Date().toISOString();
  const updated = await context.env.DB.prepare(
    `UPDATE admin_roles
          SET name = ?, description = ?, enabled = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      RETURNING id, key, name, description, protected, system, enabled, version,
                created_at, updated_at`,
  )
    .bind(
      input.name ?? before.name,
      input.description === undefined ? before.description : input.description,
      input.enabled === undefined ? before.enabled : input.enabled ? 1 : 0,
      now,
      roleId,
      input.expectedVersion,
    )
    .first<RoleRow>();
  if (!updated) {
    throw new ApiError(409, "stale_role_version", "The role was changed by another request.");
  }
  if (input.permissions) {
    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM admin_role_permissions WHERE role_id = ?").bind(roleId),
      ...permissions.map((permission) =>
        context.env.DB.prepare(
          `INSERT INTO admin_role_permissions (role_id, permission_key, created_at)
             VALUES (?, ?, ?)`,
        ).bind(roleId, permission, now),
      ),
    ]);
  }
  await recordAuditEvent(context.env.DB, {
    action: input.enabled === false ? "iam.roles.archive" : "iam.roles.update",
    actorId: principal.id,
    actorType: actorTypeForPrincipal(principal),
    id: crypto.randomUUID(),
    metadata: {
      after: { enabled: updated.enabled === 1, permissions, version: updated.version },
      before: {
        enabled: before.enabled === 1,
        permissions: beforePermissions,
        version: before.version,
      },
    },
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: roleId,
    targetType: "admin_role",
  });
  return { ...roleSummary(updated), description: updated.description, permissions };
}
