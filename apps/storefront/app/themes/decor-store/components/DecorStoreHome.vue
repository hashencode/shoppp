<script setup lang="ts">
import { recordPreviewIntent, type PreviewAction } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { useDecorStoreRuntime } from "../composables/useDecorStoreRuntime";
import { decorStoreAssetId } from "../resources";
import {
  decorStoreHeaderSourceMarkup,
  decorStoreBodySourceMarkup,
  decorStoreHeroSourceMarkup,
  decorStoreTailSourceMarkup,
  prepareDecorStoreMarkup,
} from "../runtime/source-markup";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();

if (properties.viewModel.kind !== "theme-section") {
  throw new Error("Decor Store home requires a theme-section fixture.");
}

const root = ref<HTMLElement | null>(null);
const actionIntentCount = ref(0);
const lastFocusedTrigger = ref<HTMLElement | null>(null);
const headerMarkup = computed(() =>
  prepareDecorStoreMarkup(decorStoreHeaderSourceMarkup, properties.resolveAsset),
);
const heroMarkup = computed(() =>
  prepareDecorStoreMarkup(decorStoreHeroSourceMarkup, properties.resolveAsset),
);
const bodyMarkup = computed(() =>
  prepareDecorStoreMarkup(decorStoreBodySourceMarkup, properties.resolveAsset),
);
const tailMarkup = computed(() =>
  prepareDecorStoreMarkup(decorStoreTailSourceMarkup, properties.resolveAsset),
);
const runtime = useDecorStoreRuntime(root, (sourcePath) =>
  properties.resolveAsset(decorStoreAssetId(sourcePath)),
);
let searchFocusTimer: ReturnType<typeof setTimeout> | undefined;

const productActions = {
  "Add to cart": {
    intent: "cart.add-preview",
    verb: "Add to cart",
  },
  "Add to wishlist": {
    intent: "wishlist.toggle-preview",
    verb: "Add to wishlist",
  },
  "Quick shop": {
    intent: "product.quick-view-preview",
    verb: "Quick shop",
  },
} as const;

function record(action: PreviewAction, context: string): void {
  recordPreviewIntent(action, context);
  actionIntentCount.value += 1;
}

function closeHeaderStates(returnFocus = false): void {
  root.value
    ?.querySelectorAll(".is-open, .search-form-wrapper.active, #navbarNav.show")
    .forEach((element) => element.classList.remove("is-open", "open", "active", "show"));
  root.value?.classList.remove("show-search-popup", "navbar-collapse-show");
  root.value?.querySelectorAll<HTMLElement>("[aria-expanded='true']").forEach((element) => {
    element.setAttribute("aria-expanded", "false");
  });
  if (returnFocus) lastFocusedTrigger.value?.focus();
}

