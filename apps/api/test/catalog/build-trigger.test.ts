import { describe, expect, test, vi } from "vitest";

import type { ApiEnvironment } from "../../src/http/context";
import { defaultBuildTrigger } from "../../src/publishing/releases";

describe("catalog build trigger", () => {
  test("bounds an unavailable deploy hook with an abort signal", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json({ correlationId: "build-timeout-contract" });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const trigger = defaultBuildTrigger({
        BUILD_HOOK_TOKEN: "build-hook-secret-at-least-32-bytes",
        STOREFRONT_BUILD_HOOK: "https://deploy.example.test/hooks/catalog",
      } as ApiEnvironment["Bindings"]);
      await expect(
        trigger({
          environment: "staging",
          releaseId: "release-timeout-contract",
          requestId: crypto.randomUUID(),
        }),
      ).resolves.toEqual({ correlationId: "build-timeout-contract" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
