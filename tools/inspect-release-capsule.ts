import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import manifest from "../containers/release-validation/manifest.json";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function output(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert(exitCode === 0, stderr.trim() || `${command.join(" ")} failed`);
  return stdout.trim();
}

async function commandDigest(command: string): Promise<{ path: string; sha256: string }> {
  const path = Bun.which(command);
  assert(path, `release capsule command ${command} is missing`);
  const digest = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  return { path, sha256: `sha256:${digest}` };
}

function fileDigest(contents: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

export async function inspectReleaseCapsuleToolchain(
  options: {
    verify?: boolean;
  } = {},
): Promise<Record<string, unknown>> {
  const packages = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.systemPackages).map(async ([name, expected]) => {
        const actual = await output(["dpkg-query", "-W", "-f=${Version}", name]);
        if (options.verify)
          assert(actual === expected, `${name} drifted: expected ${expected}, received ${actual}`);
        return [name, actual];
      }),
    ),
  );
  const commands = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.toolchain.systemCommands).map(async (name) => [
        name,
        await commandDigest(name),
      ]),
    ),
  );
  const browserEntries = (await readdir("/ms-playwright")).sort();
  const browserExecutables = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.toolchain.browserExecutables).map(async (path) => [
        path,
        fileDigest(await readFile(path)),
      ]),
    ),
  );
  const playwright = JSON.parse(await readFile("apps/storefront/package.json", "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const playwrightVersion = playwright.devDependencies?.["@playwright/test"];
  if (options.verify) {
    assert(
      Bun.version === manifest.toolchain.bun,
      `Bun drifted: expected ${manifest.toolchain.bun}, received ${Bun.version}`,
    );
    assert(
      process.platform === "linux" && process.arch === "x64",
      "release capsule platform drifted",
    );
    assert(
      playwrightVersion === manifest.toolchain.playwright,
      "Playwright package version drifted",
    );
    assert(
      (await output(["node", "--version"])) === manifest.toolchain.node,
      "Node.js version drifted",
    );
    assert(
      JSON.stringify(commands) === JSON.stringify(manifest.toolchain.systemCommands),
      "release capsule command inventory drifted",
    );
    assert(
      JSON.stringify(browserEntries) === JSON.stringify(manifest.toolchain.browserEntries),
      "release capsule browser inventory drifted",
    );
    assert(
      JSON.stringify(browserExecutables) === JSON.stringify(manifest.toolchain.browserExecutables),
      "release capsule browser executable drifted",
    );
  }
  return {
    baseImages: manifest.baseImages,
    browserEntries,
    browserExecutables,
    bun: Bun.version,
    commands,
    manifestDigest: fileDigest(await readFile("containers/release-validation/manifest.json")),
    node: await output(["node", "--version"]),
    osRelease: await readFile("/etc/os-release", "utf8"),
    packages,
    platform: `${process.platform}/${process.arch === "x64" ? "amd64" : process.arch}`,
    playwright: playwrightVersion,
    schemaVersion: 1,
  };
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: { verify: { type: "boolean", default: false } },
  });
  console.log(JSON.stringify(await inspectReleaseCapsuleToolchain({ verify: values.verify })));
}
