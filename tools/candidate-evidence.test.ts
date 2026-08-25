import { afterEach, describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildCandidateEvidenceBundle,
  canonicalJson,
  createSignerCertificate,
  restoreCandidateEvidenceBundle,
  verifyCandidateEvidenceBundle,
  type EvidenceTrustStore,
} from "./candidate-evidence";
import { digestArtifact } from "./release-validate";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function run(cwd: string, ...args: string[]): Promise<string> {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text();
  const error = await new Response(child.stderr).text();
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(error || `${args.join(" ")} failed`);
  return output.trim();
}

function pem(key: KeyObject): string {
  return key.export({
    format: "pem",
    type: key.type === "private" ? "pkcs8" : "spki",
  }) as string;
}

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "shoppp-candidate-evidence-"));
  temporaryDirectories.push(root);
  const repository = join(root, "repository");
  const operator = join(root, "operator");
  const spool = join(root, "spool");
  const retentionA = join(root, "retention-a");
  const retentionB = join(root, "retention-b");
  await Promise.all(
    [repository, operator, spool, retentionA, retentionB].map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await run(repository, "git", "init", "--quiet");
  await run(repository, "git", "config", "user.name", "Evidence Fixture");
  await run(repository, "git", "config", "user.email", "evidence@example.test");
  await writeFile(join(repository, ".gitignore"), "artifacts/\n");
  await writeFile(join(repository, "bun.lock"), "fixture-lock\n");
  await writeFile(join(repository, "package.json"), '{"name":"fixture"}\n');
  await mkdir(join(repository, "containers/release-validation"), { recursive: true });
  await writeFile(
    join(repository, "containers/release-validation/manifest.json"),
    `${canonicalJson({ bun: "1.3.5", platform: "linux/amd64" })}\n`,
  );
  await writeFile(join(repository, "source.ts"), "export const candidate = true;\n");
  await run(repository, "git", "add", ".");
  await run(repository, "git", "commit", "--quiet", "-m", "fixture candidate");
  const commit = await run(repository, "git", "rev-parse", "HEAD");
  const tree = await run(repository, "git", "rev-parse", "HEAD^{tree}");

  const artifactDirectory = join(repository, "artifacts/build");
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(join(artifactDirectory, "worker.js"), "export default {};\n");
  const reportPath = join(operator, "release-fixture.json");
  await mkdir(resolve(reportPath, ".."), { recursive: true });
  await writeFile(
    reportPath,
    `${canonicalJson({
      artifactDigests: {
        "artifacts/build": await digestArtifact(artifactDirectory, repository),
      },
      commit,
      createdAt: "2026-08-25T00:00:00.000Z",
      gates: [{ exitCode: 0, name: "fixture", status: "passed" }],
      releaseId: "release-fixture",
      schemaVersion: 1,
      status: "passed",
      target: "staging",
    })}\n`,
  );
  const reportBytes = await readFile(reportPath);
  const capsuleReceiptPath = join(operator, "release-fixture.capsule.json");
  await writeFile(
    capsuleReceiptPath,
    `${canonicalJson({
      classification: "validation",
      containerExitCode: 0,
      imageId: `sha256:${"c".repeat(64)}`,
      manifestDigest: `sha256:${"d".repeat(64)}`,
      platform: "linux/amd64",
      report: {
        digest: `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`,
        path: "release-fixture.json",
      },
      schemaVersion: 1,
      source: { commit, tree },
      toolchain: { bun: "1.3.5", manifestDigest: `sha256:${"d".repeat(64)}` },
    })}\n`,
  );

  const rootKeys = generateKeyPairSync("ed25519");
  const signerKeys = generateKeyPairSync("ed25519");
  const rootPrivateKeyPath = join(operator, "root-private.pem");
  const signerPrivateKeyPath = join(operator, "signer-private.pem");
  const certificatePath = join(operator, "signer-certificate.json");
  const trustStorePath = join(operator, "trust-store.json");
  await writeFile(rootPrivateKeyPath, pem(rootKeys.privateKey), { mode: 0o600 });
  await writeFile(signerPrivateKeyPath, pem(signerKeys.privateKey), { mode: 0o600 });
  const certificate = createSignerCertificate({
    notAfter: "2026-10-01T00:00:00.000Z",
    notBefore: "2026-08-01T00:00:00.000Z",
    rootKeyId: "shoppp-evidence-root-2026",
    rootPrivateKeyPem: pem(rootKeys.privateKey),
    signerKeyId: "jenkins-evidence-2026-08",
    signerPublicKeyPem: pem(signerKeys.publicKey),
  });
  await writeFile(certificatePath, `${canonicalJson(certificate)}\n`);
  const trustStore: EvidenceTrustStore = {
    roots: [
      {
        algorithm: "Ed25519",
        keyId: "shoppp-evidence-root-2026",
        publicKeyPem: pem(rootKeys.publicKey),
        status: "trusted",
      },
    ],
    revokedSignerKeyIds: [],
    schemaVersion: 1,
  };
  await writeFile(trustStorePath, `${canonicalJson(trustStore)}\n`);

  const options = {
    adapterIdentity: "fixture-adapter",
    approvedCommit: commit,
    capsuleReceiptPath,
    certificatePath,
    executorIdentity: "fixture-linux-amd64",
    issuedAt: "2026-08-25T01:00:00.000Z",
    releaseReportPath: reportPath,
    repository,
    retentionTargets: [
      {
        administrativeDomain: "intel-jenkins",
        id: "intel",
        retentionClass: "intel-append-only" as const,
        root: retentionA,
      },
      {
        administrativeDomain: "operator-vps",
        id: "vps",
        retentionClass: "operator-vps-object-lock" as const,
        root: retentionB,
      },
    ],
    signerPrivateKeyPath,
    spoolRoot: spool,
    trustStorePath,
  };
  return {
    certificate,
    commit,
    options,
    repository,
    retentionA,
    retentionB,
    root,
    signerPrivateKeyPath,
    spool,
    tree,
    trustStore,
    trustStorePath,
  };
}

