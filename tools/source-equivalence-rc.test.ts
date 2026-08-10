import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  createSourceEquivalenceRcManifest,
  verifySourceEquivalenceRcManifest,
} from "./source-equivalence-rc";

const temporaryDirectories: string[] = [];

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "shoppp-source-rc-"));
  temporaryDirectories.push(root);
  await mkdir(resolve(root, "build"));
  await mkdir(resolve(root, "tools"));
  await writeFile(resolve(root, "build/index.html"), "candidate");
  await writeFile(resolve(root, "tools/storefront-source-equivalence-policy.json"), "{}\n");
  const commit = "a".repeat(40);
  const tree = "b".repeat(40);
  const manifest = await createSourceEquivalenceRcManifest({
    artifactPath: "build",
    commit,
    createdAt: "2026-08-10T00:00:00.000Z",
    root,
    theme: "fashion-store",
    tree,
  });
  return { commit, manifest, root, tree };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("source-equivalence RC freeze", () => {
  test("binds one candidate artifact and acceptance policy to commit identity", async () => {
    const { commit, manifest, root, tree } = await fixture();
    expect(manifest).toMatchObject({
      commit,
      schemaVersion: 1,
      stage: "rc-frozen",
      theme: "fashion-store",
      tree,
    });
    await expect(
      verifySourceEquivalenceRcManifest(manifest, {
        commit,
        root,
        trackedChanges: "",
        tree,
      }),
    ).resolves.toBeUndefined();
  });

  test("rejects code identity and artifact drift", async () => {
    const { commit, manifest, root, tree } = await fixture();
    await expect(
      verifySourceEquivalenceRcManifest(manifest, {
        commit: "c".repeat(40),
        root,
        trackedChanges: "",
        tree,
      }),
    ).rejects.toThrow("current commit differs");
    await writeFile(resolve(root, "build/index.html"), "changed");
    await expect(
      verifySourceEquivalenceRcManifest(manifest, {
        commit,
        root,
        trackedChanges: "",
        tree,
      }),
    ).rejects.toThrow("artifact digest changed");
  });

  test("rejects tracked edits even when the frozen artifact is unchanged", async () => {
    const { commit, manifest, root, tree } = await fixture();
    await expect(
      verifySourceEquivalenceRcManifest(manifest, {
        commit,
        root,
        trackedChanges: " M apps/storefront/app.vue",
        tree,
      }),
    ).rejects.toThrow("clean tracked working tree");
  });
});
