import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type {
  AdminAccountActivationRequest,
  AdminPasswordChangeRequest,
  AdminPasswordLoginRequest,
  AdminPasswordResetConfirmRequest,
  AdminPasswordResetRequest,
} from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { ADMIN_SESSION_COOKIE, resolvePrincipalById } from "../middleware/auth";
import { prepareConditionalAuditEvent, recordAuditEvent } from "./audit";
import {
  createSignedResetToken,
  hashOpaqueToken,
  hashPassword,
  randomOpaqueToken,
  verifySignedToken,
  verifyPassword,
} from "./passwords";
import type { Principal } from "./permissions";

type ApiContext = Context<ApiEnvironment>;

const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const RESET_DURATION_SECONDS = 30 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_BLOCK_SECONDS = 15 * 60;
const MAX_LOGIN_FAILURES = 5;
const MAX_IP_LOGIN_FAILURES = 25;
const AUTH_STATE_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const THROTTLE_RETENTION_SECONDS = 24 * 60 * 60;

interface CredentialRow {
  readonly enabled: number;
  readonly identity_id: string;
  readonly password_hash: string;
  readonly password_iterations: number;
  readonly password_salt: string;
  readonly password_version: number;
  readonly principal_kind: string;
  readonly role_enabled: number;
  readonly role_protected: number;
}

interface PasswordResetResult {
  readonly resetToken?: string;
}

interface ResetCandidateRow {
  readonly enabled: number;
  readonly identity_id: string;
  readonly password_version: number | null;
  readonly role_enabled: number;
  readonly role_protected: number;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

export async function cleanupExpiredAdminAuthState(
  db: D1Database,
  now = new Date(),
): Promise<void> {
  const authCutoff = addSeconds(now, -AUTH_STATE_RETENTION_SECONDS);
  const throttleCutoff = addSeconds(now, -THROTTLE_RETENTION_SECONDS);
  await db.batch([
    db
      .prepare(
        `DELETE FROM admin_login_throttles
          WHERE rowid IN (
            SELECT rowid FROM admin_login_throttles
             WHERE updated_at < ? ORDER BY updated_at LIMIT 100
          )`,
      )
      .bind(throttleCutoff),
    db
      .prepare(
        `DELETE FROM admin_sessions
          WHERE rowid IN (
            SELECT rowid FROM admin_sessions
             WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
             ORDER BY expires_at LIMIT 100
          )`,
      )
      .bind(authCutoff, authCutoff),
    db
      .prepare(
        `DELETE FROM admin_password_reset_tokens
          WHERE rowid IN (
            SELECT rowid FROM admin_password_reset_tokens
             WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)
             ORDER BY expires_at LIMIT 100
          )`,
      )
      .bind(authCutoff, authCutoff),
  ]);
}

function setSessionCookie(context: ApiContext, token: string): void {
  const origin = context.req.header("Origin");
  const localDevelopment =
    context.env.ENVIRONMENT !== "production" &&
    Boolean(context.env.ADMIN_DEVELOPMENT_ORIGIN) &&
    origin === context.env.ADMIN_DEVELOPMENT_ORIGIN;
  setCookie(context, ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "Strict",
    secure: !localDevelopment && new URL(context.req.url).protocol === "https:",
  });
}

function clearSessionCookie(context: ApiContext): void {
  const origin = context.req.header("Origin");
  const localDevelopment =
    context.env.ENVIRONMENT !== "production" &&
    Boolean(context.env.ADMIN_DEVELOPMENT_ORIGIN) &&
    origin === context.env.ADMIN_DEVELOPMENT_ORIGIN;
  deleteCookie(context, ADMIN_SESSION_COOKIE, {
    path: "/",
    secure: !localDevelopment && new URL(context.req.url).protocol === "https:",
  });
}

async function throttleKeys(
  context: ApiContext,
  email: string,
): Promise<{ account: string; address: string }> {
  const address = context.req.header("CF-Connecting-IP")?.trim() || "unknown";
  return {
    account: await hashOpaqueToken(`account\n${email}\n${address}`),
    address: await hashOpaqueToken(`address\n${address}`),
  };
}

async function resetThrottleKey(context: ApiContext, email: string): Promise<string> {
  const address = context.req.header("CF-Connecting-IP")?.trim() || "unknown";
  return hashOpaqueToken(`reset\n${email}\n${address}`);
}

