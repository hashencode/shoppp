import manifest from "./app/generated/route-manifest.json";
import { catalogRelease } from "./app/generated/catalog";

const previewBuild = process.env.STOREFRONT_BUILD_MODE === "preview";
const fashion2FontImports = [
  "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');",
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap");',
  '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800;900&display=swap");',
] as const;
const redirectRules = Object.fromEntries(
  manifest.redirects.map((redirect) => [
    redirect.from,
    { redirect: { to: redirect.to, statusCode: 301 } },
  ]),
);

export default defineNuxtConfig({
  compatibilityDate: "2026-07-30",
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  features: {
    inlineStyles: previewBuild ? true : (id) => Boolean(id?.includes(".vue")),
  },
  modules: ["@nuxt/image", "@pinia/nuxt"],
  vite: {
    plugins: [
      {
        name: "fashion-2-local-font-adaptation",
        enforce: "pre",
        transform(source, id) {
          const cleanId = id.split("?", 1)[0]!;
          if (!cleanId.includes("/themes/fashion-2/upstream/") || !cleanId.endsWith(".css")) return;
          const adapted = fashion2FontImports.reduce(
            (css, remoteImport) => css.replace(remoteImport, ""),
            source,
          );
          return adapted === source ? undefined : adapted;
        },
      },
    ],
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(previewBuild ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
    },
  },
  image: {
    provider: "cloudflare",
    cloudflare: {
      baseURL: process.env.NUXT_IMAGE_ORIGIN || catalogRelease.site.origin,
    },
    screens: { xs: 390, sm: 640, md: 768, lg: 1024, xl: 1280 },
  },
  hooks: {
    "build:manifest": (clientManifest) => {
      for (const entry of Object.values(clientManifest)) {
        entry.assets = entry.assets?.filter(
          (asset) => !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(asset),
        );
        if (previewBuild) {
          entry.css = [];
          entry.imports = [];
        }
      }
    },
  },
  nitro: {
    devProxy: process.env.API_PROXY_TARGET
      ? {
          "/api": {
            target: process.env.API_PROXY_TARGET,
            changeOrigin: true,
            prependPath: false,
          },
        }
      : {},
    prerender: {
      crawlLinks: true,
      failOnError: true,
      routes: [...manifest.routes, "/cart", "/checkout", "/checkout/complete", "/orders/access"],
    },
  },
  routeRules: {
    ...redirectRules,
    "/cart": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/checkout": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/checkout/complete": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/orders/**": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
  },
  runtimeConfig: {
    public: {
      analyticsEnabled: !previewBuild,
      apiBase: "/api",
      siteOrigin: catalogRelease.site.origin,
      releaseId: catalogRelease.releaseId,
      freshnessHours: catalogRelease.site.freshnessHours,
    },
  },
  typescript: { strict: true, typeCheck: true },
});
