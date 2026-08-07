<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { fashionStoreAssetId } from "../../resources";
import FashionStoreFooter from "./FashionStoreFooter.vue";
import FashionStoreHeader from "./FashionStoreHeader.vue";

type HeaderHandle = {
  closeTransient(restoreMenuFocus?: boolean): Promise<void>;
  handleDocumentKeydown(event: KeyboardEvent): void;
  handleInternalClick(event: MouseEvent): boolean;
};

const properties = withDefaults(
  defineProps<{
    announcement: string;
    bodyClass?: string;
    preloadImage?: string;
    resolveAsset: ThemeAssetResolver;
    showStickySocials?: boolean;
  }>(),
  {
    bodyClass: "fashion-store-home",
    showStickySocials: true,
  },
);

const router = useRouter();
const cookieVisible = ref(true);
const documentReadyClass = ref<"js" | "no-js">("no-js");
const header = ref<HeaderHandle>();
const searchOpen = ref(false);

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

async function handleInternalNavigation(event: MouseEvent): Promise<void> {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  if (header.value?.handleInternalClick(event)) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[data-fashion-store-route]");
  if (!anchor) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const destination = anchor.getAttribute("href") ?? "/";
  await header.value?.closeTransient(true);
  if (router.currentRoute.value.fullPath !== destination) await router.push(destination);
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  header.value?.handleDocumentKeydown(event);
}

function scrollToTop(): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ behavior: reducedMotion ? "auto" : "smooth", top: 0 });
}

useHead(() => ({
  bodyAttrs: {
    class: searchOpen.value ? `${properties.bodyClass} show-search-popup` : properties.bodyClass,
    "data-mobile-nav-style": "classic",
  },
  htmlAttrs: { class: documentReadyClass.value, lang: "en" },
  link: [
    {
      href: sourceAsset("images/favicon.png"),
      rel: "icon",
      type: "image/png",
    },
    ...(properties.preloadImage
      ? [
          {
            as: "image" as const,
            fetchpriority: "high" as const,
            href: properties.preloadImage,
            rel: "preload" as const,
          },
        ]
      : []),
  ],
}));

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    void header.value?.closeTransient(false);
  },
);

onMounted(() => {
  documentReadyClass.value = "js";
  document.addEventListener("click", handleInternalNavigation, true);
  document.addEventListener("keydown", handleDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleInternalNavigation, true);
  document.removeEventListener("keydown", handleDocumentKeydown);
});
</script>

<template>
  <a class="skip-link" href="#fashion-store-main">Skip to content</a>
  <slot name="prelude" />
  <FashionStoreHeader
    ref="header"
    :announcement="announcement"
    :resolve-asset="resolveAsset"
    @search-open-change="searchOpen = $event"
  />
  <slot />
  <FashionStoreFooter :source-asset="sourceAsset" />
  <div
    id="cookies-model"
    class="cookie-message bg-dark-gray border-radius-8px"
    v-if="cookieVisible"
  >
    <div class="cookie-description fs-14 text-white mb-20px lh-22">
      We use cookies to enhance your browsing experience, serve personalized ads or content, and
      analyze our traffic. By clicking "Allow cookies" you consent to our use of cookies.
    </div>
    <div class="cookie-btn">
      <a
        href="/policies/cookies"
        data-fashion-store-route
        class="btn btn-transparent-white border-1 border-color-transparent-white-light btn-very-small btn-switch-text btn-rounded w-100 mb-15px"
        aria-label="Cookie policy"
      >
        <span>
          <span class="btn-double-text" data-text="Cookie policy">Cookie policy</span>
        </span>
      </a>
      <button
        type="button"
        class="btn btn-white btn-very-small btn-switch-text btn-box-shadow accept_cookies_btn btn-rounded w-100"
        data-accept-btn=""
        aria-label="Allow cookies"
        @click="cookieVisible = false"
      >
        <span>
          <span class="btn-double-text" data-text="Allow cookies">Allow cookies</span>
        </span>
      </button>
    </div>
  </div>
  <div
    v-if="showStickySocials"
    class="sticky-wrap z-index-1 d-none d-xl-inline-block"
    data-animation-delay="100"
    data-shadow-animation="true"
  >
    <div class="elements-social social-icon-style-10">
      <ul class="fs-16">
        <li class="me-30px">
          <a class="facebook" href="https://www.facebook.com/" target="_blank">
            <i class="fa-brands fa-facebook-f me-10px"></i>
            <span class="alt-font">Facebook</span>
          </a>
        </li>
        <li class="me-30px">
          <a class="dribbble" href="http://www.dribbble.com" target="_blank">
            <i class="fa-brands fa-dribbble me-10px"></i>
            <span class="alt-font">Dribbble</span>
          </a>
        </li>
        <li class="me-30px">
          <a class="twitter" href="http://www.twitter.com" target="_blank">
            <i class="fa-brands fa-twitter me-10px"></i>
            <span class="alt-font">Twitter</span>
          </a>
        </li>
        <li>
          <a class="instagram" href="http://www.instagram.com" target="_blank">
            <i class="fa-brands fa-instagram me-10px"></i>
            <span class="alt-font">Instagram</span>
          </a>
        </li>
      </ul>
    </div>
  </div>
  <div class="scroll-progress d-none d-xxl-block">
    <button type="button" class="scroll-top" aria-label="Back to top" @click="scrollToTop">
      <span class="scroll-text">Scroll</span
      ><span class="scroll-line"><span class="scroll-point"></span></span>
    </button>
  </div>
</template>