async function reserveLoginAttempt(
  context: ApiContext,
  keyHash: string,
  maxFailures: number,
  now: Date,
): Promise<void> {
  const nowIso = now.toISOString();
  const cutoff = addSeconds(now, -LOGIN_WINDOW_SECONDS);
  const throttle = await context.env.DB.prepare(
    `INSERT INTO admin_login_throttles
       (key_hash, failure_count, window_started_at, blocked_until, updated_at)
     VALUES (?, 1, ?, NULL, ?)
     ON CONFLICT(key_hash) DO UPDATE SET
       failure_count = CASE
         WHEN admin_login_throttles.window_started_at <= ? THEN 1
         ELSE admin_login_throttles.failure_count + 1
       END,
       window_started_at = CASE
         WHEN admin_login_throttles.window_started_at <= ? THEN excluded.window_started_at
         ELSE admin_login_throttles.window_started_at
       END,
       blocked_until = CASE
         WHEN admin_login_throttles.blocked_until > excluded.updated_at
           THEN admin_login_throttles.blocked_until
         WHEN admin_login_throttles.window_started_at <= ? THEN NULL
         WHEN admin_login_throttles.failure_count + 1 > ? THEN ?
         ELSE NULL
       END,
       updated_at = excluded.updated_at
     RETURNING blocked_until`,
  )
    .bind(
      keyHash,
      nowIso,
      nowIso,
      cutoff,
      cutoff,
      cutoff,
      maxFailures,
      addSeconds(now, LOGIN_BLOCK_SECONDS),
    )
    .first<{ blocked_until: string | null }>();
  if (throttle?.blocked_until && throttle.blocked_until > nowIso) {
    throw new ApiError(429, "admin_login_throttled", "Too many login attempts. Try again later.");
  }
}

async function prepareSession(
  db: D1Database,
  identityId: string,
  passwordVersion: number,
  now: Date,
  condition?: { bindings: readonly unknown[]; sql: string },
): Promise<{ statement: D1PreparedStatement; token: string }> {
  const token = randomOpaqueToken();
  const statement = db
    .prepare(
      `INSERT INTO admin_sessions
       (id, identity_id, token_hash, password_version, expires_at, last_seen_at, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     ${condition ? `WHERE EXISTS (${condition.sql})` : ""}`,
    )
    .bind(
      `session_${crypto.randomUUID()}`,
      identityId,
      await hashOpaqueToken(token),
      passwordVersion,
      addSeconds(now, SESSION_DURATION_SECONDS),
      now.toISOString(),
      now.toISOString(),
      ...(condition?.bindings ?? []),
    );
  return { statement, token };
}

async function credentialForEmail(db: D1Database, email: string): Promise<CredentialRow | null> {
  return db
    .prepare(
      `SELECT identity.id AS identity_id, identity.principal_kind, identity.enabled,
              role.enabled AS role_enabled, role.protected AS role_protected,
              credential.password_hash, credential.password_salt,
              credential.password_iterations, credential.password_version
         FROM admin_identities identity
         JOIN admin_roles role ON role.id = identity.role_id
         JOIN admin_password_credentials credential ON credential.identity_id = identity.id
        WHERE identity.principal_kind = 'human' AND identity.normalized_email = ?`,
    )
    .bind(email)
    .first<CredentialRow>();
}

async function resetCandidateForEmail(
  db: D1Database,
  email: string,
): Promise<ResetCandidateRow | null> {
  return db
    .prepare(
      `SELECT identity.id AS identity_id, identity.enabled,
              role.enabled AS role_enabled, role.protected AS role_protected,
              credential.password_version
         FROM admin_identities identity
         JOIN admin_roles role ON role.id = identity.role_id
         LEFT JOIN admin_password_credentials credential ON credential.identity_id = identity.id
        WHERE identity.principal_kind = 'human' AND identity.normalized_email = ?`,
    )
    .bind(email)
    .first<ResetCandidateRow>();
}

