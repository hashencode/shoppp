export function prepareInvitationNotification(
  db: D1Database,
  input: { invitationId: string; invitationVersion: number; now: string },
): D1PreparedStatement {
  const jobId = `notify_invitation_${crypto.randomUUID().replaceAll("-", "")}`;
  return db
    .prepare(
      `INSERT INTO notification_jobs
         (id, order_id, type, deduplication_key, payload_json, status,
          attempt_count, max_attempts, created_at, updated_at)
       VALUES (?, NULL, 'admin_invitation', ?, ?, 'pending', 0, 3, ?, ?)`,
    )
    .bind(
      jobId,
      `admin-invitation:${input.invitationId}:v${input.invitationVersion}`,
      JSON.stringify({ invitationId: input.invitationId }),
      input.now,
      input.now,
    );
}
