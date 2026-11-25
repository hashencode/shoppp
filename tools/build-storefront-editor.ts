import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const build = Bun.spawn([process.execPath, "x", "--no-install", "nuxt", "generate", "editor"], {
  cwd: resolve(root, "apps/storefront"),
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
});
if ((await build.exited) !== 0)
  throw new Error("The authenticated storefront editor bundle could not be built.");
const destination = resolve(root, "apps/admin/public/theme-editor");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(resolve(root, "apps/storefront/editor/.output/public"), destination, { recursive: true });