export async function loginWithPassword(
  context: ApiContext,
  input: AdminPasswordLoginRequest,
): Promise<Principal> {
  const email = normalizedEmail(input.email);
  const now = new Date();
  const keys = await throttleKeys(context, email);
  await reserveLoginAttempt(context, keys.address, MAX_IP_LOGIN_FAILURES, now);
  await reserveLoginAttempt(context, keys.account, MAX_LOGIN_FAILURES, now);
  const credential = await credentialForEmail(context.env.DB, email);
  const passwordValid = credential
    ? await verifyPassword(input.password, {
        hash: credential.password_hash,
        iterations: credential.password_iterations,
        salt: credential.password_salt,
      })
    : Boolean(
        await hashPassword(input.password, {
          iterations: 210_000,
          salt: "AAAAAAAAAAAAAAAAAAAAAA",
        }),
      ) && false;
  if (
    !credential ||
    !passwordValid ||
    credential.enabled !== 1 ||
    credential.role_enabled !== 1 ||
    credential.principal_kind !== "human"
  ) {
    await recordAuditEvent(context.env.DB, {
      action: "iam.password.login",
      ...(credential ? { actorId: credential.identity_id } : {}),
      actorType: "admin",
      id: crypto.randomUUID(),
      reason: "invalid_credentials_or_disabled_identity",
      requestId: context.get("requestId"),
      result: "denied",
      targetType: "admin_session",
    });
    throw new ApiError(401, "invalid_admin_credentials", "The email or password is incorrect.");
  }
  const principal = await resolvePrincipalById(context, credential.identity_id);
  if (!principal || principal.principalKind !== "human") {
    throw new ApiError(401, "invalid_admin_credentials", "The email or password is incorrect.");
  }
  const currentCredential = {
    bindings: [credential.identity_id, credential.password_version],
    sql: `SELECT 1 FROM admin_password_credentials
           WHERE identity_id = ? AND password_version = ?`,
  } as const;
  const session = await prepareSession(
    context.env.DB,
    credential.identity_id,
    credential.password_version,
    now,
    currentCredential,
  );
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `DELETE FROM admin_login_throttles
          WHERE key_hash = ? AND EXISTS (${currentCredential.sql})`,
    ).bind(keys.account, ...currentCredential.bindings),
    session.statement,
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "iam.password.login",
        actorId: credential.identity_id,
        actorType: "admin",
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetType: "admin_session",
      },
      currentCredential,
    ),
  ]);
  if ((results[1]?.meta.changes ?? 0) !== 1) {
    throw new ApiError(401, "invalid_admin_credentials", "The email or password is incorrect.");
  }
  setSessionCookie(context, session.token);
  return principal;
}

