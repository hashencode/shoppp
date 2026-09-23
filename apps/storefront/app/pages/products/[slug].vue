<script setup lang="ts">
import FashionStoreProductPage from "~/themes/fashion-store/components/pages/FashionStoreProductPage.vue";
import { themeAssets } from "~/themes/fashion-store/successor/registry";
import { useGuestCart } from "~/features/cart/use-guest-cart";
import { storefrontActionAdapterKey, type StorefrontActionAdapter } from "~/theme-engine/actions";
import { createThemeAssetResolver } from "~/theme-engine/assets";
import { storefrontCartStateKey } from "~/theme-engine/cart-state";
import { composeProductPageModel } from "~/theme-engine/composer";
import { activeExperienceSnapshot } from "~/generated/active-theme";
import {
  coalesceRuntimeCommerceRevalidations,
  liveCommerceModeKey,
  runtimeCommercePortKey,
  toRuntimeProductState,
} from "~/theme-engine/runtime-commerce";
import { breadcrumbStructuredData, canonicalUrl, productStructuredData } from "~/utils/seo";

definePageMeta({ layout: false });

const route = useRoute();
const slug = String(route.params.slug);
const { data: page } = await useAsyncData(`catalog-product:${slug}`, async () => {
  if (import.meta.client) return undefined;
  const { loadProductPage } = await import("~/utils/catalog-loader.server");
  return loadProductPage(slug);
});
if (!page.value) throw createError({ statusCode: 404, statusMessage: "Product not found" });

const { collection, product, release } = page.value;
const viewModel = composeProductPageModel({
  experience: activeExperienceSnapshot ?? undefined,
  locale: "en-US",
  productId: product.id,
  release,
  slug: product.slug,
});
const resolveThemeAsset = createThemeAssetResolver("fashion-store", themeAssets);
const commerceApi = useCommerceApi();
const {
  add: addGuestCartLine,
  cart: guestCart,
  remove: removeGuestCartLine,
  shipping: quoteGuestCartShipping,
  update: updateGuestCartLine,
} = useGuestCart();
const runtimeCommercePort = coalesceRuntimeCommerceRevalidations({
  async revalidateProduct(input) {
    const current = (await commerceApi.getLiveProductById(input.productId, input.currency)).data;
    if (current.id !== input.productId) {
      throw new Error("Commerce returned a different product than the selected Catalog Release.");
    }
    return toRuntimeProductState(current, input.currency);
  },
});
const actionAdapter: StorefrontActionAdapter = async (dispatch) => {
  if (dispatch.kind === "cart.add") {
    return addGuestCartLine({ ...dispatch.input, releaseId: release.releaseId }, dispatch.currency);
  }
  if (dispatch.kind === "cart.remove") return removeGuestCartLine(dispatch.variantId);
  if (dispatch.kind === "cart.shipping") return quoteGuestCartShipping(dispatch.input);
  return updateGuestCartLine(dispatch.variantId, dispatch.input);
};
provide(runtimeCommercePortKey, runtimeCommercePort);
provide(liveCommerceModeKey, true);
provide(storefrontActionAdapterKey, actionAdapter);
provide(storefrontCartStateKey, readonly(guestCart));

const canonical = canonicalUrl(release.site.origin, `/products/${product.slug}`);
const image = product.media[0];
useSeoMeta({
  title: product.seoTitle,
  description: product.seoDescription,
  ogTitle: product.seoTitle,
  ogDescription: product.seoDescription,
  ogUrl: canonical,
  ogImage: image ? canonicalUrl(release.site.origin, image.src) : undefined,
  twitterCard: "summary_large_image",
});
useHead({
  link: [{ rel: "canonical", href: canonical }],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(productStructuredData(product, release.site.origin)),
    },
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify(
        breadcrumbStructuredData(
          [
            { name: "Home", path: "/" },
            ...(collection
              ? [{ name: collection.name, path: `/collections/${collection.slug}` }]
              : []),
            { name: product.name, path: `/products/${product.slug}` },
          ],
          release.site.origin,
        ),
      ),
    },
  ],
});
</script>

<template>
  <FashionStoreProductPage :resolve-asset="resolveThemeAsset" :view-model="viewModel" />
</template>
