import {
  storefrontReleaseMarkerSchema,
  storefrontStagingCatalogObservationSchema,
  type StorefrontReleaseMarker,
} from "@shoppp/contracts";
import { orderAccessAssetPath } from "./order-assets";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  API: Fetcher;
  ASSETS: Fetcher;
  CF_VERSION_METADATA?: { id: string };
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
    if (path === "/.well-known/shoppp-release") return releaseObservation(request, environment);
    if (path === "/.well-known/shoppp-release/catalog")
      return releaseObservation(request, environment, true);
    return path === "/api" || path.startsWith("/api/")
      ? publicApiRequest(request, environment)
      : environment.ASSETS.fetch(
          path.startsWith("/orders/") ? staticAssetRequest(request) : request,
        );
  },
};

async function compiledMarker(
  request: Request,
  environment: Environment,
): Promise<StorefrontReleaseMarker | null> {
  if (!environment.CF_VERSION_METADATA?.id) return null;
  const asset = await environment.ASSETS.fetch(
    new Request(new URL("/__shoppp-release.json", request.url)),
  );
  if (!asset.ok) return null;
  return storefrontReleaseMarkerSchema.parse(await asset.json());
}

async function publicApiRequest(request: Request, environment: Environment): Promise<Response> {
  const upstream = upstreamApiRequest(request);
  try {
    const marker = await compiledMarker(request, environment);
    if (!marker) return environment.API.fetch(upstream);
    const headers = new Headers(upstream.headers);
    headers.set("X-Preview-Catalog-Release", marker.identity.catalogReleaseId);
    headers.set("X-Storefront-Catalog-Manifest-Digest", marker.identity.catalogManifestDigest);
    return environment.API.fetch(new Request(upstream, { headers }));
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

async function releaseObservation(
  request: Request,
  environment: Environment,
  includeCatalog = false,
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "GET")
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
  try {
    const marker = await compiledMarker(request, environment);
    if (!marker) return new Response(null, { status: 404, headers });
    const observation = { ...marker, workerVersionId: environment.CF_VERSION_METADATA!.id };
    if (!includeCatalog) return Response.json(observation, { headers });
    const catalog = await environment.ASSETS.fetch(
      new Request(new URL("/__shoppp-catalog.json", request.url)),
    );
    if (!catalog.ok) return new Response(null, { status: 503, headers });
    const catalogManifestJson = await catalog.text();
    const rawDigest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(catalogManifestJson),
    );
    const digest = Array.from(new Uint8Array(rawDigest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    if (
      digest !== marker.identity.catalogManifestDigest ||
      JSON.parse(catalogManifestJson).releaseId !== marker.identity.catalogReleaseId
    ) {
      return new Response(null, { status: 503, headers });
    }
    return Response.json(
      storefrontStagingCatalogObservationSchema.parse({ ...observation, catalogManifestJson }),
      { headers },
    );
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
