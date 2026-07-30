import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const publicRoot = resolve(import.meta.dir, "../.output/public");
const port = Number(Bun.argv[2] || 3421);

interface RedirectRule {
  from: string;
  status: number;
  to: string;
}

const redirectRules: RedirectRule[] = (await readFile(resolve(publicRoot, "_redirects"), "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [from, to, rawStatus = "302"] = line.split(/\s+/);
    return { from, status: Number(rawStatus), to };
  });

function matchingRedirect(pathname: string): RedirectRule | undefined {
  return redirectRules.find(({ from }) =>
    from.endsWith("*") ? pathname.startsWith(from.slice(0, -1)) : pathname === from,
  );
}

async function staticResponse(
  file: Bun.BunFile,
  request: Request,
  status = 200,
): Promise<Response> {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": file.type,
    Vary: "Accept-Encoding",
  });
  if (request.headers.get("Accept-Encoding")?.includes("gzip")) {
    headers.set("Content-Encoding", "gzip");
    return new Response(Bun.gzipSync(await file.bytes()), { headers, status });
  }
  return new Response(file, { headers, status });
}

async function publicFile(pathname: string): Promise<Bun.BunFile | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  const direct = resolve(publicRoot, relative || "index.html");
  if (direct !== publicRoot && !direct.startsWith(`${publicRoot}${sep}`)) return null;

  for (const candidate of [direct, resolve(direct, "index.html")]) {
    try {
      if ((await stat(candidate)).isFile()) return Bun.file(candidate);
    } catch {
      // Try the directory index or the static 404 below.
    }
  }
  return null;
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/platform/events" && request.method === "POST") {
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return Response.json(
        {
          error: { code: "api_unavailable", message: "API routes require an integration server." },
        },
        { headers: { "Cache-Control": "no-store" }, status: 503 },
      );
    }

    const rule = matchingRedirect(url.pathname);
    if (rule && rule.status >= 300 && rule.status < 400) {
      return new Response(null, { headers: { Location: rule.to }, status: rule.status });
    }

    const pathname = rule?.status === 200 ? rule.to : url.pathname;
    const file = await publicFile(pathname);
    if (file) return staticResponse(file, request);

    return staticResponse(Bun.file(resolve(publicRoot, "404.html")), request, 404);
  },
});

console.log(`Static storefront test server listening on http://127.0.0.1:${port}`);
