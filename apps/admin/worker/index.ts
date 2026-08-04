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
    return path === "/api" || path.startsWith("/api/")
      ? environment.API.fetch(upstreamApiRequest(request))
      : environment.ASSETS.fetch(request);
  },
};
