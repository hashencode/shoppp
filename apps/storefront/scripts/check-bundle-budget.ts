import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dir, "../.output/public/_nuxt");
const files = await readdir(root);
const javascript = files.filter((file) => file.endsWith(".js"));
let totalGzip = 0;
for (const file of javascript) {
  totalGzip += gzipSync(await readFile(resolve(root, file))).byteLength;
}
const budget = 200 * 1024;
if (totalGzip > budget) {
  throw new Error(`Storefront JavaScript ${totalGzip} bytes gzip exceeds ${budget}.`);
}
console.log(`Storefront JavaScript budget passed: ${totalGzip} / ${budget} bytes gzip.`);
