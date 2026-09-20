import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";
import type { Context } from "hono";

import { createApp } from "../../src/http/app";
import type { ApiEnvironment } from "../../src/http/context";
import { serveLocalCatalogMedia } from "../../src/media/uploads";

const KEY = "catalog/products/local-serving.webp";

function localContext(path: string): Context<ApiEnvironment> {
  return {
    env: { ENVIRONMENT: "development", MEDIA: env.MEDIA },
    req: { path },
  } as unknown as Context<ApiEnvironment>;
}

describe("local catalog media serving", () => {
  beforeEach(async () => {
    await env.MEDIA.delete(KEY);
  });

  test("serves a safe catalog object only in development", async () => {
    await env.MEDIA.put(KEY, new Uint8Array([82, 73, 70, 70]), {
      httpMetadata: { contentType: "image/webp" },
    });
    const local = await serveLocalCatalogMedia(localContext(`/media/${KEY}`));
    expect(local.status).toBe(200);
    expect(local.headers.get("content-type")).toBe("image/webp");
    expect(local.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(new Uint8Array(await local.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));

    const staging = await createApp().fetch(
      new Request(`https://api.example.test/media/${KEY}`),
      env,
    );
    expect(staging.status).toBe(404);
  });

  test("rejects unsafe and missing local media keys", async () => {
    await expect(
      serveLocalCatalogMedia(localContext("/media/private/secret.webp")),
    ).rejects.toThrow("local media object was not found");
    await expect(
      serveLocalCatalogMedia(localContext("/media/catalog/products/missing.webp")),
    ).rejects.toThrow("local media object was not found");
  });
});
