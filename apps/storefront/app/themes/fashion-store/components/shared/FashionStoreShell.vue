<script setup lang="ts">
import FashionStoreIcon from "./FashionStoreIcon.vue";
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import { storefrontPresentationShellKey } from "../../../../theme-engine/presentation-context";
import type { PresentationShellViewModel } from "../../../../theme-engine/view-models";
import { liveCommerceModeKey } from "../../../../theme-engine/runtime-commerce";
import { useFashionStoreVisualRuntime } from "../../composables/useFashionStoreVisualRuntime";
import { fashionStoreAssetId } from "../../resources";
import { fashionStoreDestinations } from "../../destinations";
import figtreeFontUrl from "../../upstream/fonts/figtree-latin.woff2?url";
import outfitFontUrl from "../../upstream/fonts/outfit-latin.woff2?url";
import FashionStoreFooter from "./FashionStoreFooter.vue";
import FashionStoreHeader from "./FashionStoreHeader.vue";

type HeaderHandle = {
  closeTransient(restoreMenuFocus?: boolean): Promise<void>;
};
const properties = withDefaults(
  defineProps<{
    announcement?: string;
    announcementLink?: PresentationShellViewModel["announcementLink"];
    brandName?: string;
    contentLayout?: "source" | "wide";
    variant?: "home" | "page";
    footer?: PresentationShellViewModel["footer"];
    header?: PresentationShellViewModel["header"];
    preloadImage?: string;
    publishedRoutes?: readonly string[];
    previewIntentCount?: number;
    resolveAsset: ThemeAssetResolver;
    showStickySocials?: boolean;
  }>(),
  {
    contentLayout: "source",
    variant: "page",
    previewIntentCount: 0,
    showStickySocials: true,
  },
);
const experienceShell = inject(storefrontPresentationShellKey, undefined);
const liveMode = inject(liveCommerceModeKey, false);
const announcement = computed(
  () => properties.announcement ?? experienceShell?.value?.announcement,
);
const announcementLink = computed(
  () => properties.announcementLink ?? experienceShell?.value?.announcementLink,
);
const footer = computed(() => properties.footer ?? experienceShell?.value?.footer);
const header = computed(() => properties.header ?? experienceShell?.value?.header);
const brandName = computed(() => properties.brandName ?? experienceShell?.value?.siteName);
const resolvedPublishedRoutes = computed(
  () => properties.publishedRoutes ?? experienceShell?.value?.publishedRoutes,
);
const renderedPublishedRoutes = computed(() =>
  header.value?.legacyNavigation || footer.value?.legacyNavigation
    ? resolvedPublishedRoutes.value
    : properties.publishedRoutes,
);
const stickySocials = computed(
  () => footer.value?.publicContact?.socials ?? header.value?.publicContact?.socials ?? [],
);

const router = useRouter();
const documentReadyClass = ref<"js" | "no-js">("no-js");
const headerHandle = ref<HeaderHandle>();
const searchOpen = ref(false);
const noScriptMarkup = `<div class="container pt-15px pb-15px" role="region" aria-label="JavaScript limitations">
  <p>Catalog content and canonical destinations remain available without JavaScript.</p>
  <p>Shopping actions require JavaScript. Enable it to change a cart or begin checkout.</p>
  <a href="/">Return to the storefront</a>
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
    "data-fashion-store-content-layout": properties.contentLayout,
    "data-fashion-store-shell": "true",
  },
  htmlAttrs: {
    class: documentReadyClass.value,
    "data-fashion-store-document": "true",
    lang: "en",
  },
  link: [
    {
      as: "font" as const,
      crossorigin: "anonymous",
      href: figtreeFontUrl,
      key: "fashion-store-figtree-font",
      rel: "preload" as const,
      type: "font/woff2",
    },
    {
      as: "font" as const,
      crossorigin: "anonymous",
      href: outfitFontUrl,
      key: "fashion-store-outfit-font",
      rel: "preload" as const,
      type: "font/woff2",
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
});
</script>

<template>
  <a class="skip-link" href="#fashion-store-main">Skip to content</a>
  <noscript v-html="noScriptMarkup" />
  <span
    class="visually-hidden"
    data-fashion-store-source-parity="true"
    :data-preview-intent-count="previewIntentCount"
    :data-runtime-instance-count="visualRuntime.liveInstances.value"
    :data-runtime-status="visualRuntime.status.value"
  />
  <slot name="prelude" />
  <FashionStoreHeader
    ref="headerHandle"
    :announcement="announcement"
    :announcement-link="announcementLink"
    :brand-name="brandName"
    :configuration="header"
    :background="variant === 'home' ? 'transparent-overlay' : 'solid'"
    :resolve-asset="resolveAsset"
    :published-routes="renderedPublishedRoutes"
    @search-open-change="searchOpen = $event"
  />
  <slot />
  <FashionStoreFooter
    :brand-name="brandName"
    :configuration="footer"
    :published-routes="renderedPublishedRoutes"
    :resolve-asset="resolveAsset"
    :source-asset="sourceAsset"
  />
  <div
    v-if="showStickySocials && (!liveMode || stickySocials.length > 0)"
    class="sticky-wrap z-index-1 d-none d-xl-inline-block"
    data-animation-delay="100"
    data-shadow-animation="true"
  >
    <div class="elements-social social-icon-style-10">
      <ul class="fs-16">
        <li v-for="social in stickySocials" :key="social.id" class="me-30px">
          <a
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${social.label} (opens in a new tab)`"
          >
            <span class="alt-font">{{ social.label }}</span>
          </a>
        </li>
        <li v-if="!liveMode" class="me-30px">
          <a
            class="facebook"
            :href="fashionStoreDestinations.facebook"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FashionStoreIcon name="facebook" class="me-10px" />
            <span class="alt-font">Facebook</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li v-if="!liveMode" class="me-30px">
          <a
            class="dribbble"
            :href="fashionStoreDestinations.dribbble"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FashionStoreIcon name="dribbble" class="me-10px" />
            <span class="alt-font">Dribbble</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li v-if="!liveMode" class="me-30px">
          <a
            class="twitter"
            :href="fashionStoreDestinations.twitter"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FashionStoreIcon name="twitter" class="me-10px" />
            <span class="alt-font">Twitter</span>
          </a>
        </li>
        {{
          sourceInlineGap
        }}
        <li v-if="!liveMode">
          <a
            class="instagram"
            :href="fashionStoreDestinations.instagram"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FashionStoreIcon name="instagram" class="me-10px" />
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
