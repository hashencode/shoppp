import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

export interface FontAxis {
  defaultValue: number;
  maximum: number;
  minimum: number;
  tag: string;
}

export interface ThemeFontInspection {
  axes: FontAxis[];
  family: string;
  hash: string;
  namedFamily: string;
  path: string;
  subfamily: string;
}

interface SfntTable {
  length: number;
  offset: number;
}

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function tableDirectory(view: DataView): Map<string, SfntTable> {
  const tables = new Map<string, SfntTable>();
  const count = view.getUint16(4);
  for (let index = 0; index < count; index += 1) {
    const recordOffset = 12 + index * 16;
    tables.set(readTag(view, recordOffset), {
      length: view.getUint32(recordOffset + 12),
      offset: view.getUint32(recordOffset + 8),
    });
  }
  return tables;
}

function decodeUtf16BigEndian(bytes: Uint8Array): string {
  const codeUnits: number[] = [];
  for (let index = 0; index + 1 < bytes.length; index += 2)
    codeUnits.push((bytes[index]! << 8) | bytes[index + 1]!);
  return String.fromCharCode(...codeUnits);
}

function readName(
  view: DataView,
  bytes: Uint8Array,
  table: SfntTable,
  nameId: number,
): string | null {
  const count = view.getUint16(table.offset + 2);
  const stringOffset = table.offset + view.getUint16(table.offset + 4);
  const matches: Array<{ language: number; platform: number; value: string }> = [];
  for (let index = 0; index < count; index += 1) {
    const offset = table.offset + 6 + index * 12;
    const platform = view.getUint16(offset);
    const language = view.getUint16(offset + 4);
    if (view.getUint16(offset + 6) !== nameId) continue;
    const length = view.getUint16(offset + 8);
    const valueOffset = stringOffset + view.getUint16(offset + 10);
    const valueBytes = bytes.slice(valueOffset, valueOffset + length);
    const value =
      platform === 0 || platform === 3
        ? decodeUtf16BigEndian(valueBytes)
        : new TextDecoder().decode(valueBytes);
    if (value) matches.push({ language, platform, value });
  }
  return (
    matches.find(({ platform, language }) => platform === 3 && language === 0x409)?.value ??
    matches.find(({ platform }) => platform === 0 || platform === 3)?.value ??
    matches[0]?.value ??
    null
  );
}

function readAxes(view: DataView, table: SfntTable | undefined): FontAxis[] {
  if (!table) return [];
  const axesOffset = table.offset + view.getUint16(table.offset + 4);
  const axisCount = view.getUint16(table.offset + 8);
  const axisSize = view.getUint16(table.offset + 10);
  const fixed = (offset: number) => view.getInt32(offset) / 65_536;
  return Array.from({ length: axisCount }, (_, index) => {
    const offset = axesOffset + index * axisSize;
    return {
      defaultValue: fixed(offset + 8),
      maximum: fixed(offset + 12),
      minimum: fixed(offset + 4),
      tag: readTag(view, offset),
    };
  });
}

async function decompressWoff2(path: string, destination: string): Promise<string> {
  const copiedWoff = join(destination, basename(path));
  await copyFile(path, copiedWoff);
  const process = Bun.spawn(["woff2_decompress", copiedWoff], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) {
    const error = await new Response(process.stderr).text();
    throw new Error(`woff2_decompress failed for ${path}: ${error.trim()}`);
  }
  return copiedWoff.replace(/\.woff2$/i, ".ttf");
}

export async function inspectThemeFont(path: string): Promise<ThemeFontInspection> {
  const source = await readFile(path);
  const hash = new Bun.CryptoHasher("sha256").update(source).digest("hex");
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "shoppp-font-audit-"));
  try {
    const sfntPath = await decompressWoff2(path, temporaryDirectory);
    const sfnt = await readFile(sfntPath);
    const bytes = new Uint8Array(sfnt);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = tableDirectory(view);
    const names = tables.get("name");
    if (!names) throw new Error(`Font ${path} has no name table.`);
    return {
      axes: readAxes(view, tables.get("fvar")),
      family: readName(view, bytes, names, 16) ?? readName(view, bytes, names, 1) ?? "",
      hash,
      namedFamily: readName(view, bytes, names, 1) ?? "",
      path,
      subfamily: readName(view, bytes, names, 17) ?? readName(view, bytes, names, 2) ?? "",
    };
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (!paths.length) throw new Error("Pass one or more .woff2 paths to inspect.");
  console.log(JSON.stringify(await Promise.all(paths.map(inspectThemeFont)), null, 2));
}
