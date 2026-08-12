<script setup lang="ts">
import type { ExperienceSnapshot } from "@shoppp/contracts";

import {
  activeExperienceSnapshot,
  activePreviewOrigin,
  activeThemeAssets,
  activeThemeId,
  activeThemeRegistry,
  activeThemeRoutes,
} from "./generated/active-theme";
import {
  activeExperienceProviderInput,
  activeFixtureRegistry,
} from "./generated/active-experience";
import { createThemeAssetResolver } from "./theme-engine/assets";
import {
  createFixturePresentationProvider,
  createLivePresentationProvider,
} from "./theme-engine/providers";
import { resolveThemeRoute } from "./theme-engine/routes";
import ThemeRenderer from "./theme-engine/renderer.vue";
import { useGuestCart } from "./features/cart/use-guest-cart";
import { storeOrderAccess } from "./features/checkout/session";
import type { StorefrontActionAdapter } from "./theme-engine/actions";
import type { StorefrontCheckoutAdapter } from "./theme-engine/checkout";
import { storefrontCartStateKey } from "./theme-engine/cart-state";
import {
  runtimeCommercePortKey,
  liveCommerceModeKey,
  toRuntimeProductState,
  type RuntimeCommercePort,
} from "./theme-engine/runtime-commerce";
import { canonicalUrl, productStructuredData } from "./utils/seo";

const resolveThemeAsset = createThemeAssetResolver(activeThemeId, activeThemeAssets);
const router = useRouter();
const currentRoute = computed(() => router.currentRoute.value);
const routeMode = activeExperienceProviderInput.mode === "live" ? "live" : "fixture-preview";
const experienceSnapshot: ExperienceSnapshot | null = activeExperienceSnapshot;
const fixturePresentationProvider = createFixturePresentationProvider({
  bindings: experienceSnapshot?.bindings.filter((binding) => binding.kind === "fixture") ?? [],
  fixtures: activeFixtureRegistry,
});
const pageContract = computed(() =>
  resolveThemeRoute(
    currentRoute.value.path,
    activeThemeRoutes,
    activeExperienceProviderInput.mode === "live"
      ? activeExperienceProviderInput.release
      : undefined,
    routeMode,
  ),
);
const presentationProvider = computed(() =>
  activeExperienceProviderInput.mode === "live" && activeExperienceSnapshot && pageContract.value
    ? createLivePresentationProvider({
        experience: activeExperienceSnapshot,
        locale: "en-US",
        path: currentRoute.value.path,
        release: activeExperienceProviderInput.release,
        route: pageContract.value,
      })
    : fixturePresentationProvider,
);
const {
  add: addGuestCartLine,
  beginCheckout,
  cart: guestCart,
  error: guestCartError,
  ensure: ensureGuestCart,
  notice: guestCartNotice,
  remove: removeGuestCartLine,
  shipping: quoteGuestCartShipping,
  update: updateGuestCartLine,
} = useGuestCart();
const commerceApi = useCommerceApi();
const runtimeCommercePort: RuntimeCommercePort = {
  async revalidateProduct(input) {
    const product = (await commerceApi.getLiveProductById(input.productId, input.currency)).data;
    if (product.id !== input.productId) {
      throw new Error("Commerce returned a different product than the selected Catalog Release.");
    }
    return toRuntimeProductState(product, input.currency);
  },
};
if (activeExperienceProviderInput.mode === "live") {
  provide(runtimeCommercePortKey, runtimeCommercePort);
  provide(liveCommerceModeKey, true);
  provide(storefrontCartStateKey, readonly(guestCart));
}
const storefrontActionAdapter: StorefrontActionAdapter = async (dispatch) => {
  if (dispatch.kind === "cart.add") {
    return addGuestCartLine(
      activeExperienceProviderInput.mode === "live"
        ? {
            ...dispatch.input,
            releaseId: activeExperienceProviderInput.identity.catalogReleaseId,
          }
        : dispatch.input,
      dispatch.currency,
    );
  }
  if (dispatch.kind === "cart.remove") return removeGuestCartLine(dispatch.variantId);
  if (dispatch.kind === "cart.shipping") return quoteGuestCartShipping(dispatch.input);
  return updateGuestCartLine(dispatch.variantId, dispatch.input);
};
const storefrontCheckoutAdapter: StorefrontCheckoutAdapter = {
  begin: beginCheckout,
  complete(session) {
    storeOrderAccess({ attemptId: session.attemptId, token: session.orderAccessToken });
    window.location.assign(session.checkoutUrl);
  },
  async configuration() {
    return (await commerceApi.getPublicRuntimeConfiguration()).data;
  },
  async ensure() {
    return ensureGuestCart(
      activeExperienceProviderInput.mode === "live"
        ? activeExperienceProviderInput.release.site.defaultCurrency
        : "USD",
    );
  },
  shipping: quoteGuestCartShipping,
  status() {
    return { error: guestCartError.value, notice: guestCartNotice.value };
  },
};

