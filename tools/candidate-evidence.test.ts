import { afterEach, describe, expect, test } from "bun:test";
import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import {
  buildCandidateEvidenceBundle,
  canonicalJson,
  createSignerCertificate,
  deriveGitTreeFromArchive,
  restoreCandidateEvidenceBundle,
  verifyCandidateEvidenceBundle,
  type EvidenceTrustStore,
} from "./candidate-evidence";
import { RELEASE_CAPSULE_MANIFEST } from "./release-capsule";
import { RELEASE_ARTIFACT_PATHS, RELEASE_GATES } from "./release-validate";

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

async function bundleFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? bundleFiles(join(path, entry.name)) : [join(path, entry.name)],
    ),
  );
  return nested.flat();
}

async function rewriteBundleDigest(path: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of (await bundleFiles(path))
    .filter((file) => basename(file) !== "bundle-digest.txt")
    .sort((left, right) => relative(path, left).localeCompare(relative(path, right)))) {
    hash.update(relative(path, file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  const digest = `sha256:${hash.digest("hex")}`;
  await writeFile(join(path, "bundle-digest.txt"), `${digest}\n`);
  return digest;
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
    `${canonicalJson(RELEASE_CAPSULE_MANIFEST)}\n`,
  );
  await writeFile(join(repository, "source.ts"), "export const candidate = true;\n");
  await run(repository, "git", "add", ".");
  await run(repository, "git", "commit", "--quiet", "-m", "fixture candidate");
  const commit = await run(repository, "git", "rev-parse", "HEAD");
  const tree = await run(repository, "git", "rev-parse", "HEAD^{tree}");

  const reportPath = join(operator, "release-fixture.json");
  await mkdir(resolve(reportPath, ".."), { recursive: true });
  await writeFile(
    reportPath,
    `${canonicalJson({
      artifactDigests: {
        ...Object.fromEntries(
          RELEASE_ARTIFACT_PATHS.map((path) => [path, `sha256:${"e".repeat(64)}`]),
        ),
      },
      commit,
      createdAt: "2026-08-25T00:00:00.000Z",
      environmentIsolation: { environments: [], mode: "structural" },
      gates: RELEASE_GATES.map((gate) => ({
        ...gate,
        durationMs: 1,
        exitCode: 0,
        status: "passed",
      })),
      releaseId: "release-fixture",
      schemaVersion: 1,
      status: "passed",
      target: "staging",
    })}\n`,
  );
  const reportBytes = await readFile(reportPath);
  const releaseManifestBytes = await readFile(
    join(repository, "containers/release-validation/manifest.json"),
  );
  const releaseManifestDigest = `sha256:${createHash("sha256")
    .update(releaseManifestBytes)
    .digest("hex")}`;
  const capsuleReceiptPath = join(operator, "release-fixture.capsule.json");
  await writeFile(
    capsuleReceiptPath,
    `${canonicalJson({
      classification: "validation",
      containerExitCode: 0,
      createdAt: "2026-08-25T00:01:00.000Z",
      imageId: `sha256:${"c".repeat(64)}`,
      manifestDigest: releaseManifestDigest,
      platform: "linux/amd64",
      report: {
        digest: `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`,
        path: "release-fixture.json",
      },
      schemaVersion: 1,
      source: { commit, tree },
      toolchain: {
        baseImages: RELEASE_CAPSULE_MANIFEST.baseImages,
        browserEntries: RELEASE_CAPSULE_MANIFEST.toolchain.browserEntries,
        browserExecutables: RELEASE_CAPSULE_MANIFEST.toolchain.browserExecutables,
        bun: RELEASE_CAPSULE_MANIFEST.toolchain.bun,
        commands: RELEASE_CAPSULE_MANIFEST.toolchain.systemCommands,
        manifestDigest: releaseManifestDigest,
        node: RELEASE_CAPSULE_MANIFEST.toolchain.node,
        osRelease: "fixture-linux",
        packages: RELEASE_CAPSULE_MANIFEST.systemPackages,
        platform: RELEASE_CAPSULE_MANIFEST.toolchain.platform,
        playwright: RELEASE_CAPSULE_MANIFEST.toolchain.playwright,
        schemaVersion: 1,
      },
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
        expectedBundleDigest: first.bundleDigest,
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

  test("refuses reduced passing reports and broken capsule toolchain linkage before signing", async () => {
    const reduced = await fixture();
    const report = JSON.parse(await readFile(reduced.options.releaseReportPath, "utf8"));
    report.gates = report.gates.slice(0, 1);
    await writeFile(reduced.options.releaseReportPath, `${canonicalJson(report)}\n`);
    await expect(
      buildCandidateEvidenceBundle({ ...reduced.options, attemptId: "reduced-report" }),
    ).rejects.toThrow(/gate count/);

    const unlinked = await fixture();
    const receipt = JSON.parse(await readFile(unlinked.options.capsuleReceiptPath, "utf8"));
    receipt.toolchain.manifestDigest = `sha256:${"a".repeat(64)}`;
    await writeFile(unlinked.options.capsuleReceiptPath, `${canonicalJson(receipt)}\n`);
    await expect(
      buildCandidateEvidenceBundle({ ...unlinked.options, attemptId: "unlinked-toolchain" }),
    ).rejects.toThrow(/toolchain manifest linkage/);
  });

  test("derives the claimed Git tree from archive contents without trusting a checkout", async () => {
    const value = await fixture();
    const archive = join(value.root, "source.tar");
    await run(value.repository, "git", "archive", "--output", archive, "HEAD");
    expect(await deriveGitTreeFromArchive(await readFile(archive))).toBe(value.tree);
    await writeFile(join(value.repository, "source.ts"), "export const candidate = false;\n");
    await run(value.repository, "git", "add", ".");
    await run(value.repository, "git", "commit", "--quiet", "-m", "different tree");
    const otherArchive = join(value.root, "other-source.tar");
    await run(value.repository, "git", "archive", "--output", otherArchive, "HEAD");
    expect(await deriveGitTreeFromArchive(await readFile(otherArchive))).not.toBe(value.tree);
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
        expectedBundleDigest: built.bundleDigest,
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
        expectedBundleDigest: signed.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/bundle signature/i);
  });

  test("finalizes and restores from one required retention target", async () => {
    const value = await fixture();
    const retentionTargets = [value.options.retentionTargets[0]!];
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "single-retention-copy",
      retentionTargets,
    });
    expect(built.retentionCopies).toHaveLength(1);
    expect(built.retentionCopies[0]).toMatchObject({ id: "intel", status: "verified" });
    const destination = join(value.root, "single-retention-restore");
    await expect(
      restoreCandidateEvidenceBundle({
        bundleDigest: built.bundleDigest,
        destination,
        now: "2026-08-25T01:05:00.000Z",
        retentionTargets,
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({ sourceRetentionId: "intel" });
    expect(await readFile(join(destination, "manifest.json"), "utf8")).toBe(
      await readFile(join(built.bundlePath, "manifest.json"), "utf8"),
    );
  });

  test("verifies and restores signed bundles from the superseded policy", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "legacy-policy",
    });
    const signerPrivateKey = createPrivateKey(await readFile(value.signerPrivateKeyPath));
    let legacyBundleDigest = "";
    for (const retentionRoot of [value.retentionA, value.retentionB]) {
      const retainedBundle = join(retentionRoot, built.bundleDigest);
      const manifestPath = join(retainedBundle, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.policyVersion = "2026-08-25";
      await writeFile(manifestPath, `${canonicalJson(manifest)}\n`);

      const signaturePath = join(retainedBundle, "signature.json");
      const bundleSignature = JSON.parse(await readFile(signaturePath, "utf8"));
      bundleSignature.manifestDigest = `sha256:${createHash("sha256")
        .update(canonicalJson(manifest))
        .digest("hex")}`;
      bundleSignature.signature = sign(
        null,
        Buffer.from(
          canonicalJson({
            manifestDigest: bundleSignature.manifestDigest,
            provenanceDigest: bundleSignature.provenanceDigest,
          }),
        ),
        signerPrivateKey,
      ).toString("base64");
      await writeFile(signaturePath, `${canonicalJson(bundleSignature)}\n`);

      const copyDigest = await rewriteBundleDigest(retainedBundle);
      if (legacyBundleDigest) expect(copyDigest).toBe(legacyBundleDigest);
      legacyBundleDigest = copyDigest;
      await rename(retainedBundle, join(retentionRoot, legacyBundleDigest));
      const oldWitnessPath = join(retentionRoot, `${built.bundleDigest}.quorum.json`);
      const witness = JSON.parse(await readFile(oldWitnessPath, "utf8"));
      witness.payload.bundleDigest = legacyBundleDigest;
      witness.signature = sign(
        null,
        Buffer.from(canonicalJson(witness.payload)),
        signerPrivateKey,
      ).toString("base64");
      await writeFile(
        join(retentionRoot, `${legacyBundleDigest}.quorum.json`),
        `${canonicalJson(witness)}\n`,
      );
      await unlink(oldWitnessPath);
    }

    const legacyBundle = join(value.retentionA, legacyBundleDigest);

    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: legacyBundle,
        expectedBundleDigest: legacyBundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({ manifest: { policyVersion: "2026-08-25" } });
    await expect(
      restoreCandidateEvidenceBundle({
        bundleDigest: legacyBundleDigest,
        destination: join(value.root, "legacy-policy-restore"),
        now: "2026-08-25T01:05:00.000Z",
        retentionTargets: value.options.retentionTargets,
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({ sourceRetentionId: "intel" });
    await rm(value.retentionA, { recursive: true });
    await expect(
      restoreCandidateEvidenceBundle({
        bundleDigest: legacyBundleDigest,
        destination: join(value.root, "legacy-policy-fallback-restore"),
        now: "2026-08-25T01:05:00.000Z",
        retentionTargets: value.options.retentionTargets,
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({ sourceRetentionId: "vps" });

    const vpsWitnessPath = join(value.retentionB, `${legacyBundleDigest}.quorum.json`);
    const downgradedWitness = JSON.parse(await readFile(vpsWitnessPath, "utf8"));
    downgradedWitness.payload.retentionTargets = [
      downgradedWitness.payload.retentionTargets.find(
        (target: { id: string }) => target.id === "intel",
      ),
    ];
    downgradedWitness.signature = sign(
      null,
      Buffer.from(canonicalJson(downgradedWitness.payload)),
      signerPrivateKey,
    ).toString("base64");
    await writeFile(vpsWitnessPath, `${canonicalJson(downgradedWitness)}\n`);
    await expect(
      restoreCandidateEvidenceBundle({
        bundleDigest: legacyBundleDigest,
        destination: join(value.root, "legacy-policy-downgrade-restore"),
        now: "2026-08-25T01:05:00.000Z",
        retentionTargets: [{ ...value.options.retentionTargets[0]!, root: value.retentionB }],
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/no valid retention copy/);
  });

  test("requires every declared retention target but can restore from a surviving copy", async () => {
    const value = await fixture();
    const unavailable = join(value.root, "not-a-directory");
    await writeFile(unavailable, "occupied\n");
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "missing-declared-copy",
        retentionTargets: [
          value.options.retentionTargets[0]!,
          { ...value.options.retentionTargets[1]!, root: unavailable },
        ],
      }),
    ).rejects.toThrow(/declared retention target/);

    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "restore-copy",
    });
    await rm(value.retentionA, { recursive: true });
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

    const fallback = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "restore-corrupt-copy",
    });
    const damaged = join(
      value.retentionA,
      fallback.bundleDigest,
      fallback.manifest.objects[0]!.objectName,
    );
    const damagedBytes = await readFile(damaged);
    damagedBytes[0] = damagedBytes[0] === 0 ? 1 : damagedBytes[0]! - 1;
    await writeFile(damaged, damagedBytes);
    await expect(
      restoreCandidateEvidenceBundle({
        bundleDigest: fallback.bundleDigest,
        destination: join(value.root, "restored-after-corruption"),
        now: "2026-08-25T01:05:00.000Z",
        retentionTargets: value.options.retentionTargets,
        trustStorePath: value.trustStorePath,
      }),
    ).resolves.toMatchObject({ sourceRetentionId: "vps" });
  });

  test("removes partially published witnesses when a declared target rejects publication", async () => {
    const value = await fixture();
    const attemptId = "witness-publication-failure";
    const built = await buildCandidateEvidenceBundle({ ...value.options, attemptId });
    const firstWitness = join(value.retentionA, `${built.bundleDigest}.quorum.json`);
    await Promise.all([
      rm(built.bundlePath, { recursive: true }),
      rm(join(value.retentionA, built.bundleDigest), { recursive: true }),
      rm(join(value.retentionB, built.bundleDigest), { recursive: true }),
      rm(firstWitness),
    ]);

    await expect(buildCandidateEvidenceBundle({ ...value.options, attemptId })).rejects.toThrow();
    await expect(readFile(firstWitness)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("allows same-domain optional copies but rejects duplicate target identities and roots", async () => {
    const value = await fixture();
    const sameDomainTargets = value.options.retentionTargets.map((target) => ({
      ...target,
      administrativeDomain: "shared-admin",
    }));
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "same-domain",
        retentionTargets: sameDomainTargets,
      }),
    ).resolves.toMatchObject({ retentionCopies: [{ status: "verified" }, { status: "verified" }] });
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "vps-only",
        retentionTargets: [value.options.retentionTargets[1]!],
      }),
    ).rejects.toThrow(/requires an Intel append-only retention target/);
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "too-many-targets",
        retentionTargets: [
          ...sameDomainTargets,
          {
            administrativeDomain: "shared-admin",
            id: "third",
            retentionClass: "intel-append-only",
            root: join(value.root, "retention-c"),
          },
        ],
      }),
    ).rejects.toThrow(/at most two retention targets/);
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "duplicate-id",
        retentionTargets: sameDomainTargets.map((target) => ({ ...target, id: "duplicate" })),
      }),
    ).rejects.toThrow(/IDs must be unique/);
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: "duplicate-root",
        retentionTargets: sameDomainTargets.map((target) => ({
          ...target,
          root: value.retentionA,
        })),
      }),
    ).rejects.toThrow(/roots must be distinct/);
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
        expectedBundleDigest: built.bundleDigest,
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
        expectedBundleDigest: built.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: revokedPath,
      }),
    ).rejects.toThrow(/revoked/);

    const unknownPath = join(value.root, "unknown-trust.json");
    await writeFile(unknownPath, `${canonicalJson({ ...value.trustStore, roots: [] })}\n`);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        expectedBundleDigest: built.bundleDigest,
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
        expectedBundleDigest: built.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/bundle digest/i);
  });

  test("anchors verification to the caller digest and rejects substituted valid bundles", async () => {
    const value = await fixture();
    const first = await buildCandidateEvidenceBundle({ ...value.options, attemptId: "anchor-1" });
    const second = await buildCandidateEvidenceBundle({ ...value.options, attemptId: "anchor-2" });
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: second.bundlePath,
        expectedBundleDigest: first.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/expected digest/);
  });

  test("rejects unknown signed fields even after an attacker recomputes the inventory", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "unknown-signed-field",
    });
    const manifestPath = join(built.bundlePath, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.ignoredAuthority = "attacker-controlled";
    await writeFile(manifestPath, `${canonicalJson(manifest)}\n`);
    const recomputed = await rewriteBundleDigest(built.bundlePath);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        expectedBundleDigest: recomputed,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/unknown or missing fields/);
  });

  test("rejects root-signature and signer-certificate payload tampering", async () => {
    for (const field of ["root-signature", "payload"] as const) {
      const value = await fixture();
      const built = await buildCandidateEvidenceBundle({
        ...value.options,
        attemptId: `certificate-${field}`,
      });
      const signaturePath = join(built.bundlePath, "signature.json");
      const signature = JSON.parse(await readFile(signaturePath, "utf8"));
      if (field === "root-signature") {
        signature.certificate.rootSignature = `${signature.certificate.rootSignature.slice(0, -4)}AAAA`;
      } else {
        signature.certificate.payload.notAfter = "2026-09-30T00:00:00.000Z";
      }
      await writeFile(signaturePath, `${canonicalJson(signature)}\n`);
      const recomputed = await rewriteBundleDigest(built.bundlePath);
      await expect(
        verifyCandidateEvidenceBundle({
          bundlePath: built.bundlePath,
          expectedBundleDigest: recomputed,
          now: "2026-08-25T01:05:00.000Z",
          trustStorePath: value.trustStorePath,
        }),
      ).rejects.toThrow(/certificate root signature/);
    }
  });

  test("scans built-in credentials and generated metadata before persistence", async () => {
    const credentials = [
      "-----BEGIN PRIVATE KEY-----",
      "-----BEGIN ENCRYPTED PRIVATE KEY-----",
      "Authorization: Bearer abcdefghijklmnop",
      "AKIAABCDEFGHIJKLMNOP",
      "grant_abcdefghijklmnop",
    ];
    for (const [index, credential] of credentials.entries()) {
      const value = await fixture();
      const report = JSON.parse(await readFile(value.options.releaseReportPath, "utf8"));
      report.diagnostic = credential;
      await writeFile(value.options.releaseReportPath, `${canonicalJson(report)}\n`);
      await expect(
        buildCandidateEvidenceBundle({
          ...value.options,
          attemptId: `credential-${index}`,
        }),
      ).rejects.toThrow(/credential material/);
      expect((await readdir(value.spool)).some((name) => name.startsWith(".tmp-"))).toBe(false);
    }

    const value = await fixture();
    await expect(
      buildCandidateEvidenceBundle({
        ...value.options,
        adapterIdentity: "generated-metadata-canary",
        attemptId: "generated-canary",
        canarySecrets: ["generated-metadata-canary"],
      }),
    ).rejects.toThrow(/canary secret.*metadata/);
    expect((await readdir(value.spool)).some((name) => name.startsWith(".tmp-"))).toBe(false);
  });

  test("rejects malformed trust and signed-document fields before cryptographic use", async () => {
    const value = await fixture();
    const built = await buildCandidateEvidenceBundle({
      ...value.options,
      attemptId: "malformed-json-boundary",
    });
    const malformedTrustPath = join(value.root, "malformed-trust.json");
    await writeFile(
      malformedTrustPath,
      `${canonicalJson({ ...value.trustStore, roots: [{ algorithm: "Ed25519" }] })}\n`,
    );
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        expectedBundleDigest: built.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: malformedTrustPath,
      }),
    ).rejects.toThrow(/trust root|root public key/);

    const manifestPath = join(built.bundlePath, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.objects[0].size = "not-a-number";
    await writeFile(manifestPath, `${canonicalJson(manifest)}\n`);
    await expect(
      verifyCandidateEvidenceBundle({
        bundlePath: built.bundlePath,
        expectedBundleDigest: built.bundleDigest,
        now: "2026-08-25T01:05:00.000Z",
        trustStorePath: value.trustStorePath,
      }),
    ).rejects.toThrow(/object size/);
  });
});
