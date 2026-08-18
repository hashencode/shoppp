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
  activeCatalogSearchIndex,
  activeExperienceProviderInput,
  activeFixtureRegistry,
} from "./generated/active-experience";
import { createThemeAssetResolver } from "./theme-engine/assets";
import {
  createFixturePresentationProvider,
  selectLivePort,
  selectPresentationProvider,
} from "./theme-engine/providers";
import { resolveThemeRoute } from "./theme-engine/routes";
import ThemeRenderer from "./theme-engine/renderer.vue";
import { useGuestCart } from "./features/cart/use-guest-cart";
import { checkoutReturnCartRefreshKey, storeOrderAccess } from "./features/checkout/session";
import {
  storefrontActionAdapterKey,
  type StorefrontActionAdapter,
} from "./theme-engine/actions";
import {
  storefrontCheckoutAdapterKey,
  type StorefrontCheckoutAdapter,
} from "./theme-engine/checkout";
import { storefrontCartStateKey } from "./theme-engine/cart-state";
import {
  coalesceRuntimeCommerceRevalidations,
  liveCommerceModeKey,
  runtimeCommercePortKey,
  toRuntimeProductState,
} from "./theme-engine/runtime-commerce";
import { canonicalUrl, productStructuredData } from "./utils/seo";
import { catalogSearchIndexKey } from "./theme-engine/search";
import {
  composeExperienceShell,
  composePlatformRoutePresentation,
} from "./theme-engine/composer";
import {
  storefrontPlatformPresentationKey,
  storefrontPresentationShellKey,
} from "./theme-engine/presentation-context";
import type { ThemeRegistry } from "./theme-engine/registry";

const resolveThemeAsset = createThemeAssetResolver(activeThemeId, activeThemeAssets);
const themeRegistry: ThemeRegistry = activeThemeRegistry;
const router = useRouter();
const currentRoute = computed(() => router.currentRoute.value);
interface PrivatePreviewContext {
  contentDigest: string;
  environment: "private-preview";
  expiresAt: string;
  generatedAt: string | null;
  returnUrl: string;
  snapshotId: string;
}
const privatePreviewContext = ref<PrivatePreviewContext | null>(null);
if (import.meta.client && activeExperienceProviderInput.mode === "live") {
  onMounted(async () => {
    try {
      const response = await fetch("/__preview/context", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (response.ok) privatePreviewContext.value = await response.json();
    } catch {
      privatePreviewContext.value = null;
    }
  });
}
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
const presentationProvider = computed(() => {
  const liveInput =
    activeExperienceProviderInput.mode === "live" && activeExperienceSnapshot && pageContract.value
      ? {
          adapter: themeRegistry.composition,
          experience: activeExperienceSnapshot,
          locale: "en-US",
          path: currentRoute.value.path,
          release: activeExperienceProviderInput.release,
          route: pageContract.value,
        }
      : undefined;
  return selectPresentationProvider({
    fixtureProvider: fixturePresentationProvider,
    liveInput,
    mode: activeExperienceProviderInput.mode,
  });
});
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
const runtimeCommercePort = coalesceRuntimeCommerceRevalidations({
  async revalidateProduct(input) {
    const product = (await commerceApi.getLiveProductById(input.productId, input.currency)).data;
    if (product.id !== input.productId) {
      throw new Error("Commerce returned a different product than the selected Catalog Release.");
    }
    return toRuntimeProductState(product, input.currency);
  },
});
if (activeExperienceProviderInput.mode === "live") {
  const defaultCurrency = activeExperienceProviderInput.release.site.defaultCurrency;
  provide(catalogSearchIndexKey, activeCatalogSearchIndex);
  provide(runtimeCommercePortKey, runtimeCommercePort);
  provide(liveCommerceModeKey, true);
  provide(storefrontCartStateKey, readonly(guestCart));
  provide(checkoutReturnCartRefreshKey, async () => {
    await ensureGuestCart(defaultCurrency);
  });
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
const themeActionAdapter = selectLivePort(
  activeExperienceProviderInput.mode,
  storefrontActionAdapter,
);
const themeCheckoutAdapter = selectLivePort(
  activeExperienceProviderInput.mode,
  storefrontCheckoutAdapter,
);
if (themeActionAdapter) provide(storefrontActionAdapterKey, themeActionAdapter);
if (themeCheckoutAdapter) provide(storefrontCheckoutAdapterKey, themeCheckoutAdapter);

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
const experienceShell = computed(() =>
  activeExperienceProviderInput.mode === "live" && activeExperienceSnapshot && liveRelease
    ? composeExperienceShell({
        adapter: themeRegistry.composition,
        experience: activeExperienceSnapshot,
        release: liveRelease,
      })
    : undefined,
);
const platformPresentation = computed(() =>
  activeExperienceProviderInput.mode === "live" && activeExperienceSnapshot && liveRelease
    ? composePlatformRoutePresentation({
        adapter: themeRegistry.composition,
        experience: activeExperienceSnapshot,
        path: currentRoute.value.path,
        release: liveRelease,
      })
    : undefined,
);
provide(storefrontPresentationShellKey, experienceShell);
provide(storefrontPlatformPresentationKey, platformPresentation);
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
      <strong>Private preview</strong> · Catalog
      {{ activeExperienceProviderInput.identity.catalogReleaseId }} · Experience
      {{ activeExperienceProviderInput.identity.experienceSnapshotId }} v{{
        activeExperienceProviderInput.identity.experienceVersion
      }}
      · Theme {{ activeExperienceProviderInput.identity.themeId }}
      {{ activeExperienceProviderInput.identity.themeVersion }} · Platform
      {{ activeExperienceProviderInput.identity.platformContractVersion }}
      <template v-if="privatePreviewContext">
        · Generated {{ privatePreviewContext.generatedAt ?? "pending" }} · Expires
        {{ privatePreviewContext.expiresAt }} · Content {{ privatePreviewContext.contentDigest }} ·
        <a :href="privatePreviewContext.returnUrl">Return to editor</a>
      </template>
    </aside>
    <ThemeRenderer
      v-if="previewTemplate && presentationProvider"
      :action-adapter="themeActionAdapter"
      :checkout-adapter="themeCheckoutAdapter"
      :provider="presentationProvider"
      :registry="themeRegistry"
      :resolve-asset="resolveThemeAsset"
      :template="previewTemplate"
    />
    <component
      :is="themeRegistry.platformShell"
      v-else-if="activeExperienceSnapshot && rendersPlatformRoute && themeRegistry.platformShell"
      body-class=""
      :resolve-asset="resolveThemeAsset"
      :show-sticky-socials="false"
    >
      <NuxtPage />
    </component>
    <NuxtLayout v-else-if="activeExperienceSnapshot && rendersPlatformRoute"><NuxtPage /></NuxtLayout>
    <main v-else-if="activeExperienceSnapshot">
      <h1>Preview template unavailable</h1>
      <p>The selected theme does not declare this presentation surface.</p>
    </main>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
