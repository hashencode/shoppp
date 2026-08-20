interface PreviewAuthorizationService {
  fetch(request: Request): Promise<Response>;
}

interface CommerceService {
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
  COMMERCE_API?: CommerceService;
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
  inputIdentity?: {
    catalogReleaseId: string;
    experienceSnapshotId: string;
    experienceVersion: number;
    platformContractVersion: string;
    themeId: string;
    themeVersion: string;
  };
  mediaOrigins?: string[];
  origin: string;
  previewContext?: {
    contentDigest: string;
    environment: "private-preview";
    expiresAt: string;
    generatedAt: string | null;
    returnUrl: string;
    snapshotId: string;
  };
}

const digestPattern = /^[a-f0-9]{64}$/;
const snapshotPattern = /^[a-z][a-z0-9-]{2,99}$/;
const catalogReleasePattern = /^[A-Za-z0-9_-]{1,160}$/;
const artifactPrefixPattern =
  /^snapshots\/[a-z][a-z0-9-]{2,99}\/(?:[A-Za-z0-9_-]{1,160}\/)?[a-f0-9]{64}$/;

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

function normalizePreviewRequestAssetPath(pathname: string): string {
  const path = normalizePreviewAssetPath(pathname);
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return lastSegment.includes(".") ? path : `${path}/index.html`;
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
  catalogReleaseId?: string,
): Promise<PreviewArtifactDescriptor> {
  if (!snapshotPattern.test(snapshotId)) throw new Error("Preview snapshot identifier is invalid.");
  if (catalogReleaseId && !catalogReleasePattern.test(catalogReleaseId)) {
    throw new Error("Preview Catalog Release identifier is invalid.");
  }
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
  const prefix = catalogReleaseId
    ? `snapshots/${snapshotId}/${catalogReleaseId}/${digest}`
    : `snapshots/${snapshotId}/${digest}`;
  return { digest, files, manifestBody, prefix };
}

export async function uploadPreviewArtifact(
  bucket: PreviewArtifactBucket,
  snapshotId: string,
  rawFiles: readonly PreviewArtifactFile[],
  expectedDigest?: string,
  catalogReleaseId?: string,
): Promise<PreviewArtifactResult> {
  const descriptor = await describePreviewArtifact(
    snapshotId,
    rawFiles,
    expectedDigest,
    catalogReleaseId,
  );
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
      customMetadata: {
        artifactDigest: descriptor.digest,
        ...(catalogReleaseId ? { catalogReleaseId } : {}),
        sha256: fileDigest,
        snapshotId,
      },
      httpMetadata: { contentType: file.contentType },
    });
  }
  return { digest: descriptor.digest, prefix: descriptor.prefix };
}

function validMediaOrigins(value: unknown): value is string[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 8 || new Set(value).size !== value.length) {
    return false;
  }
  return value.every((entry) => {
    if (typeof entry !== "string") return false;
    try {
      const url = new URL(entry);
      return (
        url.protocol === "https:" &&
        url.username === "" &&
        url.password === "" &&
        url.origin === entry
      );
    } catch {
      return false;
    }
  });
}

