import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import {
  appendFile,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { digestArtifact } from "./release-validate";

const POLICY_VERSION = "2026-08-25";
const MAX_CERTIFICATE_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
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
  role: "source-archive" | "declared-input" | "release-report" | "artifact-file";
  size: number;
  sourcePath: string;
}

interface EvidenceArtifact {
  digest: string;
  objectDigests: string[];
  path: string;
}

export interface CandidateEvidenceManifest {
  schemaVersion: 1;
  policyVersion: typeof POLICY_VERSION;
  source: {
    archiveDigest: string;
    commit: string;
    tree: string;
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

interface AuditEvent {
  action: "bundle-finalized" | "projection-verified" | "restore-verified";
  adapterIdentity: string;
  at: string;
  bundleDigest: string;
  objectDigest?: string;
  result: "passed";
  retentionClass?: RetentionClass;
  retentionId?: string;
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
  now?: string;
  trustStorePath: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSafeId(value: string, label: string): void {
  assert(SAFE_ID.test(value), `${label} contains unsafe characters`);
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
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /authorization["':=\s]+bearer\s+[A-Za-z0-9._~+/-]{12,}/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bgrant_[A-Za-z0-9_-]{16,}\b/,
  ];
  assert(!prohibited.some((pattern) => pattern.test(text)), `credential material found in ${label}`);
}

async function writeCanonical(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${canonicalJson(value)}\n`, { flag: "wx" });
}

async function appendAudit(path: string | undefined, event: AuditEvent): Promise<void> {
  if (!path) return;
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
  assertSafeId(options.rootKeyId, "root key ID");
  assertSafeId(options.signerKeyId, "signer key ID");
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
  const store = value as EvidenceTrustStore;
  assert(store?.schemaVersion === 1, "unsupported evidence trust-store schema");
  assert(Array.isArray(store.roots), "evidence trust store roots are missing");
  assert(Array.isArray(store.revokedSignerKeyIds), "revoked signer list is missing");
  for (const root of store.roots) {
    assert(root.algorithm === "Ed25519", "unsupported trust-root algorithm");
    assertSafeId(root.keyId, "root key ID");
    assert(root.status === "trusted" || root.status === "revoked", "invalid trust-root status");
  }
  for (const keyId of store.revokedSignerKeyIds) assertSafeId(keyId, "revoked signer key ID");
  return store;
}

async function verifyCertificate(
  certificate: SignerCertificate,
  trustStorePath: string,
  now: string,
): Promise<void> {
  const trustStore = validateTrustStore(JSON.parse(await readFile(trustStorePath, "utf8")));
  const payload = certificate?.payload;
  assert(payload?.schemaVersion === 1, "unsupported signer certificate schema");
  assert(payload.algorithm === "Ed25519", "unsupported signer algorithm");
  assert(payload.usage === "candidate-evidence", "signer certificate has the wrong usage");
  assertSafeId(payload.rootKeyId, "root key ID");
  assertSafeId(payload.signerKeyId, "signer key ID");
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

function parseReleaseReport(value: unknown): {
  artifactDigests: Record<string, string>;
  commit: string;
  releaseId: string;
  status: string;
  target: string;
} {
  const report = value as {
    artifactDigests?: Record<string, string>;
    commit?: string;
    releaseId?: string;
    status?: string;
    target?: string;
  };
  assert(report && typeof report === "object", "release report is invalid");
  assert(report.status === "passed", "candidate evidence requires a passing release report");
  assert(typeof report.commit === "string" && SHA.test(report.commit), "release commit is invalid");
  assert(typeof report.releaseId === "string", "release ID is missing");
  assertSafeId(report.releaseId, "release ID");
  assert(report.target === "staging" || report.target === "production", "release target is invalid");
  assert(report.artifactDigests && typeof report.artifactDigests === "object", "artifact digests are missing");
  for (const [path, digest] of Object.entries(report.artifactDigests)) {
    assert(path && !resolve(path).startsWith(".."), `artifact path is invalid: ${path}`);
    assert(DIGEST.test(digest), `artifact digest is invalid: ${path}`);
  }
  return report as ReturnType<typeof parseReleaseReport>;
}

function assertRetentionTargets(targets: RetentionTarget[]): void {
  assert(targets.length === 2, "candidate evidence requires exactly two retention targets");
  const classes = new Set(targets.map((target) => target.retentionClass));
  assert(
    classes.size === 2 &&
      classes.has("intel-append-only") &&
      classes.has("operator-vps-object-lock"),
    "candidate evidence requires both approved retention classes",
  );
  const ids = new Set<string>();
  const roots = new Set<string>();
  const administrativeDomains = new Set<string>();
  for (const target of targets) {
    assertSafeId(target.id, "retention target ID");
    assertSafeId(target.administrativeDomain, "retention administrative domain");
    assert(!ids.has(target.id), "retention target IDs must be unique");
    ids.add(target.id);
    const root = resolve(target.root);
    assert(!roots.has(root), "retention roots must be distinct");
    roots.add(root);
    administrativeDomains.add(target.administrativeDomain);
  }
  assert(administrativeDomains.size === 2, "retention targets require separate administrative domains");
}

async function bundleInventoryDigest(bundlePath: string): Promise<string> {
  const files = (await filesUnder(bundlePath))
    .filter((path) => basename(path) !== "bundle-digest.txt")
    .sort((left, right) => relativePath(bundlePath, left).localeCompare(relativePath(bundlePath, right)));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relativePath(bundlePath, file));
    hash.update("\0");
    hash.update(await readFile(file));
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
  assertSafeId(options.attemptId, "attempt ID");
  assertSafeId(options.adapterIdentity, "adapter identity");
  assertSafeId(options.executorIdentity, "executor identity");
  assert(SHA.test(options.approvedCommit), "approved commit is invalid");
  assertRetentionTargets(options.retentionTargets);
  const repository = resolve(options.repository);
  const status = await gitText(repository, "status", "--porcelain=v1", "--untracked-files=all");
  assert(!status, `observed source changes:\n${status}\ncandidate evidence requires clean source input`);
  const commit = await gitText(repository, "rev-parse", `${options.approvedCommit}^{commit}`);
  assert(commit === options.approvedCommit, "approved commit must be the exact executable commit");
  const head = await gitText(repository, "rev-parse", "HEAD");
  assert(head === commit, "approved commit must equal checkout HEAD");
  const tree = await gitText(repository, "rev-parse", `${commit}^{tree}`);
  const issuedAt = new Date(options.issuedAt ?? new Date().toISOString()).toISOString();
  const certificate = JSON.parse(await readFile(options.certificatePath, "utf8")) as SignerCertificate;
  await verifyCertificate(certificate, options.trustStorePath, issuedAt);
  const signerKeyMetadata = await stat(options.signerPrivateKeyPath);
  assert(
    (signerKeyMetadata.mode & 0o077) === 0,
    "signer private key permissions must deny group and other access",
  );
  const signerPrivateKey = createPrivateKey(await readFile(options.signerPrivateKeyPath, "utf8"));
  const signerPublicKey = createPublicKey(certificate.payload.signerPublicKeyPem);
  assert(
    signerPrivateKey.asymmetricKeyType === "ed25519" && signerPublicKey.asymmetricKeyType === "ed25519",
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
  for (const path of declaredInputs) {
    const bytes = await readFile(repositoryPath(repository, path));
    objects.push(
      await addObject(staging, bytes, { role: "declared-input", sourcePath: path }, canarySecrets),
    );
  }

  const reportPath = resolve(options.releaseReportPath);
  assert(
    reportPath.startsWith(`${repository}${sep}`),
    "release report must be inside the candidate repository",
  );
  const reportBytes = await readFile(reportPath);
  assertNoSecrets(reportBytes, relativePath(repository, reportPath), canarySecrets);
  const releaseReport = parseReleaseReport(JSON.parse(new TextDecoder().decode(reportBytes)));
  assert(releaseReport.commit === commit, "release report commit differs from approved source");
  const reportObject = await addObject(
    staging,
    reportBytes,
    { role: "release-report", sourcePath: relativePath(repository, reportPath) },
    canarySecrets,
  );
  objects.push(reportObject);

  const artifacts: EvidenceArtifact[] = [];
  for (const [path, expectedDigest] of Object.entries(releaseReport.artifactDigests).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const absolute = repositoryPath(repository, path);
    const artifactFiles = await filesUnder(absolute);
    assert((await digestArtifact(absolute, repository)) === expectedDigest, `artifact digest mismatch: ${path}`);
    const artifactObjects: EvidenceObject[] = [];
    for (const file of artifactFiles) {
      artifactObjects.push(
        await addObject(
          staging,
          await readFile(file),
          { role: "artifact-file", sourcePath: relativePath(repository, file) },
          canarySecrets,
        ),
      );
    }
    objects.push(...artifactObjects);
    artifacts.push({
      digest: expectedDigest,
      objectDigests: artifactObjects.map((object) => object.digest),
      path,
    });
  }

  objects.sort((left, right) =>
    `${left.role}:${left.sourcePath}`.localeCompare(`${right.role}:${right.sourcePath}`),
  );
  const manifest: CandidateEvidenceManifest = {
    artifacts,
    declaredInputs,
    objects,
    policyVersion: POLICY_VERSION,
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
  const audit: AuditEvent[] = [
    {
      action: "bundle-finalized",
      adapterIdentity: options.adapterIdentity,
      at: issuedAt,
      bundleDigest: "computed-after-local-finalization",
      result: "passed",
    },
  ];
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
    now: issuedAt,
    trustStorePath: options.trustStorePath,
  });
  await appendAudit(options.auditLogPath, { ...audit[0]!, bundleDigest });

  const retentionCopies: Array<RetentionTarget & { path: string; status: "verified" }> = [];
  try {
    for (const target of options.retentionTargets) {
      await mkdir(target.root, { recursive: true });
      const path = join(target.root, bundleDigest);
      await cp(bundlePath, path, { recursive: true, errorOnExist: true, force: false });
      await verifyCandidateEvidenceBundle({
        bundlePath: path,
        now: issuedAt,
        trustStorePath: options.trustStorePath,
      });
      const event: AuditEvent = {
        action: "projection-verified",
        adapterIdentity: options.adapterIdentity,
        at: issuedAt,
        bundleDigest,
        result: "passed",
        retentionClass: target.retentionClass,
        retentionId: target.id,
      };
      await writeCanonical(join(target.root, `${bundleDigest}.${target.id}.projection.json`), event);
      await appendAudit(options.auditLogPath, event);
      retentionCopies.push({ ...target, path, status: "verified" });
    }
  } catch (error) {
    throw new Error(`2/2 retention quorum was not reached: ${(error as Error).message}`);
  }
  assert(retentionCopies.length === 2, "2/2 retention quorum was not reached");
  return { bundleDigest, bundlePath, manifest, manifestDigest, provenance, retentionCopies };
}

function parseManifest(value: unknown): CandidateEvidenceManifest {
  const manifest = value as CandidateEvidenceManifest;
  assert(manifest?.schemaVersion === 1, "unsupported candidate evidence manifest schema");
  assert(manifest.policyVersion === POLICY_VERSION, "unsupported candidate evidence policy");
  assert(SHA.test(manifest.source?.commit), "candidate commit is invalid");
  assert(SHA.test(manifest.source?.tree), "candidate tree is invalid");
  assert(DIGEST.test(manifest.source?.archiveDigest), "source archive digest is invalid");
  assert(Array.isArray(manifest.objects) && manifest.objects.length > 0, "evidence objects are missing");
  assert(Array.isArray(manifest.artifacts), "evidence artifacts are missing");
  return manifest;
}

export async function verifyCandidateEvidenceBundle(options: VerifyOptions): Promise<{
  bundleDigest: string;
  manifest: CandidateEvidenceManifest;
  signerKeyId: string;
}> {
  const bundlePath = resolve(options.bundlePath);
  let expectedBundleDigest: string;
  try {
    expectedBundleDigest = (await readFile(join(bundlePath, "bundle-digest.txt"), "utf8")).trim();
  } catch {
    throw new Error("bundle digest is missing");
  }
  assert(DIGEST.test(expectedBundleDigest), "bundle digest is missing or invalid");
  const [manifestBytes, provenanceBytes, signatureBytes] = await Promise.all([
    readFile(join(bundlePath, "manifest.json")),
    readFile(join(bundlePath, "provenance.json")),
    readFile(join(bundlePath, "signature.json")),
  ]);
  const manifest = parseManifest(JSON.parse(manifestBytes.toString("utf8")));
  const provenance = JSON.parse(provenanceBytes.toString("utf8")) as EvidenceProvenance;
  const signature = JSON.parse(signatureBytes.toString("utf8")) as EvidenceSignature;
  assert(provenance?.schemaVersion === 1, "unsupported evidence provenance schema");
  assertSafeId(provenance.attemptId, "attempt ID");
  assertSafeId(provenance.adapterIdentity, "adapter identity");
  assertSafeId(provenance.executorIdentity, "executor identity");
  assert(signature?.schemaVersion === 1 && signature.algorithm === "Ed25519", "invalid bundle signature schema");
  const manifestDigest = sha256(canonicalJson(manifest));
  const provenanceDigest = sha256(canonicalJson(provenance));
  assert(signature.manifestDigest === manifestDigest, "manifest digest mismatch");
  assert(signature.provenanceDigest === provenanceDigest, "provenance digest mismatch");
  await verifyCertificate(signature.certificate, options.trustStorePath, options.now ?? new Date().toISOString());
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
  for (const object of manifest.objects) {
    assert(DIGEST.test(object.digest), `object digest is invalid: ${object.sourcePath}`);
    const match = OBJECT_NAME.exec(object.objectName);
    assert(match && `sha256:${match[1]}` === object.digest, `object name is invalid: ${object.sourcePath}`);
    const bytes = await readFile(join(bundlePath, object.objectName));
    assert(bytes.byteLength === object.size, `object size mismatch: ${object.sourcePath}`);
    assert(sha256(bytes) === object.digest, `object digest mismatch: ${object.sourcePath}`);
  }
  const sourceObject = manifest.objects.find((object) => object.role === "source-archive");
  assert(sourceObject?.digest === manifest.source.archiveDigest, "source archive object mismatch");
  const reportObject = manifest.objects.find((object) => object.role === "release-report");
  assert(reportObject?.digest === manifest.releaseReport.digest, "release report object mismatch");
  for (const artifact of manifest.artifacts) {
    const files = manifest.objects
      .filter(
        (object) =>
          object.role === "artifact-file" &&
          (object.sourcePath === artifact.path || object.sourcePath.startsWith(`${artifact.path}/`)),
      )
      .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
    assert(
      canonicalJson(files.map((file) => file.digest)) === canonicalJson(artifact.objectDigests),
      `artifact object inventory mismatch: ${artifact.path}`,
    );
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(file.sourcePath);
      hash.update("\0");
      hash.update(await readFile(join(bundlePath, file.objectName)));
      hash.update("\0");
    }
    assert(`sha256:${hash.digest("hex")}` === artifact.digest, `artifact digest mismatch: ${artifact.path}`);
  }
  assert((await bundleInventoryDigest(bundlePath)) === expectedBundleDigest, "bundle digest mismatch");
  return {
    bundleDigest: expectedBundleDigest,
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
  for (const target of options.retentionTargets) {
    const source = join(target.root, options.bundleDigest);
    try {
      await verifyCandidateEvidenceBundle({
        bundlePath: source,
        trustStorePath: options.trustStorePath,
        ...(options.now ? { now: options.now } : {}),
      });
      await cp(source, options.destination, { recursive: true, errorOnExist: true, force: false });
      await verifyCandidateEvidenceBundle({
        bundlePath: options.destination,
        trustStorePath: options.trustStorePath,
        ...(options.now ? { now: options.now } : {}),
      });
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
    } catch {
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
    console.log(canonicalJson({ output: values.output, signerKeyId: certificate.payload.signerKeyId }));
  } else if (command === "create-trust-store") {
    assert(
      values["root-key-id"] && values["root-public-key"] && values.output,
      "create-trust-store requires --root-key-id, --root-public-key, and --output",
    );
    assertSafeId(values["root-key-id"], "root key ID");
    const publicKeyPem = await readFile(values["root-public-key"], "utf8");
    assert(createPublicKey(publicKeyPem).asymmetricKeyType === "ed25519", "trust root must be Ed25519");
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
    assert(values.bundle && values["trust-store"], "verify requires --bundle and --trust-store");
    console.log(
      canonicalJson(
        await verifyCandidateEvidenceBundle({
          bundlePath: values.bundle,
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
    console.log(canonicalJson({ bundleDigest: result.bundleDigest, bundlePath: result.bundlePath }));
  } else {
    throw new Error(
      "candidate-evidence command must be issue-certificate, create-trust-store, build, verify, or restore",
    );
  }
}
