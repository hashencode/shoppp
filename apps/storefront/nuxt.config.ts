import manifest from "./app/generated/route-manifest.json";
import { catalogRelease } from "./app/generated/catalog";

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
    prerender: {
      crawlLinks: true,
      failOnError: true,
      ignore: ["/cart", "/checkout/**", "/orders/**"],
      routes: manifest.routes,
    },
  },
  routeRules: {
    ...redirectRules,
    "/checkout/**": { prerender: false },
    "/orders/**": { prerender: false },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "https://api.example.invalid",
      siteOrigin: catalogRelease.site.origin,
      releaseId: catalogRelease.releaseId,
      freshnessHours: catalogRelease.site.freshnessHours,
    },
  },
  typescript: { strict: true, typeCheck: true },
});
