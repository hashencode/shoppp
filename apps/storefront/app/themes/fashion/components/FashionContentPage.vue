<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import FashionAboutPage from "./FashionAboutPage.vue";
import FashionAccountPage from "./FashionAccountPage.vue";
import FashionArticlePage from "./FashionArticlePage.vue";
import FashionContactPage from "./FashionContactPage.vue";
import FashionFaqPage from "./FashionFaqPage.vue";
import FashionMagazinePage from "./FashionMagazinePage.vue";
import FashionWishlistPage from "./FashionWishlistPage.vue";

interface FashionContentData {
  products: { assetId: string; name: string; price: string; slug: string }[];
}

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed(() =>
  properties.viewModel.kind === "theme-section"
    ? (properties.viewModel.data as unknown as FashionContentData)
    : null,
);
const router = useRouter();
const path = computed(() => router.currentRoute.value.path.replace(/\/+$/, "") || "/");
const page = computed(() =>
  path.value.startsWith("/magazine/") ? "article" : path.value.slice(1),
);
const formMessage = ref("");

const titles: Record<string, string> = {
  about: "About",
  account: "My account",
  contact: "Contact",
  faq: "FAQs",
  magazine: "Magazine",
  wishlist: "Wishlist",
};
const title = computed(() => titles[page.value] ?? "Fashion page");

function submit(label: string): void {
  formMessage.value = `${label} is ready in this preview.`;
}
</script>

<template>
  <main v-if="data" class="fashion-content-page" :data-page="page">
    <header v-if="page !== 'article'" class="fashion-page-breadcrumb">
      <h1>{{ title }}</h1>
      <nav aria-label="Breadcrumb">
        <NuxtLink to="/">Home</NuxtLink><span>{{ title }}</span>
      </nav>
    </header>

    <FashionAccountPage v-if="page === 'account'" @submit="submit" />
    <FashionMagazinePage v-else-if="page === 'magazine'" :resolve-asset="properties.resolveAsset" />
    <FashionArticlePage
      v-else-if="page === 'article'"
      :resolve-asset="properties.resolveAsset"
      @submit="submit"
    />
    <FashionWishlistPage
      v-else-if="page === 'wishlist'"
      :products="data.products"
      :resolve-asset="properties.resolveAsset"
      @submit="submit"
    />
    <FashionFaqPage v-else-if="page === 'faq'" />
    <FashionContactPage
      v-else-if="page === 'contact'"
      :resolve-asset="properties.resolveAsset"
      @submit="submit"
    />
    <FashionAboutPage v-else :resolve-asset="properties.resolveAsset" />

    <p v-if="formMessage" class="fashion-form-message" aria-live="polite">{{ formMessage }}</p>
  </main>
</template>