function openOnly(container: Element, trigger: HTMLElement): void {
  const wasOpen = container.classList.contains("is-open");
  closeHeaderStates();
  if (!wasOpen) {
    lastFocusedTrigger.value = trigger;
    container.classList.add("is-open");
    container.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const searchTrigger = target.closest<HTMLElement>(".header-search-form");
  if (searchTrigger) {
    event.preventDefault();
    closeHeaderStates();
    lastFocusedTrigger.value = searchTrigger;
    root.value?.querySelector(".search-form-wrapper")?.classList.add("active");
    root.value?.classList.add("show-search-popup");
    searchTrigger.setAttribute("aria-expanded", "true");
    const focusSearch = () => root.value?.querySelector<HTMLInputElement>(".search-input")?.focus();
    focusSearch();
    searchFocusTimer = setTimeout(focusSearch, 150);
    return;
  }
  if (target.closest(".search-close")) {
    event.preventDefault();
    closeHeaderStates(true);
    return;
  }
  const toggler = target.closest<HTMLElement>(".navbar-toggler");
  if (toggler) {
    event.preventDefault();
    const menu = root.value?.querySelector("#navbarNav");
    const willOpen = !menu?.classList.contains("show");
    closeHeaderStates();
    menu?.classList.toggle("show", willOpen);
    root.value?.classList.toggle("navbar-collapse-show", willOpen);
    toggler.setAttribute("aria-expanded", String(willOpen));
    lastFocusedTrigger.value = toggler;
    return;
  }
  const dropdownTrigger = target.closest<HTMLElement>(
    ".header-language > a, .header-cart > a, header .dropdown-toggle",
  );
  if (dropdownTrigger) {
    event.preventDefault();
    const container = dropdownTrigger.closest(".dropdown");
    if (container) openOnly(container, dropdownTrigger);
    return;
  }
  const productAction = target.closest<HTMLElement>(
    "[title='Add to wishlist'], [title='Add to cart'], [title='Quick shop']",
  );
  const productActionTitle = productAction?.title;
  if (productAction && productActionTitle && productActionTitle in productActions) {
    event.preventDefault();
    const definition = productActions[productActionTitle as keyof typeof productActions];
    const productName =
      productAction
        .closest(".shop-box")
        ?.querySelector<HTMLElement>(".shop-footer > a")
        ?.textContent?.trim() || "product";
    record(
      {
        id: `${definition.intent.replaceAll(/[^a-z0-9]+/g, "-")}-${productName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
        intent: definition.intent,
        label: `${definition.verb} ${productName}`,
      },
      "decor-store.home.product",
    );
    return;
  }
  const cookieChoice = target.closest<HTMLElement>("[data-cookie-choice]");
  if (cookieChoice) {
    event.preventDefault();
    const notice = cookieChoice.closest<HTMLElement>(".cookie-message");
    const choice = cookieChoice.dataset.cookieChoice || "dismissed";
    notice?.setAttribute("hidden", "");
    notice?.setAttribute("aria-hidden", "true");
    if (root.value) root.value.dataset.decorCookieChoice = choice;
    return;
  }
  if (target.closest(".scroll-progress .scroll-top")) {
    event.preventDefault();
    window.scrollTo({
      behavior: runtime.reducedMotion.value ? "auto" : "smooth",
      top: 0,
    });
    return;
  }
  if (target.closest("[data-decor-newsletter-form] button")) {
    event.preventDefault();
    return;
  }
  if (target.closest("[data-decor-local-control]")) {
    event.preventDefault();
    return;
  }
  const route = target.closest<HTMLAnchorElement>("[data-decor-route-intent]");
  if (route) {
    event.preventDefault();
    record(
      {
        id: "decor-home-navigation",
        intent: "navigation",
        label: route.textContent?.trim() || "Decor navigation",
        target: "/",
      },
      "decor-store.home.navigation",
    );
    closeHeaderStates();
  }
}

function handleSubmit(event: SubmitEvent): void {
  const form = event.target as HTMLFormElement;
  if (form.matches("[data-decor-newsletter-form]")) {
    event.preventDefault();
    return;
  }
  if (!form.matches("[data-decor-search-form]")) return;
  event.preventDefault();
  const query = new FormData(form).get("s")?.toString().trim() || "";
  record(
    {
      id: "decor-search",
      intent: "navigation",
      label: query ? `Search for ${query}` : "Open search results",
      target: query ? `/?search=${encodeURIComponent(query)}` : "/",
    },
    "decor-store.home.search",
  );
  closeHeaderStates(true);
}

function handleRootKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target as HTMLElement;
  if (!target.matches("[role='button']")) return;
  if (target.matches("a, button")) return;
  event.preventDefault();
  target.click();
}

function handleDocumentPointer(event: PointerEvent): void {
  const target = event.target as HTMLElement;
  if (
    target.closest(
      ".header-language.is-open, .header-cart.is-open, header .dropdown.is-open, .search-form-wrapper.active",
    )
  ) {
    return;
  }
  closeHeaderStates();
}

function handleDocumentKey(event: KeyboardEvent): void {
  if (event.key === "Escape") closeHeaderStates(true);
  if (root.value?.contains(event.target as Node)) handleRootKeydown(event);
}

function handleDocumentClick(event: MouseEvent): void {
  if (root.value?.contains(event.target as Node)) handleClick(event);
}

function handleDocumentSubmit(event: SubmitEvent): void {
  if (root.value?.contains(event.target as Node)) handleSubmit(event);
}

function handleResize(): void {
  if (innerWidth >= 992) {
    root.value?.querySelector("#navbarNav")?.classList.remove("show");
    root.value?.querySelector(".navbar-toggler")?.setAttribute("aria-expanded", "false");
  }
}

watchEffect(() => {
  const slider = root.value?.querySelector<HTMLElement>("#decor-store-slider");
  if (!slider) return;
  const state = {
    decorHeroActiveSlide: runtime.activeSlide.value,
    decorHeroFallback: runtime.failure.value,
    decorHeroPageHidden: String(runtime.pageHidden.value),
    decorHeroReady: String(runtime.status.value === "ready"),
    decorHeroReducedMotion: String(runtime.reducedMotion.value),
    decorHeroTransition: runtime.transition.value,
  };
  for (const [key, value] of Object.entries(state)) {
    if (slider.dataset[key] !== value) slider.dataset[key] = value;
  }
});

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("pointerdown", handleDocumentPointer);
  document.addEventListener("keydown", handleDocumentKey);
  document.addEventListener("submit", handleDocumentSubmit);
  window.addEventListener("resize", handleResize, { passive: true });
});

onBeforeUnmount(() => {
  if (searchFocusTimer) clearTimeout(searchFocusTimer);
  document.removeEventListener("click", handleDocumentClick);
  document.removeEventListener("pointerdown", handleDocumentPointer);
  document.removeEventListener("keydown", handleDocumentKey);
  document.removeEventListener("submit", handleDocumentSubmit);
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <main
    ref="root"
    data-decor-store-source-parity
    data-storefront-hydration="eager"
    data-mobile-nav-style="classic"
    :data-runtime-status="runtime.status.value"
    :data-decor-body-ready="runtime.bodyReady.value"
    :data-preview-intent-count="actionIntentCount"
  >
    <h1 class="decor-store-preview-shell__title">Decor Store</h1>
    <div class="decor-store-source-fragment" v-html="headerMarkup"></div>
    <div class="decor-store-source-fragment" v-html="heroMarkup"></div>
    <div class="decor-store-source-fragment" v-html="bodyMarkup"></div>
    <div class="decor-store-source-fragment" v-html="tailMarkup"></div>
  </main>
</template>
