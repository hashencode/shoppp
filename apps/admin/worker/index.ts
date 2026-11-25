interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  ADMIN_HOSTNAME: string;
  API: Fetcher;
  ASSETS: Fetcher;
}

export function upstreamApiRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/api".length) || "/";
  return new Request(url, request);
}

export default {
  fetch(request: Request, environment: Environment): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/theme-editor/")) return editorEntry(request, environment);
    return path === "/api" || path.startsWith("/api/")
      ? environment.API.fetch(upstreamApiRequest(request))
      : environment.ASSETS.fetch(request);
  },
};

async function editorEntry(request: Request, environment: Environment): Promise<Response> {
  const sessionUrl = new URL("/admin/session", request.url);
  const session = await environment.API.fetch(new Request(sessionUrl, { headers: request.headers }));
  if (!session.ok) return new Response(null, { status: session.status, headers: { "Cache-Control": "no-store" } });
  const body = await session.json() as { data?: { permissions?: string[] } };
  if (!body.data?.permissions?.includes("themes.read"))
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  const response = await environment.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  const nonce = crypto.randomUUID();
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'none'; base-uri 'self'`);
  const content = headers.get("Content-Type")?.includes("text/html")
    ? (await response.text()).replaceAll(/<script(?=\s|>)/g, `<script nonce="${nonce}"`)
    : response.body;
  return new Response(content, { status: response.status, headers });
}
