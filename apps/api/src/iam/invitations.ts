import type {
  AdminInvitation,
  CreateAdminInvitationRequest,
  ResendAdminInvitationRequest,
  RevokeAdminInvitationRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareConditionalAuditEvent, recordAuditEvent } from "./audit";
import { loadAssignableRole } from "./admin-roles";
import { prepareInvitationNotification } from "./invitation-notifications";
import { actorTypeForPrincipal } from "./permissions";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

interface InvitationRow {
  accepted_at: string | null;
  accepted_identity_id: string | null;
  created_at: string;
  delivery_attempt_count: number | null;
  delivery_last_error_code: string | null;
  delivery_status: "dead_letter" | "failed" | "pending" | "processing" | "sent" | null;
  display_name: string | null;
  expires_at: string;
  id: string;
  idempotency_key: string;
  normalized_email: string;
  revoked_at: string | null;
  role_enabled: number;
  role_id: string;
  role_key: string;
  role_name: string;
  role_protected: number;
  role_system: number;
  role_version: number;
  status: "pending" | "accepted" | "revoked" | "expired";
  updated_at: string;
  version: number;
}

const INVITATION_SELECT = `SELECT invitation.id, invitation.normalized_email,
  invitation.display_name, invitation.status, invitation.idempotency_key,
  invitation.expires_at, invitation.accepted_identity_id, invitation.accepted_at,
  invitation.revoked_at, invitation.version, invitation.created_at, invitation.updated_at,
  role.id AS role_id, role.key AS role_key, role.name AS role_name,
  role.protected AS role_protected, role.system AS role_system,
  role.enabled AS role_enabled, role.version AS role_version,
  delivery.status AS delivery_status, delivery.attempt_count AS delivery_attempt_count,
  delivery.last_error_code AS delivery_last_error_code
  FROM admin_invitations invitation
  JOIN admin_roles role ON role.id = invitation.role_id
  LEFT JOIN notification_jobs delivery ON delivery.id = (
    SELECT job.id FROM notification_jobs job
     WHERE job.type = 'admin_invitation'
       AND job.payload_json = json_object('invitationId', invitation.id)
     ORDER BY job.created_at DESC, job.rowid DESC
     LIMIT 1
  )`;

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

function effectiveStatus(row: InvitationRow, now: string): InvitationRow["status"] {
  return row.status === "pending" && row.expires_at <= now ? "expired" : row.status;
}

function dto(row: InvitationRow, now = new Date().toISOString()): AdminInvitation {
  return {
    acceptedAt: row.accepted_at,
    acceptedIdentityId: row.accepted_identity_id,
    createdAt: row.created_at,
    delivery: row.delivery_status
      ? {
          attemptCount: row.delivery_attempt_count ?? 0,
          lastErrorCode: row.delivery_last_error_code,
          status: row.delivery_status,
        }
      : null,
    displayName: row.display_name,
    email: row.normalized_email,
    expiresAt: row.expires_at,
    id: row.id,
    revokedAt: row.revoked_at,
    role: {
      enabled: row.role_enabled === 1,
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      protected: row.role_protected === 1,
      system: row.role_system === 1,
      version: row.role_version,
    },
    status: effectiveStatus(row, now),
    updatedAt: row.updated_at,
    version: row.version,
  };
}

async function findInvitation(db: D1Database, id: string): Promise<InvitationRow | null> {
  return db.prepare(`${INVITATION_SELECT} WHERE invitation.id = ?`).bind(id).first<InvitationRow>();
}

async function expirePendingInvitations(db: D1Database, now: string): Promise<void> {
  await db
    .prepare(
      `UPDATE admin_invitations
          SET status = 'expired', version = version + 1, updated_at = ?
        WHERE status = 'pending' AND expires_at <= ?`,
    )
    .bind(now, now)
    .run();
}

export async function listAdminInvitations(
  db: D1Database,
  input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    status?: InvitationRow["status"] | undefined;
  },
): Promise<{ items: AdminInvitation[]; page: number; pageSize: number; total: number }> {
  const now = new Date().toISOString();
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (input.status) {
    if (input.status === "pending") {
      clauses.push("invitation.status = 'pending' AND invitation.expires_at > ?");
      bindings.push(now);
    } else if (input.status === "expired") {
      clauses.push(
        "(invitation.status = 'expired' OR (invitation.status = 'pending' AND invitation.expires_at <= ?))",
      );
      bindings.push(now);
    } else {
      clauses.push("invitation.status = ?");
      bindings.push(input.status);
    }
  }
  if (input.search) {
    clauses.push(
      "(invitation.normalized_email LIKE ? OR lower(COALESCE(invitation.display_name, '')) LIKE ?)",
    );
    const search = `%${input.search.trim().toLowerCase()}%`;
    bindings.push(search, search);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [count, rows] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS count FROM admin_invitations invitation ${where}`)
      .bind(...bindings)
      .first<{ count: number }>(),
    db
      .prepare(
        `${INVITATION_SELECT} ${where}
         ORDER BY invitation.created_at DESC, invitation.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
      .all<InvitationRow>(),
  ]);
  return {
    items: rows.results.map((row) => dto(row, now)),
    page: input.page,
    pageSize: input.pageSize,
    total: count?.count ?? 0,
  };
}

