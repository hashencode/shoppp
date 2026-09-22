import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { writeFashionStoreProductContentMigrationBundle } from "./build-fashion-store-product-content-migration";

const predecessorPath = resolve(import.meta.dir, "fashion-store-live-catalog.json");
const successorPath = resolve(import.meta.dir, "fashion-store-product-content-catalog.json");

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function input(outputDirectory: string) {
  return {
    actorId: "local-product-content-migration",
    createdAt: "2026-09-22T00:00:00.000Z",
    outputDirectory,
    predecessorPath,
    requestId: "local-product-content-v4",
    successorPath,
  };
}

test("publishes one complete local migration bundle with matching digests", async () => {
  const parentDirectory = await mkdtemp(resolve(tmpdir(), "shoppp-fs-f12-bundle-"));
  const outputDirectory = resolve(parentDirectory, "bundle");
  try {
    await writeFashionStoreProductContentMigrationBundle(input(outputDirectory));

    expect((await readdir(outputDirectory)).sort()).toEqual([
      "migration-plan.json",
      "receipt.json",
      "seed-additive-variants.sql",
    ]);
    const [planJson, receiptJson, sql] = await Promise.all([
      readFile(resolve(outputDirectory, "migration-plan.json"), "utf8"),
      readFile(resolve(outputDirectory, "receipt.json"), "utf8"),
      readFile(resolve(outputDirectory, "seed-additive-variants.sql"), "utf8"),
    ]);
    const receipt = JSON.parse(receiptJson) as {
      evidenceSemantics: string;
      planSha256: string;
      sqlSha256: string;
    };
    expect(receipt.planSha256).toBe(sha256(planJson));
    expect(receipt.sqlSha256).toBe(sha256(sql));
    expect(receipt.evidenceSemantics).toContain("Local preparation");
    expect(receipt.evidenceSemantics).toContain("does not prove remote");
    expect((await readdir(parentDirectory)).filter((name) => name.includes(".tmp-"))).toEqual([]);
  } finally {
    await rm(parentDirectory, { force: true, recursive: true });
  }
});

test("refuses an existing output directory without replacing its contents", async () => {
  const parentDirectory = await mkdtemp(resolve(tmpdir(), "shoppp-fs-f12-bundle-"));
  const outputDirectory = resolve(parentDirectory, "bundle");
  const sentinelPath = resolve(outputDirectory, "keep.txt");
  try {
    await mkdir(outputDirectory);
    await writeFile(sentinelPath, "existing bundle\n");

    await expect(
      writeFashionStoreProductContentMigrationBundle(input(outputDirectory)),
    ).rejects.toThrow("output already exists");
    expect(await readdir(outputDirectory)).toEqual(["keep.txt"]);
    expect(await readFile(sentinelPath, "utf8")).toBe("existing bundle\n");
    expect((await readdir(parentDirectory)).filter((name) => name.includes(".tmp-"))).toEqual([]);
  } finally {
    await rm(parentDirectory, { force: true, recursive: true });
  }
});
