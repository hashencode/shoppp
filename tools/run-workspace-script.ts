import { Glob } from "bun";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

interface WorkspacePackage {
  name: string;
  path: string;
  scripts: Record<string, string>;
}

interface Options {
  ifPresent: boolean;
  script: string;
  workspace?: string;
}

function parseArguments(arguments_: string[]): Options {
  const [script, ...flags] = arguments_;
  if (!script) {
    throw new Error(
      "Usage: bun tools/run-workspace-script.ts <script> [--if-present] [--workspace=<name>]",
    );
  }

  const workspaceFlag = flags.find((flag) => flag.startsWith("--workspace="));
  return {
    ifPresent: flags.includes("--if-present"),
    script,
    ...(workspaceFlag ? { workspace: workspaceFlag.slice("--workspace=".length) } : {}),
  };
}

async function loadWorkspaces(root: string): Promise<WorkspacePackage[]> {
  const glob = new Glob("{apps,packages}/*/package.json");
  const paths = Array.from(glob.scanSync({ cwd: root, onlyFiles: true })).sort();

  return Promise.all(
    paths.map(async (path) => {
      const packageJson = JSON.parse(await readFile(`${root}/${path}`, "utf8")) as {
        name?: string;
        scripts?: Record<string, string>;
      };
      if (!packageJson.name) {
        throw new Error(`${path} must declare a package name.`);
      }
      return {
        name: packageJson.name,
        path: dirname(path),
        scripts: packageJson.scripts ?? {},
      };
    }),
  );
}

async function main(): Promise<void> {
  const root = process.cwd();
  const options = parseArguments(Bun.argv.slice(2));
  const allWorkspaces = await loadWorkspaces(root);
  const selected = options.workspace
    ? allWorkspaces.filter((workspace) => workspace.name === options.workspace)
    : allWorkspaces;
  const runnable = selected.filter((workspace) => options.script in workspace.scripts);
  const missing = selected.filter((workspace) => !(options.script in workspace.scripts));

  if (missing.length > 0 && !options.ifPresent) {
    throw new Error(
      `Missing "${options.script}" script in: ${missing.map((workspace) => workspace.name).join(", ")}`,
    );
  }

  if (runnable.length === 0) {
    console.log(`No workspace currently defines "${options.script}"; gate is not yet applicable.`);
    return;
  }

  for (const workspace of runnable) {
    console.log(`\n> ${workspace.name}: ${options.script}`);
    const child = Bun.spawn(["bun", "run", options.script], {
      cwd: `${root}/${workspace.path}`,
      env: process.env,
      stderr: "inherit",
      stdin: "inherit",
      stdout: "inherit",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

await main();
