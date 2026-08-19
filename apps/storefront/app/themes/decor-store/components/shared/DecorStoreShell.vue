<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { DecorStorePageId } from "../../page-contracts";
import DecorStoreFooter from "./DecorStoreFooter.vue";
import DecorStoreHeader from "./DecorStoreHeader.vue";

type HeaderHandle = {
  closeTransient(restoreFocus?: boolean): Promise<void>;
  handleKeydown(event: KeyboardEvent): void;
};

const properties = defineProps<{
  activePage: DecorStorePageId;
  announcement: string;
  resolveAsset: ThemeAssetResolver;
}>();
const router = useRouter();
const cookieVisible = ref(true);
const header = ref<HeaderHandle>();
const searchOpen = ref(false);

async function handleNavigation(event: MouseEvent): Promise<void> {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[data-decor-store-route]");
  if (!anchor) return;
  event.preventDefault();
  const destination = anchor.getAttribute("href") ?? "/";
  await header.value?.closeTransient(false);
  if (router.currentRoute.value.fullPath !== destination) await router.push(destination);
}

function handleKeydown(event: KeyboardEvent): void {
  header.value?.handleKeydown(event);
}

function scrollToTop(): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ behavior: reduced ? "auto" : "smooth", top: 0 });
}

watch(
  () => router.currentRoute.value.fullPath,
  () => void header.value?.closeTransient(false),
);

useHead(() => ({
  bodyAttrs: {
    class: searchOpen.value ? "show-search-popup" : undefined,
    "data-mobile-nav-style": "classic",
  },
}));

onMounted(() => {
  document.addEventListener("click", handleNavigation, true);
  document.addEventListener("keydown", handleKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", handleNavigation, true);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <a class="skip-link" href="#decor-store-secondary-main">Skip to content</a>
  <span class="sr-only" data-decor-store-secondary-shell data-runtime-status="ready"></span>
  <DecorStoreHeader
    ref="header"
    :active-page="activePage"
    :announcement="announcement"
    :resolve-asset="resolveAsset"
    @search-open-change="searchOpen = $event"
  />
  <main id="decor-store-secondary-main"><slot /></main>
  <DecorStoreFooter :resolve-asset="resolveAsset" />
  <div
    v-if="cookieVisible"
    id="cookies-model"
    class="cookie-message bg-dark-gray border-radius-8px"
    style="display: block"
  >
    <div class="cookie-description fs-14 text-white mb-20px lh-22">
      We use cookies to enhance your browsing experience, serve personalized ads or content, and
      analyze our traffic.
    </div>
    <button
      type="button"
      class="btn btn-white btn-very-small btn-rounded w-100"
      @click="cookieVisible = false"
    >
      Allow cookies
    </button>
  </div>
  <div class="scroll-progress d-none d-xxl-block">
    <button type="button" aria-label="Back to top" @click="scrollToTop">
      <span class="scroll-text">Scroll</span>
    </button>
  </div>
</template>
