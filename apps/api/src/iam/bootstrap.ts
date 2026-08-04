import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import type { AccessIdentity, HumanAccessIdentity } from "./access-jwt";
import { prepareAuditEvent } from "./audit";
import { normalizeAdminEmail } from "./invitations";
import { prepareInvitationNotification } from "./invitation-notifications";

export function productionBootstrapConfirmation(databaseIdentity: string, email: string): string {
  return `BOOTSTRAP_PRODUCTION:${databaseIdentity}:${normalizeAdminEmail(email)}`;
}

function requireHuman(identity: AccessIdentity): HumanAccessIdentity {
  if (identity.principalKind !== "human") {
    throw new ApiError(
      403,
      "human_invitation_required",
      "Service identities cannot accept invitations.",
    );
  }
  return identity;
}

export async function acceptAdminInvitation(
  context: Context<ApiEnvironment>,
  accessIdentity: AccessIdentity,
): Promise<{ accepted: boolean; identityId: string }> {
  const identity = requireHuman(accessIdentity);
  const email = normalizeAdminEmail(identity.email);
  const existing = await context.env.DB.prepare(
    `SELECT id, enabled FROM admin_identities
        WHERE principal_kind = 'human' AND access_subject = ? AND normalized_email = ?`,
  )
    .bind(identity.subject, email)
    .first<{ enabled: number; id: string }>();
  if (existing?.enabled === 1) return { accepted: false, identityId: existing.id };
  const now = new Date().toISOString();
  const invitation = await context.env.DB.prepare(
    `SELECT invitation.id, invitation.display_name, invitation.role_id, invitation.version
         FROM admin_invitations invitation
         JOIN admin_roles role ON role.id = invitation.role_id
        WHERE invitation.normalized_email = ? AND invitation.status = 'pending'
          AND invitation.expires_at > ? AND role.enabled = 1`,
  )
    .bind(email, now)
    .first<{ display_name: string | null; id: string; role_id: string; version: number }>();
  if (!invitation) {
    const expired = await context.env.DB.prepare(
      `SELECT id FROM admin_invitations
          WHERE normalized_email = ?
            AND (status = 'expired' OR (status = 'pending' AND expires_at <= ?))
          LIMIT 1`,
    )
      .bind(email, now)
      .first<{ id: string }>();
    if (expired) {
      throw new ApiError(401, "invitation_expired", "Admin access is not active.");
    }
    throw new ApiError(
      401,
      "active_invitation_required",
      "No active invitation matches this identity.",
    );
  }
  const identityId = `identity_${crypto.randomUUID().replaceAll("-", "")}`;
  const displayName = invitation.display_name ?? email.split("@")[0] ?? "Administrator";
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO admin_identities
             (id, principal_kind, access_subject, normalized_email, display_name, role_id,
              enabled, version, last_seen_at, created_at, updated_at)
           VALUES (?, 'human', ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
      ).bind(identityId, identity.subject, email, displayName, invitation.role_id, now, now, now),
      context.env.DB.prepare(
        `UPDATE admin_invitations
              SET status = 'accepted', accepted_identity_id = ?, accepted_at = ?,
                  version = version + 1, updated_at = ?
            WHERE id = ? AND status = 'pending' AND expires_at > ? AND version = ?`,
      ).bind(identityId, now, now, invitation.id, now, invitation.version),
      prepareAuditEvent(context.env.DB, {
        action: "iam.invitations.accept",
        actorId: identityId,
        actorType: "admin",
        id: crypto.randomUUID(),
        metadata: {
          after: {
            roleId: invitation.role_id,
            status: "accepted",
            version: invitation.version + 1,
          },
          before: { roleId: invitation.role_id, status: "pending", version: invitation.version },
        },
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: invitation.id,
        targetType: "admin_invitation",
      }),
    ]);
  } catch {
    const winner = await context.env.DB.prepare(
      `SELECT id FROM admin_identities
          WHERE principal_kind = 'human' AND access_subject = ? AND normalized_email = ?
            AND enabled = 1`,
    )
      .bind(identity.subject, email)
      .first<{ id: string }>();
    if (winner) return { accepted: false, identityId: winner.id };
    throw new ApiError(
      409,
      "invitation_acceptance_conflict",
      "The invitation was already claimed.",
    );
  }
  return { accepted: true, identityId };
}

export async function bootstrapFirstAdmin(
  db: D1Database,
  input: {
    confirmation?: string;
    databaseIdentity: string;
    email: string;
    environment: "production" | "test";
  },
): Promise<{ invitationId: string; reused: boolean }> {
  const email = normalizeAdminEmail(input.email);
  if (!input.databaseIdentity.trim()) {
    throw new Error("An explicit database identity is required.");
  }
  if (
    input.environment === "production" &&
    input.confirmation !== productionBootstrapConfirmation(input.databaseIdentity, email)
  ) {
    throw new Error("Production bootstrap confirmation does not match the exact target.");
  }
  const enabledAdmin = await db
    .prepare(
      `SELECT identity.id FROM admin_identities identity
       JOIN admin_roles role ON role.id = identity.role_id
       WHERE identity.principal_kind = 'human' AND identity.enabled = 1
         AND role.protected = 1 AND role.enabled = 1 LIMIT 1`,
    )
    .first<{ id: string }>();
  if (enabledAdmin)
    throw new Error("Bootstrap refused: an enabled protected administrator exists.");
  const existing = await db
    .prepare(
      `SELECT invitation.id FROM admin_invitations invitation
       JOIN admin_roles role ON role.id = invitation.role_id
       WHERE invitation.normalized_email = ? AND invitation.status = 'pending'
         AND invitation.expires_at > ? AND role.protected = 1 LIMIT 1`,
    )
    .bind(email, new Date().toISOString())
    .first<{ id: string }>();
  if (existing) return { invitationId: existing.id, reused: true };
  const role = await db
    .prepare("SELECT id FROM admin_roles WHERE protected = 1 AND enabled = 1 LIMIT 1")
    .first<{ id: string }>();
  if (!role) throw new Error("Bootstrap refused: no enabled protected role exists.");
  const id = `inv_${crypto.randomUUID().replaceAll("-", "")}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO admin_invitations
           (id, normalized_email, display_name, role_id, status, idempotency_key,
            invited_by_id, expires_at, version, created_at, updated_at)
         VALUES (?, ?, NULL, ?, 'pending', ?, NULL, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        email,
        role.id,
        `bootstrap:${input.databaseIdentity}:${email}`,
        expiresAt,
        now,
        now,
      ),
    prepareInvitationNotification(db, { invitationId: id, invitationVersion: 1, now }),
    prepareAuditEvent(db, {
      action: "iam.bootstrap.invitation",
      actorType: "machine",
      id: crypto.randomUUID(),
      metadata: { databaseIdentity: input.databaseIdentity, environment: input.environment },
      result: "succeeded",
      targetId: id,
      targetType: "admin_invitation",
    }),
  ]);
  return { invitationId: id, reused: false };
}
