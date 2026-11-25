import { expect, test } from "bun:test";
import worker from "../apps/admin/worker/index";

test("editor entry requires the current theme reader and keeps data private", async () => {
  let assets = 0;
  const request = new Request("https://admin.test/theme-editor/");
  const environment = { ADMIN_HOSTNAME: "admin.test",
    API: { fetch: async () => Response.json({ data: { permissions: ["themes.read"] } }) },
    ASSETS: { fetch: async () => { assets++; return new Response('<html><script>ready()</script></html>', { headers: { 'Content-Type': 'text/html' } }); } },
  };
  const response = await worker.fetch(request, environment);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(await response.text()).toContain('nonce=');
  const denied = await worker.fetch(request, { ...environment, API: { fetch: async () => new Response(null, { status: 401 }) } });
  expect(denied.status).toBe(401);
  expect(assets).toBe(1);
});
