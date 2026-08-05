import type { RouterConfig } from "@nuxt/schema";
import { nextTick } from "vue";

export const storefrontScrollBehavior: NonNullable<RouterConfig["scrollBehavior"]> = async (
  to,
  _from,
  savedPosition,
) => {
  if (savedPosition) return savedPosition;

  if (to.hash) {
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      behavior: "auto",
      el: to.hash,
      top: 0,
    };
  }

  return {
    behavior: "auto",
    left: 0,
    top: 0,
  };
};

export default <RouterConfig>{
  scrollBehavior: storefrontScrollBehavior,
};
