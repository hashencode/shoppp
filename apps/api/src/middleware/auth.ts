import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { isAdminIdentityExpired } from "../iam/identity-expiry";
import type { Principal } from "../iam/permissions";
import { hashOpaqueToken } from "../iam/passwords";
import { safeRequestPath } from "../security/redaction";

export type AdminIdentityClaim =
  | { readonly email: string; readonly principalKind: "human"; readonly subject: string }
  | {
      readonly principalKind: "service";
      readonly serviceName: string;
      readonly subject: string;
    };

export type TestIdentityVerifier = (token: string) => Promise<AdminIdentityClaim>;

interface PrincipalRow {
  readonly access_subject: string;
  readonly display_name: string;
  readonly enabled: number;
  readonly expires_at: string | null;
  readonly id: string;
  readonly normalized_email: string | null;
  readonly principal_kind: string;
  readonly role_enabled: number;
  readonly role_id: string;
  readonly role_key: string;
  readonly role_name: string;
  readonly role_protected: number;
  readonly role_system: number;
  readonly role_version: number;
}

const registeredPermissions = new Set<string>(ADMIN_PERMISSION_KEYS);
export const ADMIN_SESSION_COOKIE = "shoppp_admin_session";
type ApiContext = Context<ApiEnvironment>;

export function logAuthenticationDenial(
  context: ApiContext,
  reason: string,
  principalKind?: AdminIdentityClaim["principalKind"],
): void {
  console.warn(
    JSON.stringify({
      event: "security.access_denied",
      ...(principalKind ? { principalKind } : {}),
      reason,
      requestId: context.get("requestId"),
      route: safeRequestPath(context.req.url),
    }),
  );
}

async function auditMappedDenial(
  context: ApiContext,
  row: PrincipalRow,
  reason: string,
): Promise<void> {
  await recordAuditEvent(context.env.DB, {
    action: "iam.authenticate",
    actorId: row.id,
    actorType: row.principal_kind === "service" ? "machine" : "admin",
    id: crypto.randomUUID(),
    reason,
    requestId: context.get("requestId"),
    result: "denied",
    targetId: row.id,
    targetType: "admin_identity",
  });
}

export async function resolvePrincipal(
  context: ApiContext,
  identity: AdminIdentityClaim,
): Promise<Principal | null> {
  const row = await context.env.DB.prepare(
    `SELECT identity.id, identity.principal_kind, identity.access_subject,
            identity.normalized_email, identity.display_name, identity.enabled,
            identity.expires_at,
            role.id AS role_id, role.key AS role_key, role.name AS role_name,
            role.protected AS role_protected, role.system AS role_system,
            role.enabled AS role_enabled, role.version AS role_version
       FROM admin_identities identity
       JOIN admin_roles role ON role.id = identity.role_id
      WHERE identity.access_subject = ?`,
  )
    .bind(identity.subject)
    .first<PrincipalRow>();
  if (!row) return null;

  if (row.enabled !== 1 || row.role_enabled !== 1) {
    await auditMappedDenial(context, row, "identity_or_role_disabled");
    throw new ApiError(401, "identity_not_enabled", "The administrator identity is not enabled.");
  }
  if (isAdminIdentityExpired(row.expires_at)) {
    await auditMappedDenial(context, row, "identity_expired");
    throw new ApiError(401, "identity_expired", "The administrator identity has expired.");
  }
  if (row.principal_kind !== identity.principalKind) {
    await auditMappedDenial(context, row, "principal_kind_mismatch");
    throw new ApiError(
      401,
      "identity_claim_mismatch",
      "The administrator identity does not match.",
    );
  }
  if (
    identity.principalKind === "human" &&
    row.normalized_email !== identity.email.trim().toLowerCase()
  ) {
    await auditMappedDenial(context, row, "verified_email_mismatch");
    throw new ApiError(
      401,
      "identity_claim_mismatch",
      "The administrator identity does not match.",
    );
  }

  const permissionRows = await context.env.DB.prepare(
    `SELECT definition.permission_key
       FROM admin_role_permissions role_permission
       JOIN admin_permission_definitions definition
         ON definition.permission_key = role_permission.permission_key
      WHERE role_permission.role_id = ?
      ORDER BY definition.sort_order`,
  )
    .bind(row.role_id)
    .all<{ permission_key: string }>();
  if (
    permissionRows.results.some(({ permission_key }) => !registeredPermissions.has(permission_key))
  ) {
    await auditMappedDenial(context, row, "unknown_permission_catalog_entry");
    throw new ApiError(
      403,
      "authorization_state_invalid",
      "The identity authorization state is invalid.",
    );
  }
  const permissions = permissionRows.results.map(
    ({ permission_key }) => permission_key as AdminPermission,
  );
  if (
    row.role_protected === 1 &&
    (permissions.length !== ADMIN_PERMISSION_KEYS.length ||
      ADMIN_PERMISSION_KEYS.some((permission) => !permissions.includes(permission)))
  ) {
    await auditMappedDenial(context, row, "protected_role_permission_drift");
    throw new ApiError(
      403,
      "authorization_state_invalid",
      "The identity authorization state is invalid.",
    );
  }

  const base = {
    displayName: row.display_name,
    id: row.id,
    permissions,
    role: {
      enabled: row.role_enabled === 1,
      id: row.role_id,
      key: row.role_key,
      name: row.role_name,
      protected: row.role_protected === 1,
      system: row.role_system === 1,
      version: row.role_version,
    },
    subject: row.access_subject,
  } as const;
  return identity.principalKind === "human"
    ? { ...base, email: identity.email, principalKind: "human" }
    : {
        ...base,
        principalKind: "service",
        serviceName: identity.serviceName,
      };
}

