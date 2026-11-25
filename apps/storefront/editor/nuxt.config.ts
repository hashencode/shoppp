import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-30",
  srcDir: "app",
  ssr: false,
  pages: true,
  devtools: { enabled: false },
  modules: ["@pinia/nuxt"],
  imports: { dirs: [fileURLToPath(new URL('../app/composables', import.meta.url))] },
  vite: {
    plugins: [
      {
        name: "editor-local-fonts",
        enforce: "pre",
        transform(source, id) {
          if (
            !id.split("?")[0]?.includes("/themes/fashion-store/upstream/") ||
            !id.split("?")[0]?.endsWith(".css")
          )
            return;
          return {
            code: source.replace(
              /@import url\(['"]https:\/\/fonts\.googleapis\.com\/[^)]+\);\s*/g,
              "",
            ),
            map: null,
          };
        },
      },
    ],
  },
  alias: {
    "~": fileURLToPath(new URL("../app", import.meta.url)),
    "@": fileURLToPath(new URL("../app", import.meta.url)),
  },
  app: {
    baseURL: "/theme-editor/",
    head: { meta: [{ name: "robots", content: "noindex, nofollow" }] },
  },
  runtimeConfig: { public: { fashionStoreHomeProfile: "combined" } },
  nitro: { output: { dir: ".output" }, prerender: { crawlLinks: false, routes: ["/"] } },
});
