import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type FidelityThemeId = "decor" | "fashion";

interface CaptureMetadata {
  capturedAt: string;
  themeId: FidelityThemeId;
  viewports: { height: number; id: "desktop" | "mobile"; width: number }[];
}

function pngDimensions(contents: Uint8Array): { height: number; width: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (contents.length < 24 || !signature.every((byte, index) => contents[index] === byte)) {
    throw new Error("Fidelity capture is not a valid PNG.");
  }
  const view = new DataView(contents.buffer, contents.byteOffset, contents.byteLength);
  return { height: view.getUint32(20), width: view.getUint32(16) };
}

async function metadata(root: string, themeId: FidelityThemeId): Promise<CaptureMetadata> {
  const path = join(root, themeId, "metadata.json");
  const value = JSON.parse(
    await readFile(path, "utf8").catch(() => {
      throw new Error(`Fidelity metadata is missing: ${path}`);
    }),
  ) as CaptureMetadata;
  if (value.themeId !== themeId)
    throw new Error(`Fidelity metadata belongs to the wrong theme: ${path}`);
  if (!Number.isFinite(Date.parse(value.capturedAt)))
    throw new Error(`Fidelity metadata is stale or invalid: ${path}`);
  return value;
}

export async function generateThemeFidelityReport(options: {
  approvalBy?: string;
  commit: string;
  implementationRoot: string;
  outputRoot: string;
  referenceRoot: string;
  themes?: FidelityThemeId[];
}): Promise<string> {
  if (!/^[a-f0-9]{7,40}$/.test(options.commit)) throw new Error("A real commit SHA is required.");
  const themes = options.themes ?? ["fashion", "decor"];
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const cards: string[] = [];
  for (const themeId of themes) {
    const referenceMetadata = await metadata(resolve(options.referenceRoot), themeId);
    const implementationMetadata = await metadata(resolve(options.implementationRoot), themeId);
    for (const viewport of ["desktop", "mobile"] as const) {
      const expected = referenceMetadata.viewports.find(({ id }) => id === viewport);
      const actual = implementationMetadata.viewports.find(({ id }) => id === viewport);
      if (!expected || !actual || expected.width !== actual.width) {
        throw new Error(`${themeId} ${viewport} capture viewport dimensions do not match.`);
      }
      const referencePath = join(resolve(options.referenceRoot), themeId, `${viewport}.png`);
      const implementationPath = join(
        resolve(options.implementationRoot),
        themeId,
        `${viewport}.png`,
      );
      for (const path of [referencePath, implementationPath]) {
        if (!(await stat(path).catch(() => null))?.isFile())
          throw new Error(`Fidelity capture is missing: ${path}`);
      }
      const referenceDimensions = pngDimensions(new Uint8Array(await readFile(referencePath)));
      const implementationDimensions = pngDimensions(
        new Uint8Array(await readFile(implementationPath)),
      );
      if (
        referenceDimensions.width !== expected.width ||
        implementationDimensions.width !== actual.width
      ) {
        throw new Error(`${themeId} ${viewport} PNG dimensions do not match capture metadata.`);
      }
      const referenceName = `${themeId}-${viewport}-reference.png`;
      const implementationName = `${themeId}-${viewport}-implementation.png`;
      await Promise.all([
        copyFile(referencePath, join(outputRoot, referenceName)),
        copyFile(implementationPath, join(outputRoot, implementationName)),
      ]);
      cards.push(`<section>
  <h2>${themeId} · ${viewport}</h2>
  <p>${expected.width}px viewport · commit <code>${options.commit}</code></p>
  <div class="comparison">
    <figure><figcaption>Reference</figcaption><img src="${referenceName}" alt="${themeId} ${viewport} reference"></figure>
    <figure><figcaption>Implementation</figcaption><img src="${implementationName}" alt="${themeId} ${viewport} implementation"></figure>
  </div>
</section>`);
    }
  }
  const reportPath = join(outputRoot, "index.html");
  await writeFile(
    reportPath,
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fashion and Decor fidelity review</title><style>body{margin:0;padding:32px;background:#eef1f3;color:#14202b;font:16px system-ui}main{max-width:1600px;margin:auto}section{margin:0 0 40px;padding:24px;background:#fff;border-radius:16px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}figure{margin:0}figcaption{font-weight:700;margin-bottom:8px}img{display:block;width:100%;height:auto;border:1px solid #d8dde2}@media(max-width:800px){.comparison{grid-template-columns:1fr}}</style><main><h1>Fashion and Decor fidelity review</h1><p>Reference evidence remains separate from implementation captures. This report does not imply approval.</p>${cards.join("")}</main></html>`,
  );
  if (options.approvalBy?.trim()) {
    await writeFile(
      join(outputRoot, "approval.json"),
      `${JSON.stringify(
        {
          approvedAt: new Date().toISOString(),
          approvedBy: options.approvalBy.trim(),
          commit: options.commit,
          report: basename(reportPath),
          themes,
        },
        null,
        2,
      )}\n`,
    );
  }
  return reportPath;
}

function value(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const arguments_ = Bun.argv.slice(2);
  const referenceRoot = value(arguments_, "--reference");
  const implementationRoot = value(arguments_, "--implementation");
  const outputRoot = value(arguments_, "--output");
  const commit = value(arguments_, "--commit");
  if (!referenceRoot || !implementationRoot || !outputRoot || !commit) {
    throw new Error(
      "Usage: bun tools/theme-fidelity-report.ts --reference=<root> --implementation=<root> --output=<root> --commit=<sha>",
    );
  }
  console.log(
    await generateThemeFidelityReport({ commit, implementationRoot, outputRoot, referenceRoot }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