export async function activateAdminAccount(
  context: ApiContext,
  input: AdminAccountActivationRequest,
  secret: string,
): Promise<Principal> {
  const claims = await verifySignedToken(secret, input.token);
  const now = new Date();
  if (
    !claims ||
    claims.p !== "account_activation" ||
    typeof claims.n !== "string" ||
    typeof claims.e !== "string" ||
    !Number.isInteger(claims.v) ||
    claims.e <= now.toISOString()
  ) {
    throw new ApiError(
      400,
      "account_activation_invalid",
      "The account activation link is invalid.",
    );
  }
  const invitation = await context.env.DB.prepare(
    `SELECT invitation.id, invitation.normalized_email, invitation.display_name,
            invitation.role_id, invitation.version, invitation.expires_at
       FROM admin_invitations invitation
       JOIN admin_roles role ON role.id = invitation.role_id
      WHERE invitation.id = ? AND invitation.status = 'pending'
        AND invitation.version = ? AND invitation.expires_at = ?
        AND invitation.expires_at > ? AND role.enabled = 1`,
  )
    .bind(claims.n, claims.v, claims.e, now.toISOString())
    .first<{
      display_name: string | null;
      expires_at: string;
      id: string;
      normalized_email: string;
      role_id: string;
      version: number;
    }>();
  if (!invitation) {
    throw new ApiError(
      400,
      "account_activation_invalid",
      "The account activation link is invalid.",
    );
  }
  const password = await hashPassword(input.password);
  const identityId = `identity_${crypto.randomUUID()}`;
  const session = await prepareSession(context.env.DB, identityId, 1, now);
  const displayName =
    invitation.display_name ?? invitation.normalized_email.split("@")[0] ?? "Administrator";
  try {
    const results = await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO admin_identities
             (id, principal_kind, access_subject, normalized_email, display_name, role_id,
              enabled, version, created_at, updated_at)
           SELECT ?, 'human', ?, invitation.normalized_email, ?, invitation.role_id,
                  1, 1, ?, ?
             FROM admin_invitations invitation
             JOIN admin_roles role ON role.id = invitation.role_id
            WHERE invitation.id = ? AND invitation.status = 'pending'
              AND invitation.version = ? AND invitation.expires_at > ? AND role.enabled = 1`,
      ).bind(
        identityId,
        `password:${invitation.normalized_email}`,
        displayName,
        now.toISOString(),
        now.toISOString(),
        invitation.id,
        invitation.version,
        now.toISOString(),
      ),
      context.env.DB.prepare(
        `INSERT INTO admin_password_credentials
             (identity_id, password_hash, password_salt, password_iterations, password_version,
              must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, 0, ?, ?)`,
      ).bind(
        identityId,
        password.hash,
        password.salt,
        password.iterations,
        now.toISOString(),
        now.toISOString(),
      ),
      context.env.DB.prepare(
        `UPDATE admin_invitations
              SET status = 'accepted', accepted_identity_id = ?, accepted_at = ?,
                  version = version + 1, updated_at = ?
            WHERE id = ? AND status = 'pending' AND version = ? AND expires_at > ?`,
      ).bind(
        identityId,
        now.toISOString(),
        now.toISOString(),
        invitation.id,
        invitation.version,
        now.toISOString(),
      ),
      context.env.DB.prepare(
        `INSERT INTO audit_events
           (id, actor_type, actor_id, action, target_type, target_id, result,
            reason, request_id, metadata_json, created_at)
         VALUES (?, 'admin', ?, 'iam.invitations.accept', 'admin_invitation', ?,
                 'succeeded', NULL, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        identityId,
        invitation.id,
        context.get("requestId"),
        JSON.stringify({ authentication: "password", roleId: invitation.role_id }),
        now.toISOString(),
      ),
      session.statement,
    ]);
    const identityInsert = results[0];
    const invitationUpdate = results[2];
    if (
      !identityInsert ||
      !invitationUpdate ||
      (identityInsert.meta.changes ?? 0) < 1 ||
      (invitationUpdate.meta.changes ?? 0) < 1
    ) {
      throw new Error("activation_conflict");
    }
  } catch (error) {
    const state = await context.env.DB.prepare(
      `SELECT invitation.status, invitation.version,
              EXISTS(
                SELECT 1 FROM admin_identities identity
                 WHERE identity.normalized_email = invitation.normalized_email
              ) AS identity_exists
         FROM admin_invitations invitation WHERE invitation.id = ?`,
    )
      .bind(invitation.id)
      .first<{ identity_exists: number; status: string; version: number }>();
    if (
      !state ||
      state.status !== "pending" ||
      state.version !== invitation.version ||
      state.identity_exists === 1
    ) {
      throw new ApiError(409, "account_activation_conflict", "The invitation was already used.");
    }
    throw error;
  }
  const principal = await resolvePrincipalById(context, identityId);
  if (!principal || principal.principalKind !== "human") {
    throw new ApiError(500, "account_activation_failed", "Account activation failed.");
  }
  setSessionCookie(context, session.token);
  return principal;
}