export async function resolvePrincipalById(
  context: ApiContext,
  identityId: string,
): Promise<Principal | null> {
  const identity = await context.env.DB.prepare(
    `SELECT access_subject, normalized_email, principal_kind
       FROM admin_identities WHERE id = ?`,
  )
    .bind(identityId)
    .first<{
      access_subject: string;
      normalized_email: string | null;
      principal_kind: "human" | "service";
    }>();
  if (!identity) return null;
  return resolvePrincipal(
    context,
    identity.principal_kind === "human"
      ? {
          email: identity.normalized_email ?? "",
          principalKind: "human",
          subject: identity.access_subject,
        }
      : {
          principalKind: "service",
          serviceName: identity.access_subject,
          subject: identity.access_subject,
        },
  );
}

async function resolvePasswordSession(
  context: ApiContext,
  token: string,
): Promise<Principal | null> {
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const session = await context.env.DB.prepare(
    `SELECT session.id, session.identity_id
       FROM admin_sessions session
       JOIN admin_password_credentials credential ON credential.identity_id = session.identity_id
      WHERE session.token_hash = ?
        AND session.revoked_at IS NULL
        AND session.expires_at > ?
        AND session.password_version = credential.password_version`,
  )
    .bind(tokenHash, now)
    .first<{ id: string; identity_id: string }>();
  if (!session) return null;
  const principal = await resolvePrincipalById(context, session.identity_id);
  if (!principal || principal.principalKind !== "human") return null;
  await context.env.DB.prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?")
    .bind(now, session.id)
    .run();
  return principal;
}

async function resolveServiceCredential(
  context: ApiContext,
  token: string,
): Promise<Principal | null> {
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const credential = await context.env.DB.prepare(
    `SELECT id, identity_id
       FROM admin_service_credentials
      WHERE token_hash = ? AND enabled = 1 AND (expires_at IS NULL OR expires_at > ?)`,
  )
    .bind(tokenHash, now)
    .first<{ id: string; identity_id: string }>();
  if (!credential) return null;
  const principal = await resolvePrincipalById(context, credential.identity_id);
  if (!principal || principal.principalKind !== "service") return null;
  await context.env.DB.prepare("UPDATE admin_service_credentials SET last_used_at = ? WHERE id = ?")
    .bind(now, credential.id)
    .run();
  return principal;
}

export function adminAuthentication(
  testIdentityVerifier?: TestIdentityVerifier,
): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    const sessionToken = getCookie(context, ADMIN_SESSION_COOKIE);
    if (sessionToken) {
      const principal = await resolvePasswordSession(context, sessionToken);
      if (!principal) {
        logAuthenticationDenial(context, "admin_session_invalid", "human");
        throw new ApiError(401, "admin_session_invalid", "The administrator session is invalid.");
      }
      context.set("principal", principal);
      await next();
      return;
    }
    const testIdentityToken = context.req.header("X-Test-Admin-Identity");
    if (testIdentityVerifier && testIdentityToken) {
      let identity: AdminIdentityClaim;
      try {
        identity = await testIdentityVerifier(testIdentityToken);
      } catch {
        logAuthenticationDenial(context, "test_identity_invalid");
        throw new ApiError(401, "admin_identity_invalid", "Administrator authentication failed.");
      }
      const principal = await resolvePrincipal(context, identity);
      if (!principal) {
        logAuthenticationDenial(context, "admin_identity_unmapped", identity.principalKind);
        throw new ApiError(401, "identity_unmapped", "The administrator identity is not enabled.");
      }
      context.set("principal", principal);
      await next();
      return;
    }
    const authorization = context.req.header("Authorization");
    if (authorization?.startsWith("Bearer ")) {
      const principal = await resolveServiceCredential(context, authorization.slice(7).trim());
      if (!principal) {
        logAuthenticationDenial(context, "service_credential_invalid", "service");
        throw new ApiError(401, "service_credential_invalid", "Service authentication failed.");
      }
      context.set("principal", principal);
      await next();
      return;
    }
    logAuthenticationDenial(context, "admin_login_required");
    throw new ApiError(401, "admin_login_required", "Administrator login is required.");
  };
}
