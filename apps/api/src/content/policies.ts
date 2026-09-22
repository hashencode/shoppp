import {
  policyAuthoritySchema,
  type CreatePolicyRequest,
  type PolicyAuthority,
  type PolicyTransitionRequest,
  type UpdatePolicyRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent, recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { filterStorefrontBacklinks, findPolicyBacklinks } from "../storefront-control/backlinks";

interface PolicyRow {
  approval_digest: string | null;
  approval_environment: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  effective_date: string;
  kind: "privacy" | "returns" | "shipping" | "terms";
  policy_id: string;
  published_at: string | null;
  sections_json: string;
  slug: string;
  status: "draft" | "approved" | "published" | "archived";
  title: string;
  updated_at: string;
  version: number;
}

interface PolicyListRow extends PolicyRow {
  candidate: number;
  live: number;
}

export interface PolicyListPage {
  data: Array<PolicyAuthority & { inclusion: { candidate: boolean; live: boolean } }>;
  nextCursor: string | null;
}

const columns = `policy_id, version, kind, slug, title, effective_date, sections_json, status,
  approval_digest, approved_by, approved_at, approval_environment, published_at, created_at, updated_at`;

function mapPolicy(row: PolicyRow): PolicyAuthority {
  return policyAuthoritySchema.parse({
    ...(row.approval_digest ? { approvalDigest: row.approval_digest } : {}),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    ...(row.approved_by ? { approvedBy: row.approved_by } : {}),
    createdAt: row.created_at,
    effectiveDate: row.effective_date,
    id: row.policy_id,
    kind: row.kind,
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    sections: JSON.parse(row.sections_json),
    slug: row.slug,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

async function withInclusion(db: D1Database, policy: PolicyAuthority) {
  const inclusion = await db
    .prepare(
      `SELECT
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'policy' AND source.source_id = ?
            AND source.source_version = ? AND release.purpose = 'private-preview'
            AND release.candidate_status = 'succeeded') AS candidate,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'policy' AND source.source_id = ?
            AND source.source_version = ? AND release.status = 'deployed') AS live`,
    )
    .bind(policy.id, policy.version, policy.id, policy.version)
    .first<{ candidate: number; live: number }>();
  return Object.assign(policy, {
    inclusion: { candidate: inclusion?.candidate === 1, live: inclusion?.live === 1 },
  });
}

async function row(db: D1Database, id: string, version?: number): Promise<PolicyRow | null> {
  return db
    .prepare(
      `SELECT ${columns} FROM policy_versions WHERE policy_id = ?
       ${version === undefined ? "ORDER BY version DESC LIMIT 1" : "AND version = ?"}`,
    )
    .bind(id, ...(version === undefined ? [] : [version]))
    .first<PolicyRow>();
}

export async function listPolicies(
  db: D1Database,
  options: { cursor?: string | undefined; limit: number },
): Promise<PolicyListPage> {
  const [cursorKind, cursorId] = options.cursor?.split(":", 2) ?? [];
  const rows = await db
    .prepare(
      `SELECT ${columns},
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'policy' AND source.source_id = current.policy_id
            AND source.source_version = current.version AND release.purpose = 'private-preview'
            AND release.candidate_status = 'succeeded') AS candidate,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = 'policy' AND source.source_id = current.policy_id
            AND source.source_version = current.version AND release.status = 'deployed') AS live
       FROM policy_versions current
        WHERE version = (SELECT MAX(version) FROM policy_versions latest WHERE latest.policy_id = current.policy_id)
          AND (? IS NULL OR kind > ? OR (kind = ? AND policy_id > ?))
        ORDER BY kind, policy_id LIMIT ?`,
    )
    .bind(cursorKind ?? null, cursorKind ?? "", cursorKind ?? "", cursorId ?? "", options.limit + 1)
    .all<PolicyListRow>();
  const pageRows = rows.results.slice(0, options.limit);
  const last = pageRows.at(-1);
  return {
    data: pageRows.map((item) =>
      Object.assign(mapPolicy(item), {
        inclusion: { candidate: item.candidate === 1, live: item.live === 1 },
      }),
    ),
    nextCursor:
      rows.results.length > options.limit && last ? `${last.kind}:${last.policy_id}` : null,
  };
}

function policyId() {
  return `policy.${crypto.randomUUID()}`;
}

async function assertSlugAvailable(db: D1Database, slug: string, exceptId?: string) {
  const duplicate = await db
    .prepare(
      `SELECT policy_id FROM policy_versions
        WHERE slug = ? AND status != 'archived' AND (? IS NULL OR policy_id != ?)
        LIMIT 1`,
    )
    .bind(slug, exceptId ?? null, exceptId ?? null)
    .first<{ policy_id: string }>();
  if (duplicate)
    throw new ApiError(409, "policy_slug_conflict", "That Policy slug is already used.");
}

function writeValues(input: CreatePolicyRequest | UpdatePolicyRequest) {
  return [input.kind, input.slug, input.title, input.effectiveDate, JSON.stringify(input.sections)];
}

export async function createPolicy(context: Context<ApiEnvironment>, input: CreatePolicyRequest) {
  await assertSlugAvailable(context.env.DB, input.slug);
  const id = policyId();
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const guardKey = `policy_create_guard:${context.get("requestId")}`;
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, CASE WHEN NOT EXISTS (
           SELECT 1 FROM policy_versions WHERE slug = ? AND status != 'archived'
         ) THEN '{}' ELSE 'invalid' END, ?)`,
      ).bind(guardKey, input.slug, now),
      context.env.DB.prepare(
        `INSERT INTO policy_versions
        (policy_id, version, kind, slug, title, effective_date, sections_json, status, created_at, updated_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      ).bind(id, ...writeValues(input), now, now),
      prepareAuditEvent(context.env.DB, {
        action: "policies.create",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: { version: 1 },
        reason: input.reason,
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "policy",
      }),
      context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(guardKey),
    ]);
  } catch (error) {
    await assertSlugAvailable(context.env.DB, input.slug);
    throw error;
  }
  return mapPolicy((await row(context.env.DB, id))!);
}

