import { defineAsyncComponent } from "vue";

const FashionStoreCartPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCartPage.vue"),
);
const FashionStoreCheckoutPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCheckoutPage.vue"),
);
const FashionStoreCollectionPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreCollectionPage.vue"),
);
const FashionStoreContentPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreContentPage.vue"),
);
const FashionStoreProductPage = defineAsyncComponent(
  () => import("./components/pages/FashionStoreProductPage.vue"),
);

export const fashionStorePageSections = {
  "fashion-store.cart": FashionStoreCartPage,
  "fashion-store.checkout": FashionStoreCheckoutPage,
  "fashion-store.collection": FashionStoreCollectionPage,
  "fashion-store.content": FashionStoreContentPage,
  "fashion-store.product": FashionStoreProductPage,
} as const;
