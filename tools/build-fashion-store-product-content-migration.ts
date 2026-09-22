import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  buildFashionStoreProductContentMigrationPlan,
  buildFashionStoreProductContentMigrationSql,
} from "./prepare-fashion-store-product-content-migration";

export interface FashionStoreProductContentMigrationBundleInput {
  readonly actorId: string;
  readonly createdAt: string;
  readonly outputDirectory: string;
  readonly predecessorPath: string;
  readonly requestId: string;
  readonly successorPath: string;
}

function cliInput(): FashionStoreProductContentMigrationBundleInput {
  const { values } = parseArgs({
    options: {
      "actor-id": { default: "local-product-content-migration", type: "string" },
      "created-at": { type: "string" },
      "output-dir": { type: "string" },
      predecessor: { default: "tools/fashion-store-live-catalog.json", type: "string" },
      "request-id": { type: "string" },
      successor: {
        default: "tools/fashion-store-product-content-catalog.json",
        type: "string",
      },
    },
    strict: true,
  });
  if (!values["created-at"] || !values["output-dir"] || !values["request-id"]) {
    throw new Error("Provide --created-at, --request-id, and --output-dir.");
  }
  return {
    actorId: values["actor-id"],
    createdAt: values["created-at"],
    outputDirectory: resolve(values["output-dir"]),
    predecessorPath: resolve(values.predecessor),
    requestId: values["request-id"],
    successorPath: resolve(values.successor),
  };
}

async function catalog(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function sha256(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

async function requireMissingDirectory(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Migration bundle output already exists: ${path}`);
}

export async function writeFashionStoreProductContentMigrationBundle(
  input: FashionStoreProductContentMigrationBundleInput,
): Promise<void> {
  const [predecessor, successor] = await Promise.all([
    catalog(input.predecessorPath),
    catalog(input.successorPath),
  ]);
  const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);
  const sql = buildFashionStoreProductContentMigrationSql(plan, input);
  const planJson = `${JSON.stringify(plan, null, 2)}\n`;
  const receiptJson = `${JSON.stringify(
    {
      addedMediaCount: plan.addedMedia.length,
      addedVariantCount: plan.addedVariants.length,
      evidenceSemantics:
        "Local preparation and artifact-integrity evidence only; this receipt does not prove remote D1 or R2 mutation, release activation, deployment, or any other remote apply.",
      planSha256: sha256(planJson),
      predecessorCatalogVersion: plan.predecessorCatalogVersion,
      productCount: plan.expected.productCount,
      revisionCount: plan.revisions.length,
      sqlSha256: sha256(sql),
      successorCatalogVersion: plan.successorCatalogVersion,
      targetMediaCount: plan.expected.mediaCount,
      targetVariantCount: plan.expected.variantCount,
    },
    null,
    2,
  )}\n`;

  await requireMissingDirectory(input.outputDirectory);
  const parentDirectory = dirname(input.outputDirectory);
  await mkdir(parentDirectory, { recursive: true });
  const temporaryDirectory = await mkdtemp(
    resolve(parentDirectory, `.${basename(input.outputDirectory)}.tmp-`),
  );
  try {
    await Promise.all([
      writeFile(resolve(temporaryDirectory, "migration-plan.json"), planJson),
      writeFile(resolve(temporaryDirectory, "seed-additive-variants.sql"), sql),
    ]);
    await writeFile(resolve(temporaryDirectory, "receipt.json"), receiptJson);
    await requireMissingDirectory(input.outputDirectory);
    await rename(temporaryDirectory, input.outputDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }
}

if (import.meta.main) await writeFashionStoreProductContentMigrationBundle(cliInput());
