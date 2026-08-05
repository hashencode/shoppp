interface PreviewAuthorizationService {
  fetch(request: Request): Promise<Response>;
}

export interface PreviewArtifactObject {
  body: BodyInit;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
}

export interface PreviewArtifactBucket {
  get(key: string): Promise<PreviewArtifactObject | null>;
  head(key: string): Promise<PreviewArtifactObject | null>;
  put(
    key: string,
    body: Uint8Array,
    options: {
      customMetadata: Record<string, string>;
      httpMetadata: { contentType: string };
    },
  ): Promise<unknown>;
}

export interface PreviewAccessEnvironment {
  PREVIEW_ARTIFACTS: PreviewArtifactBucket;
  PREVIEW_AUTH: PreviewAuthorizationService;
  PREVIEW_AUTH_TOKEN: string;
  PREVIEW_HANDOFF_ORIGIN: string;
  PREVIEW_ORIGIN: string;
}

export interface PreviewArtifactFile {
  body: Uint8Array;
  contentType: string;
  path: string;
}

export interface PreviewArtifactResult {
  digest: string;
  prefix: string;
}

export interface PreviewArtifactDescriptor extends PreviewArtifactResult {
  files: PreviewArtifactFile[];
  manifestBody: Uint8Array;
}

interface PreviewAuthorization {
  artifactPrefix: string;
  authorized: true;
  expiresAt: string;
  origin: string;
}

const digestPattern = /^[a-f0-9]{64}$/;
const snapshotPattern = /^[a-z][a-z0-9-]{2,99}$/;
const artifactPrefixPattern = /^snapshots\/[a-z][a-z0-9-]{2,99}\/[a-f0-9]{64}$/;

function hexadecimal(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(contents: Uint8Array): Promise<string> {
  return hexadecimal(await crypto.subtle.digest("SHA-256", contents));
}

function decodedPath(pathname: string): string {
  let decoded = pathname;
  try {
    for (let index = 0; index < 3; index += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    throw new Error("Preview asset path has invalid encoding.");
  }
  return decoded;
}

export function normalizePreviewAssetPath(pathname: string): string {
  const decoded = decodedPath(pathname);
  const hasControlCharacter = [...decoded].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!decoded.startsWith("/") || decoded.includes("\\") || hasControlCharacter) {
    throw new Error("Preview asset path is invalid.");
  }
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Preview asset path traversal is prohibited.");
  }
  const relativePath = decoded.replace(/^\/+/, "");
  if (!relativePath) return "index.html";
  if (relativePath.startsWith("_preview-")) {
    throw new Error("Preview artifact metadata is private.");
  }
  return relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
}

function normalizeArtifactFile(file: PreviewArtifactFile): PreviewArtifactFile {
  const path = normalizePreviewAssetPath(`/${file.path}`);
  if (
    !file.contentType ||
    file.contentType.length > 200 ||
    /[\r\n]/.test(file.contentType) ||
    file.body.byteLength === 0
  ) {
    throw new Error(`Preview artifact metadata is invalid for ${file.path}.`);
  }
  return { ...file, path };
}

export async function describePreviewArtifact(
  snapshotId: string,
  rawFiles: readonly PreviewArtifactFile[],
  expectedDigest?: string,
): Promise<PreviewArtifactDescriptor> {
  if (!snapshotPattern.test(snapshotId)) throw new Error("Preview snapshot identifier is invalid.");
  if (rawFiles.length === 0) throw new Error("Preview output must contain at least one file.");
  const files = rawFiles
    .map(normalizeArtifactFile)
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(files.map(({ path }) => path)).size !== files.length) {
    throw new Error("Preview output contains duplicate normalized asset paths.");
  }
  const manifestFiles = await Promise.all(
    files.map(async (file) => ({
      bytes: file.body.byteLength,
      contentType: file.contentType,
      path: file.path,
      sha256: await sha256(file.body),
    })),
  );
  const manifestBody = new TextEncoder().encode(
    JSON.stringify({ files: manifestFiles, schemaVersion: 1 }),
  );
  const digest = await sha256(manifestBody);
  if (
    expectedDigest !== undefined &&
    (!digestPattern.test(expectedDigest) || expectedDigest !== digest)
  ) {
    throw new Error(
      `Preview artifact digest mismatch: expected ${expectedDigest}, received ${digest}.`,
    );
  }
  const prefix = `snapshots/${snapshotId}/${digest}`;
  return { digest, files, manifestBody, prefix };
}

