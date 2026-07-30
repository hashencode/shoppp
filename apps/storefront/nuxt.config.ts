import manifest from "./app/generated/route-manifest.json";
import { catalogRelease } from "./app/generated/catalog";

const previewBuild = process.env.STOREFRONT_BUILD_MODE === "preview";
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
  modules: ["@nuxt/ui", "@nuxt/image", "@pinia/nuxt"],
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