function securityHeaders(origin: string, mediaOrigins: readonly string[] = []): Headers {
  const imageSources = [origin, ...mediaOrigins].join(" ");
  const turnstileOrigin = "https://challenges.cloudflare.com";
  return new Headers({
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": [
      `default-src ${origin}`,
      `script-src ${origin} ${turnstileOrigin}`,
      `style-src ${origin} 'unsafe-inline'`,
      `img-src ${imageSources}`,
      `font-src ${origin}`,
      "connect-src 'self'",
      `frame-src ${turnstileOrigin}`,
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

function validPreviewContext(
  value: PreviewAuthorization["previewContext"],
  authorizationExpiresAt: string,
): value is NonNullable<PreviewAuthorization["previewContext"]> {
  if (
    !value ||
    value.environment !== "private-preview" ||
    !digestPattern.test(value.contentDigest) ||
    !snapshotPattern.test(value.snapshotId) ||
    value.expiresAt !== authorizationExpiresAt ||
    (value.generatedAt !== null && !Number.isFinite(Date.parse(value.generatedAt)))
  ) {
    return false;
  }
  try {
    const returnUrl = new URL(value.returnUrl);
    return (
      returnUrl.protocol === "https:" && returnUrl.username === "" && returnUrl.password === ""
    );
  } catch {
    return false;
  }
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
    value.origin !== new URL(request.url).origin ||
    !validMediaOrigins(value.mediaOrigins)
  ) {
    return null;
  }
  return value as PreviewAuthorization;
}

const commerceRoutes = [
  { methods: new Set(["GET"]), pattern: /^\/platform\/config$/ },
  {
    methods: new Set(["GET"]),
    pattern: /^\/catalog\/products\/[A-Za-z0-9_-]{1,160}\/live$/,
    query: "currency",
  },
  {
    methods: new Set(["GET"]),
    pattern: /^\/catalog\/products\/by-id\/[A-Za-z0-9_-]{1,160}\/live$/,
    query: "currency",
  },
  { methods: new Set(["GET", "POST"]), pattern: /^\/cart$/ },
  { methods: new Set(["POST"]), pattern: /^\/cart\/lines$/ },
  {
    methods: new Set(["DELETE", "PATCH"]),
    pattern: /^\/cart\/lines\/[A-Za-z0-9_-]{1,160}$/,
  },
  { methods: new Set(["POST"]), pattern: /^\/cart\/adjustments\/acknowledge$/ },
  { methods: new Set(["PUT"]), pattern: /^\/cart\/shipping$/ },
  { methods: new Set(["POST"]), pattern: /^\/cart\/reservations$/ },
  { methods: new Set(["POST"]), pattern: /^\/checkout\/sessions$/ },
  { methods: new Set(["GET"]), pattern: /^\/orders\/[A-Za-z0-9_-]{40,160}$/ },
] as const;

const commerceBodyLimit = 64 * 1024;

function commercePath(pathname: string): string {
  const decoded = decodedPath(pathname);
  if (decoded !== pathname || !decoded.startsWith("/api/") || decoded.includes("\\")) {
    throw new Error("Commerce path is invalid.");
  }
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Commerce path is invalid.");
  }
  return decoded.slice("/api".length);
}

function matchingCommerceRoute(pathname: string) {
  return commerceRoutes.find(({ pattern }) => pattern.test(pathname));
}

function validCommerceQuery(route: (typeof commerceRoutes)[number], search: URLSearchParams) {
  if (!("query" in route)) return search.size === 0;
  return (
    search.size === 1 && search.has("currency") && /^[A-Z]{3}$/.test(search.get("currency") ?? "")
  );
}

function commerceRequestHeaders(
  request: Request,
  origin: string,
  catalogReleaseId: string,
  pathname: string,
): Headers {
  const headers = new Headers({
    Accept: "application/json",
    Origin: origin,
    "X-Preview-Catalog-Release": catalogReleaseId,
  });
  const authorization = request.headers.get("Authorization");
  const acceptsCartToken =
    (pathname === "/cart" && request.method === "GET") ||
    pathname.startsWith("/cart/") ||
    pathname === "/checkout/sessions";
  if (
    acceptsCartToken &&
    authorization &&
    /^CartToken [A-Za-z0-9_-]{32,160}$/.test(authorization)
  ) {
    headers.set("Authorization", authorization);
  }
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim();
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && contentType === "application/json") {
    headers.set("Content-Type", "application/json");
  }
  const requestId = request.headers.get("X-Request-Id");
  if (requestId && requestId.length <= 200 && !/[\r\n]/.test(requestId)) {
    headers.set("X-Request-Id", requestId);
  }
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (
    mutation &&
    idempotencyKey &&
    idempotencyKey.length <= 200 &&
    !/[\r\n]/.test(idempotencyKey)
  ) {
    headers.set("Idempotency-Key", idempotencyKey);
  }
  if (pathname === "/checkout/sessions") {
    const turnstile = request.headers.get("X-Turnstile-Token");
    if (turnstile && /^[A-Za-z0-9._~-]{1,2048}$/.test(turnstile)) {
      headers.set("X-Turnstile-Token", turnstile);
    }
  }
  return headers;
}

