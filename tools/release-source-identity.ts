import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ReleaseSourceIdentity {
  commit: string;
  tree: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function readReleaseSourceIdentity(
  root: string,
  environment: Record<string, string | undefined> = process.env,
): Promise<ReleaseSourceIdentity | undefined> {
  if (environment.RELEASE_SOURCE_MODE !== "capsule") return undefined;
  const source = JSON.parse(await readFile(resolve(root, ".release-source.json"), "utf8")) as {
    schemaVersion?: unknown;
    commit?: unknown;
    tree?: unknown;
  };
  assert(source.schemaVersion === 1, "release capsule source schema is invalid");
  assert(
    typeof source.commit === "string" && /^[a-f0-9]{40}$/.test(source.commit),
    "release capsule source commit is invalid",
  );
  assert(
    typeof source.tree === "string" && /^[a-f0-9]{40}$/.test(source.tree),
    "release capsule source tree is invalid",
  );
  return { commit: source.commit, tree: source.tree };
}