export async function uploadPreviewArtifact(
  bucket: PreviewArtifactBucket,
  snapshotId: string,
  rawFiles: readonly PreviewArtifactFile[],
  expectedDigest?: string,
): Promise<PreviewArtifactResult> {
  const descriptor = await describePreviewArtifact(snapshotId, rawFiles, expectedDigest);
  const uploads = [
    ...descriptor.files,
    {
      body: descriptor.manifestBody,
      contentType: "application/json; charset=utf-8",
      path: "_preview-manifest.json",
    },
  ];
  for (const file of uploads) {
    const key = `${descriptor.prefix}/${file.path}`;
    const fileDigest = await sha256(file.body);
    const existing = await bucket.head(key);
    if (existing) {
      if (existing.customMetadata?.sha256 !== fileDigest) {
        throw new Error(`Preview artifact collision at ${key}.`);
      }
      continue;
    }
    await bucket.put(key, file.body, {
      customMetadata: { artifactDigest: descriptor.digest, sha256: fileDigest, snapshotId },
      httpMetadata: { contentType: file.contentType },
    });
  }
  return { digest: descriptor.digest, prefix: descriptor.prefix };
}

function securityHeaders(origin: string): Headers {
  return new Headers({
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": [
      `default-src ${origin}`,
      `script-src ${origin}`,
      `style-src ${origin} 'unsafe-inline'`,
      `img-src ${origin}`,
      `font-src ${origin}`,
      "connect-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; "),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
  });
}

function responseWithSecurity(
  body: BodyInit | null,
  origin: string,
  status: number,
  contentType = "text/plain; charset=utf-8",
): Response {
  const headers = securityHeaders(origin);
  headers.set("Content-Type", contentType);
  return new Response(body, { headers, status });
}

function previewSession(request: Request): string | undefined {
  const cookie = request.headers.get("Cookie") ?? "";
  const value = cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("__Host-shoppp-preview="))
    ?.slice("__Host-shoppp-preview=".length);
  return value && /^[A-Za-z0-9_-]{32,256}$/.test(value) ? value : undefined;
}

async function authorize(
  request: Request,
  environment: PreviewAccessEnvironment,
  now: Date,
): Promise<PreviewAuthorization | null> {
  const session = previewSession(request);
  if (!session) return null;
  const response = await environment.PREVIEW_AUTH.fetch(
    new Request("https://preview-auth.internal/internal/preview/authorize", {
      headers: {
        Authorization: `Bearer ${environment.PREVIEW_AUTH_TOKEN}`,
        Cookie: `__Host-shoppp-preview=${session}`,
        "X-Preview-Origin": new URL(request.url).origin,
      },
      method: "POST",
    }),
  );
  if (!response.ok) return null;
  const value = (await response.json()) as Partial<PreviewAuthorization>;
  if (
    value.authorized !== true ||
    typeof value.artifactPrefix !== "string" ||
    !artifactPrefixPattern.test(value.artifactPrefix) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= now.getTime() ||
    value.origin !== environment.PREVIEW_ORIGIN ||
    value.origin !== new URL(request.url).origin
  ) {
    return null;
  }
  return value as PreviewAuthorization;
}