const previewTemplate = computed(() =>
  pageContract.value
    ? activeExperienceSnapshot?.resolvedTemplates.find(
        (template) => template.pageType === pageContract.value?.pageType,
      )
    : undefined,
);
const rendersPlatformRoute = computed(() => {
  const path = currentRoute.value.path;
  return (
    path === "/checkout/complete" || path.startsWith("/orders/") || path.startsWith("/policies/")
  );
});
const liveRelease =
  activeExperienceProviderInput.mode === "live" ? activeExperienceProviderInput.release : undefined;
const routeSeo = computed(() => {
  const contract = pageContract.value;
  const normalizedPath = currentRoute.value.path.replace(/\/+$/, "") || "/";
  const product = contract?.parameters?.productId
    ? liveRelease?.products.find(({ id }) => id === contract.parameters?.productId)
    : undefined;
  const collection = contract?.parameters?.collectionId
    ? liveRelease?.collections.find(({ id }) => id === contract.parameters?.collectionId)
    : undefined;
  const title =
    product?.seoTitle ??
    collection?.seoTitle ??
    (contract
      ? {
          cart: "Shopping cart",
          checkout: "Checkout",
          collection: "Shop",
          content: contract.id.replaceAll("-", " "),
          home: liveRelease?.site.name ?? "Fashion Store",
          order: "Order",
          policy: "Policy",
          product: "Product",
        }[contract.pageType]
      : "Page not found");
  return {
    canonicalPath: contract?.canonicalPath ?? normalizedPath,
    description:
      product?.seoDescription ??
      collection?.seoDescription ??
      "Browse the published Fashion Store Experience.",
    product,
    title,
  };
});
const previewOrigin = activePreviewOrigin;
if (activeExperienceSnapshot && previewOrigin) {
  const seoOrigin = liveRelease?.site.origin ?? previewOrigin;
  useSeoMeta({
    description: () => routeSeo.value.description,
    robots: "noindex, nofollow",
    title: () => `${routeSeo.value.title} · Private preview`,
  });
  useHead(() => ({
    link: [
      {
        rel: "canonical",
        href: canonicalUrl(seoOrigin, routeSeo.value.canonicalPath),
      },
    ],
    script: routeSeo.value.product
      ? [
          {
            type: "application/ld+json",
            innerHTML: JSON.stringify(productStructuredData(routeSeo.value.product, seoOrigin)),
          },
        ]
      : [],
  }));
}

const routeUnavailable = computed(() =>
  Boolean(activeExperienceSnapshot && !pageContract.value && !rendersPlatformRoute.value),
);
if (import.meta.server && routeUnavailable.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found" });
}
if (import.meta.client) {
  watch(
    routeUnavailable,
    (unavailable) => {
      if (unavailable) showError({ statusCode: 404, statusMessage: "Page not found" });
    },
    { immediate: true },
  );
}
</script>

<template>
  <div class="app-shell">
    <aside
      v-if="activeExperienceProviderInput.mode === 'live'"
      class="preview-context"
      aria-label="Private preview context"
    >
      Catalog {{ activeExperienceProviderInput.identity.catalogReleaseId }} · Experience
      {{ activeExperienceProviderInput.identity.experienceSnapshotId }} v{{
        activeExperienceProviderInput.identity.experienceVersion
      }}
      · Theme {{ activeExperienceProviderInput.identity.themeId }}
      {{ activeExperienceProviderInput.identity.themeVersion }} · Platform
      {{ activeExperienceProviderInput.identity.platformContractVersion }}
    </aside>
    <ThemeRenderer
      v-if="previewTemplate"
      :action-adapter="storefrontActionAdapter"
      :checkout-adapter="storefrontCheckoutAdapter"
      :provider="presentationProvider"
      :registry="activeThemeRegistry"
      :resolve-asset="resolveThemeAsset"
      :template="previewTemplate"
    />
    <NuxtLayout v-else-if="activeExperienceSnapshot && rendersPlatformRoute">
      <NuxtPage />
    </NuxtLayout>
    <main v-else-if="activeExperienceSnapshot">
      <h1>Preview template unavailable</h1>
      <p>The selected theme does not declare this presentation surface.</p>
    </main>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