export async function createAdminInvitation(
  context: Context<ApiEnvironment>,
  input: CreateAdminInvitationRequest,
): Promise<{ invitation: AdminInvitation; reused: boolean }> {
  const principal = context.get("principal");
  const email = normalizeAdminEmail(input.email);
  await loadAssignableRole(context, input.roleId, {
    action: "iam.invitations.create",
    type: "admin_invitation",
  });
  const now = new Date().toISOString();
  await expirePendingInvitations(context.env.DB, now);
  const existingIdentity = await context.env.DB.prepare(
    `SELECT id FROM admin_identities
        WHERE principal_kind = 'human' AND normalized_email = ?`,
  )
    .bind(email)
    .first<{ id: string }>();
  if (existingIdentity) {
    throw new ApiError(409, "admin_user_exists", "A user already exists for this email.");
  }
  const byKey = await context.env.DB.prepare(
    `${INVITATION_SELECT} WHERE invitation.idempotency_key = ?`,
  )
    .bind(input.idempotencyKey)
    .first<InvitationRow>();
  if (byKey) {
    if (
      byKey.normalized_email !== email ||
      byKey.role_id !== input.roleId ||
      byKey.display_name !== (input.displayName ?? null)
    ) {
      throw new ApiError(
        409,
        "invitation_idempotency_mismatch",
        "The idempotency key was used for another invitation.",
      );
    }
    return { invitation: dto(byKey, now), reused: true };
  }
  const active = await context.env.DB.prepare(
    `${INVITATION_SELECT}
       WHERE invitation.normalized_email = ? AND invitation.status = 'pending'`,
  )
    .bind(email)
    .first<InvitationRow>();
  if (active) {
    if (active.role_id !== input.roleId) {
      throw new ApiError(
        409,
        "active_invitation_conflict",
        "An active invitation already exists for this email and another role.",
      );
    }
    return { invitation: dto(active, now), reused: true };
  }
  const id = `inv_${crypto.randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(new Date(now).getTime() + INVITATION_TTL_MS).toISOString();
  const createdInvitationCondition = {
    bindings: [id],
    sql: "SELECT 1 FROM admin_invitations WHERE id = ? AND status = 'pending'",
  } as const;
  let insertResult: D1Result<unknown> | undefined;
  try {
    [insertResult] = await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO admin_invitations
             (id, normalized_email, display_name, role_id, status, idempotency_key,
              invited_by_id, expires_at, version, created_at, updated_at)
           SELECT ?, ?, ?, ?, 'pending', ?, ?, ?, 1, ?, ?
            WHERE EXISTS (SELECT 1 FROM admin_roles WHERE id = ? AND enabled = 1)`,
      ).bind(
        id,
        email,
        input.displayName ?? null,
        input.roleId,
        input.idempotencyKey,
        principal.id,
        expiresAt,
        now,
        now,
        input.roleId,
      ),
      prepareInvitationNotification(context.env.DB, {
        condition: createdInvitationCondition,
        invitationId: id,
        invitationVersion: 1,
        now,
      }),
      prepareConditionalAuditEvent(
        context.env.DB,
        {
          action: "iam.invitations.create",
          actorId: principal.id,
          actorType: actorTypeForPrincipal(principal),
          id: crypto.randomUUID(),
          metadata: { after: { roleId: input.roleId, status: "pending", version: 1 } },
          requestId: context.get("requestId"),
          result: "succeeded",
          targetId: id,
          targetType: "admin_invitation",
        },
        createdInvitationCondition,
      ),
    ]);
  } catch (error) {
    if (!String(error).includes("UNIQUE constraint")) throw error;
    const winner = await context.env.DB.prepare(
      `${INVITATION_SELECT}
         WHERE invitation.normalized_email = ? AND invitation.status = 'pending'`,
    )
      .bind(email)
      .first<InvitationRow>();
    if (winner?.role_id === input.roleId) {
      return { invitation: dto(winner, now), reused: true };
    }
    throw new ApiError(409, "active_invitation_conflict", "An active invitation already exists.");
  }
  if (insertResult?.meta.changes !== 1) {
    await recordAuditEvent(context.env.DB, {
      action: "iam.invitations.create",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { code: "role_unavailable", roleId: input.roleId },
      reason: "role_unavailable",
      requestId: context.get("requestId"),
      result: "denied",
      targetType: "admin_invitation",
    });
    throw new ApiError(409, "role_unavailable", "The selected role is not enabled.");
  }
  const created = await findInvitation(context.env.DB, id);
  if (!created) throw new ApiError(500, "invitation_create_failed", "Invitation creation failed.");
  return { invitation: dto(created, now), reused: false };
}