describe("portable candidate evidence", () => {
  test("builds deterministic candidate manifests with unique signed attempts and two verified copies", async () => {
    const value = await fixture();
    const first = await buildCandidateEvidenceBundle({ ...value.options, attemptId: "attempt-1" });
    const second = await buildCandidateEvidenceBundle({ ...value.options, attemptId: "attempt-2" });

    expect(first.manifest.source).toMatchObject({ commit: value.commit, tree: value.tree });
    expect(first.manifestDigest).toBe(second.manifestDigest);
    expect(first.bundleDigest).not.toBe(second.bundleDigest);
    expect(first.retentionCopies.map((copy) => copy.status)).toEqual(["verified", "verified"]);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: first.bundlePath,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({
      bundleDigest: first.bundleDigest,
      signerKeyId: "jenkins-evidence-2026-08",
    });
  });

  test("rejects dirty and untracked source before finalization", async () => {
    const value = await fixture();
    await writeFile(join(value.repository, "untracked-source.ts"), "export {};\n");
    await expect(
      buildCandidateEvidenceBundle({ ...value.options, attemptId: "dirty-attempt" }),
    ).rejects.toThrow(/untracked-source\.ts.*clean source input/s);
  });

  test("fails closed when an object byte or bundle signature changes", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "tamper-object",
    });
    const objectPath = join(built.bundlePath, built.manifest.objects[0]!.objectName);
    const objectBytes = await readFile(objectPath);
    objectBytes[0] = objectBytes[0] === 0 ? 1 : objectBytes[0]! - 1;
    await writeFile(objectPath, objectBytes);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/object.*digest mismatch/i);

    const signed = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "tamper-signature",
    });
    const signaturePath = join(signed.bundlePath, "signature.json");
    const signature = JSON.parse(await readFile(signaturePath, "utf8"));
    signature.signature = `${signature.signature.slice(0, -4)}AAAA`;
    await writeFile(signaturePath, `${canonicalJson(signature)}\n`);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: signed.bundlePath,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/bundle signature/i);
  });

  test("requires both retention classes but restores exact bytes from either surviving copy", async () => {
    const value = await fixture();
    const unavailable = join(value.root, "not-a-directory");
    await writeFile(unavailable, "occupied\n");
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "missing-copy",
        retentionTargets: [
          value.options.retentionTargets[0]!,
          { ...value.options.retentionTargets[1]!, root: unavailable },
        ],
      }),
    ).rejects.toThrow(/2\/2 retention quorum/);

    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "restore-copy",
    });
    await rm(join(value.retentionA, built.bundleDigest), { recursive: true });
    const destination = join(value.root, "restored");
    const restored = await restoreCandidateEvidenceBundle({
      bundleDigest: built.bundleDigest,
      destination,
      now: "2026-08-25T01:05:00.000Z",
      retentionTargets: value.options.retentionTargets,
      trustStorePath: value.trustStorePath,
    });
    expect(restored.sourceRetentionId).toBe("vps");
    expect(await readFile(join(destination, "manifest.json"), "utf8")).toBe(
      await readFile(join(built.bundlePath, "manifest.json"), "utf8"),
    );
  });

  test("rejects retention targets that claim separate classes inside one administrative domain", async () => {
    const value = await fixture();
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "same-domain",
        retentionTargets: value.options.retentionTargets.map((target) => ({
          ...target,
          administrativeDomain: "shared-admin",
        })),
      }),
    ).rejects.toThrow(/administrative domains/);
  });

  test("rejects permissive signer-key custody and symlinked capsule evidence", async () => {
    const value = await fixture();
    await chmod(value.signerPrivateKeyPath, 0o644);
    await expect(
      buildCandidateEvidenceBundle({ ...value.options, attemptId: "permissive-key" }),
    ).rejects.toThrow(/signer private key.*permissions/);

    await chmod(value.signerPrivateKeyPath, 0o600);
    const realReceipt = value.options.capsuleReceiptPath;
    const linkedReceipt = join(value.root, "linked-capsule-receipt.json");
    await symlink(realReceipt, linkedReceipt);
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "capsule-symlink",
        capsuleReceiptPath: linkedReceipt,
      }),
    ).rejects.toThrow(/symbolic link/);
  });

  test("rejects unknown, expired, and revoked signer authority", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "trust-check",
    });
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        now: "2026-10-02T00:00:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/expired/);

    const revokedPath = join(value.root, "revoked-trust.json");
    await writeFile(
      revokedPath,
      `${canonicalJson({
        ...value.trustStore,
        revokedSignerKeyIds: [value.certificate.payload.signerKeyId],
      })}\n`,
    );
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: revokedPath,
      }),
    ).rejects.toThrow(/revoked/);

    const unknownPath = join(value.root, "unknown-trust.json");
    await writeFile(unknownPath, `${canonicalJson({ ...value.trustStore, roots: [] })}\n`);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: unknownPath,
      }),
    ).rejects.toThrow(/unknown root/);
  });

  test("rejects canary secrets before a bundle or retention copy exists", async () => {
    const value = await fixture();
    const canary = "SHOPPP-CANARY-SECRET-DO-NOT-RETAIN";
    const report = JSON.parse(await readFile(value.options.releaseReportPath, "utf8"));
    report.diagnostic = canary;
    await writeFile(value.options.releaseReportPath, `${canonicalJson(report)}\n`);
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "canary-attempt",
        canarySecrets: [canary],
      }),
    ).rejects.toThrow(/canary secret/);
    await expect(readFile(join(value.spool, "canary-attempt"))).rejects.toThrow();
  });

  test("does not treat a copied directory as valid when its content-address is wrong", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "wrong-address",
    });
    const copied = join(value.root, "copied-bundle");
    await cp(built.bundlePath, copied, { recursive: true });
    await unlink(join(copied, "bundle-digest.txt"));
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: copied,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/bundle digest/i);
  });
});
