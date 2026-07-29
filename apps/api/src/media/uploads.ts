import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export async function uploadCatalogMedia(context: Context<ApiEnvironment>) {
  const key = decodeURIComponent(context.req.path.slice("/admin/media/".length));
  await (
    await import("../iam/permissions")
  ).requirePermission(context, "catalog.write", {
    id: key,
    type: "media",
  });
  if (!key.startsWith("catalog/") || key.includes("..")) {
    throw new ApiError(422, "unsafe_media_key", "Media keys must use the catalog/ prefix.");
  }
  const contentType = context.req.header("Content-Type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ApiError(415, "unsupported_media_type", "Only JPEG, PNG, WebP, and GIF are allowed.");
  }
  const declaredSize = Number(context.req.header("Content-Length") ?? "0");
  if (!Number.isFinite(declaredSize) || declaredSize < 1) {
    throw new ApiError(422, "invalid_media_size", "A valid Content-Length is required.");
  }
  if (declaredSize > MAX_MEDIA_BYTES) {
    throw new ApiError(413, "media_too_large", "Catalog media must not exceed 10 MiB.");
  }
  const body = await context.req.arrayBuffer();
  if (body.byteLength !== declaredSize) {
    throw new ApiError(422, "media_size_mismatch", "Content-Length does not match the upload.");
  }
  await context.env.MEDIA.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: { uploadedBy: context.get("principal").id },
  });
  await recordAuditEvent(context.env.DB, {
    action: "catalog.media.upload",
    actorId: context.get("principal").id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: { contentType, size: body.byteLength },
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: key,
    targetType: "media",
  });
  return { key, size: body.byteLength };
}
