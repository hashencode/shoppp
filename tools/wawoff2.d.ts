declare module "wawoff2" {
  export function decompress(source: Uint8Array): Promise<Uint8Array>;
}
