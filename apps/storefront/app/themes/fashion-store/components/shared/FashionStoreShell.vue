<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontPresentationShellKey } from "../../../../theme-engine/presentation-context";
import type { PresentationShellViewModel } from "../../../../theme-engine/view-models";
import { storefrontExperienceHydratedEvent } from "../../../../hydration";
import { useFashionStoreVisualRuntime } from "../../composables/useFashionStoreVisualRuntime";
import { fashionStoreAssetId } from "../../resources";
import { fashionStoreDestinations } from "../../destinations";
import FashionStoreFooter from "./FashionStoreFooter.vue";
import FashionStoreHeader from "./FashionStoreHeader.vue";

type HeaderHandle = {
  closeTransient(restoreMenuFocus?: boolean): Promise<void>;
};
const properties = withDefaults(
  defineProps<{
    announcement?: string;
    announcementLink?: PresentationShellViewModel["announcementLink"];
    variant?: "home" | "page";
    footer?: PresentationShellViewModel["footer"];
    header?: PresentationShellViewModel["header"];
    preloadImage?: string;
    previewIntentCount?: number;
    resolveAsset: ThemeAssetResolver;
    showStickySocials?: boolean;
  }>(),
  {
    variant: "page",
    previewIntentCount: 0,
    showStickySocials: true,
  },
);
const experienceShell = inject(storefrontPresentationShellKey, undefined);
const announcement = computed(
  () => properties.announcement ?? experienceShell?.value?.announcement,
);
const announcementLink = computed(
  () => properties.announcementLink ?? experienceShell?.value?.announcementLink,
);
const footer = computed(() => properties.footer ?? experienceShell?.value?.footer);
const header = computed(() => properties.header ?? experienceShell?.value?.header);

const router = useRouter();
const cookieVisible = ref(true);
const documentReadyClass = ref<"js" | "no-js">("no-js");
const headerHandle = ref<HeaderHandle>();
const searchOpen = ref(false);
const noScriptMarkup = `<div class="container pt-15px pb-15px" role="region" aria-label="JavaScript limitations">
  <p>Catalog content and canonical destinations remain available without JavaScript.</p>
  <p>Shopping actions require JavaScript. Enable it to change a cart or begin checkout.</p>
  <a href="/shop">Browse the published catalog</a>
</div>`;
const sourceInlineGap = " ";
const visualRuntime = useFashionStoreVisualRuntime();

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashionStoreAssetId(sourcePath));
}

function scrollToTop(): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ behavior: reducedMotion ? "auto" : "smooth", top: 0 });
}

useHead(() => ({
  bodyAttrs: {
    class:
      [
        properties.variant === "home" ? "fashion-store-home" : "",
        searchOpen.value ? "show-search-popup" : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
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
    void headerHandle.value?.closeTransient(false);
    void nextTick(() => {
      document.getElementById("fashion-store-main")?.setAttribute("tabindex", "-1");
    });
  },
);

onMounted(() => {
  documentReadyClass.value = "js";
  nextTick(() => {
    document.documentElement.classList.remove("no-js");
    document.documentElement.classList.add("js");
    document.getElementById("fashion-store-main")?.setAttribute("tabindex", "-1");
  });
  window.dispatchEvent(new Event(storefrontExperienceHydratedEvent));
});
</script>

<template>
  <a class="skip-link" href="#fashion-store-main">Skip to content</a>
  <noscript v-html="noScriptMarkup" />
  <span
    class="sr-only"
    data-fashion-store-source-parity="true"
    :data-preview-intent-count="previewIntentCount"
    :data-runtime-instance-count="visualRuntime.liveInstances.value"
    :data-runtime-error="visualRuntime.failure.value || undefined"
    :data-runtime-status="visualRuntime.status.value"
  />
  <slot name="prelude" />
  <FashionStoreHeader
    ref="headerHandle"
    :announcement="announcement"
    :announcement-link="announcementLink"
    :configuration="header"
    :home-layout="variant === 'home'"
    :resolve-asset="resolveAsset"
    @search-open-change="searchOpen = $event"
  />
  <slot />
  <FashionStoreFooter
    :configuration="footer"
    :home-layout="variant === 'home'"
    :resolve-asset="resolveAsset"
    :source-asset="sourceAsset"
  />
  <div
    id="cookies-model"
    class="cookie-message bg-dark-gray border-radius-8px"
    v-if="cookieVisible"
    style="display: block"
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
          <a
            class="facebook"
            :href="fashionStoreDestinations.facebook"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fa-brands fa-facebook-f me-10px"></i>
            <span class="alt-font">Facebook</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li class="me-30px">
          <a
            class="dribbble"
            :href="fashionStoreDestinations.dribbble"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fa-brands fa-dribbble me-10px"></i>
            <span class="alt-font">Dribbble</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li class="me-30px">
          <a
            class="twitter"
            :href="fashionStoreDestinations.twitter"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fa-brands fa-twitter me-10px"></i>
            <span class="alt-font">Twitter</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li>
          <a
            class="instagram"
            :href="fashionStoreDestinations.instagram"
            target="_blank"
            rel="noopener noreferrer"
          >
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

<style scoped>
.scroll-progress .scroll-top {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}

.scroll-progress .scroll-point {
  height: calc(var(--fashion-store-scroll-progress, 0) * 100%);
}
</style>
