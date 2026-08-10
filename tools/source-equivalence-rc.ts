import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

import { digestArtifact } from "./release-validate";
import { loadSourceEquivalencePolicy } from "./verify-source-equivalent-themes";

export interface SourceEquivalenceRcManifest {
  acceptancePolicy: { digest: string; path: string };
  artifact: { digest: string; path: string };
  commit: string;
  createdAt: string;
  schemaVersion: 1;
  stage: "rc-frozen";
  theme: string;
  tree: string;
}

const ROOT = resolve(import.meta.dir, "..");
const POLICY_PATH = "tools/storefront-source-equivalence-policy.json";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function safeRelativePath(root: string, path: string): string {
  const absolute = resolve(root, path);
  const relativePath = relative(root, absolute);
  assert(
    relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath),
    "RC artifacts must be inside the repository and cannot be the repository root",
  );
  return relativePath;
}

async function git(root: string, ...arguments_: string[]): Promise<string> {
  const child = Bun.spawn(["git", ...arguments_], {
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || `git ${arguments_.join(" ")} failed`);
  return stdout.trim();
}

export async function createSourceEquivalenceRcManifest(options: {
  artifactPath: string;
  commit: string;
  createdAt?: string;
  root?: string;
  theme: string;
  tree: string;
}): Promise<SourceEquivalenceRcManifest> {
  const root = options.root ?? ROOT;
  const artifactPath = safeRelativePath(root, options.artifactPath);
  const policyPath = safeRelativePath(root, POLICY_PATH);
  return {
    acceptancePolicy: {
      digest: await digestArtifact(resolve(root, policyPath), root),
      path: policyPath,
    },
    artifact: {
      digest: await digestArtifact(resolve(root, artifactPath), root),
      path: artifactPath,
    },
    commit: options.commit,
    createdAt: options.createdAt ?? new Date().toISOString(),
    schemaVersion: 1,
    stage: "rc-frozen",
    theme: options.theme,
    tree: options.tree,
  };
}

export async function verifySourceEquivalenceRcManifest(
  manifest: SourceEquivalenceRcManifest,
  options: {
    commit: string;
    root?: string;
    trackedChanges: string;
    tree: string;
  },
): Promise<void> {
  const root = options.root ?? ROOT;
  assert(manifest.schemaVersion === 1, "unsupported source-equivalence RC schema");
  assert(manifest.stage === "rc-frozen", "manifest is not a frozen RC");
  assert(/^[a-f0-9]{40}$/.test(manifest.commit), "RC manifest requires a full commit SHA");
  assert(/^[a-f0-9]{40}$/.test(manifest.tree), "RC manifest requires a full tree SHA");
  assert(!options.trackedChanges, "RC verification requires a clean tracked working tree");
  assert(manifest.commit === options.commit, "current commit differs from the frozen RC");
  assert(manifest.tree === options.tree, "current tracked tree differs from the frozen RC");

  const artifactPath = safeRelativePath(root, manifest.artifact.path);
  const policyPath = safeRelativePath(root, manifest.acceptancePolicy.path);
  assert(
    (await digestArtifact(resolve(root, artifactPath), root)) === manifest.artifact.digest,
    "RC build artifact digest changed after freeze",
  );
  assert(
    (await digestArtifact(resolve(root, policyPath), root)) === manifest.acceptancePolicy.digest,
    "RC acceptance policy digest changed after freeze",
  );
}

async function repositoryIdentity(root: string): Promise<{
  commit: string;
  trackedChanges: string;
  tree: string;
}> {
  const [commit, trackedChanges, tree] = await Promise.all([
    git(root, "rev-parse", "HEAD"),
    git(root, "status", "--porcelain", "--untracked-files=no"),
    git(root, "rev-parse", "HEAD^{tree}"),
  ]);
  return { commit, trackedChanges, tree };
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      artifact: { type: "string" },
      commit: { type: "string" },
      manifest: { type: "string" },
      output: { type: "string" },
      theme: { type: "string" },
    },
    strict: true,
  });
  const action = positionals[0];
  assert(
    action === "freeze" || action === "verify",
    "Usage: source-equivalence-rc.ts <freeze|verify>",
  );
  const identity = await repositoryIdentity(ROOT);

  if (action === "freeze") {
    assert(values.theme, "RC freeze requires --theme=<id>");
    assert(values.artifact, "RC freeze requires --artifact=<built-directory>");
    assert(!identity.trackedChanges, "RC freeze requires a clean tracked working tree");
    const policy = await loadSourceEquivalencePolicy();
    assert(
      policy.themes.some(({ id }) => id === values.theme),
      `unknown theme: ${values.theme}`,
    );
    const manifest = await createSourceEquivalenceRcManifest({
      artifactPath: values.artifact,
      commit: identity.commit,
      theme: values.theme,
      tree: identity.tree,
    });
    const output = resolve(
      ROOT,
      values.output ??
        `artifacts/source-equivalence/rc/${values.theme}-${identity.commit.slice(0, 12)}.json`,
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ manifest: relative(ROOT, output), ...manifest }, null, 2));
    return;
  }

  assert(values.manifest, "RC verification requires --manifest=<path>");
  assert(values.commit, "RC verification requires --commit=<full-git-sha>");
  assert(/^[a-f0-9]{40}$/.test(values.commit), "RC verification requires a full commit SHA");
  const manifest = JSON.parse(
    await readFile(resolve(ROOT, values.manifest), "utf8"),
  ) as SourceEquivalenceRcManifest;
  assert(manifest.commit === values.commit, "requested commit differs from the frozen RC");
  await verifySourceEquivalenceRcManifest(manifest, { ...identity, root: ROOT });
  console.log(
    JSON.stringify({ artifact: manifest.artifact, commit: manifest.commit, rcVerified: true }),
  );
}

if (import.meta.main) await main();
