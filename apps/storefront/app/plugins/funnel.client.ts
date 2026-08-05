import { defineNuxtPlugin } from "#app";

import { sendPageView } from "~/utils/analytics";

export default defineNuxtPlugin((nuxtApp) => {
  if (!useRuntimeConfig().public.analyticsEnabled) return;
  let lastPath = "";
  const sendOnce = (path: string) => {
    if (path === lastPath) return;
    lastPath = path;
    sendPageView(path);
  };

  nuxtApp.hook("app:mounted", () => sendOnce(window.location.pathname));
  nuxtApp.$router.afterEach((to) => sendOnce(to.path));
});
