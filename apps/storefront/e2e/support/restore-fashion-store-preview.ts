import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const storefrontRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function run(command: string, args: string[], environment: NodeJS.ProcessEnv = process.env) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: storefrontRoot,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code ?? "no status"}.`));
    });
  });
}

export default async function restoreFashionStorePreview(): Promise<void> {
  await run("bun", ["scripts/prepare-theme-preview-fixture.ts", "fashion-store"]);
  await run("bun", ["scripts/prepare-experience.ts"], {
    ...process.env,
    STOREFRONT_BUILD_MODE: "preview",
    STOREFRONT_EXPERIENCE_FILE: "fixtures/experience/.generated/fashion-store-preview-input.json",
  });
}
