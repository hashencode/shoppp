import { orderAccessAssetPath } from "./order-assets";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  API: Fetcher;
  ASSETS: Fetcher;
}

export function upstreamApiRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice("/api".length) || "/";
  return new Request(url, request);
}

export function staticAssetRequest(request: Request): Request {
  const url = new URL(request.url);
  const pathname = orderAccessAssetPath(url.pathname);
  if (pathname === url.pathname) {
    return request;
  }
  url.pathname = pathname;
  return new Request(url, request);
}

export default {
  fetch(request: Request, environment: Environment): Promise<Response> {
    const path = new URL(request.url).pathname;
    return path === "/api" || path.startsWith("/api/")
      ? environment.API.fetch(upstreamApiRequest(request))
      : environment.ASSETS.fetch(
          path.startsWith("/orders/") ? staticAssetRequest(request) : request,
        );
  },
};
