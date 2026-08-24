import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { importAdminTemplate } from "./import-admin-template";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function git(root: string, arguments_: string[]): Promise<void> {
  const process = Bun.spawnSync(["git", "--no-pager", ...arguments_], {
    cwd: root,
    env: {
      ...Bun.env,
      GIT_AUTHOR_DATE: "2026-07-29T23:25:41+08:00",
      GIT_COMMITTER_DATE: "2026-07-29T23:25:41+08:00",
    },
    stderr: "pipe",
    stdout: "ignore",
  });
  if (process.exitCode !== 0) {
    throw new Error(process.stderr.toString());
  }
}

async function writeFixtureFile(root: string, path: string, contents: string): Promise<void> {
  const absolutePath = join(root, path);
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function createSourceRepository(): Promise<{
  approvedCommit: string;
  destination: string;
  manifestPath: string;
  root: string;
  source: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-admin-import-"));
  temporaryRoots.push(root);
  const source = join(root, "source");
  const destination = join(root, "destination");
  const manifestPath = join(root, "admin-template-manifest.json");
  await mkdir(source);
  await git(source, ["init", "--quiet"]);
  await git(source, ["config", "user.name", "Template Owner"]);
  await git(source, ["config", "user.email", "owner@example.test"]);

  await Promise.all([
    writeFixtureFile(source, "package.json", '{"name":"template"}\n'),
    writeFixtureFile(source, "src/main.tsx", "export const source = 'committed';\n"),
    writeFixtureFile(source, "public/logo.svg", "<svg />\n"),
    writeFixtureFile(source, "e2e/smoke.spec.ts", "export {};\n"),
    writeFixtureFile(source, "docs/ai/rules.md", "# Rules\n"),
    writeFixtureFile(source, "docs/testing-standards.md", "# Tests\n"),
    writeFixtureFile(source, ".env.test", "SECRET=must-not-copy\n"),
    writeFixtureFile(source, ".agents/memories/ACTIVE.md", "local memory\n"),
    writeFixtureFile(source, "reports/audit.json", '{"private":true}\n'),
    writeFixtureFile(source, "bun.lock", "source lock\n"),
    writeFixtureFile(source, "AGENTS.md", "source-only instructions\n"),
  ]);
  await git(source, ["add", "."]);
  await git(source, ["commit", "--quiet", "-m", "fixture"]);
  const approvedCommit = (
    await readFile(join(source, ".git", "refs", "heads", "master"), "utf8")
  ).trim();

  await writeFixtureFile(source, "src/main.tsx", "export const source = 'dirty';\n");
  await writeFixtureFile(source, "src/uncommitted.tsx", "export {};\n");

  return { approvedCommit, destination, manifestPath, root, source };
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

describe("importAdminTemplate", () => {
  test("copies an approved commit reproducibly and excludes local or sensitive paths", async () => {
    const fixture = await createSourceRepository();
    expect(fixture.approvedCommit).toMatch(/^[0-9a-f]{40}$/);
    const options = {
      approvedCommit: fixture.approvedCommit,
      destination: fixture.destination,
      importedAt: "2026-07-30",
      manifestPath: fixture.manifestPath,
      ownershipAssertion: "The user supplied and authorized this template for copying.",
      source: fixture.source,
      sourceLabel: "fixture-admin-template",
    };

    const firstManifest = await importAdminTemplate(options);
    const firstManifestContents = await readFile(fixture.manifestPath, "utf8");
    const secondManifest = await importAdminTemplate(options);

    expect(secondManifest).toEqual(firstManifest);
    expect(await readFile(fixture.manifestPath, "utf8")).toBe(firstManifestContents);
    expect(await readFile(join(fixture.destination, "src/main.tsx"), "utf8")).toContain(
      "'committed'",
    );
    expect(await pathExists(join(fixture.destination, "src/uncommitted.tsx"))).toBe(false);
    expect(await pathExists(join(fixture.destination, ".env.test"))).toBe(false);
    expect(await pathExists(join(fixture.destination, ".agents"))).toBe(false);
    expect(await pathExists(join(fixture.destination, "reports"))).toBe(false);
    expect(await pathExists(join(fixture.destination, "bun.lock"))).toBe(false);
    expect(await pathExists(join(fixture.destination, "AGENTS.md"))).toBe(false);
    expect(await readFile(join(fixture.source, "src/main.tsx"), "utf8")).toBe(
      "export const source = 'dirty';\n",
    );
    expect(await readFile(join(fixture.source, "src/uncommitted.tsx"), "utf8")).toBe(
      "export {};\n",
    );
  }, 15_000);

  test("rejects a source revision other than the approved commit", async () => {
    const fixture = await createSourceRepository();

    await expect(
      importAdminTemplate({
        approvedCommit: "0000000000000000000000000000000000000000",
        destination: fixture.destination,
        importedAt: "2026-07-30",
        manifestPath: fixture.manifestPath,
        ownershipAssertion: "Authorized fixture.",
        source: fixture.source,
        sourceLabel: "fixture-admin-template",
      }),
    ).rejects.toThrow("approved commit");
  });
});
