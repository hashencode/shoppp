// Run after `bun run --cwd apps/storefront build`; requires local Node, OpenSSL and Chromium.
// Only isolated in-memory D1 and a loopback HTTPS listener are used. No hosted services.
import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { resolve, extname, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiRequire = createRequire(resolve(root, "apps/api/package.json"));
const wranglerRequire = createRequire(apiRequire.resolve("wrangler"));
const { Miniflare } = await import(pathToFileURL(wranglerRequire.resolve("miniflare")).href);
const { readD1Migrations } = await import(
  pathToFileURL(
    resolve(root, "apps/api/node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs"),
  ).href
);
const { build } = await import(pathToFileURL(wranglerRequire.resolve("esbuild")).href);
const storefrontRequire = createRequire(resolve(root, "apps/storefront/package.json"));
const { chromium } = storefrontRequire("@playwright/test");
const temporary = await mkdtemp(resolve(tmpdir(), "shoppp-cda-probe-"));
await build({
  stdin: {
    contents: `import {createApp} from ${JSON.stringify(resolve(root, "apps/api/src/http/app.ts"))}; const app=createApp({testIdentityVerifier:async()=>({email:'cda@example.test',principalKind:'human',subject:'cda-e2e'})});export default {fetch:app.fetch};`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:*", "node:*"],
  outfile: resolve(temporary, "worker.mjs"),
});
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    resolve(temporary, "local.key"),
    "-out",
    resolve(temporary, "local.crt"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
  ],
  { stdio: "ignore" },
);
const origin = "https://127.0.0.1:3444";
const mf = new Miniflare({
  rootPath: temporary,
  modulesRoot: temporary,
  modules: true,
  scriptPath: resolve(temporary, "worker.mjs"),
  compatibilityDate: "2026-07-22",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  bindings: {
    ENVIRONMENT: "development",
    AUTH_TOKEN_SECRET: randomBytes(32).toString("hex"),
    ADMIN_ORIGIN: origin,
    STOREFRONT_ORIGIN: origin,
    PREVIEW_ORIGIN: "https://preview.example.test",
    PUBLIC_ORIGIN: origin,
    RESOURCE_NAMESPACE: "cda-development",
    MEDIA_PUBLIC_ORIGIN: "https://media.example.test",
    TAX_MODE: "zero",
    TRAFFIC_ENABLED: "true",
    TRAFFIC_ACTIVE_KEY_ID: "local",
    TRAFFIC_KEYS_JSON: JSON.stringify({ local: randomBytes(32).toString("hex") }),
  },
});
let server, browser;
try {
  const db = await mf.getD1Database("DB");
  for (const migration of await readD1Migrations(root + "/packages/db/migrations"))
    await db.batch(migration.queries.map((q) => db.prepare(q)));
  const release = JSON.parse(
    await readFile(root + "/apps/storefront/fixtures/release.json", "utf8"),
  );
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO catalog_releases(id,status,purpose,environment,manifest_json,approved_at,deployed_at,created_at,updated_at) VALUES (?,'deployed','public','development',?,?,?,?,?)",
    )
    .bind(release.releaseId, JSON.stringify(release), now, now, now, now)
    .run();
  await db
    .prepare(
      "INSERT INTO admin_identities(id,principal_kind,access_subject,normalized_email,display_name,role_id,enabled,version,created_at,updated_at) VALUES ('cda-admin','human','cda-e2e','cda@example.test','CDA','role_analyst',1,1,?,?)",
    )
    .bind(now, now)
    .run();
  server = createServer(
    {
      key: await readFile(resolve(temporary, "local.key")),
      cert: await readFile(resolve(temporary, "local.crt")),
    },
    async (req, res) => {
      try {
        if (req.url.startsWith("/api/")) {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const response = await mf.dispatchFetch(origin + req.url.slice(4), {
            method: req.method,
            headers: req.headers,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        let file = resolve(
          root + "/apps/storefront/.output/public",
          "." + decodeURIComponent(req.url.split("?")[0]),
        );
        if ((await stat(file)).isDirectory()) file += "/index.html";
        const mime =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".json": "application/json",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          }[extname(file)] ?? "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(await readFile(file));
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  );
  await new Promise((resolve) => server.listen(3444, "127.0.0.1", resolve));
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const failures = [];
  page.on("response", (r) => {
    if (r.url().includes("/traffic/") && r.status() >= 400) failures.push(r.status());
  });
  await page.goto(origin + "/products/atlas-carry-on");
  async function pv(expected) {
    for (let i = 0; i < 50; i++) {
      const n = await db
        .prepare("SELECT COALESCE(SUM(page_views),0) n FROM traffic_pv_buckets WHERE product_id=''")
        .first("n");
      if (n === expected) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("PV did not reach " + expected + " failures=" + failures);
  }
  await pv(1);
  await page.reload();
  await pv(2);
  await page.evaluate(async () =>
    document.querySelector("#__nuxt").__vue_app__.config.globalProperties.$router.push("/"),
  );
  await pv(3);
  const second = await context.newPage();
  await second.goto(origin + "/");
  await pv(4);
  const cookies = await context.cookies();
  const identity = cookies.find((c) => c.name === "__Host-shoppp-traffic");
  if (!identity?.httpOnly || !identity.secure) throw Error("Identity flags");
  const date = now.slice(0, 10);
  const reportResponse = await mf.dispatchFetch(
    origin + `/admin/reporting/traffic?startDate=${date}&endDate=${date}&timeZone=UTC`,
    { headers: { "X-Test-Admin-Identity": "local-test", Origin: origin } },
  );
  const envelope = await reportResponse.json();
  if (reportResponse.status !== 200)
    throw Error("report status " + reportResponse.status + " " + JSON.stringify(envelope));
  const report = envelope.data;
  if (
    report.uniqueVisitors !== 1 ||
    report.pageViews !== 4 ||
    report.products[0]?.pageViews !== 2 ||
    report.products[0]?.path !== "/products/atlas-carry-on"
  )
    throw Error("Unexpected report " + JSON.stringify(report));
  console.log(
    JSON.stringify({
      status: "pass",
      uniqueVisitors: report.uniqueVisitors,
      pageViews: report.pageViews,
      productViews: report.products[0].pageViews,
      publicLink: report.storefrontOrigin + report.products[0].path,
      secureHttpOnlyIdentity: true,
      trafficFailures: failures.length,
    }),
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await mf.dispose();
  await rm(temporary, { recursive: true, force: true });
}