export async function resendAdminInvitation(
  context: Context<ApiEnvironment>,
  id: string,
  input: ResendAdminInvitationRequest,
): Promise<AdminInvitation> {
  const principal = context.get("principal");
  const before = await findInvitation(context.env.DB, id);
  if (!before) throw new ApiError(404, "invitation_not_found", "The invitation was not found.");
  const now = new Date().toISOString();
  if (effectiveStatus(before, now) !== "pending") {
    throw new ApiError(409, "invitation_not_pending", "Only an active invitation can be resent.");
  }
  const existingJob = await context.env.DB.prepare(
    "SELECT id FROM notification_jobs WHERE deduplication_key = ?",
  )
    .bind(`admin-invitation-resend:${id}:${input.idempotencyKey}`)
    .first<{ id: string }>();
  if (existingJob) return dto(before, now);
  const nextVersion = input.expectedVersion + 1;
  const committedInvitationCondition = {
    bindings: [id, nextVersion, now],
    sql: "SELECT 1 FROM admin_invitations WHERE id = ? AND status = 'pending' AND version = ? AND updated_at = ?",
  } as const;
  const [updateResult] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_invitations SET version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'pending' AND expires_at > ? AND version = ?`,
    ).bind(now, id, now, input.expectedVersion),
    prepareInvitationNotification(context.env.DB, {
      condition: committedInvitationCondition,
      invitationId: id,
      invitationVersion: nextVersion,
      now,
    }),
    context.env.DB.prepare(
      `UPDATE notification_jobs SET deduplication_key = ?
          WHERE deduplication_key = ? AND EXISTS (${committedInvitationCondition.sql})`,
    ).bind(
      `admin-invitation-resend:${id}:${input.idempotencyKey}`,
      `admin-invitation:${id}:v${nextVersion}`,
      ...committedInvitationCondition.bindings,
    ),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "iam.invitations.resend",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: {
          after: { status: "pending", version: nextVersion },
          before: { status: "pending", version: before.version },
        },
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "admin_invitation",
      },
      committedInvitationCondition,
    ),
  ]);
  if (updateResult?.meta.changes !== 1) {
    throw new ApiError(409, "stale_invitation_version", "The invitation was changed.");
  }
  const after = await findInvitation(context.env.DB, id);
  if (!after) throw new ApiError(500, "invitation_resend_failed", "Invitation resend failed.");
  return dto(after, now);
}

export async function revokeAdminInvitation(
  context: Context<ApiEnvironment>,
  id: string,
  input: RevokeAdminInvitationRequest,
): Promise<AdminInvitation> {
  const principal = context.get("principal");
  const now = new Date().toISOString();
  const nextVersion = input.expectedVersion + 1;
  const [updateResult] = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_invitations
          SET status = 'revoked', revoked_at = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'pending' AND expires_at > ? AND version = ?`,
    ).bind(now, now, id, now, input.expectedVersion),
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "iam.invitations.revoke",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: {
          after: { status: "revoked", version: nextVersion },
          before: { status: "pending", version: input.expectedVersion },
        },
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "admin_invitation",
      },
      {
        bindings: [id, nextVersion, now],
        sql: "SELECT 1 FROM admin_invitations WHERE id = ? AND status = 'revoked' AND version = ? AND updated_at = ?",
      },
    ),
  ]);
  if (updateResult?.meta.changes !== 1) {
    const current = await findInvitation(context.env.DB, id);
    if (!current) throw new ApiError(404, "invitation_not_found", "The invitation was not found.");
    throw new ApiError(409, "stale_invitation_version", "The invitation is no longer active.");
  }
  const after = await findInvitation(context.env.DB, id);
  if (!after) throw new ApiError(500, "invitation_revoke_failed", "Invitation revoke failed.");
  return dto(after, now);
}
