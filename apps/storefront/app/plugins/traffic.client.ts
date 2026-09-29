import { defineNuxtPlugin } from "#app";
import { createTrafficClient } from "~/utils/traffic";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public;
  if (!config.analyticsEnabled) return;
  const client = createTrafficClient({
    releaseId: String(config.releaseId),
    initialize: (operation) =>
      navigator.locks ? navigator.locks.request("shoppp-traffic-identity", operation) : operation(),
  });
  const visit = () => {
    const path = nuxtApp.$router.currentRoute.value.path;
    const slug = path.startsWith("/products/")
      ? path.slice("/products/".length).replace(/\/$/, "")
      : null;
    const page = slug
      ? (nuxtApp.payload.data[`catalog-product:${slug}`] as
          { product?: { id?: string }; releaseId?: string } | undefined)
      : undefined;
    if (slug && page?.releaseId !== config.releaseId) return;
    void client.visit(path, page?.product?.id);
  };
  nuxtApp.hook("app:mounted", visit);
  nuxtApp.hook("page:finish", visit);
});
