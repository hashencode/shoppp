import { createHash } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import manifest from "../containers/release-validation/manifest.json";
import { safeReleaseId } from "./release-validate";

type Environment = Record<string, string | undefined>;

interface CapsuleRunOptions {
  image: string;
  outputDirectory: string;
  releaseId: string;
}

interface BuiltCapsule {
  image: string;
  previousImage?: string;
  source: { commit: string; tree: string };
}

export const CAPSULE_PLATFORM = "linux/amd64" as const;
export const RELEASE_CAPSULE_MANIFEST = manifest;

const ROOT = resolve(import.meta.dir, "..");
const PINNED_IMAGE = /^(?:[A-Za-z0-9./_-]+@)?sha256:[a-f0-9]{64}$/;
const FORBIDDEN_CREDENTIAL = /(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL)/i;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertReleaseCapsuleEnvironment(environment: Environment): void {
  assert(
    environment.SHOPPP_RELEASE_OPERATOR_CONTEXT === "approved",
    "release capsule requires an approved release-operator context",
  );
  const github = Object.entries(environment).find(
    ([name, value]) => name.startsWith("GITHUB_") && Boolean(value),
  );
  assert(!github, `release capsule rejects GitHub environment variable ${github?.[0] ?? ""}`);
  const credential = Object.entries(environment).find(
    ([name, value]) => FORBIDDEN_CREDENTIAL.test(name) && Boolean(value),
  );
  assert(!credential, `release capsule rejects ambient credential ${credential?.[0] ?? ""}`);
}

export function capsuleRunArguments(options: CapsuleRunOptions): string[] {
  assert(PINNED_IMAGE.test(options.image), "release capsule image must be digest-pinned");
  safeReleaseId(options.releaseId, "release capsule ID");
  assert(isAbsolute(options.outputDirectory), "release capsule output directory must be absolute");
  assert(
    !/[,\n\r]/.test(options.outputDirectory),
    "release capsule output directory contains unsafe characters",
  );
  return [
    "run",
    "--rm",
    "--platform",
    CAPSULE_PLATFORM,
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "2048",
    "--shm-size",
    "1gb",
    "--mount",
    `type=bind,src=${options.outputDirectory},dst=/evidence`,
    "--env",
    "CI=true",
    "--env",
    `RELEASE_ID=${options.releaseId}`,
    options.image,
  ];
}

async function output(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert(exitCode === 0, stderr.trim() || `${command.join(" ")} failed`);
  return stdout.trim();
}