export async function updatePolicy(
  context: Context<ApiEnvironment>,
  id: string,
  input: UpdatePolicyRequest,
) {
  const current = await row(context.env.DB, id);
  if (!current) throw new ApiError(404, "policy_not_found", "The Policy was not found.");
  if (current.version !== input.expectedVersion)
    throw new ApiError(409, "policy_conflict", "The Policy changed. Reload before saving.");
  await assertSlugAvailable(context.env.DB, input.slug, id);
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const principal = context.get("principal");
  const guardKey = `policy_write_guard:${context.get("requestId")}`;
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, CASE WHEN (SELECT MAX(version) FROM policy_versions WHERE policy_id = ?) = ?
                         THEN '{}' ELSE 'invalid' END, ?)`,
      ).bind(guardKey, id, input.expectedVersion, now),
      context.env.DB.prepare(
        `INSERT INTO policy_versions
      (policy_id, version, kind, slug, title, effective_date, sections_json, status, created_at, updated_at)
       SELECT policy_id, ?, ?, ?, ?, ?, ?, 'draft', ?, ? FROM policy_versions
        WHERE policy_id = ? AND version = ?`,
      ).bind(nextVersion, ...writeValues(input), now, now, id, input.expectedVersion),
      prepareAuditEvent(context.env.DB, {
        action: "policies.update",
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: crypto.randomUUID(),
        metadata: { fromVersion: current.version, toVersion: nextVersion },
        reason: input.reason,
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: "policy",
      }),
      context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(guardKey),
    ]);
  } catch (error) {
    if ((await row(context.env.DB, id))?.version !== input.expectedVersion)
      throw new ApiError(409, "policy_conflict", "The Policy changed. Reload before saving.");
    throw error;
  }
  if ((await row(context.env.DB, id))?.version !== nextVersion)
    throw new ApiError(409, "policy_conflict", "The Policy changed. Reload before saving.");
  return mapPolicy((await row(context.env.DB, id))!);
}

async function digest(row: PolicyRow) {
  const value = JSON.stringify({
    effectiveDate: row.effective_date,
    id: row.policy_id,
    kind: row.kind,
    sections: JSON.parse(row.sections_json),
    slug: row.slug,
    title: row.title,
    version: row.version,
  });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function renderedText(row: PolicyRow): string {
  return (
    JSON.parse(row.sections_json) as Array<{
      alt?: string;
      caption?: string;
      text?: string;
      items?: string[];
    }>
  )
    .flatMap((section) => section.items ?? [section.text ?? section.caption ?? section.alt ?? ""])
    .filter(Boolean)
    .join("\n");
}

async function transition(
  context: Context<ApiEnvironment>,
  id: string,
  input: PolicyTransitionRequest,
  action: "approve" | "publish" | "archive",
) {
  const current = await row(context.env.DB, id);
  if (!current) throw new ApiError(404, "policy_not_found", "The Policy was not found.");
  const principal = context.get("principal");
  const auditDenied = async (code: string) =>
    recordAuditEvent(context.env.DB, {
      action: `policies.${action}`,
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { code, expectedVersion: input.expectedVersion },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "denied",
      targetId: id,
      targetType: "policy",
    });
  if (current.version !== input.expectedVersion) {
    await auditDenied("policy_conflict");
    throw new ApiError(409, "policy_conflict", "The Policy changed. Reload before continuing.");
  }
  if (action === "approve" && principal.principalKind !== "human") {
    await auditDenied("human_approval_required");
    throw new ApiError(
      403,
      "human_approval_required",
      "Policy approval requires a human operator.",
    );
  }
  const expected =
    action === "approve" ? "draft" : action === "publish" ? "approved" : current.status;
  const currentDigest = action === "publish" ? await digest(current) : null;
  const rejectionCode =
    action === "publish" && current.approval_environment !== context.env.ENVIRONMENT
      ? "policy_approval_environment_mismatch"
      : action === "publish" && current.approval_digest !== currentDigest
        ? "policy_approval_stale"
        : action === "archive" && current.status === "archived"
          ? "policy_transition_invalid"
          : current.status !== expected
            ? "policy_transition_invalid"
            : null;
  if (rejectionCode) {
    await auditDenied(rejectionCode);
    throw new ApiError(409, rejectionCode, "The Policy is not eligible for this transition.");
  }
  const now = new Date().toISOString();
  const approvalDigest = action === "approve" ? await digest(current) : current.approval_digest;
  const nextStatus =
    action === "approve" ? "approved" : action === "publish" ? "published" : "archived";
  const statements: D1PreparedStatement[] = [];
  if (action === "archive") {
    const rawBacklinks = await findPolicyBacklinks(
      context.env.DB,
      id,
      current.version,
      context.env.ENVIRONMENT,
    );
    if (rawBacklinks.length) {
      await auditDenied("policy_referenced");
      throw new ApiError(409, "policy_referenced", "Remove current references before archiving.", {
        backlinks: filterStorefrontBacklinks(rawBacklinks, principal.permissions),
      });
    }
  }
  const guardKey = `policy_transition_guard:${context.get("requestId")}`;
  statements.push(
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, CASE WHEN EXISTS (
         SELECT 1 FROM policy_versions WHERE policy_id = ? AND version = ? AND status = ?
       ) THEN '{}' ELSE 'invalid' END, ?)`,
    ).bind(guardKey, id, input.expectedVersion, expected, now),
  );
  if (action === "publish") {
    statements.push(
      context.env.DB.prepare(
        `UPDATE policy_versions SET status = 'archived', updated_at = ?
          WHERE status = 'published' AND NOT (policy_id = ? AND version = ?)
            AND (policy_id = ? OR kind = ?)`,
      ).bind(now, id, current.version, id, current.kind),
    );
  }
  statements.push(
    context.env.DB.prepare(
      `UPDATE policy_versions SET status = ?, approval_digest = ?, approved_by = ?, approved_at = ?,
          approval_environment = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
          updated_at = ?
        WHERE policy_id = ? AND version = ? AND status = ?`,
    ).bind(
      nextStatus,
      approvalDigest,
      action === "approve" ? principal.id : current.approved_by,
      action === "approve" ? now : current.approved_at,
      action === "approve" ? context.env.ENVIRONMENT : current.approval_environment,
      nextStatus,
      now,
      now,
      id,
      input.expectedVersion,
      expected,
    ),
    prepareAuditEvent(context.env.DB, {
      action: `policies.${action}`,
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { version: current.version },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: id,
      targetType: "policy",
    }),
    context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(guardKey),
  );
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    const fresh = await row(context.env.DB, id);
    if (!fresh || fresh.version !== input.expectedVersion || fresh.status !== current.status)
      throw new ApiError(409, "policy_conflict", "The Policy changed. Reload before continuing.");
    throw error;
  }
  return mapPolicy((await row(context.env.DB, id, input.expectedVersion))!);
}

export const approvePolicy = (
  context: Context<ApiEnvironment>,
  id: string,
  input: PolicyTransitionRequest,
) => transition(context, id, input, "approve");
export const publishPolicy = (
  context: Context<ApiEnvironment>,
  id: string,
  input: PolicyTransitionRequest,
) => transition(context, id, input, "publish");
export const archivePolicy = (
  context: Context<ApiEnvironment>,
  id: string,
  input: PolicyTransitionRequest,
) => transition(context, id, input, "archive");

export async function reviewPolicy(db: D1Database, id: string, version?: number) {
  const current = await row(db, id, version);
  if (!current) throw new ApiError(404, "policy_not_found", "The Policy version was not found.");
  const published = await db
    .prepare(
      `SELECT ${columns} FROM policy_versions WHERE kind = ? AND status = 'published' LIMIT 1`,
    )
    .bind(current.kind)
    .first<PolicyRow>();
  return {
    current: await withInclusion(db, mapPolicy(current)),
    digest: await digest(current),
    previous: published ? await withInclusion(db, mapPolicy(published)) : null,
    previousRenderedText: published ? renderedText(published) : null,
    renderedText: renderedText(current),
  };
}