function commerceResponse(upstream: Response): Response {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of ["Content-Type", "Retry-After", "X-Request-Id"] as const) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { headers, status: upstream.status });
}

async function forwardCommerce(
  request: Request,
  environment: PreviewAccessEnvironment,
  authorization: PreviewAuthorization,
  origin: string,
): Promise<Response> {
  const catalogReleaseId = authorization.inputIdentity?.catalogReleaseId;
  if (!catalogReleaseId || !catalogReleasePattern.test(catalogReleaseId)) {
    return responseWithSecurity("Preview Catalog identity is unavailable.", origin, 403);
  }
  const requestUrl = new URL(request.url);
  let pathname: string;
  try {
    pathname = commercePath(requestUrl.pathname);
  } catch {
    return responseWithSecurity("Commerce path is invalid.", origin, 400);
  }
  const route = matchingCommerceRoute(pathname);
  if (!route || !route.methods.has(request.method as never)) {
    return responseWithSecurity("Method not allowed.", origin, 405);
  }
  if (!validCommerceQuery(route, requestUrl.searchParams)) {
    return responseWithSecurity("Commerce query is invalid.", origin, 400);
  }
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.headers.get("Origin") !== origin
  ) {
    return responseWithSecurity("Commerce origin is not authorized.", origin, 403);
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (
    !Number.isFinite(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > commerceBodyLimit
  ) {
    return responseWithSecurity("Commerce payload is too large.", origin, 413);
  }
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > commerceBodyLimit) {
    return responseWithSecurity("Commerce payload is too large.", origin, 413);
  }
  const upstreamRequest = new Request(`https://commerce.internal${pathname}${requestUrl.search}`, {
    body,
    headers: commerceRequestHeaders(request, origin, catalogReleaseId, pathname),
    method: request.method,
    redirect: "manual",
  });
  let upstream: Response;
  try {
    if (!environment.COMMERCE_API) throw new Error("Commerce binding is missing.");
    upstream = await environment.COMMERCE_API.fetch(upstreamRequest);
  } catch {
    return responseWithSecurity("Commerce is unavailable.", origin, 503);
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return responseWithSecurity("Commerce returned an unexpected redirect.", origin, 502);
  }
  return commerceResponse(upstream);
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
    if (!previewSession(request)) {
      return responseWithSecurity("Preview session required.", configuredOrigin.origin, 401);
    }
    let authorization: PreviewAuthorization | null;
    try {
      authorization = await authorize(request, environment, now());
    } catch {
      return responseWithSecurity(
        "Preview authorization is unavailable.",
        configuredOrigin.origin,
        503,
      );
    }
    if (!authorization) {
      return responseWithSecurity(
        "Preview session is invalid or expired.",
        configuredOrigin.origin,
        403,
      );
    }
    if (requestUrl.pathname === "/__preview/context") {
      if (!validPreviewContext(authorization.previewContext, authorization.expiresAt)) {
        return responseWithSecurity(
          "Preview context is unavailable.",
          configuredOrigin.origin,
          503,
        );
      }
      return responseWithSecurity(
        JSON.stringify(authorization.previewContext),
        configuredOrigin.origin,
        200,
        "application/json; charset=utf-8",
      );
    }
    if (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")) {
      return forwardCommerce(request, environment, authorization, configuredOrigin.origin);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return responseWithSecurity("Method not allowed.", configuredOrigin.origin, 405);
    }
    let assetPath: string;
    try {
      assetPath = normalizePreviewRequestAssetPath(requestUrl.pathname);
    } catch {
      return responseWithSecurity("Preview asset path is invalid.", configuredOrigin.origin, 400);
    }
    const object = await environment.PREVIEW_ARTIFACTS.get(
      `${authorization.artifactPrefix}/${assetPath}`,
    );
    if (!object) {
      return responseWithSecurity("Preview artifact not found.", configuredOrigin.origin, 404);
    }
    const headers = securityHeaders(configuredOrigin.origin, authorization.mediaOrigins);
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
