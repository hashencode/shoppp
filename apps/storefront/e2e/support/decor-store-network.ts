import type { Request } from "@playwright/test";

export function isDecorStoreBusinessRequest(request: Request): boolean {
  if (!["fetch", "xhr"].includes(request.resourceType())) return false;
  const path = new URL(request.url()).pathname;
  return !path.startsWith("/_nuxt/") && !path.endsWith("/_payload.json");
}