async function redeemGrant(
  request: Request,
  environment: PreviewAccessEnvironment,
  origin: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return responseWithSecurity("Method not allowed.", origin, 405);
  }
  if (request.headers.get("Origin") !== environment.PREVIEW_HANDOFF_ORIGIN) {
    return responseWithSecurity("Preview origin is not authorized.", origin, 403);
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > 1024) {
    return responseWithSecurity("Preview grant payload is too large.", origin, 413);
  }
  let grant: string;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1024) throw new Error();
    const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim();
    const body =
      contentType === "application/x-www-form-urlencoded"
        ? { grant: new URLSearchParams(rawBody).get("grant") }
        : (JSON.parse(rawBody) as { grant?: unknown });
    if (
      typeof body.grant !== "string" ||
      body.grant.length < 32 ||
      body.grant.length > 256 ||
      !/^[A-Za-z0-9_-]+$/.test(body.grant)
    ) {
      throw new Error();
    }
    grant = body.grant;
  } catch {
    return responseWithSecurity("Preview grant is invalid.", origin, 422);
  }
  const redemption = await environment.PREVIEW_AUTH.fetch(
    new Request("https://preview-auth.internal/internal/preview/redeem", {
      body: JSON.stringify({ grant, origin }),
      headers: {
        Authorization: `Bearer ${environment.PREVIEW_AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
  if (!redemption.ok) {
    return responseWithSecurity("Preview grant is invalid or expired.", origin, 403);
  }
  const value = (await redemption.json()) as {
    data?: { expiresAt?: unknown; session?: unknown };
  };
  if (
    typeof value.data?.session !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(value.data.session) ||
    typeof value.data.expiresAt !== "string" ||
    Date.parse(value.data.expiresAt) <= Date.now()
  ) {
    return responseWithSecurity("Preview authorization failed.", origin, 502);
  }
  const headers = securityHeaders(origin);
  headers.set("Location", "/");
  headers.set(
    "Set-Cookie",
    `__Host-shoppp-preview=${value.data.session}; Path=/; Expires=${new Date(value.data.expiresAt).toUTCString()}; Secure; HttpOnly; SameSite=Strict`,
  );
  return new Response(null, { headers, status: 303 });
}

export function createPreviewAccessHandler(options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date());
  return async (request: Request, environment: PreviewAccessEnvironment): Promise<Response> => {
    let configuredOrigin: URL;
    try {
      configuredOrigin = new URL(environment.PREVIEW_ORIGIN);
    } catch {
      return new Response("Preview origin is not configured.", { status: 500 });
    }
    const requestUrl = new URL(request.url);
    if (
      configuredOrigin.protocol !== "https:" ||
      configuredOrigin.origin !== environment.PREVIEW_ORIGIN ||
      requestUrl.origin !== environment.PREVIEW_ORIGIN
    ) {
      return responseWithSecurity(
        "Preview origin is not authorized.",
        configuredOrigin.origin,
        403,
      );
    }
    if (!environment.PREVIEW_AUTH_TOKEN || environment.PREVIEW_AUTH_TOKEN.length < 32) {
      return responseWithSecurity(
        "Preview authorization is not configured.",
        configuredOrigin.origin,
        500,
      );
    }
    if (requestUrl.pathname === "/__preview/session") {
      return redeemGrant(request, environment, configuredOrigin.origin);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return responseWithSecurity("Method not allowed.", configuredOrigin.origin, 405);
    }
    if (!previewSession(request)) {
      return responseWithSecurity("Preview session required.", configuredOrigin.origin, 401);
    }
    const authorization = await authorize(request, environment, now());
    if (!authorization) {
      return responseWithSecurity(
        "Preview session is invalid or expired.",
        configuredOrigin.origin,
        403,
      );
    }
    let assetPath: string;
    try {
      assetPath = normalizePreviewAssetPath(requestUrl.pathname);
    } catch {
      return responseWithSecurity("Preview asset path is invalid.", configuredOrigin.origin, 400);
    }
    const object = await environment.PREVIEW_ARTIFACTS.get(
      `${authorization.artifactPrefix}/${assetPath}`,
    );
    if (!object) {
      return responseWithSecurity("Preview artifact not found.", configuredOrigin.origin, 404);
    }
    const headers = securityHeaders(configuredOrigin.origin);
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
      status: 200,
    });
  };
}

const handlePreviewAccess = createPreviewAccessHandler();

export default {
  fetch(request: Request, environment: PreviewAccessEnvironment): Promise<Response> {
    return handlePreviewAccess(request, environment);
  },
};
