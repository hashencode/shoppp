import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import {
  appendFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { CAPSULE_PLATFORM, parsePassingReleaseReport } from "./release-capsule";
import { safeReleaseId } from "./release-validate";

const CURRENT_POLICY_VERSION = "2026-08-26";
const SUPPORTED_POLICY_VERSIONS = ["2026-08-25", CURRENT_POLICY_VERSION] as const;
type EvidencePolicyVersion = (typeof SUPPORTED_POLICY_VERSIONS)[number];
const MAX_CERTIFICATE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const SHA = /^[0-9a-f]{40,64}$/;
const DIGEST = /^sha256:([0-9a-f]{64})$/;
const OBJECT_NAME = /^objects\/([0-9a-f]{64})$/;

export type RetentionClass = "intel-append-only" | "operator-vps-object-lock";

export interface EvidenceTrustStore {
  schemaVersion: 1;
  roots: Array<{
    algorithm: "Ed25519";
    keyId: string;
    publicKeyPem: string;
    status: "trusted" | "revoked";
  }>;
  revokedSignerKeyIds: string[];
}

export interface SignerCertificatePayload {
  schemaVersion: 1;
  algorithm: "Ed25519";
  usage: "candidate-evidence";
  rootKeyId: string;
  signerKeyId: string;
  signerPublicKeyPem: string;
  notBefore: string;
  notAfter: string;
}

export interface SignerCertificate {
  payload: SignerCertificatePayload;
  rootSignature: string;
}

interface EvidenceObject {
  digest: string;
  objectName: string;
  role: "source-archive" | "declared-input" | "release-report" | "capsule-receipt";
  size: number;
  sourcePath: string;
}

interface EvidenceArtifact {
  digest: string;
  path: string;
}

export interface CandidateEvidenceManifest {
  schemaVersion: 1;
  policyVersion: EvidencePolicyVersion;
  source: {
    archiveDigest: string;
    commit: string;
    tree: string;
  };
  capsuleReceipt: {
    digest: string;
    imageId: string;
    manifestDigest: string;
    path: string;
    platform: typeof CAPSULE_PLATFORM;
  };
  declaredInputs: string[];
  releaseReport: {
    digest: string;
    path: string;
    releaseId: string;
    target: string;
  };
  artifacts: EvidenceArtifact[];
  objects: EvidenceObject[];
}

interface EvidenceProvenance {
  schemaVersion: 1;
  adapterIdentity: string;
  attemptId: string;
  executorIdentity: string;
  issuedAt: string;
}

interface EvidenceSignature {
  schemaVersion: 1;
  algorithm: "Ed25519";
  certificate: SignerCertificate;
  manifestDigest: string;
  provenanceDigest: string;
  signature: string;
}

interface CapsuleReceipt {
  classification: "validation";
  containerExitCode: 0;
  imageId: string;
  manifestDigest: string;
  platform: typeof CAPSULE_PLATFORM;
  report: { digest: string; path: string };
  source: { commit: string; tree: string };
  toolchain: {
    baseImages: Record<string, string>;
    browserEntries: string[];
    browserExecutables: Record<string, string>;
    bun: string;
    commands: Record<string, { path: string; sha256: string }>;
    manifestDigest: string;
    node: string;
    packages: Record<string, string>;
    platform: typeof CAPSULE_PLATFORM;
    playwright: string;
  };
}

interface PreparedAuditEvent {
  action: "bundle-prepared";
  adapterIdentity: string;
  at: string;
  manifestDigest: string;
  provenanceDigest: string;
  result: "passed";
}

interface AddressedAuditEvent {
  action: "bundle-finalized" | "projection-verified" | "restore-verified";
  adapterIdentity: string;
  at: string;
  bundleDigest: string;
  result: "passed";
  retentionClass?: RetentionClass;
  retentionId?: string;
}

type AuditEvent = PreparedAuditEvent | AddressedAuditEvent;

interface RetentionWitnessPayload {
  at: string;
  bundleDigest: string;
  manifestDigest: string;
  provenanceDigest: string;
  retentionTargets: Array<{
    administrativeDomain: string;
    id: string;
    retentionClass: RetentionClass;
  }>;
  schemaVersion: 1;
}

interface RetentionWitness {
  algorithm: "Ed25519";
  certificate: SignerCertificate;
  payload: RetentionWitnessPayload;
  signature: string;
}

interface RetentionTarget {
  administrativeDomain: string;
  id: string;
  retentionClass: RetentionClass;
  root: string;
}

interface BuildOptions {
  adapterIdentity: string;
  approvedCommit: string;
  attemptId: string;
  canarySecrets?: string[];
  capsuleReceiptPath: string;
  certificatePath: string;
  executorIdentity: string;
  issuedAt?: string;
  releaseReportPath: string;
  repository: string;
  retentionTargets: RetentionTarget[];
  signerPrivateKeyPath: string;
  spoolRoot: string;
  trustStorePath: string;
  auditLogPath?: string;
}

interface VerifyOptions {
  bundlePath: string;
  expectedBundleDigest: string;
  now?: string;
  trustStorePath: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isEvidencePolicyVersion(value: unknown): value is EvidencePolicyVersion {
  return SUPPORTED_POLICY_VERSIONS.some((version) => version === value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} is invalid`,
  );
  return value as Record<string, unknown>;
}

function exactRecord(value: unknown, keys: string[], label: string): Record<string, unknown> {
  const candidate = record(value, label);
  assert(
    JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify([...keys].sort()),
    `${label} has unknown or missing fields`,
  );
  return candidate;
}

function canonicalDocument<T>(bytes: Uint8Array, label: string, parse: (value: unknown) => T): T {
  const text = new TextDecoder().decode(bytes);
  const parsed = parse(JSON.parse(text));
  assert(text === `${canonicalJson(parsed)}\n`, `${label} is not canonical JSON`);
  return parsed;
}

function string(value: unknown, label: string): string {
  assert(typeof value === "string" && value.length > 0, `${label} is invalid`);
  return value;
}

function digest(value: unknown, label: string): string {
  const result = string(value, label);
  assert(DIGEST.test(result), `${label} is invalid`);
  return result;
}

function sha(value: unknown, label: string): string {
  const result = string(value, label);
  assert(SHA.test(result), `${label} is invalid`);
  return result;
}

function safeId(value: unknown, label: string): string {
  const result = string(value, label);
  safeReleaseId(result, label);
  return result;
}

function relativeArtifactPath(value: unknown, label: string): string {
  const result = string(value, label);
  assert(!result.startsWith("/") && !result.split(/[\\/]/).includes(".."), `${label} is invalid`);
  return result;
}

function base64(value: unknown, label: string): string {
  const result = string(value, label);
  assert(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result),
    `${label} is invalid`,
  );
  return result;
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    assert(Number.isFinite(value), "canonical JSON rejects non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  assert(typeof value === "object", "canonical JSON rejects unsupported values");
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalize(entry)]),
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function sha256(bytes: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function git(repository: string, ...args: string[]): Promise<Uint8Array> {
  const child = Bun.spawn(["git", ...args], {
    cwd: repository,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, error, exitCode] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(error.trim() || `git ${args.join(" ")} failed`);
  return new Uint8Array(output);
}

async function gitText(repository: string, ...args: string[]): Promise<string> {
  return new TextDecoder().decode(await git(repository, ...args)).trim();
}

export async function deriveGitTreeFromArchive(bytes: Uint8Array): Promise<string> {
  const temporary = await mkdtemp(join(tmpdir(), "shoppp-evidence-archive-"));
  try {
    const archive = join(temporary, "source.tar");
    const checkout = join(temporary, "checkout");
    await writeFile(archive, bytes, { flag: "wx" });
    const listing = Bun.spawn(["tar", "-tf", archive], { stdout: "pipe", stderr: "pipe" });
    const [entries, listingError, listingExit] = await Promise.all([
      new Response(listing.stdout).text(),
      new Response(listing.stderr).text(),
      listing.exited,
    ]);
    assert(listingExit === 0, listingError.trim() || "source archive inventory is invalid");
    for (const entry of entries.split("\n").filter(Boolean)) {
      assert(
        !entry.startsWith("/") && !entry.split("/").includes(".."),
        `source archive contains an unsafe path: ${entry}`,
      );
    }
    await mkdir(checkout);
    const extraction = Bun.spawn(["tar", "-xf", archive, "-C", checkout], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const extractionError = await new Response(extraction.stderr).text();
    assert(
      (await extraction.exited) === 0,
      extractionError.trim() || "source archive extraction failed",
    );
    await gitText(checkout, "init", "--quiet");
    await gitText(checkout, "add", "-f", "--", ".");
    return await gitText(checkout, "write-tree");
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

function repositoryPath(repository: string, path: string): string {
  const root = resolve(repository);
  const absolute = resolve(root, path);
  assert(
    absolute === root || absolute.startsWith(`${root}${sep}`),
    `evidence input escapes repository: ${path}`,
  );
  return absolute;
}

async function filesUnder(path: string): Promise<string[]> {
  const metadata = await lstat(path);
  assert(!metadata.isSymbolicLink(), `evidence input must not be a symbolic link: ${path}`);
  if (metadata.isFile()) return [path];
  assert(metadata.isDirectory(), `unsupported artifact input: ${path}`);
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => filesUnder(join(path, entry.name))),
  );
  return nested.flat();
}

function relativePath(repository: string, path: string): string {
  const value = relative(repository, path).split(sep).join("/");
  assert(value && !value.startsWith("../"), `input is outside repository: ${path}`);
  return value;
}

function assertNoSecrets(bytes: Uint8Array, label: string, canarySecrets: string[]): void {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  for (const canary of canarySecrets) {
    assert(!canary || !text.includes(canary), `canary secret found in ${label}`);
  }
  const prohibited = [
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/,
    /authorization["':=\s]+bearer\s+[A-Za-z0-9._~+/-]{12,}/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgrant_[A-Za-z0-9_-]{16,}\b/,
  ];
  assert(
    !prohibited.some((pattern) => pattern.test(text)),
    `credential material found in ${label}`,
  );
}

async function writeCanonical(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${canonicalJson(value)}\n`, { flag: "wx" });
}

async function appendAudit(
  path: string | undefined,
  event: AuditEvent,
  canarySecrets: string[] = [],
): Promise<void> {
  if (!path) return;
  assertNoSecrets(Buffer.from(canonicalJson(event)), "external audit event", canarySecrets);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${canonicalJson(event)}\n`, { mode: 0o600 });
}

export function createSignerCertificate(options: {
  notAfter: string;
  notBefore: string;
  rootKeyId: string;
  rootPrivateKeyPem: string;
  signerKeyId: string;
  signerPublicKeyPem: string;
}): SignerCertificate {
  safeReleaseId(options.rootKeyId, "root key ID");
  safeReleaseId(options.signerKeyId, "signer key ID");
  const notBefore = Date.parse(options.notBefore);
  const notAfter = Date.parse(options.notAfter);
  assert(Number.isFinite(notBefore) && Number.isFinite(notAfter), "certificate dates are invalid");
  assert(notAfter > notBefore, "certificate expiry must follow issue time");
  assert(
    notAfter - notBefore <= MAX_CERTIFICATE_LIFETIME_MS,
    "signer certificate lifetime exceeds 90 days",
  );
  const payload: SignerCertificatePayload = {
    algorithm: "Ed25519",
    notAfter: new Date(notAfter).toISOString(),
    notBefore: new Date(notBefore).toISOString(),
    rootKeyId: options.rootKeyId,
    schemaVersion: 1,
    signerKeyId: options.signerKeyId,
    signerPublicKeyPem: options.signerPublicKeyPem,
    usage: "candidate-evidence",
  };
  const rootSignature = sign(
    null,
    Buffer.from(canonicalJson(payload)),
    createPrivateKey(options.rootPrivateKeyPem),
  ).toString("base64");
  return { payload, rootSignature };
}

function validateTrustStore(value: unknown): EvidenceTrustStore {
  const store = exactRecord(
    value,
    ["revokedSignerKeyIds", "roots", "schemaVersion"],
    "evidence trust store",
  );
  assert(store.schemaVersion === 1, "unsupported evidence trust-store schema");
  assert(Array.isArray(store.roots), "evidence trust store roots are missing");
  assert(Array.isArray(store.revokedSignerKeyIds), "revoked signer list is missing");
  const roots = store.roots.map((candidate) => {
    const root = exactRecord(
      candidate,
      ["algorithm", "keyId", "publicKeyPem", "status"],
      "trust root",
    );
    assert(root.algorithm === "Ed25519", "unsupported trust-root algorithm");
    assert(root.status === "trusted" || root.status === "revoked", "invalid trust-root status");
    const publicKeyPem = string(root.publicKeyPem, "root public key");
    assert(
      createPublicKey(publicKeyPem).asymmetricKeyType === "ed25519",
      "trust root is not Ed25519",
    );
    return {
      algorithm: "Ed25519" as const,
      keyId: safeId(root.keyId, "root key ID"),
      publicKeyPem,
      status: root.status as "trusted" | "revoked",
    };
  });
  const revokedSignerKeyIds = store.revokedSignerKeyIds.map((keyId) =>
    safeId(keyId, "revoked signer key ID"),
  );
  return { schemaVersion: 1, roots, revokedSignerKeyIds };
}

function parseSignerCertificate(value: unknown): SignerCertificate {
  const certificate = exactRecord(value, ["payload", "rootSignature"], "signer certificate");
  const candidate = exactRecord(
    certificate.payload,
    [
      "algorithm",
      "notAfter",
      "notBefore",
      "rootKeyId",
      "schemaVersion",
      "signerKeyId",
      "signerPublicKeyPem",
      "usage",
    ],
    "signer certificate payload",
  );
  assert(candidate.schemaVersion === 1, "unsupported signer certificate schema");
  assert(candidate.algorithm === "Ed25519", "unsupported signer algorithm");
  assert(candidate.usage === "candidate-evidence", "signer certificate has the wrong usage");
  const signerPublicKeyPem = string(candidate.signerPublicKeyPem, "signer public key");
  assert(
    createPublicKey(signerPublicKeyPem).asymmetricKeyType === "ed25519",
    "signer key is not Ed25519",
  );
  const notBefore = string(candidate.notBefore, "certificate start time");
  const notAfter = string(candidate.notAfter, "certificate expiry time");
  assert(
    Number.isFinite(Date.parse(notBefore)) && Number.isFinite(Date.parse(notAfter)),
    "certificate dates are invalid",
  );
  return {
    payload: {
      algorithm: "Ed25519",
      notAfter,
      notBefore,
      rootKeyId: safeId(candidate.rootKeyId, "root key ID"),
      schemaVersion: 1,
      signerKeyId: safeId(candidate.signerKeyId, "signer key ID"),
      signerPublicKeyPem,
      usage: "candidate-evidence",
    },
    rootSignature: base64(certificate.rootSignature, "certificate root signature"),
  };
}

async function verifyCertificate(
  certificate: SignerCertificate,
  trustStorePath: string,
  now: string,
): Promise<void> {
  const trustStore = validateTrustStore(JSON.parse(await readFile(trustStorePath, "utf8")));
  const payload = certificate.payload;
  const root = trustStore.roots.find((entry) => entry.keyId === payload.rootKeyId);
  assert(root, `unknown root key: ${payload.rootKeyId}`);
  assert(root.status === "trusted", `root key is revoked: ${payload.rootKeyId}`);
  assert(
    verify(
      null,
      Buffer.from(canonicalJson(payload)),
      createPublicKey(root.publicKeyPem),
      Buffer.from(certificate.rootSignature, "base64"),
    ),
    "signer certificate root signature is invalid",
  );
  const current = Date.parse(now);
  const notBefore = Date.parse(payload.notBefore);
  const notAfter = Date.parse(payload.notAfter);
  assert(Number.isFinite(current), "verification time is invalid");
  assert(notAfter - notBefore <= MAX_CERTIFICATE_LIFETIME_MS, "signer certificate exceeds 90 days");
  assert(current >= notBefore, "signer certificate is not active yet");
  assert(current <= notAfter, "signer certificate is expired");
  assert(
    !trustStore.revokedSignerKeyIds.includes(payload.signerKeyId),
    `signer key is revoked: ${payload.signerKeyId}`,
  );
}

function parseCapsuleReceipt(value: unknown): CapsuleReceipt {
  const receipt = exactRecord(
    value,
    [
      "classification",
      "containerExitCode",
      "createdAt",
      "imageId",
      "manifestDigest",
      "platform",
      "report",
      "schemaVersion",
      "source",
      "toolchain",
    ],
    "release capsule receipt",
  );
  assert(receipt.schemaVersion === 1, "unsupported release capsule receipt schema");
  assert(
    receipt.classification === "validation",
    "candidate evidence requires validation-class capsule evidence",
  );
  assert(receipt.containerExitCode === 0, "candidate evidence requires a passing release capsule");
  assert(
    receipt.platform === CAPSULE_PLATFORM,
    `candidate evidence requires the approved ${CAPSULE_PLATFORM} capsule`,
  );
  const createdAt = string(receipt.createdAt, "capsule creation time");
  assert(Number.isFinite(Date.parse(createdAt)), "capsule creation time is invalid");
  const source = exactRecord(receipt.source, ["commit", "tree"], "capsule source identity");
  const report = exactRecord(receipt.report, ["digest", "path"], "capsule report identity");
  const toolchain = exactRecord(
    receipt.toolchain,
    [
      "baseImages",
      "browserEntries",
      "browserExecutables",
      "bun",
      "commands",
      "manifestDigest",
      "node",
      "osRelease",
      "packages",
      "platform",
      "playwright",
      "schemaVersion",
    ],
    "capsule toolchain",
  );
  assert(toolchain.schemaVersion === 1, "capsule toolchain schema is invalid");
  assert(toolchain.platform === CAPSULE_PLATFORM, "capsule toolchain platform is invalid");
  string(toolchain.osRelease, "capsule operating-system release");
  const stringMap = (value: unknown, label: string): Record<string, string> =>
    Object.fromEntries(
      Object.entries(record(value, label)).map(([key, entry]) => [
        key,
        string(entry, `${label}: ${key}`),
      ]),
    );
  assert(Array.isArray(toolchain.browserEntries), "capsule browser inventory is invalid");
  const commands = Object.fromEntries(
    Object.entries(record(toolchain.commands, "capsule command inventory")).map(([name, value]) => {
      const command = exactRecord(value, ["path", "sha256"], `capsule command: ${name}`);
      return [
        name,
        {
          path: string(command.path, `capsule command path: ${name}`),
          sha256: digest(command.sha256, `capsule command digest: ${name}`),
        },
      ];
    }),
  );
  return {
    classification: "validation",
    containerExitCode: 0,
    imageId: digest(receipt.imageId, "capsule image identity"),
    manifestDigest: digest(receipt.manifestDigest, "capsule manifest digest"),
    platform: CAPSULE_PLATFORM,
    report: {
      digest: digest(report.digest, "capsule report digest"),
      path: relativeArtifactPath(report.path, "capsule report path"),
    },
    source: {
      commit: sha(source.commit, "capsule source commit"),
      tree: sha(source.tree, "capsule source tree"),
    },
    toolchain: {
      baseImages: stringMap(toolchain.baseImages, "capsule base images"),
      browserEntries: toolchain.browserEntries.map((entry) =>
        string(entry, "capsule browser inventory entry"),
      ),
      browserExecutables: stringMap(toolchain.browserExecutables, "capsule browser executables"),
      bun: string(toolchain.bun, "capsule Bun version"),
      commands,
      manifestDigest: digest(toolchain.manifestDigest, "capsule toolchain manifest digest"),
      node: string(toolchain.node, "capsule Node.js version"),
      packages: stringMap(toolchain.packages, "capsule package inventory"),
      platform: CAPSULE_PLATFORM,
      playwright: string(toolchain.playwright, "capsule Playwright version"),
    },
  };
}

function assertToolchainMatchesManifest(receipt: CapsuleReceipt, manifestBytes: Uint8Array): void {
  const manifest = record(JSON.parse(new TextDecoder().decode(manifestBytes)), "release manifest");
  const toolchain = record(manifest.toolchain, "release manifest toolchain");
  assert(
    receipt.toolchain.manifestDigest === sha256(manifestBytes),
    "capsule toolchain manifest linkage mismatch",
  );
  for (const key of ["bun", "node", "playwright", "platform"] as const) {
    assert(receipt.toolchain[key] === toolchain[key], `capsule toolchain ${key} drifted`);
  }
  assert(
    canonicalJson(receipt.toolchain.commands) === canonicalJson(toolchain.systemCommands),
    "capsule command inventory drifted",
  );
  assert(
    canonicalJson(receipt.toolchain.browserEntries) === canonicalJson(toolchain.browserEntries),
    "capsule browser inventory drifted",
  );
  assert(
    canonicalJson(receipt.toolchain.browserExecutables) ===
      canonicalJson(toolchain.browserExecutables),
    "capsule browser executable inventory drifted",
  );
  assert(
    canonicalJson(receipt.toolchain.baseImages) === canonicalJson(manifest.baseImages),
    "capsule base-image inventory drifted",
  );
  const packages = record(manifest.systemPackages, "release manifest packages");
  for (const [name, version] of Object.entries(packages)) {
    assert(receipt.toolchain.packages[name] === version, `capsule package drifted: ${name}`);
  }
}

function assertRetentionTargets(targets: RetentionTarget[]): void {
  assert(targets.length >= 1, "candidate evidence requires at least one retention target");
  assert(targets.length <= 2, "candidate evidence supports at most two retention targets");
  const ids = new Set<string>();
  const roots = new Set<string>();
  for (const target of targets) {
    assert(
      target.retentionClass === "intel-append-only" ||
        target.retentionClass === "operator-vps-object-lock",
      "retention class is invalid",
    );
    safeReleaseId(target.id, "retention target ID");
    safeReleaseId(target.administrativeDomain, "retention administrative domain");
    assert(!ids.has(target.id), "retention target IDs must be unique");
    ids.add(target.id);
    const root = resolve(target.root);
    assert(!roots.has(root), "retention roots must be distinct");
    roots.add(root);
  }
  assert(
    targets.some((target) => target.retentionClass === "intel-append-only"),
    "candidate evidence requires an Intel append-only retention target",
  );
}

function assertRetentionPolicyTargets(
  policyVersion: EvidencePolicyVersion,
  targets: RetentionTarget[],
): void {
  if (policyVersion !== "2026-08-25") return;
  assert(
    targets.length === 2 &&
      new Set(targets.map((target) => target.administrativeDomain)).size === 2 &&
      new Set(targets.map((target) => target.retentionClass)).size === 2,
    "legacy retention policy requires two independent targets",
  );
}

function witnessTargets(targets: RetentionTarget[]): RetentionWitnessPayload["retentionTargets"] {
  return targets
    .map(({ administrativeDomain, id, retentionClass }) => ({
      administrativeDomain,
      id,
      retentionClass,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function parseRetentionWitness(value: unknown): RetentionWitness {
  const witness = exactRecord(
    value,
    ["algorithm", "certificate", "payload", "signature"],
    "retention witness",
  );
  assert(witness.algorithm === "Ed25519", "retention witness algorithm is invalid");
  const payload = exactRecord(
    witness.payload,
    [
      "at",
      "bundleDigest",
      "manifestDigest",
      "provenanceDigest",
      "retentionTargets",
      "schemaVersion",
    ],
    "retention witness payload",
  );
  assert(payload.schemaVersion === 1, "retention witness schema is invalid");
  const at = string(payload.at, "retention witness time");
  assert(Number.isFinite(Date.parse(at)), "retention witness time is invalid");
  assert(Array.isArray(payload.retentionTargets), "retention witness targets are invalid");
  const retentionTargets = payload.retentionTargets.map((candidate) => {
    const target = exactRecord(
      candidate,
      ["administrativeDomain", "id", "retentionClass"],
      "retention witness target",
    );
    assert(
      target.retentionClass === "intel-append-only" ||
        target.retentionClass === "operator-vps-object-lock",
      "retention witness retention class is invalid",
    );
    return {
      administrativeDomain: safeId(target.administrativeDomain, "retention administrative domain"),
      id: safeId(target.id, "retention target ID"),
      retentionClass: target.retentionClass as RetentionClass,
    };
  });
  return {
    algorithm: "Ed25519",
    certificate: parseSignerCertificate(witness.certificate),
    payload: {
      at,
      bundleDigest: digest(payload.bundleDigest, "retention witness bundle digest"),
      manifestDigest: digest(payload.manifestDigest, "retention witness manifest digest"),
      provenanceDigest: digest(payload.provenanceDigest, "retention witness provenance digest"),
      retentionTargets,
      schemaVersion: 1,
    },
    signature: base64(witness.signature, "retention witness signature"),
  };
}

async function verifyRetentionWitness(options: {
  bundleDigest: string;
  now?: string;
  policyVersion: EvidencePolicyVersion;
  retentionTargets: RetentionTarget[];
  trustStorePath: string;
  witnessPath: string;
}): Promise<RetentionWitness> {
  const witness = canonicalDocument(
    await readFile(options.witnessPath),
    "retention witness",
    parseRetentionWitness,
  );
  assert(
    witness.payload.bundleDigest === options.bundleDigest,
    "retention witness bundle mismatch",
  );
  assert(
    canonicalJson(witness.payload.retentionTargets) ===
      canonicalJson(witnessTargets(options.retentionTargets)),
    "retention witness target identities mismatch",
  );
  assertRetentionPolicyTargets(options.policyVersion, options.retentionTargets);
  await verifyCertificate(
    witness.certificate,
    options.trustStorePath,
    options.now ?? new Date().toISOString(),
  );
  assert(
    verify(
      null,
      Buffer.from(canonicalJson(witness.payload)),
      createPublicKey(witness.certificate.payload.signerPublicKeyPem),
      Buffer.from(witness.signature, "base64"),
    ),
    "retention witness signature is invalid",
  );
  return witness;
}

async function bundleInventoryDigest(
  bundlePath: string,
  knownBytes: ReadonlyMap<string, Uint8Array> = new Map(),
): Promise<string> {
  const files = (await filesUnder(bundlePath))
    .filter((path) => basename(path) !== "bundle-digest.txt")
    .sort((left, right) =>
      relativePath(bundlePath, left).localeCompare(relativePath(bundlePath, right)),
    );
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relativePath(bundlePath, file));
    hash.update("\0");
    hash.update(knownBytes.get(file) ?? (await readFile(file)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function addObject(
  staging: string,
  bytes: Uint8Array,
  object: Omit<EvidenceObject, "digest" | "objectName" | "size">,
  canarySecrets: string[],
): Promise<EvidenceObject> {
  assertNoSecrets(bytes, object.sourcePath, canarySecrets);
  const digest = sha256(bytes);
  const hex = digest.slice("sha256:".length);
  const objectName = `objects/${hex}`;
  const path = join(staging, objectName);
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx" });
  } catch (error) {
    const existing = await readFile(path);
    if (sha256(existing) !== digest) throw error;
  }
  return { ...object, digest, objectName, size: bytes.byteLength };
}

export async function buildCandidateEvidenceBundle(options: BuildOptions): Promise<{
  bundleDigest: string;
  bundlePath: string;
  manifest: CandidateEvidenceManifest;
  manifestDigest: string;
  provenance: EvidenceProvenance;
  retentionCopies: Array<RetentionTarget & { path: string; status: "verified" }>;
}> {
  safeReleaseId(options.attemptId, "attempt ID");
  safeReleaseId(options.adapterIdentity, "adapter identity");
  safeReleaseId(options.executorIdentity, "executor identity");
  assert(SHA.test(options.approvedCommit), "approved commit is invalid");
  assertRetentionTargets(options.retentionTargets);
  const repository = resolve(options.repository);
  const status = await gitText(repository, "status", "--porcelain=v1", "--untracked-files=all");
  assert(
    !status,
    `observed source changes:\n${status}\ncandidate evidence requires clean source input`,
  );
  const commit = await gitText(repository, "rev-parse", `${options.approvedCommit}^{commit}`);
  assert(commit === options.approvedCommit, "approved commit must be the exact executable commit");
  const head = await gitText(repository, "rev-parse", "HEAD");
  assert(head === commit, "approved commit must equal checkout HEAD");
  const tree = await gitText(repository, "rev-parse", `${commit}^{tree}`);
  const issuedAt = new Date(options.issuedAt ?? new Date().toISOString()).toISOString();
  const certificate = parseSignerCertificate(
    JSON.parse(await readFile(options.certificatePath, "utf8")),
  );
  await verifyCertificate(certificate, options.trustStorePath, issuedAt);
  const signerKeyMetadata = await stat(options.signerPrivateKeyPath);
  assert(
    (signerKeyMetadata.mode & 0o077) === 0,
    "signer private key permissions must deny group and other access",
  );
  const signerPrivateKey = createPrivateKey(await readFile(options.signerPrivateKeyPath, "utf8"));
  const signerPublicKey = createPublicKey(certificate.payload.signerPublicKeyPem);
  assert(
    signerPrivateKey.asymmetricKeyType === "ed25519" &&
      signerPublicKey.asymmetricKeyType === "ed25519",
    "candidate evidence requires Ed25519 signer keys",
  );
  assert(
    createPublicKey(signerPrivateKey).export({ format: "pem", type: "spki" }) ===
      signerPublicKey.export({ format: "pem", type: "spki" }),
    "signer private key does not match its certificate",
  );

  await mkdir(options.spoolRoot, { recursive: true });
  const staging = await mkdtemp(join(options.spoolRoot, `.tmp-${options.attemptId}-`));
  const canarySecrets = (options.canarySecrets ?? []).filter(Boolean);
  try {
    const objects: EvidenceObject[] = [];
    const sourceArchive = await git(repository, "archive", "--format=tar", commit);
    const sourceObject = await addObject(
      staging,
      sourceArchive,
      { role: "source-archive", sourcePath: `git:${commit}` },
      canarySecrets,
    );
    objects.push(sourceObject);

    const declaredInputs = ["bun.lock", "containers/release-validation/manifest.json"];
    const declaredInputBytes = new Map<string, Uint8Array>();
    for (const path of declaredInputs) {
      const bytes = await readFile(repositoryPath(repository, path));
      declaredInputBytes.set(path, bytes);
      objects.push(
        await addObject(
          staging,
          bytes,
          { role: "declared-input", sourcePath: path },
          canarySecrets,
        ),
      );
    }

    const reportPath = resolve(options.releaseReportPath);
    assert(
      !(await lstat(reportPath)).isSymbolicLink(),
      "release report must not be a symbolic link",
    );
    const reportBytes = await readFile(reportPath);
    const reportLabel = `release-report/${basename(reportPath)}`;
    assertNoSecrets(reportBytes, reportLabel, canarySecrets);
    const reportFile = basename(reportPath);
    assert(reportFile.endsWith(".json"), "release report must use its release ID as a .json name");
    const releaseReport = parsePassingReleaseReport(
      JSON.parse(new TextDecoder().decode(reportBytes)),
      { expectedCommit: commit, releaseId: reportFile.slice(0, -".json".length) },
    );
    const reportObject = await addObject(
      staging,
      reportBytes,
      { role: "release-report", sourcePath: reportLabel },
      canarySecrets,
    );
    objects.push(reportObject);

    const capsuleReceiptPath = resolve(options.capsuleReceiptPath);
    assert(
      !(await lstat(capsuleReceiptPath)).isSymbolicLink(),
      "release capsule receipt must not be a symbolic link",
    );
    const capsuleReceiptBytes = await readFile(capsuleReceiptPath);
    const capsuleReceiptLabel = `capsule-receipt/${basename(capsuleReceiptPath)}`;
    const capsuleReceipt = parseCapsuleReceipt(
      JSON.parse(new TextDecoder().decode(capsuleReceiptBytes)),
    );
    assert(
      capsuleReceipt.source.commit === commit,
      "capsule receipt commit differs from approved source",
    );
    assert(
      capsuleReceipt.source.tree === tree,
      "capsule receipt tree differs from approved source",
    );
    assert(
      capsuleReceipt.report.path === basename(reportPath),
      "capsule receipt names a different release report",
    );
    assert(
      capsuleReceipt.report.digest === sha256(reportBytes),
      "capsule receipt report digest mismatch",
    );
    const releaseManifestDigest = sha256(
      declaredInputBytes.get("containers/release-validation/manifest.json")!,
    );
    assert(
      capsuleReceipt.manifestDigest === releaseManifestDigest &&
        capsuleReceipt.toolchain.manifestDigest === releaseManifestDigest,
      "capsule receipt toolchain manifest linkage mismatch",
    );
    assertToolchainMatchesManifest(
      capsuleReceipt,
      declaredInputBytes.get("containers/release-validation/manifest.json")!,
    );
    const capsuleReceiptObject = await addObject(
      staging,
      capsuleReceiptBytes,
      { role: "capsule-receipt", sourcePath: capsuleReceiptLabel },
      canarySecrets,
    );
    objects.push(capsuleReceiptObject);

    const artifacts: EvidenceArtifact[] = [];
    for (const [path, expectedDigest] of Object.entries(releaseReport.artifactDigests).sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      artifacts.push({ digest: expectedDigest, path });
    }

    objects.sort((left, right) =>
      `${left.role}:${left.sourcePath}`.localeCompare(`${right.role}:${right.sourcePath}`),
    );
    const manifest: CandidateEvidenceManifest = {
      artifacts,
      capsuleReceipt: {
        digest: capsuleReceiptObject.digest,
        imageId: capsuleReceipt.imageId,
        manifestDigest: capsuleReceipt.manifestDigest,
        path: capsuleReceiptObject.sourcePath,
        platform: CAPSULE_PLATFORM,
      },
      declaredInputs,
      objects,
      policyVersion: CURRENT_POLICY_VERSION,
      releaseReport: {
        digest: reportObject.digest,
        path: reportObject.sourcePath,
        releaseId: releaseReport.releaseId,
        target: releaseReport.target,
      },
      schemaVersion: 1,
      source: { archiveDigest: sourceObject.digest, commit, tree },
    };
    const provenance: EvidenceProvenance = {
      adapterIdentity: options.adapterIdentity,
      attemptId: options.attemptId,
      executorIdentity: options.executorIdentity,
      issuedAt,
      schemaVersion: 1,
    };
    const manifestDigest = sha256(canonicalJson(manifest));
    const provenanceDigest = sha256(canonicalJson(provenance));
    const signed = canonicalJson({ manifestDigest, provenanceDigest });
    const signature: EvidenceSignature = {
      algorithm: "Ed25519",
      certificate,
      manifestDigest,
      provenanceDigest,
      schemaVersion: 1,
      signature: sign(null, Buffer.from(signed), signerPrivateKey).toString("base64"),
    };
    const audit: PreparedAuditEvent[] = [
      {
        action: "bundle-prepared",
        adapterIdentity: options.adapterIdentity,
        at: issuedAt,
        manifestDigest,
        provenanceDigest,
        result: "passed",
      },
    ];
    for (const [label, value] of [
      ["manifest metadata", manifest],
      ["provenance metadata", provenance],
      ["signature metadata", signature],
      ["bundle audit metadata", audit],
    ] as const) {
      assertNoSecrets(Buffer.from(canonicalJson(value)), label, canarySecrets);
    }
    await writeCanonical(join(staging, "manifest.json"), manifest);
    await writeCanonical(join(staging, "provenance.json"), provenance);
    await writeCanonical(join(staging, "signature.json"), signature);
    await writeCanonical(join(staging, "audit.json"), audit);
    const bundleDigest = await bundleInventoryDigest(staging);
    await writeFile(join(staging, "bundle-digest.txt"), `${bundleDigest}\n`, { flag: "wx" });
    const bundlePath = join(options.spoolRoot, bundleDigest);
    await rename(staging, bundlePath);
    await verifyCandidateEvidenceBundle({
      bundlePath,
      expectedBundleDigest: bundleDigest,
      now: issuedAt,
      trustStorePath: options.trustStorePath,
    });

    const projectionResults = await Promise.allSettled(
      options.retentionTargets.map(async (target) => {
        await mkdir(target.root, { recursive: true });
        const path = join(target.root, `${bundleDigest}.staging-${options.attemptId}`);
        await cp(bundlePath, path, { recursive: true, errorOnExist: true, force: false });
        await verifyCandidateEvidenceBundle({
          bundlePath: path,
          expectedBundleDigest: bundleDigest,
          now: issuedAt,
          trustStorePath: options.trustStorePath,
        });
        const event: AddressedAuditEvent = {
          action: "projection-verified",
          adapterIdentity: options.adapterIdentity,
          at: issuedAt,
          bundleDigest,
          result: "passed",
          retentionClass: target.retentionClass,
          retentionId: target.id,
        };
        return { ...target, event, path, status: "verified" as const };
      }),
    );
    const failedProjection = projectionResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedProjection) {
      await Promise.allSettled(
        options.retentionTargets.map((target) =>
          rm(join(target.root, `${bundleDigest}.staging-${options.attemptId}`), {
            force: true,
            recursive: true,
          }),
        ),
      );
      const failure = failedProjection.reason;
      throw new Error(
        `a declared retention target was not verified: ${failure instanceof Error ? failure.message : String(failure)}`,
        { cause: failure },
      );
    }
    const retentionCopies = projectionResults.map((result) => {
      assert(result.status === "fulfilled", "not every declared retention target was verified");
      return result.value;
    });
    for (const copy of retentionCopies) {
      const finalPath = join(copy.root, bundleDigest);
      await rename(copy.path, finalPath);
      copy.path = finalPath;
    }
    const witnessPayload: RetentionWitnessPayload = {
      at: issuedAt,
      bundleDigest,
      manifestDigest,
      provenanceDigest,
      retentionTargets: witnessTargets(options.retentionTargets),
      schemaVersion: 1,
    };
    const witness: RetentionWitness = {
      algorithm: "Ed25519",
      certificate,
      payload: witnessPayload,
      signature: sign(null, Buffer.from(canonicalJson(witnessPayload)), signerPrivateKey).toString(
        "base64",
      ),
    };
    assertNoSecrets(Buffer.from(canonicalJson(witness)), "retention witness", canarySecrets);
    const witnessCopies = retentionCopies.map((copy) => ({
      finalPath: join(copy.root, `${bundleDigest}.quorum.json`),
      stagingPath: join(copy.root, `${bundleDigest}.quorum.staging-${options.attemptId}.json`),
    }));
    try {
      await Promise.all(witnessCopies.map((copy) => writeCanonical(copy.stagingPath, witness)));
      const verifiedWitnesses = await Promise.all(
        witnessCopies.map((copy) =>
          verifyRetentionWitness({
            bundleDigest,
            now: issuedAt,
            policyVersion: CURRENT_POLICY_VERSION,
            retentionTargets: options.retentionTargets,
            trustStorePath: options.trustStorePath,
            witnessPath: copy.stagingPath,
          }),
        ),
      );
      const firstWitness = verifiedWitnesses[0];
      assert(firstWitness, "retention witness is missing");
      const firstWitnessJson = canonicalJson(firstWitness);
      assert(
        verifiedWitnesses
          .slice(1)
          .every((candidate) => canonicalJson(candidate) === firstWitnessJson),
        "retention witnesses differ",
      );
      const publicationResults = await Promise.allSettled(
        witnessCopies.map((copy) => writeCanonical(copy.finalPath, witness)),
      );
      const failedPublication = publicationResults.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failedPublication) {
        await Promise.allSettled(
          publicationResults.map((result, index) =>
            result.status === "fulfilled"
              ? rm(witnessCopies[index]!.finalPath, { force: true })
              : Promise.resolve(),
          ),
        );
        throw new Error(
          `a declared retention witness was not published: ${failedPublication.reason instanceof Error ? failedPublication.reason.message : String(failedPublication.reason)}`,
          { cause: failedPublication.reason },
        );
      }
    } finally {
      await Promise.allSettled(witnessCopies.map((copy) => rm(copy.stagingPath, { force: true })));
    }
    const finalizedEvent: AddressedAuditEvent = {
      action: "bundle-finalized",
      adapterIdentity: options.adapterIdentity,
      at: issuedAt,
      bundleDigest,
      result: "passed",
    };
    await appendAudit(options.auditLogPath, finalizedEvent, canarySecrets);
    for (const copy of retentionCopies) {
      assertNoSecrets(Buffer.from(canonicalJson(copy.event)), "projection marker", canarySecrets);
      await writeCanonical(
        join(copy.root, `${bundleDigest}.${copy.id}.projection.json`),
        copy.event,
      );
      await appendAudit(options.auditLogPath, copy.event, canarySecrets);
    }
    return {
      bundleDigest,
      bundlePath,
      manifest,
      manifestDigest,
      provenance,
      retentionCopies: retentionCopies.map(({ event: _, ...copy }) => copy),
    };
  } catch (error) {
    await rm(staging, { force: true, recursive: true });
    throw error;
  }
}

function parseManifest(value: unknown): CandidateEvidenceManifest {
  const manifest = exactRecord(
    value,
    [
      "artifacts",
      "capsuleReceipt",
      "declaredInputs",
      "objects",
      "policyVersion",
      "releaseReport",
      "schemaVersion",
      "source",
    ],
    "candidate evidence manifest",
  );
  assert(manifest.schemaVersion === 1, "unsupported candidate evidence manifest schema");
  assert(isEvidencePolicyVersion(manifest.policyVersion), "unsupported candidate evidence policy");
  const source = exactRecord(
    manifest.source,
    ["archiveDigest", "commit", "tree"],
    "candidate source",
  );
  const capsuleReceipt = exactRecord(
    manifest.capsuleReceipt,
    ["digest", "imageId", "manifestDigest", "path", "platform"],
    "candidate capsule receipt",
  );
  const releaseReport = exactRecord(
    manifest.releaseReport,
    ["digest", "path", "releaseId", "target"],
    "candidate release report",
  );
  assert(capsuleReceipt.platform === CAPSULE_PLATFORM, "candidate capsule platform is invalid");
  assert(
    releaseReport.target === "staging" || releaseReport.target === "production",
    "candidate release target is invalid",
  );
  assert(Array.isArray(manifest.declaredInputs), "declared inputs are missing");
  assert(
    Array.isArray(manifest.objects) && manifest.objects.length > 0,
    "evidence objects are missing",
  );
  assert(Array.isArray(manifest.artifacts), "evidence artifacts are missing");
  const declaredInputs = manifest.declaredInputs.map((path) =>
    relativeArtifactPath(path, "declared input path"),
  );
  const artifacts = manifest.artifacts.map((candidate) => {
    const artifact = exactRecord(candidate, ["digest", "path"], "evidence artifact");
    return {
      digest: digest(artifact.digest, "artifact digest"),
      path: relativeArtifactPath(artifact.path, "artifact path"),
    };
  });
  const roles = new Set<EvidenceObject["role"]>([
    "source-archive",
    "declared-input",
    "release-report",
    "capsule-receipt",
  ]);
  const objects = manifest.objects.map((candidate) => {
    const object = exactRecord(
      candidate,
      ["digest", "objectName", "role", "size", "sourcePath"],
      "evidence object",
    );
    assert(roles.has(object.role as EvidenceObject["role"]), "evidence object role is invalid");
    assert(
      typeof object.size === "number" && Number.isSafeInteger(object.size) && object.size >= 0,
      "evidence object size is invalid",
    );
    const objectName = string(object.objectName, "evidence object name");
    assert(OBJECT_NAME.test(objectName), "evidence object name is invalid");
    return {
      digest: digest(object.digest, "evidence object digest"),
      objectName,
      role: object.role as EvidenceObject["role"],
      size: object.size,
      sourcePath: string(object.sourcePath, "evidence object source path"),
    };
  });
  return {
    artifacts,
    capsuleReceipt: {
      digest: digest(capsuleReceipt.digest, "candidate capsule receipt digest"),
      imageId: digest(capsuleReceipt.imageId, "candidate capsule image identity"),
      manifestDigest: digest(capsuleReceipt.manifestDigest, "candidate capsule manifest digest"),
      path: relativeArtifactPath(capsuleReceipt.path, "candidate capsule receipt path"),
      platform: CAPSULE_PLATFORM,
    },
    declaredInputs,
    objects,
    policyVersion: manifest.policyVersion,
    releaseReport: {
      digest: digest(releaseReport.digest, "candidate release report digest"),
      path: relativeArtifactPath(releaseReport.path, "candidate release report path"),
      releaseId: safeId(releaseReport.releaseId, "release ID"),
      target: releaseReport.target,
    },
    schemaVersion: 1,
    source: {
      archiveDigest: digest(source.archiveDigest, "source archive digest"),
      commit: sha(source.commit, "candidate commit"),
      tree: sha(source.tree, "candidate tree"),
    },
  };
}

function parseProvenance(value: unknown): EvidenceProvenance {
  const provenance = exactRecord(
    value,
    ["adapterIdentity", "attemptId", "executorIdentity", "issuedAt", "schemaVersion"],
    "evidence provenance",
  );
  assert(provenance.schemaVersion === 1, "unsupported evidence provenance schema");
  const issuedAt = string(provenance.issuedAt, "bundle issue time");
  assert(Number.isFinite(Date.parse(issuedAt)), "bundle issue time is invalid");
  return {
    adapterIdentity: safeId(provenance.adapterIdentity, "adapter identity"),
    attemptId: safeId(provenance.attemptId, "attempt ID"),
    executorIdentity: safeId(provenance.executorIdentity, "executor identity"),
    issuedAt,
    schemaVersion: 1,
  };
}

function parseSignature(value: unknown): EvidenceSignature {
  const signature = exactRecord(
    value,
    [
      "algorithm",
      "certificate",
      "manifestDigest",
      "provenanceDigest",
      "schemaVersion",
      "signature",
    ],
    "evidence signature",
  );
  assert(
    signature.schemaVersion === 1 && signature.algorithm === "Ed25519",
    "invalid bundle signature schema",
  );
  return {
    algorithm: "Ed25519",
    certificate: parseSignerCertificate(signature.certificate),
    manifestDigest: digest(signature.manifestDigest, "signed manifest digest"),
    provenanceDigest: digest(signature.provenanceDigest, "signed provenance digest"),
    schemaVersion: 1,
    signature: base64(signature.signature, "bundle signature"),
  };
}

export async function verifyCandidateEvidenceBundle(options: VerifyOptions): Promise<{
  bundleDigest: string;
  manifest: CandidateEvidenceManifest;
  signerKeyId: string;
}> {
  const bundlePath = resolve(options.bundlePath);
  assert(DIGEST.test(options.expectedBundleDigest), "expected bundle digest is invalid");
  let declaredBundleDigest: string;
  try {
    declaredBundleDigest = (await readFile(join(bundlePath, "bundle-digest.txt"), "utf8")).trim();
  } catch {
    throw new Error("bundle digest is missing");
  }
  assert(DIGEST.test(declaredBundleDigest), "bundle digest is missing or invalid");
  assert(
    declaredBundleDigest === options.expectedBundleDigest,
    "bundle address does not match expected digest",
  );
  const [manifestBytes, provenanceBytes, signatureBytes] = await Promise.all([
    readFile(join(bundlePath, "manifest.json")),
    readFile(join(bundlePath, "provenance.json")),
    readFile(join(bundlePath, "signature.json")),
  ]);
  const manifest = canonicalDocument(manifestBytes, "manifest", parseManifest);
  const provenance = canonicalDocument(provenanceBytes, "provenance", parseProvenance);
  const signature = canonicalDocument(signatureBytes, "signature", parseSignature);
  const manifestDigest = sha256(canonicalJson(manifest));
  const provenanceDigest = sha256(canonicalJson(provenance));
  assert(signature.manifestDigest === manifestDigest, "manifest digest mismatch");
  assert(signature.provenanceDigest === provenanceDigest, "provenance digest mismatch");
  await verifyCertificate(
    signature.certificate,
    options.trustStorePath,
    options.now ?? new Date().toISOString(),
  );
  const issuedAt = Date.parse(provenance.issuedAt);
  assert(
    issuedAt >= Date.parse(signature.certificate.payload.notBefore) &&
      issuedAt <= Date.parse(signature.certificate.payload.notAfter),
    "bundle issue time is outside signer certificate validity",
  );
  assert(
    verify(
      null,
      Buffer.from(canonicalJson({ manifestDigest, provenanceDigest })),
      createPublicKey(signature.certificate.payload.signerPublicKeyPem),
      Buffer.from(signature.signature, "base64"),
    ),
    "bundle signature is invalid",
  );
  const verifiedBytes = new Map<string, Uint8Array>([
    [join(bundlePath, "manifest.json"), manifestBytes],
    [join(bundlePath, "provenance.json"), provenanceBytes],
    [join(bundlePath, "signature.json"), signatureBytes],
  ]);
  for (const object of manifest.objects) {
    assert(DIGEST.test(object.digest), `object digest is invalid: ${object.sourcePath}`);
    const match = OBJECT_NAME.exec(object.objectName);
    assert(
      match && `sha256:${match[1]}` === object.digest,
      `object name is invalid: ${object.sourcePath}`,
    );
    const objectPath = join(bundlePath, object.objectName);
    const bytes = await readFile(objectPath);
    verifiedBytes.set(objectPath, bytes);
    assert(bytes.byteLength === object.size, `object size mismatch: ${object.sourcePath}`);
    assert(sha256(bytes) === object.digest, `object digest mismatch: ${object.sourcePath}`);
  }
  const objectsWithRole = (role: EvidenceObject["role"]): EvidenceObject[] =>
    manifest.objects.filter((object) => object.role === role);
  const sourceObjects = objectsWithRole("source-archive");
  const reportObjects = objectsWithRole("release-report");
  const capsuleReceiptObjects = objectsWithRole("capsule-receipt");
  assert(sourceObjects.length === 1, "candidate evidence requires one source archive");
  assert(reportObjects.length === 1, "candidate evidence requires one release report");
  assert(capsuleReceiptObjects.length === 1, "candidate evidence requires one capsule receipt");
  const sourceObject = sourceObjects[0]!;
  assert(sourceObject?.digest === manifest.source.archiveDigest, "source archive object mismatch");
  const reportObject = reportObjects[0]!;
  assert(reportObject?.digest === manifest.releaseReport.digest, "release report object mismatch");
  const capsuleReceiptObject = capsuleReceiptObjects[0]!;
  assert(
    capsuleReceiptObject?.digest === manifest.capsuleReceipt.digest,
    "capsule receipt object mismatch",
  );
  const objectBytes = (object: EvidenceObject): Uint8Array =>
    verifiedBytes.get(join(bundlePath, object.objectName))!;
  assert(
    (await deriveGitTreeFromArchive(objectBytes(sourceObject))) === manifest.source.tree,
    "source archive tree mismatch",
  );
  const report = parsePassingReleaseReport(
    JSON.parse(new TextDecoder().decode(objectBytes(reportObject))),
    { expectedCommit: manifest.source.commit, releaseId: manifest.releaseReport.releaseId },
  );
  assert(
    canonicalJson(manifest.artifacts) ===
      canonicalJson(
        Object.entries(report.artifactDigests)
          .map(([path, digest]) => ({ digest, path }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      ),
    "signed artifact inventory differs from the passing release report",
  );
  const receipt = parseCapsuleReceipt(
    JSON.parse(new TextDecoder().decode(objectBytes(capsuleReceiptObject))),
  );
  assert(
    receipt.source.commit === manifest.source.commit &&
      receipt.source.tree === manifest.source.tree,
    "capsule receipt source linkage mismatch",
  );
  assert(
    receipt.report.digest === reportObject.digest &&
      receipt.report.path === basename(manifest.releaseReport.path),
    "capsule receipt report linkage mismatch",
  );
  assert(
    receipt.imageId === manifest.capsuleReceipt.imageId &&
      receipt.manifestDigest === manifest.capsuleReceipt.manifestDigest,
    "capsule receipt identity linkage mismatch",
  );
  const releaseManifestObject = manifest.objects.find(
    (object) =>
      object.role === "declared-input" &&
      object.sourcePath === "containers/release-validation/manifest.json",
  );
  assert(releaseManifestObject, "release capsule manifest object is missing");
  assert(
    receipt.manifestDigest === sha256(objectBytes(releaseManifestObject)) &&
      receipt.toolchain.manifestDigest === receipt.manifestDigest,
    "capsule toolchain manifest linkage mismatch",
  );
  assertToolchainMatchesManifest(receipt, objectBytes(releaseManifestObject));
  assert(
    manifest.declaredInputs.length === 2 &&
      manifest.declaredInputs.includes("bun.lock") &&
      manifest.declaredInputs.includes("containers/release-validation/manifest.json"),
    "declared input inventory is invalid",
  );
  assert(
    (await bundleInventoryDigest(bundlePath, verifiedBytes)) === options.expectedBundleDigest,
    "bundle digest mismatch",
  );
  return {
    bundleDigest: options.expectedBundleDigest,
    manifest,
    signerKeyId: signature.certificate.payload.signerKeyId,
  };
}

export async function restoreCandidateEvidenceBundle(options: {
  bundleDigest: string;
  destination: string;
  now?: string;
  retentionTargets: RetentionTarget[];
  trustStorePath: string;
  auditLogPath?: string;
}): Promise<{ bundleDigest: string; destination: string; sourceRetentionId: string }> {
  assert(DIGEST.test(options.bundleDigest), "restore bundle digest is invalid");
  assertRetentionTargets(options.retentionTargets);
  try {
    await lstat(options.destination);
    throw new Error("restore destination already exists");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
  await mkdir(dirname(resolve(options.destination)), { recursive: true });
  for (const target of options.retentionTargets) {
    const source = join(target.root, options.bundleDigest);
    const temporaryParent = await mkdtemp(
      join(dirname(resolve(options.destination)), `.${basename(options.destination)}.restore-`),
    );
    const temporaryDestination = join(temporaryParent, "bundle");
    let published = false;
    try {
      const verifiedBundle = await verifyCandidateEvidenceBundle({
        bundlePath: source,
        expectedBundleDigest: options.bundleDigest,
        trustStorePath: options.trustStorePath,
        ...(options.now ? { now: options.now } : {}),
      });
      await verifyRetentionWitness({
        bundleDigest: options.bundleDigest,
        policyVersion: verifiedBundle.manifest.policyVersion,
        retentionTargets: options.retentionTargets,
        trustStorePath: options.trustStorePath,
        witnessPath: join(target.root, `${options.bundleDigest}.quorum.json`),
        ...(options.now ? { now: options.now } : {}),
      });
      await cp(source, temporaryDestination, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await verifyCandidateEvidenceBundle({
        bundlePath: temporaryDestination,
        expectedBundleDigest: options.bundleDigest,
        trustStorePath: options.trustStorePath,
        ...(options.now ? { now: options.now } : {}),
      });
      await rename(temporaryDestination, options.destination);
      published = true;
      await rm(temporaryParent, { force: true, recursive: true });
      await appendAudit(options.auditLogPath, {
        action: "restore-verified",
        adapterIdentity: "candidate-evidence-restore",
        at: new Date(options.now ?? new Date().toISOString()).toISOString(),
        bundleDigest: options.bundleDigest,
        result: "passed",
        retentionClass: target.retentionClass,
        retentionId: target.id,
      });
      return {
        bundleDigest: options.bundleDigest,
        destination: options.destination,
        sourceRetentionId: target.id,
      };
    } catch (error) {
      await rm(temporaryParent, { force: true, recursive: true });
      if (published) throw error;
      continue;
    }
  }
  throw new Error("no valid retention copy could restore the requested bundle");
}

function parseRetention(value: string): RetentionTarget {
  const [id, retentionClass, administrativeDomain, ...root] = value.split(":");
  assert(
    id && retentionClass && administrativeDomain && root.length,
    "retention target must be id:class:administrative-domain:path",
  );
  assert(
    retentionClass === "intel-append-only" || retentionClass === "operator-vps-object-lock",
    "retention class is invalid",
  );
  return { administrativeDomain, id, retentionClass, root: root.join(":") };
}

if (import.meta.main) {
  const command = Bun.argv[2];
  const { values } = parseArgs({
    args: Bun.argv.slice(3),
    options: {
      "adapter-id": { type: "string" },
      "approved-commit": { type: "string" },
      "attempt-id": { type: "string" },
      "audit-log": { type: "string" },
      bundle: { type: "string" },
      "capsule-receipt": { type: "string" },
      certificate: { type: "string" },
      destination: { type: "string" },
      digest: { type: "string" },
      "executor-id": { type: "string" },
      "release-report": { type: "string" },
      repository: { type: "string" },
      retention: { type: "string", multiple: true },
      "root-key": { type: "string" },
      "root-key-id": { type: "string" },
      "root-public-key": { type: "string" },
      "signer-key": { type: "string" },
      "signer-key-id": { type: "string" },
      "signer-public-key": { type: "string" },
      spool: { type: "string" },
      "trust-store": { type: "string" },
      "not-before": { type: "string" },
      "not-after": { type: "string" },
      output: { type: "string" },
    },
  });
  if (command === "issue-certificate") {
    assert(
      values["root-key"] &&
        values["root-key-id"] &&
        values["signer-key-id"] &&
        values["signer-public-key"] &&
        values["not-before"] &&
        values["not-after"] &&
        values.output,
      "issue-certificate is missing required key, validity, or output options",
    );
    const rootKeyMetadata = await stat(values["root-key"]);
    assert(
      (rootKeyMetadata.mode & 0o077) === 0,
      "offline root private key permissions must deny group and other access",
    );
    const certificate = createSignerCertificate({
      notAfter: values["not-after"],
      notBefore: values["not-before"],
      rootKeyId: values["root-key-id"],
      rootPrivateKeyPem: await readFile(values["root-key"], "utf8"),
      signerKeyId: values["signer-key-id"],
      signerPublicKeyPem: await readFile(values["signer-public-key"], "utf8"),
    });
    await mkdir(dirname(values.output), { recursive: true });
    await writeCanonical(values.output, certificate);
    console.log(
      canonicalJson({ output: values.output, signerKeyId: certificate.payload.signerKeyId }),
    );
  } else if (command === "create-trust-store") {
    assert(
      values["root-key-id"] && values["root-public-key"] && values.output,
      "create-trust-store requires --root-key-id, --root-public-key, and --output",
    );
    safeReleaseId(values["root-key-id"], "root key ID");
    const publicKeyPem = await readFile(values["root-public-key"], "utf8");
    assert(
      createPublicKey(publicKeyPem).asymmetricKeyType === "ed25519",
      "trust root must be Ed25519",
    );
    const trustStore: EvidenceTrustStore = {
      revokedSignerKeyIds: [],
      roots: [
        {
          algorithm: "Ed25519",
          keyId: values["root-key-id"],
          publicKeyPem,
          status: "trusted",
        },
      ],
      schemaVersion: 1,
    };
    await mkdir(dirname(values.output), { recursive: true });
    await writeCanonical(values.output, trustStore);
    console.log(canonicalJson({ output: values.output, rootKeyId: values["root-key-id"] }));
  } else if (command === "verify") {
    assert(
      values.bundle && values.digest && values["trust-store"],
      "verify requires --bundle, --digest, and --trust-store",
    );
    console.log(
      canonicalJson(
        await verifyCandidateEvidenceBundle({
          bundlePath: values.bundle,
          expectedBundleDigest: values.digest,
          trustStorePath: values["trust-store"],
        }),
      ),
    );
  } else if (command === "restore") {
    assert(
      values.digest && values.destination && values["trust-store"],
      "restore requires --digest, --destination, and --trust-store",
    );
    console.log(
      canonicalJson(
        await restoreCandidateEvidenceBundle({
          bundleDigest: values.digest,
          destination: values.destination,
          retentionTargets: (values.retention ?? []).map(parseRetention),
          trustStorePath: values["trust-store"],
          ...(values["audit-log"] ? { auditLogPath: values["audit-log"] } : {}),
        }),
      ),
    );
  } else if (command === "build") {
    assert(
      values.repository &&
        values["approved-commit"] &&
        values["capsule-receipt"] &&
        values["release-report"] &&
        values.certificate &&
        values["signer-key"] &&
        values["trust-store"] &&
        values.spool &&
        values["attempt-id"] &&
        values["executor-id"] &&
        values["adapter-id"],
      "build is missing required evidence options",
    );
    const result = await buildCandidateEvidenceBundle({
      adapterIdentity: values["adapter-id"],
      approvedCommit: values["approved-commit"],
      attemptId: values["attempt-id"],
      ...(process.env.SHOPPP_EVIDENCE_CANARY
        ? { canarySecrets: [process.env.SHOPPP_EVIDENCE_CANARY] }
        : {}),
      capsuleReceiptPath: values["capsule-receipt"],
      certificatePath: values.certificate,
      executorIdentity: values["executor-id"],
      releaseReportPath: values["release-report"],
      repository: values.repository,
      retentionTargets: (values.retention ?? []).map(parseRetention),
      signerPrivateKeyPath: values["signer-key"],
      spoolRoot: values.spool,
      trustStorePath: values["trust-store"],
      ...(values["audit-log"] ? { auditLogPath: values["audit-log"] } : {}),
    });
    console.log(
      canonicalJson({ bundleDigest: result.bundleDigest, bundlePath: result.bundlePath }),
    );
  } else {
    throw new Error(
      "candidate-evidence command must be issue-certificate, create-trust-store, build, verify, or restore",
    );
  }
}
