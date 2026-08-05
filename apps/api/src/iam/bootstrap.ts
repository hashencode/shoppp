import { prepareAuditEvent } from "./audit";
import { normalizeAdminEmail } from "./invitations";
import { prepareInvitationNotification } from "./invitation-notifications";

export function productionBootstrapConfirmation(databaseIdentity: string, email: string): string {
  return `BOOTSTRAP_PRODUCTION:${databaseIdentity}:${normalizeAdminEmail(email)}`;
}

const BOOTSTRAP_DATABASE_IDENTITIES = {
  production: "shoppp-production",
  test: "shoppp-staging",
} as const;

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
  const expectedDatabaseIdentity = BOOTSTRAP_DATABASE_IDENTITIES[input.environment];
  if (input.databaseIdentity !== expectedDatabaseIdentity) {
    throw new Error(
      `${input.environment} bootstrap must target ${expectedDatabaseIdentity}; received ${input.databaseIdentity}.`,
    );
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