export async function logoutPasswordSession(context: ApiContext): Promise<void> {
  const token = getCookie(context, ADMIN_SESSION_COOKIE);
  if (token) {
    await context.env.DB.prepare(
      "UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    )
      .bind(new Date().toISOString(), await hashOpaqueToken(token))
      .run();
  }
  clearSessionCookie(context);
}

export async function requestPasswordReset(
  context: ApiContext,
  input: AdminPasswordResetRequest,
  options: { exposeToken?: boolean; secret: string },
): Promise<PasswordResetResult> {
  const email = normalizedEmail(input.email);
  try {
    await reserveLoginAttempt(context, await resetThrottleKey(context, email), 1, new Date());
  } catch (error) {
    if (error instanceof ApiError && error.code === "admin_login_throttled") return {};
    throw error;
  }
  let candidate = await resetCandidateForEmail(context.env.DB, email);
  if (!candidate || candidate.enabled !== 1 || candidate.role_enabled !== 1) return {};
  if (candidate.role_protected === 1) {
    await recordAuditEvent(context.env.DB, {
      action: "iam.password.reset.request",
      actorId: candidate.identity_id,
      actorType: "admin",
      id: crypto.randomUUID(),
      reason: "protected_admin_online_reset_forbidden",
      requestId: context.get("requestId"),
      result: "denied",
      targetId: candidate.identity_id,
      targetType: "admin_identity",
    });
    throw new ApiError(
      403,
      "protected_admin_password_reset_denied",
      "Protected administrators cannot reset their password online.",
    );
  }
  if (candidate.password_version === null) {
    const placeholder = await hashPassword(randomOpaqueToken());
    const createdAt = new Date().toISOString();
    await context.env.DB.prepare(
      `INSERT OR IGNORE INTO admin_password_credentials
         (identity_id, password_hash, password_salt, password_iterations, password_version,
          must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
    )
      .bind(
        candidate.identity_id,
        placeholder.hash,
        placeholder.salt,
        placeholder.iterations,
        createdAt,
        createdAt,
      )
      .run();
    candidate = await resetCandidateForEmail(context.env.DB, email);
  }
  if (!candidate || candidate.password_version === null) {
    throw new ApiError(
      500,
      "admin_credential_create_failed",
      "Administrator credential setup failed.",
    );
  }
  const now = new Date();
  const resetId = `reset_${crypto.randomUUID()}`;
  const expiresAt = addSeconds(now, RESET_DURATION_SECONDS);
  const token = await createSignedResetToken(options.secret, {
    expiresAt,
    identityId: candidate.identity_id,
    passwordVersion: candidate.password_version,
    resetId,
  });
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_password_reset_tokens SET used_at = ?
          WHERE identity_id = ? AND used_at IS NULL`,
    ).bind(now.toISOString(), candidate.identity_id),
    context.env.DB.prepare(
      `INSERT INTO admin_password_reset_tokens
           (id, identity_id, token_hash, password_version, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      resetId,
      candidate.identity_id,
      await hashOpaqueToken(token),
      candidate.password_version,
      expiresAt,
      now.toISOString(),
    ),
    context.env.DB.prepare(
      `INSERT INTO notification_jobs
           (id, order_id, type, deduplication_key, payload_json, status,
            attempt_count, max_attempts, created_at, updated_at)
         VALUES (?, NULL, 'admin_password_reset', ?, ?, 'pending', 0, 3, ?, ?)`,
    ).bind(
      `notify_${resetId}`,
      `admin-password-reset:${resetId}`,
      JSON.stringify({ resetId }),
      now.toISOString(),
      now.toISOString(),
    ),
    context.env.DB.prepare(
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result,
          reason, request_id, metadata_json, created_at)
       VALUES (?, 'admin', ?, 'iam.password.reset.request', 'admin_identity', ?,
               'succeeded', NULL, ?, '{}', ?)`,
    ).bind(
      crypto.randomUUID(),
      candidate.identity_id,
      candidate.identity_id,
      context.get("requestId"),
      now.toISOString(),
    ),
  ]);
  return options.exposeToken ? { resetToken: token } : {};
}

export async function confirmPasswordReset(
  context: ApiContext,
  input: AdminPasswordResetConfirmRequest,
): Promise<void> {
  const tokenHash = await hashOpaqueToken(input.token);
  const now = new Date();
  const reset = await context.env.DB.prepare(
    `SELECT reset.id, reset.identity_id, reset.password_version,
            credential.password_version AS current_password_version, role.protected
       FROM admin_password_reset_tokens reset
       JOIN admin_password_credentials credential ON credential.identity_id = reset.identity_id
       JOIN admin_identities identity ON identity.id = reset.identity_id
       JOIN admin_roles role ON role.id = identity.role_id
      WHERE reset.token_hash = ? AND reset.used_at IS NULL AND reset.expires_at > ?`,
  )
    .bind(tokenHash, now.toISOString())
    .first<{
      current_password_version: number;
      id: string;
      identity_id: string;
      password_version: number;
      protected: number;
    }>();
  if (
    !reset ||
    reset.protected === 1 ||
    reset.password_version !== reset.current_password_version
  ) {
    throw new ApiError(400, "password_reset_token_invalid", "The password reset link is invalid.");
  }
  const password = await hashPassword(input.newPassword);
  const nextVersion = reset.password_version + 1;
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_password_credentials
            SET password_hash = ?, password_salt = ?, password_iterations = ?,
                password_version = ?, must_change_password = 0, updated_at = ?
          WHERE identity_id = ? AND password_version = ?`,
    ).bind(
      password.hash,
      password.salt,
      password.iterations,
      nextVersion,
      now.toISOString(),
      reset.identity_id,
      reset.password_version,
    ),
    context.env.DB.prepare(
      `UPDATE admin_password_reset_tokens SET used_at = ?
         WHERE identity_id = ? AND used_at IS NULL
           AND EXISTS (
             SELECT 1 FROM admin_password_credentials credential
              WHERE credential.identity_id = ? AND credential.password_hash = ?
                AND credential.password_version = ?
           )`,
    ).bind(now.toISOString(), reset.identity_id, reset.identity_id, password.hash, nextVersion),
    context.env.DB.prepare(
      `UPDATE admin_sessions SET revoked_at = ?
         WHERE identity_id = ? AND revoked_at IS NULL
           AND EXISTS (
             SELECT 1 FROM admin_password_credentials credential
              WHERE credential.identity_id = ? AND credential.password_hash = ?
                AND credential.password_version = ?
           )`,
    ).bind(now.toISOString(), reset.identity_id, reset.identity_id, password.hash, nextVersion),
    context.env.DB.prepare(
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result,
          reason, request_id, metadata_json, created_at)
       SELECT ?, 'admin', ?, 'iam.password.reset.complete', 'admin_identity', ?,
              'succeeded', NULL, ?, '{}', ?
        WHERE EXISTS (
          SELECT 1 FROM admin_password_credentials credential
           WHERE credential.identity_id = ? AND credential.password_hash = ?
             AND credential.password_version = ?
        )`,
    ).bind(
      crypto.randomUUID(),
      reset.identity_id,
      reset.identity_id,
      context.get("requestId"),
      now.toISOString(),
      reset.identity_id,
      password.hash,
      nextVersion,
    ),
  ]);
  const credentialUpdate = results[0];
  if (!credentialUpdate || (credentialUpdate.meta.changes ?? 0) !== 1) {
    throw new ApiError(400, "password_reset_token_invalid", "The password reset link is invalid.");
  }
}

