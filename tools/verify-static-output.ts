import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const STOREFRONT_OUTPUT = resolve(ROOT, "apps/storefront/.output/public");
const ADMIN_OUTPUT = resolve(ROOT, "apps/admin/dist");

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".map",
  ".md",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const SECRET_PATTERNS = [
  { label: "Stripe secret key", pattern: /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9_-]{8,}/ },
  { label: "Stripe webhook secret", pattern: /\bwhsec_[A-Za-z0-9_-]{8,}/ },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
] as const;

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

function luhnValid(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export async function verifyNoSensitiveBuildArtifacts(
  directories = [STOREFRONT_OUTPUT, ADMIN_OUTPUT],
): Promise<void> {
  const files = (await Promise.all(directories.map(filesBelow))).flat();
  for (const path of files) {
    if (!TEXT_EXTENSIONS.has(extname(path))) continue;
    const content = await readFile(path, "utf8");
    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) throw new Error(`${path} contains a ${label}.`);
    }
    const numberCandidates =
      content.match(
        /\b(?:\d{15,19}|\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{1,7})?|\d{4}[ -]\d{6}[ -]\d{5})\b/g,
      ) ?? [];
    if (numberCandidates.some(luhnValid)) {
      throw new Error(`${path} contains raw card-shaped data.`);
    }
  }
}

async function verifyTrackedSourceSafety(root: string): Promise<void> {
  const git = Bun.spawn(["git", "ls-files", "-z"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const paths = (await new Response(git.stdout).text()).split("\0").filter(Boolean);
  const error = await new Response(git.stderr).text();
  if ((await git.exited) !== 0) throw new Error(error || "could not enumerate tracked source");

  for (const relativePath of paths) {
    if (!TEXT_EXTENSIONS.has(extname(relativePath))) continue;
    let content: string;
    try {
      content = await readFile(resolve(root, relativePath), "utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(content)) throw new Error(`${relativePath} contains a ${label}.`);
    }
    const numberCandidates =
      content.match(
        /\b(?:\d{15,19}|\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{1,7})?|\d{4}[ -]\d{6}[ -]\d{5})\b/g,
      ) ?? [];
    if (numberCandidates.some(luhnValid)) {
      throw new Error(`${relativePath} contains raw card-shaped data.`);
    }
  }
}

async function verifyNoProductionOnlyMarkers(directory: string): Promise<void> {
  const forbidden = [
    "Admin Quick Start",
    "/api/template/",
    "mockServiceWorker",
    "[MSW]",
    "https://api.example.invalid",
  ];
  for (const path of await filesBelow(directory)) {
    if (!TEXT_EXTENSIONS.has(extname(path))) continue;
    const content = await readFile(path, "utf8");
    const marker = forbidden.find((candidate) => content.includes(candidate));
    if (marker) throw new Error(`${path} contains forbidden production marker ${marker}.`);
  }
}

function requireHeader(content: string, header: string): void {
  if (!content.toLowerCase().includes(header.toLowerCase())) {
    throw new Error(`static headers are missing ${header}`);
  }
}

export async function verifyStaticOutput(root = ROOT): Promise<void> {
  await verifyTrackedSourceSafety(root);
  const storefrontHeaders = await readFile(
    resolve(root, "apps/storefront/public/_headers"),
    "utf8",
  );
  const adminHeaders = await readFile(resolve(root, "apps/admin/public/_headers"), "utf8");

  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ]) {
    requireHeader(storefrontHeaders, header);
    requireHeader(adminHeaders, header);
  }
  requireHeader(storefrontHeaders, "immutable");
  requireHeader(storefrontHeaders, "noindex, nofollow");
  requireHeader(adminHeaders, "noindex, nofollow");
  requireHeader(adminHeaders, "no-store");

  for (const required of [
    resolve(root, "apps/storefront/.output/public/index.html"),
    resolve(root, "apps/storefront/.output/public/404.html"),
    resolve(root, "apps/storefront/.output/public/_headers"),
    resolve(root, "apps/admin/dist/index.html"),
    resolve(root, "apps/admin/dist/_headers"),
  ]) {
    await stat(required);
  }

  const storefrontIndex = await readFile(
    resolve(root, "apps/storefront/.output/public/index.html"),
    "utf8",
  );
  if (!storefrontIndex.includes('<link rel="canonical"') || !storefrontIndex.includes("<h1")) {
    throw new Error("storefront index is an empty shell or is missing its canonical URL");
  }
  const adminIndex = await readFile(resolve(root, "apps/admin/dist/index.html"), "utf8");
  if (!adminIndex.includes('name="robots"') || !adminIndex.includes("noindex")) {
    throw new Error("admin output must be explicitly non-indexable");
  }

  await verifyNoSensitiveBuildArtifacts([
    resolve(root, "apps/storefront/.output/public"),
    resolve(root, "apps/admin/dist"),
  ]);
  await verifyNoProductionOnlyMarkers(resolve(root, "apps/storefront/.output/public"));
  await verifyNoProductionOnlyMarkers(resolve(root, "apps/admin/dist"));
}

if (import.meta.main) {
  await verifyStaticOutput();
  console.log("Static deployment headers, HTML, and sensitive-artifact checks passed.");
}
