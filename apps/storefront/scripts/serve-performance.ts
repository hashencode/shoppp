import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const publicRoot = resolve(import.meta.dir, "../.output/public");
const port = Number(process.env.STOREFRONT_PERF_PORT || 3421);

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
    const file = await publicFile(new URL(request.url).pathname);
    if (file) return staticResponse(file, request);

    return staticResponse(Bun.file(resolve(publicRoot, "404.html")), request, 404);
  },
});

console.log(`Static performance server listening on http://127.0.0.1:${port}`);