export async function changePassword(
  context: ApiContext,
  input: AdminPasswordChangeRequest,
): Promise<void> {
  const principal = context.get("principal");
  if (principal.principalKind !== "human") {
    throw new ApiError(403, "human_password_required", "Service principals do not have passwords.");
  }
  const credential = await context.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations, password_version
       FROM admin_password_credentials WHERE identity_id = ?`,
  )
    .bind(principal.id)
    .first<{
      password_hash: string;
      password_iterations: number;
      password_salt: string;
      password_version: number;
    }>();
  if (
    !credential ||
    !(await verifyPassword(input.currentPassword, {
      hash: credential.password_hash,
      iterations: credential.password_iterations,
      salt: credential.password_salt,
    }))
  ) {
    await recordAuditEvent(context.env.DB, {
      action: "iam.password.change",
      actorId: principal.id,
      actorType: "admin",
      id: crypto.randomUUID(),
      reason: "current_password_invalid",
      requestId: context.get("requestId"),
      result: "denied",
      targetId: principal.id,
      targetType: "admin_identity",
    });
    throw new ApiError(401, "current_password_invalid", "The current password is incorrect.");
  }
  const now = new Date();
  const password = await hashPassword(input.newPassword);
  const nextVersion = credential.password_version + 1;
  const committedCredential = {
    bindings: [principal.id, password.hash, nextVersion],
    sql: `SELECT 1 FROM admin_password_credentials credential
           WHERE credential.identity_id = ? AND credential.password_hash = ?
             AND credential.password_version = ?`,
  } as const;
  const session = await prepareSession(
    context.env.DB,
    principal.id,
    nextVersion,
    now,
    committedCredential,
  );
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE admin_password_credentials
            SET password_hash = ?, password_salt = ?, password_iterations = ?,
                password_version = ?, must_change_password = 0, updated_at = ?
          WHERE identity_id = ? AND password_version = ?`,
    ).bind(
      password.hash,
      password.salt,
      password.iterations,
      nextVersion,
      now.toISOString(),
      principal.id,
      credential.password_version,
    ),
    context.env.DB.prepare(
      `UPDATE admin_sessions SET revoked_at = ?
         WHERE identity_id = ? AND revoked_at IS NULL
           AND EXISTS (${committedCredential.sql})`,
    ).bind(now.toISOString(), principal.id, ...committedCredential.bindings),
    session.statement,
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: "iam.password.change",
        actorId: principal.id,
        actorType: "admin",
        id: crypto.randomUUID(),
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: principal.id,
        targetType: "admin_identity",
      },
      committedCredential,
    ),
  ]);
  const credentialUpdate = results[0];
  if (!credentialUpdate || (credentialUpdate.meta.changes ?? 0) !== 1) {
    await recordAuditEvent(context.env.DB, {
      action: "iam.password.change",
      actorId: principal.id,
      actorType: "admin",
      id: crypto.randomUUID(),
      reason: "password_version_conflict",
      requestId: context.get("requestId"),
      result: "failed",
      targetId: principal.id,
      targetType: "admin_identity",
    });
    throw new ApiError(
      409,
      "password_change_conflict",
      "The password changed in another session. Sign in again.",
    );
  }
  if ((results[2]?.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, "password_change_conflict", "The password changed. Sign in again.");
  }
  setSessionCookie(context, session.token);
}
