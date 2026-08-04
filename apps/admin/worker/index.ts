import { shouldForwardAccessAssertion } from "../authenticated-dev-policy";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  ADMIN_HOSTNAME: string;
  API: Fetcher;
  ASSETS: Fetcher;
}

export function upstreamApiRequest(request: Request, protectedHostname?: string): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/api".length) || "/";
  const upstream = new Request(url, request);
  if (!protectedHostname || !shouldForwardAccessAssertion(url.hostname, protectedHostname)) {
    upstream.headers.delete("Cf-Access-Jwt-Assertion");
  }
  return upstream;
}

export default {
  fetch(request: Request, environment: Environment): Promise<Response> {
    const path = new URL(request.url).pathname;
    return path === "/api" || path.startsWith("/api/")
      ? environment.API.fetch(upstreamApiRequest(request, environment.ADMIN_HOSTNAME))
      : environment.ASSETS.fetch(request);
  },
};
