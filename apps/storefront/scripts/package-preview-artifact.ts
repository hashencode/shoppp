import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { describePreviewArtifact, type PreviewArtifactFile } from "../worker/preview-access";

const contentTypes: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

async function previewFiles(outputRoot: string): Promise<PreviewArtifactFile[]> {
  const files: PreviewArtifactFile[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Preview output cannot contain a symlink: ${absolutePath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Unsupported preview output entry: ${absolutePath}`);
      const path = relative(outputRoot, absolutePath).split(sep).join("/");
      files.push({
        body: new Uint8Array(await readFile(absolutePath)),
        contentType: contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream",
        path,
      });
    }
  }
  await visit(outputRoot);
  return files;
}

export async function packagePreviewArtifact(options: {
  manifestPath: string;
  outputRoot: string;
  snapshotId: string;
}): Promise<{
  digest: string;
  files: Array<{ contentType: string; path: string; sourcePath: string }>;
  manifestPath: string;
  prefix: string;
}> {
  const outputRoot = resolve(options.outputRoot);
  const descriptor = await describePreviewArtifact(
    options.snapshotId,
    await previewFiles(outputRoot),
  );
  const manifestPath = resolve(options.manifestPath);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, descriptor.manifestBody);
  return {
    digest: descriptor.digest,
    files: descriptor.files.map((file) => ({
      contentType: file.contentType,
      path: file.path,
      sourcePath: resolve(outputRoot, file.path),
    })),
    manifestPath,
    prefix: descriptor.prefix,
  };
}

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const arguments_ = Bun.argv.slice(2);
  const snapshotId = argumentValue(arguments_, "--snapshot-id");
  const outputRoot = argumentValue(arguments_, "--output");
  const manifestPath = argumentValue(arguments_, "--manifest");
  if (!snapshotId || !outputRoot || !manifestPath) {
    throw new Error(
      "Usage: bun scripts/package-preview-artifact.ts --snapshot-id=<id> --output=<directory> --manifest=<path>",
    );
  }
  console.log(
    JSON.stringify(await packagePreviewArtifact({ manifestPath, outputRoot, snapshotId })),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
