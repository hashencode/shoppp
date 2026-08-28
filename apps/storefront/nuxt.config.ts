import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "./app/generated/route-manifest.json";
import { catalogRelease } from "./app/generated/catalog";
import { experienceBuildInputSchema } from "./scripts/prepare-experience";
import { resolveStorefrontPrerenderRoutes } from "./scripts/resolve-prerender-routes";

const previewBuild = process.env.STOREFRONT_BUILD_MODE === "preview";
const fashionStoreFontImports = [
  "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');",
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap");',
  '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800;900&display=swap");',
] as const;
const decorStoreFontImports = [
  "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap');",
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap");',
  '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800;900&display=swap");',
] as const;
const redirectRules = Object.fromEntries(
  manifest.redirects.map((redirect) => [
    redirect.from,
    { redirect: { to: redirect.to, statusCode: 301 } },
  ]),
);
const previewExperienceFile = process.env.STOREFRONT_EXPERIENCE_FILE;
const previewExperienceInput = previewExperienceFile
  ? experienceBuildInputSchema.parse(
      JSON.parse(readFileSync(resolve(previewExperienceFile), "utf8")),
    )
  : undefined;
const previewThemeStyles =
  previewBuild && previewExperienceInput?.environment === "preview"
    ? previewExperienceInput.themeId === "fashion-store"
      ? [
          "~/themes/fashion-store/upstream/css/vendors.min.css",
          "~/themes/fashion-store/upstream/css/icon.min.css",
          "~/themes/fashion-store/upstream/css/style.css",
          "~/themes/fashion-store/upstream/css/responsive.css",
          "~/themes/fashion-store/upstream/demos/fashion-store/fashion-store.css",
          "~/themes/fashion-store/integration.css",
        ]
      : previewExperienceInput.themeId === "decor-store"
        ? [
            "~/themes/decor-store/upstream/css/vendors.min.css",
            "~/themes/decor-store/upstream/css/icon.min.css",
            "~/themes/decor-store/upstream/css/style.css",
            "~/themes/decor-store/upstream/css/responsive.css",
            "~/themes/decor-store/upstream/demos/decor-store/decor-store.css",
            "~/themes/decor-store/integration.css",
          ]
        : []
    : [];
const prerenderRoutes = resolveStorefrontPrerenderRoutes({
  experience: previewExperienceInput,
  previewBuild,
  productionRoutes: manifest.routes,
});

export default defineNuxtConfig({
  compatibilityDate: "2026-07-30",
  css: ["~/assets/css/main.css", ...previewThemeStyles],
  devtools: { enabled: false },
  features: {
    inlineStyles: previewBuild ? false : (id) => Boolean(id?.includes(".vue")),
  },
  modules: ["@nuxt/image", "@pinia/nuxt"],
  vite: {
    plugins: [
      {
        name: "fashion-store-local-font-adaptation",
        enforce: "pre",
        transform(source, id) {
          const cleanId = id.split("?", 1)[0]!;
          if (!cleanId.includes("/themes/fashion-store/upstream/") || !cleanId.endsWith(".css"))
            return;
          const adapted = fashionStoreFontImports.reduce(
            (css, remoteImport) => css.replace(remoteImport, ""),
            source,
          );
          return adapted === source ? undefined : { code: adapted, map: null };
        },
      },
      {
        name: "decor-store-local-font-adaptation",
        enforce: "pre",
        transform(source, id) {
          const cleanId = id.split("?", 1)[0]!;
          if (!cleanId.includes("/themes/decor-store/upstream/") || !cleanId.endsWith(".css"))
            return;
          const adapted = decorStoreFontImports
            .reduce((css, remoteImport) => css.replace(remoteImport, ""), source)
            .replace(
              /font-family:"Roboto Slab"\r?\n\s+margin-bottom:5px;/g,
              'font-family:"Roboto Slab";\n    margin-bottom:5px;',
            );
          return adapted === source ? undefined : { code: adapted, map: null };
        },
      },
    ],
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      link: [{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" }],
      script: [{ src: "/storefront-interaction-capture.js" }],
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
      const dependencyGraph = new Map(
        Object.entries(clientManifest).map(([id, entry]) => [
          id,
          { css: entry.css ?? [], imports: entry.imports ?? [] },
        ]),
      );
      const collectDependencyCss = (id: string, visited = new Set<string>()): string[] => {
        if (visited.has(id)) return [];
        visited.add(id);
        const dependency = dependencyGraph.get(id);
        if (!dependency) return [];
        return [
          ...dependency.css,
          ...dependency.imports.flatMap((importId) => collectDependencyCss(importId, visited)),
        ];
      };

      for (const [id, entry] of Object.entries(clientManifest)) {
        entry.assets = entry.assets?.filter(
          (asset) => !/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(asset),
        );
        if (previewBuild) {
          entry.css = [...new Set(collectDependencyCss(id))];
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
      crawlLinks: !previewBuild,
      failOnError: true,
      routes: prerenderRoutes,
    },
  },
  routeRules: {
    ...redirectRules,
    "/cart": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/checkout": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/checkout/complete": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/account": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
    "/wishlist": { headers: { "X-Robots-Tag": "noindex, nofollow" } },
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
