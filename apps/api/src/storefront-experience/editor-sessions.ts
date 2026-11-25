import type { Context } from "hono";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { getCanonicalDeployedCatalogRelease } from "./catalog-resources";
import { frozenContact, storefrontEditorDraftContext } from "./service";

type Session = {
  id: string;
  nonce: string;
  draft_id: string;
  actor_id: string;
  catalog_release_id: string;
  expires_at: string;
};
export async function createEditorSession(
  context: Context<ApiEnvironment>,
  draftId: string,
  catalogReleaseId: string,
) {
  await storefrontEditorDraftContext(context.env.DB, draftId);
  await getCanonicalDeployedCatalogRelease(context.env.DB, catalogReleaseId, {
    allowPrivateCandidate: true,
    environment: context.env.ENVIRONMENT,
    principalKind: context.get("principal").principalKind,
  });
  const id = crypto.randomUUID(),
    nonce = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  const result = await context.env.DB.prepare(
    `INSERT INTO storefront_editor_sessions
    (id, nonce, draft_id, actor_id, catalog_release_id, created_at, expires_at)
    SELECT ?, ?, id, ?, ?, ?, ? FROM storefront_experience_drafts WHERE id = ? AND removed_at IS NULL`,
  )
    .bind(
      id,
      nonce,
      context.get("principal").id,
      catalogReleaseId,
      now.toISOString(),
      expiresAt,
      draftId,
    )
    .run();
  if (result.meta.changes !== 1)
    throw new ApiError(
      404,
      "storefront_editor_session_unavailable",
      "Reload the draft before opening the editor preview.",
    );
  return { id, nonce, expiresAt, catalogReleaseId };
}

export async function editorSessionRecord(context: Context<ApiEnvironment>, id: string) {
  const session = await context.env.DB.prepare(
    `SELECT session.* FROM storefront_editor_sessions session
    JOIN storefront_experience_drafts draft ON draft.id = session.draft_id
    WHERE session.id = ? AND session.actor_id = ? AND session.expires_at > ? AND draft.removed_at IS NULL`,
  )
    .bind(id, context.get("principal").id, new Date().toISOString())
    .first<Session>();
  if (!session)
    throw new ApiError(
      404,
      "storefront_editor_session_unavailable",
      "The editor preview session expired. Reconnect to continue editing.",
    );
  return session;
}

export async function editorSessionContext(context: Context<ApiEnvironment>, session: Session) {
  return {
    id: session.id,
    nonce: session.nonce,
    expiresAt: session.expires_at,
    ...(await storefrontEditorDraftContext(context.env.DB, session.draft_id)),
    release: await getCanonicalDeployedCatalogRelease(context.env.DB, session.catalog_release_id, {
      allowPrivateCandidate: true,
      environment: context.env.ENVIRONMENT,
      principalKind: context.get("principal").principalKind,
    }),
    contact: await frozenContact(context),
  };
}
