import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyNoSensitiveBuildArtifacts } from "./verify-static-output";

const temporaryDirectories: string[] = [];

async function fixture(content: string): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "shoppp-static-"));
  temporaryDirectories.push(directory);
  await writeFile(resolve(directory, "bundle.js"), content);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("static artifact safety", () => {
  test("accepts public client output", async () => {
    await expect(
      verifyNoSensitiveBuildArtifacts([await fixture("window.releaseId='release-123'")]),
    ).resolves.toBeUndefined();
  });

  test("does not treat long fractional or digest values as card-shaped data", async () => {
    await expect(
      verifyNoSensitiveBuildArtifacts([
        await fixture(
          '{"density":{"value_area":1843.9238699953512},"sha256":"dfe997b0abd996f0e53ee01158720b9104656158157328c7e52e8d0ffff1b8c5"}',
        ),
      ]),
    ).resolves.toBeUndefined();
  });

  test("rejects a provider secret", async () => {
    const secret = ["sk", "live", "should-never-ship"].join("_");
    await expect(verifyNoSensitiveBuildArtifacts([await fixture(secret)])).rejects.toThrow(
      /Stripe secret key/,
    );
  });

  test("rejects raw card-shaped data", async () => {
    const rawCard = ["4242", "4242", "4242", "4242"].join(" ");
    await expect(verifyNoSensitiveBuildArtifacts([await fixture(rawCard)])).rejects.toThrow(
      /raw card-shaped data/,
    );
  });
});