async function run(command: string[], stdin?: ReadableStream): Promise<void> {
  const child = stdin
    ? Bun.spawn(command, { cwd: ROOT, stdin, stdout: "inherit", stderr: "inherit" })
    : Bun.spawn(command, { cwd: ROOT, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const exitCode = await child.exited;
  assert(exitCode === 0, `${command.join(" ")} failed with exit ${exitCode}`);
}

async function execute(command: string[]): Promise<number> {
  const child = Bun.spawn(command, {
    cwd: ROOT,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return child.exited;
}

async function optionalOutput(command: string[]): Promise<string | undefined> {
  try {
    return await output(command);
  } catch {
    return undefined;
  }
}

export async function probeReleaseCapsuleRuntime(): Promise<void> {
  let server: string;
  try {
    server = await output(["docker", "version", "--format", "{{.Server.Os}}"]);
  } catch (error) {
    throw new Error(
      `release capsule infrastructure failure: Docker server unavailable: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  assert(server === "linux", `release capsule requires a Linux Docker server, received ${server}`);
}

export function sourceTreeRevision(commit: string): string {
  assert(/^[a-f0-9]{40}$/.test(commit), "release capsule source commit is invalid");
  return `${commit}^{tree}`;
}

async function exactSourceIdentity(): Promise<{ commit: string; tree: string }> {
  const status = await output(["git", "status", "--porcelain", "--untracked-files=all"]);
  assert(!status, "release capsule requires a clean source checkout including untracked files");
  const commit = await output(["git", "rev-parse", "HEAD"]);
  const tree = await output(["git", "rev-parse", sourceTreeRevision(commit)]);
  assert(/^[a-f0-9]{40}$/.test(tree), "release capsule source tree is invalid");
  return { commit, tree };
}

async function buildReleaseCapsule(): Promise<BuiltCapsule> {
  const source = await exactSourceIdentity();
  const identity = JSON.stringify({ schemaVersion: 1, ...source });
  const archive = Bun.spawn(
    [
      "git",
      "archive",
      "--format=tar",
      `--add-virtual-file=.release-source.json:${identity}`,
      source.commit,
    ],
    { cwd: ROOT, stdout: "pipe", stderr: "inherit" },
  );
  const tag = "shoppp-release-capsule:local-cache";
  const previousImage = await optionalOutput([
    "docker",
    "image",
    "inspect",
    "--format",
    "{{.Id}}",
    tag,
  ]);
  await run(
    [
      "docker",
      "build",
      "--platform",
      CAPSULE_PLATFORM,
      "--build-arg",
      `SOURCE_COMMIT=${source.commit}`,
      "--build-arg",
      `SOURCE_TREE=${source.tree}`,
      "--file",
      "containers/release-validation/Dockerfile",
      "--tag",
      tag,
      "-",
    ],
    archive.stdout,
  );
  assert((await archive.exited) === 0, "git archive failed");
  const image = await output(["docker", "image", "inspect", "--format", "{{.Id}}", tag]);
  assert(PINNED_IMAGE.test(image), "built release capsule did not produce a pinned image ID");
  console.log(`Release capsule image: ${image}`);
  return { image, ...(previousImage ? { previousImage } : {}), source };
}

async function fileDigest(path: string): Promise<string> {
  return `sha256:${createHash("sha256")
    .update(await readFile(path))
    .digest("hex")}`;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

async function writeCapsuleReceipt(options: {
  built: BuiltCapsule;
  containerExitCode: number;
  outputDirectory: string;
  releaseId: string;
}): Promise<boolean> {
  const reportPath = resolve(options.outputDirectory, `${options.releaseId}.json`);
  const toolchain = JSON.parse(
    await output([
      "docker",
      "run",
      "--rm",
      "--platform",
      CAPSULE_PLATFORM,
      "--network",
      "none",
      "--entrypoint",
      "cat",
      options.built.image,
      "/usr/local/share/shoppp-release-toolchain.json",
    ]),
  ) as { manifestDigest?: unknown };
  assert(
    typeof toolchain.manifestDigest === "string" && PINNED_IMAGE.test(toolchain.manifestDigest),
    "release capsule image has no valid manifest digest",
  );
  const classification = await classifyCapsuleResult({
    containerExitCode: options.containerExitCode,
    releaseId: options.releaseId,
    reportPath,
  });
  const receipt = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    source: options.built.source,
    imageId: options.built.image,
    platform: CAPSULE_PLATFORM,
    manifestDigest: toolchain.manifestDigest,
    toolchain,
    containerExitCode: options.containerExitCode,
    report: classification.reportValid
      ? { path: `${options.releaseId}.json`, digest: await fileDigest(reportPath) }
      : null,
    classification: classification.kind,
  };
  const final = resolve(options.outputDirectory, `${options.releaseId}.capsule.json`);
  const temporary = resolve(
    options.outputDirectory,
    `.${options.releaseId}.capsule.json.tmp.${process.pid}`,
  );
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  try {
    await link(temporary, final);
  } finally {
    await unlink(temporary);
  }
  return classification.kind === "validation" && options.containerExitCode === 0;
}

export async function classifyCapsuleResult(options: {
  containerExitCode: number;
  releaseId: string;
  reportPath: string;
}): Promise<{ kind: "validation" | "infrastructure"; reportValid: boolean }> {
  if (![0, 1].includes(options.containerExitCode) || !(await isFile(options.reportPath))) {
    return { kind: "infrastructure", reportValid: false };
  }
  try {
    const report = JSON.parse(await readFile(options.reportPath, "utf8")) as {
      schemaVersion?: unknown;
      releaseId?: unknown;
      status?: unknown;
    };
    const expectedStatus = options.containerExitCode === 0 ? "passed" : "failed";
    const reportValid =
      report.schemaVersion === 1 &&
      report.releaseId === options.releaseId &&
      report.status === expectedStatus;
    return { kind: reportValid ? "validation" : "infrastructure", reportValid };
  } catch {
    return { kind: "infrastructure", reportValid: false };
  }
}

async function removePreviousCapsuleImage(built: BuiltCapsule): Promise<void> {
  if (!built.previousImage || built.previousImage === built.image) return;
  const child = Bun.spawn(["docker", "image", "rm", built.previousImage], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [error, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited]);
  if (exitCode !== 0) {
    console.warn(`Previous capsule image retained: ${error.trim() || built.previousImage}`);
  }
}

export async function runReleaseCapsule(options: {
  outputDirectory: string;
  releaseId: string;
}): Promise<void> {
  assertReleaseCapsuleEnvironment(process.env);
  await probeReleaseCapsuleRuntime();
  const outputDirectory = await prepareCapsuleEvidenceDirectory(options.outputDirectory);
  const built = await buildReleaseCapsule();
  const containerExitCode = await execute([
    "docker",
    ...capsuleRunArguments({ ...options, image: built.image, outputDirectory }),
  ]);
  const passed = await writeCapsuleReceipt({
    built,
    containerExitCode,
    outputDirectory,
    releaseId: options.releaseId,
  });
  if (passed) await removePreviousCapsuleImage(built);
  assert(containerExitCode === 0, `release capsule failed with exit ${containerExitCode}`);
}

export async function prepareCapsuleEvidenceDirectory(directory: string): Promise<string> {
  assert(isAbsolute(directory), "release capsule output directory must be absolute");
  assert(!/[,\n\r]/.test(directory), "release capsule output directory contains unsafe characters");
  const expected = resolve(directory);
  await mkdir(expected, { recursive: true, mode: 0o700 });
  const metadata = await lstat(expected);
  assert(
    metadata.isDirectory() && !metadata.isSymbolicLink(),
    "release capsule output is not a real directory",
  );
  const canonical = await realpath(expected);
  assert((await readdir(canonical)).length === 0, "release capsule output directory must be empty");
  return canonical;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      probe: { type: "boolean", default: false },
      "output-directory": { type: "string" },
      "release-id": { type: "string" },
    },
  });
  if (values.probe) {
    await probeReleaseCapsuleRuntime();
    console.log(`Release capsule runtime is available for ${CAPSULE_PLATFORM}.`);
  } else {
    const releaseId = values["release-id"];
    const outputDirectory = values["output-directory"];
    assert(releaseId, "--release-id is required");
    assert(outputDirectory, "--output-directory is required");
    await runReleaseCapsule({ releaseId, outputDirectory });
  }
}
