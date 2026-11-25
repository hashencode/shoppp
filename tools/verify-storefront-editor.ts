import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import worker from "../apps/admin/worker/index";
import { editorContext, editorDocument } from "../apps/storefront/tests/fixtures/editor-context";

const root = resolve(import.meta.dir, "../apps/admin/public/theme-editor");
const screenshots = resolve(
  import.meta.dir,
  "../.artifacts/screenshots/2026-10-31-storefront-visual-editor",
);
const transactions: string[] = [];
let authenticated = true;
const server = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/harness")
      return new Response(
        '<!doctype html><iframe src="/theme-editor/" title="Editor" style="width:100%;height:900px;border:0"></iframe><script>window.messages=[];addEventListener("message",event=>window.messages.push(event.data))</script>',
        { headers: { "Content-Type": "text/html" } },
      );
    return worker.fetch(request, {
      ADMIN_HOSTNAME: url.hostname,
      API: {
        fetch: async (request) => {
          if (!authenticated) return new Response(null, { status: 401 });
          const path = new URL(request.url).pathname;
          if (path === "/admin/session")
            return Response.json({ data: { permissions: ["themes.read"] } });
          if (path === `/admin/storefront-editor/sessions/${editorContext.id}`)
            return Response.json({ data: editorContext });
          transactions.push(`${request.method} ${path}`);
          return new Response(null, { status: 405 });
        },
      },
      ASSETS: {
        fetch: async (request) => {
          let path = new URL(request.url).pathname.slice("/theme-editor".length);
          if (path.endsWith("/")) path += "index.html";
          const filePath = resolve(root, `.${path}`);
          if (!filePath.startsWith(`${root}/`)) return new Response(null, { status: 404 });
          const file = Bun.file(filePath);
          return (await file.exists()) ? new Response(file) : new Response(null, { status: 404 });
        },
      },
    });
  },
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://**", (route) => route.abort());
  await page.goto(`http://127.0.0.1:${server.port}/harness`);
  const waitForMessage = (kind: string, revision?: number) =>
    page.waitForFunction(
      ({ kind, revision }) =>
        (
          window as unknown as { messages: Array<{ kind: string; revision?: number }> }
        ).messages.some(
          (message) =>
            message.kind === kind && (revision === undefined || revision === message.revision),
        ),
      { kind, revision },
      { timeout: 15_000 },
    );
  await waitForMessage("ready");
  const post = (message: unknown) =>
    page.evaluate(
      (message) =>
        (
          globalThis.document.querySelector("iframe") as HTMLIFrameElement
        ).contentWindow!.postMessage(message, location.origin),
      message,
    );
  const identity = { protocol: 1, sessionId: editorContext.id, nonce: editorContext.nonce };
  await post({ ...identity, kind: "initialize" });
  await waitForMessage("applied", 0);
  const document = structuredClone(editorDocument);
  const message = {
    ...identity,
    kind: "update",
    revision: 1,
    document,
    templateId: document.templates[0]!.id,
    path: "/",
    mode: "inspect",
  };
  await post(message);
  await waitForMessage("applied", 1);
  const frame = page.frames().find((frame) => frame.url().endsWith("/theme-editor/"))!;
  const samples: number[] = [];
  for (let revision = 2; revision <= 11; revision++) {
    const title = `Autumn local preview ${revision}`;
    document.templates[0]!.sections[0]!.blocks[0]!.settings.title = title;
    const start = performance.now();
    await post({ ...message, revision, document });
    await waitForMessage("applied", revision);
    await frame.getByText(title, { exact: true }).first().waitFor();
    samples.push(performance.now() - start);
  }
  await frame.getByText("Autumn local preview 11", { exact: true }).first().click();
  await waitForMessage("select", 11);
  const selection = await page.evaluate(
    () =>
      (window as unknown as { messages: Array<{ kind: string; instanceId: string }> }).messages
        .filter((message) => message.kind === "select")
        .at(-1)?.instanceId,
  );
  if (selection !== document.templates[0]!.sections[0]!.blocks[0]!.id)
    throw new Error("The preview did not select the clicked Hero Block.");
  await post({ ...message, revision: 3, document: editorDocument });
  await post({ ...message, revision: 12, nonce: crypto.randomUUID(), document: editorDocument });
  if (!(await frame.locator("body").innerText()).includes("Autumn local preview 11"))
    throw new Error("An old or unauthorized message replaced the current preview.");
  document.templates[0]!.styles = { accent: "#123456", buttonRadius: 12, spacing: 24 };
  document.templates[0]!.sections = document.templates[0]!.sections.filter(
    ({ type }) => type !== "fashion-store.hero",
  );
  document.bindings = document.bindings.filter(
    ({ instanceId }) => instanceId !== "fashion-store-home" && !instanceId.includes("hero-slide"),
  );
  await post({ ...message, revision: 12, document });
  await waitForMessage("applied", 12);
  if (await frame.locator('[data-editor-instance="fashion-store-home"]').count())
    throw new Error("The removed Hero is still rendered.");
  const headerIdentity = await frame
    .locator("header a[aria-label]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  if (!headerIdentity.includes("Editor fixture store home"))
    throw new Error(`Shared header identity mismatch: ${JSON.stringify(headerIdentity)}`);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: resolve(screenshots, "actual-vue-preview.png"), fullPage: true });
  authenticated = false;
  const denied = await page.request.get(`http://127.0.0.1:${server.port}/theme-editor/`);
  if (denied.status() !== 401 || transactions.length || errors.length)
    throw new Error(JSON.stringify({ denied: denied.status(), transactions, errors }));
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        viewport: "1440x1000",
        reducedMotion: true,
        warmSamples: samples.length,
        p95Ms: sorted[Math.ceil(samples.length * 0.95) - 1],
        authenticatedEntry: true,
        foreignOrOldMessagesRejected: true,
        blockSelection: true,
        sharedShellWithoutHero: true,
        commerceRequests: transactions.length,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.stop(true);
}
