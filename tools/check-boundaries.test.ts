import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkBoundaries } from "./check-boundaries";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

async function createFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shoppp-boundaries-"));
  temporaryRoots.push(root);

  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = join(root, relativePath);
      await mkdir(join(absolutePath, ".."), { recursive: true });
      await writeFile(absolutePath, contents);
    }),
  );

  return root;
}

describe("checkBoundaries", () => {
  test("allows every application to import framework-neutral contracts", async () => {
    const root = await createFixture({
      "apps/admin/src/catalog.ts": 'import type { Product } from "@shoppp/contracts";',
      "apps/api/src/catalog.ts": 'import type { Product } from "@shoppp/contracts";',
      "apps/storefront/app/catalog.ts": 'import type { Product } from "@shoppp/contracts";',
    });

    expect(await checkBoundaries(root)).toEqual([]);
  });

  test("rejects storefront code that imports the database package", async () => {
    const root = await createFixture({
      "apps/storefront/app/cart.ts": 'import { database } from "@shoppp/db";',
    });

    expect(await checkBoundaries(root)).toEqual([
      expect.objectContaining({
        importSpecifier: "@shoppp/db",
        rule: "browser-no-database",
      }),
    ]);
  });

  test("rejects framework dependencies from the domain package", async () => {
    const root = await createFixture({
      "packages/domain/src/order.ts": 'import { Hono } from "hono";',
    });

    expect(await checkBoundaries(root)).toEqual([
      expect.objectContaining({
        importSpecifier: "hono",
        rule: "domain-framework-neutral",
      }),
    ]);
  });
});
