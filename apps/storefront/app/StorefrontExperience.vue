<script setup lang="ts">
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
import type { PreviewActionAdapter } from "./theme-engine/actions";
import type { PreviewCheckoutAdapter } from "./theme-engine/checkout";

const resolveThemeAsset = createThemeAssetResolver(activeThemeId, activeThemeAssets);
const router = useRouter();
const currentRoute = computed(() => router.currentRoute.value);
const fixturePresentationProvider = createFixturePresentationProvider({
  bindings:
    activeExperienceSnapshot?.bindings.filter((binding) => binding.kind === "fixture") ?? [],
  fixtures: activeFixtureRegistry,
});
const presentationProvider = computed(() =>
  activeExperienceProviderInput.mode === "live" && activeExperienceSnapshot
    ? createLivePresentationProvider({
        experience: activeExperienceSnapshot,
        locale: "en-US",
        path: currentRoute.value.path,
        release: activeExperienceProviderInput.release,
      })
    : fixturePresentationProvider,
);
const {
  add: addGuestCartLine,
  beginCheckout,
  ensure: ensureGuestCart,
  remove: removeGuestCartLine,
  shipping: quoteGuestCartShipping,
  update: updateGuestCartLine,
} = useGuestCart();
const commerceApi = useCommerceApi();
const previewActionAdapter: PreviewActionAdapter = async (dispatch) => {
  if (dispatch.kind === "cart.add") {
    return addGuestCartLine(dispatch.input, dispatch.currency);
  }
  if (dispatch.kind === "cart.remove") return removeGuestCartLine(dispatch.variantId);
  if (dispatch.kind === "cart.shipping") return quoteGuestCartShipping(dispatch.input);
  return updateGuestCartLine(dispatch.variantId, dispatch.input);
};
const previewCheckoutAdapter: PreviewCheckoutAdapter = {
  begin: beginCheckout,
  complete(session) {
    storeOrderAccess({ attemptId: session.attemptId, token: session.orderAccessToken });
    window.location.assign(session.checkoutUrl);
  },
  async configuration() {
    return (await commerceApi.getPublicRuntimeConfiguration()).data;
  },
  async ensure() {
    return ensureGuestCart();
  },
  shipping: quoteGuestCartShipping,
};

const pageContract = computed(() =>
  resolveThemeRoute(
    currentRoute.value.path,
    activeThemeRoutes,
    activeExperienceProviderInput.mode === "live"
      ? activeExperienceProviderInput.release
      : undefined,
  ),
);
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
const previewTitle = computed(() =>
  pageContract.value
    ? {
        cart: "Preview bag",
        checkout: "Checkout presentation",
        collection: "Fixture collection",
        content: "Fashion page",
        home: `${activeThemeId[0]?.toUpperCase()}${activeThemeId.slice(1)} storefront`,
        order: "Order status presentation",
        policy: "Fixture policy",
        product: "Fixture product",
      }[pageContract.value.pageType]
    : "Page unavailable",
);

const previewOrigin = activePreviewOrigin;
if (activeExperienceSnapshot && previewOrigin) {
  useSeoMeta({
    description: "A private fixture-backed storefront theme preview.",
    robots: "noindex, nofollow",
  });
  useHead(() => ({
    link: [{ rel: "canonical", href: new URL(currentRoute.value.path, previewOrigin).href }],
    title: `${previewTitle.value} · Private fixture preview`,
  }));
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
      :action-adapter="previewActionAdapter"
      :checkout-adapter="previewCheckoutAdapter"
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
