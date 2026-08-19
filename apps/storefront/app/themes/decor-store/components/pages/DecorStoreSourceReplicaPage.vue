<script setup lang="ts">
import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { DecorStorePageId } from "../../page-contracts";
import { decorStoreAssetId } from "../../resources";
import { decorStoreSecondaryPageFragmentLoaders } from "../../runtime/secondary-page-fragments/index.generated";
import DecorStoreShell from "../shared/DecorStoreShell.vue";

type SecondaryPageId = Exclude<DecorStorePageId, "home">;
const transparentPixel =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

const properties = defineProps<{
  announcement: string;
  pageId: SecondaryPageId;
  resolveAsset: ThemeAssetResolver;
}>();
const root = ref<HTMLElement>();
const fragment = shallowRef("");
let fragmentLoad = 0;
function resolveSourceAsset(path: string): string {
  return properties.resolveAsset(decorStoreAssetId(path));
}

async function loadFragment(pageId: SecondaryPageId): Promise<void> {
  const load = ++fragmentLoad;
  const next = await decorStoreSecondaryPageFragmentLoaders[pageId]();
  if (load === fragmentLoad) fragment.value = next;
}

await loadFragment(properties.pageId);

const markup = computed(() =>
  fragment.value
    // The upstream remote placeholders are unavailable in isolated capture. A decoded
    // transparent pixel plus integration CSS preserves their observed zero-size geometry.
    .replaceAll("__DECOR_PLACEHOLDER__", transparentPixel)
    .replace(/__DECOR_ASSET__(images\/.*?)__/g, (_, path: string) => resolveSourceAsset(path)),
);

function toggleTab(anchor: HTMLElement): void {
  const selector = anchor.getAttribute("href") ?? anchor.dataset.bsTarget;
  if (!selector?.startsWith("#")) return;
  const panel = root.value?.querySelector<HTMLElement>(selector);
  const list = anchor.closest("ul, .nav");
  list?.querySelectorAll(".active").forEach((element) => element.classList.remove("active"));
  anchor.classList.add("active");
  const container = panel?.parentElement;
  container?.querySelectorAll<HTMLElement>(":scope > .tab-pane").forEach((element) => {
    element.classList.remove("active", "show");
    element.hidden = true;
  });
  if (panel) {
    panel.hidden = false;
    panel.classList.add("active", "show");
  }
}

function toggleCollapse(anchor: HTMLElement): void {
  const selector = anchor.dataset.bsTarget ?? anchor.getAttribute("href");
  if (!selector?.startsWith("#")) return;
  const panel = root.value?.querySelector<HTMLElement>(selector);
  const open = !panel?.classList.contains("show");
  panel?.classList.toggle("show", open);
  if (panel) panel.hidden = !open;
  anchor.classList.toggle("collapsed", !open);
  anchor.setAttribute("aria-expanded", String(open));
}

function recalculateCartTotal(): void {
  const cartTotal = [
    ...(root.value?.querySelectorAll<HTMLElement>(".product-subtotal") ?? []),
  ].reduce((sum, element) => sum + Number(element.textContent?.match(/[\d.]+/)?.[0] ?? 0), 0);
  root.value?.querySelectorAll<HTMLElement>("[data-decor-cart-total]").forEach((total) => {
    total.textContent = `$${cartTotal.toFixed(2)}`;
  });
}

function updateQuantity(control: HTMLElement): void {
  const input = control.parentElement?.querySelector<HTMLInputElement>(".qty-text");
  if (!input) return;
  const current = Number(input.value) || 1;
  input.value = String(Math.max(1, current + (control.classList.contains("qty-plus") ? 1 : -1)));
  const status = control.parentElement?.querySelector<HTMLElement>("[role='status']");
  if (status) status.textContent = input.value;
  if (properties.pageId === "cart") {
    const row = control.closest("tr");
    const price = Number(
      row?.querySelector(".product-price")?.textContent?.match(/[\d.]+/)?.[0] ?? 0,
    );
    const subtotal = row?.querySelector<HTMLElement>(".product-subtotal");
    if (subtotal) subtotal.textContent = `$${(price * Number(input.value)).toFixed(2)}`;
    recalculateCartTotal();
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function productName(item: Element): string {
  return (
    item.querySelector<HTMLElement>(".shop-footer a, .product-name a")?.textContent?.trim() ||
    "Product"
  );
}

function productId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function appendStatus(container: Element, label: string, value: string): HTMLElement {
  const existing = container.querySelector<HTMLElement>(
    `[role='status'][aria-label='${CSS.escape(label)}']`,
  );
  if (existing) return existing;
  const status = document.createElement("span");
  status.className = "decor-store-source-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", label);
  status.textContent = value;
  container.append(status);
  return status;
}

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const control = target.closest<HTMLElement>("a, button, [role='button']");
  if (!control) return;
  if (control.matches("[data-bs-toggle='tab']")) {
    event.preventDefault();
    toggleTab(control);
    return;
  }
  if (control.matches("[data-bs-toggle='collapse']")) {
    event.preventDefault();
    toggleCollapse(control);
    return;
  }
  if (control.matches(".qty-plus, .qty-minus")) {
    event.preventDefault();
    updateQuantity(control);
    return;
  }
  if (control.matches("[data-decor-slider-next], [data-decor-slider-previous]")) {
    event.preventDefault();
    const sliderId =
      control.dataset.decorSliderNext ?? control.dataset.decorSliderPrevious ?? undefined;
    const slider =
      control.closest<HTMLElement>("[data-decor-slider]") ??
      (sliderId
        ? root.value?.querySelector<HTMLElement>(`[data-decor-slider='${CSS.escape(sliderId)}']`)
        : undefined);
    const slides = slider?.querySelectorAll<HTMLElement>("[data-decor-slide]");
    if (!slides?.length) return;
    const current = [...slides].findIndex((slide) => slide.getAttribute("aria-current") === "true");
    const delta = control.matches("[data-decor-slider-previous]") ? -1 : 1;
    const next = (Math.max(current, 0) + delta + slides.length) % slides.length;
    slides.forEach((slide, index) => {
      const active = index === next;
      slide.hidden = !active;
      slide.setAttribute("aria-current", String(active));
    });
    const status = slider?.querySelector<HTMLElement>("[role='status']");
    if (status) status.textContent = slides[next]?.dataset.decorSlideLabel ?? `Slide ${next + 1}`;
    return;
  }
  if (control.closest(".product-remove")) {
    event.preventDefault();
    control.closest("tr")?.remove();
    recalculateCartTotal();
    return;
  }
  if (properties.pageId === "wishlist" && control.querySelector(".icon-feather-heart-on")) {
    event.preventDefault();
    control.closest(".grid-item")?.remove();
    return;
  }
  if (
    ["shop-left", "shop-none", "shop-right"].includes(properties.pageId) &&
    control.closest(".shop-sidebar")
  ) {
    const filter = control.textContent?.trim();
    if (filter === "Furnitures") {
      event.preventDefault();
      const items = root.value?.querySelectorAll<HTMLElement>(".shop-wrapper > .grid-item") ?? [];
      const active = control.getAttribute("aria-pressed") !== "true";
      control.setAttribute("aria-pressed", String(active));
      items.forEach((item) => {
        item.hidden =
          active && !["wood-stool", "modern-stool"].includes(item.dataset.productId ?? "");
      });
      return;
    }
  }
  if (
    control.closest(".pagination-style-01") &&
    /^0?\d+$/.test(control.textContent?.trim() ?? "")
  ) {
    event.preventDefault();
    control
      .closest(".pagination-style-01")
      ?.querySelectorAll("[aria-current]")
      .forEach((item) => item.removeAttribute("aria-current"));
    control.setAttribute("aria-current", "page");
    return;
  }
  if (control.matches(".wishlist")) {
    event.preventDefault();
    const active = control.classList.toggle("active");
    control.setAttribute("aria-pressed", String(active));
    return;
  }
  if (control.matches("[data-decor-local-action]")) event.preventDefault();
}

function handleChange(event: Event): void {
  const target = event.target;
  if (
    !(target instanceof HTMLSelectElement) ||
    target.getAttribute("aria-label") !== "Default sorting"
  )
    return;
  const grid = root.value?.querySelector(".shop-wrapper");
  if (!grid) return;
  const items = [...grid.querySelectorAll<HTMLElement>(":scope > .grid-item")];
  const direction = target.value === "4" ? 1 : target.value === "5" ? -1 : 0;
  items
    .map((item, index) => ({
      item,
      index: Number(item.dataset.sourceOrder ?? index),
      price: Number([...item.textContent!.matchAll(/\$(\d+(?:\.\d+)?)/g)].at(-1)?.[1] ?? 0),
    }))
    .sort((left, right) =>
      direction === 0 ? left.index - right.index : direction * (left.price - right.price),
    )
    .forEach(({ item }) => grid.append(item));
}

function prepareProductItems(): void {
  const element = root.value;
  if (!element) return;
  element.querySelectorAll<HTMLElement>(".shop-wrapper > .grid-item").forEach((item, index) => {
    item.dataset.sourceOrder = String(index);
    const name = productName(item);
    item.dataset.productId = productId(name);
    item.querySelectorAll<HTMLElement>("[title='Add to wishlist']").forEach((control) => {
      control.classList.add("wishlist");
      control.setAttribute("role", "button");
      control.setAttribute("aria-label", `Add ${name} to wishlist`);
      control.setAttribute("aria-pressed", "false");
    });
    item.querySelectorAll<HTMLElement>("[title='Add to cart']").forEach((control) => {
      control.setAttribute("role", "button");
      control.setAttribute("aria-label", `Add ${name} to cart`);
    });
  });
}

function prepareProductPage(): void {
  if (properties.pageId !== "product" || !root.value) return;
  const element = root.value;
  const slides = element.querySelectorAll<HTMLElement>(
    ".product-image-slider .swiper-slide.gallery-box",
  );
  const slider = element.querySelector<HTMLElement>(".product-image-slider");
  slider?.setAttribute("data-decor-slider", "product-gallery");
  slides.forEach((slide, index) => {
    slide.dataset.gallerySlide = String(index + 1);
    slide.dataset.decorSlide = String(index + 1);
    slide.dataset.decorSlideLabel = `Product image ${index + 1}`;
    slide.hidden = index !== 0;
    slide.setAttribute("aria-current", String(index === 0));
  });
  const next = element.querySelector<HTMLElement>(".slider-product-next");
  next?.setAttribute("role", "button");
  next?.setAttribute("aria-label", "Next product image");
  next?.setAttribute("data-decor-slider-next", "product-gallery");
  const previous = element.querySelector<HTMLElement>(".slider-product-prev");
  previous?.setAttribute("role", "button");
  previous?.setAttribute("aria-label", "Previous product image");
  previous?.setAttribute("data-decor-slider-previous", "product-gallery");
  const quantity = element.querySelector<HTMLInputElement>(".product-info .qty-text");
  if (quantity) appendStatus(quantity.parentElement!, "Quantity", quantity.value || "1");
  const colorNames = ["Black", "Chestnut", "Stone", "Sage"];
  element
    .querySelectorAll<HTMLInputElement>(".product-info input[name='color']")
    .forEach((input, index) => {
      input.setAttribute("aria-label", colorNames[index] ?? `Color ${index + 1}`);
      input.checked = index === 0;
    });
  const addToCart = element.querySelector<HTMLElement>(".product-info .btn-cart");
  addToCart?.setAttribute("role", "button");
  addToCart?.setAttribute("aria-label", "Add to cart");
  element.querySelectorAll<HTMLElement>("[data-bs-toggle='tab']").forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.closest<HTMLElement>("ul, .nav")?.setAttribute("role", "tablist");
    if (tab.parentElement?.tagName === "LI") tab.parentElement.setAttribute("role", "presentation");
    const selector = tab.getAttribute("href");
    if (selector?.startsWith("#")) {
      tab.setAttribute("aria-controls", selector.slice(1));
      element.querySelector<HTMLElement>(selector)?.setAttribute("role", "tabpanel");
    }
  });
}

function prepareCart(): void {
  const rows = root.value?.querySelectorAll<HTMLTableRowElement>("tbody tr") ?? [];
  rows.forEach((row) => {
    const name = row.querySelector<HTMLElement>(".product-name a")?.textContent?.trim();
    if (!name) return;
    row.dataset.cartLine = productId(name);
    const remove = row.querySelector<HTMLElement>(".product-remove a, td:first-child a");
    remove?.setAttribute("role", "button");
    remove?.setAttribute("aria-label", `Remove ${name}`);
    row
      .querySelector<HTMLElement>(".qty-plus")
      ?.setAttribute("aria-label", `Increase ${name} quantity`);
    row
      .querySelector<HTMLElement>(".qty-minus")
      ?.setAttribute("aria-label", `Decrease ${name} quantity`);
    const quantity = row.querySelector<HTMLInputElement>(".qty-text");
    if (quantity) appendStatus(quantity.parentElement!, `${name} quantity`, quantity.value || "1");
  });
  const totals = [...(root.value?.querySelectorAll<HTMLElement>("td, h6") ?? [])].filter(
    (element) => element.textContent?.trim() === "$405.00",
  );
  totals.forEach((total) => (total.dataset.decorCartTotal = ""));
}

function prepareForms(): void {
  const element = root.value;
  if (!element) return;
  if (properties.pageId === "checkout") {
    const forms = element.querySelectorAll<HTMLElement>("[data-decor-inert-form]");
    forms[0]?.querySelectorAll<HTMLInputElement>("input").forEach((input, index) => {
      if (index === 0) input.setAttribute("aria-label", "First name");
    });
    const passwordLabel = [...element.querySelectorAll<HTMLLabelElement>("label")].find((label) =>
      label.textContent?.includes("Create account password"),
    );
    (passwordLabel?.nextElementSibling as HTMLInputElement | null)?.setAttribute(
      "aria-label",
      "Account password",
    );
    const password = element.querySelector<HTMLInputElement>("[aria-label='Account password']");
    if (password) password.disabled = true;
    const placeOrder = [...element.querySelectorAll<HTMLElement>("a, button")].find((control) =>
      control.textContent?.includes("Place order"),
    );
    if (placeOrder) {
      placeOrder.setAttribute("role", "button");
      placeOrder.setAttribute("aria-disabled", "true");
    }
  }
  if (properties.pageId === "account") {
    const forms = element.querySelectorAll<HTMLElement>("[data-decor-inert-form]");
    forms[0]?.setAttribute("aria-label", "Login presentation");
    forms[1]?.setAttribute("aria-label", "Registration presentation");
    const loginInputs = forms[0]?.querySelectorAll<HTMLInputElement>("input");
    loginInputs?.[0]?.setAttribute("aria-label", "Username or email address");
    loginInputs?.[1]?.setAttribute("aria-label", "Password");
    forms[0]
      ?.querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => (button.disabled = true));
    forms[1]
      ?.querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => (button.disabled = true));
  }
  if (properties.pageId === "contact") {
    const form = element.querySelector<HTMLElement>("[data-decor-inert-form]");
    form?.querySelector<HTMLInputElement>("input[name='name']")?.setAttribute("aria-label", "Name");
    form
      ?.querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => (button.disabled = true));
    const map = element.querySelector<HTMLElement>(".decor-source-map-placeholder, #map");
    map?.setAttribute("role", "img");
    map?.setAttribute("aria-label", "Store location map presentation");
  }
}

function prepareContentControls(): void {
  const element = root.value;
  if (!element) return;
  if (properties.pageId === "about") {
    const next = element.querySelector<HTMLElement>(".slider-one-slide-next-1");
    const slider = next?.closest<HTMLElement>(".swiper");
    const slides = slider?.querySelectorAll<HTMLElement>(
      ":scope > .swiper-wrapper > .swiper-slide",
    );
    if (!next || !slider || !slides?.length) return;
    slider.setAttribute("data-decor-slider", "about-story");
    slides.forEach((slide, index) => {
      slide.dataset.decorSlide = String(index + 1);
      slide.dataset.decorSlideLabel =
        slide.querySelector("h3")?.textContent?.trim() ?? `Story ${index + 1}`;
      slide.hidden = index !== 0;
      slide.setAttribute("aria-current", String(index === 0));
    });
    next.setAttribute("role", "button");
    next.setAttribute("aria-label", "Next story");
    next.setAttribute("data-decor-slider-next", "about-story");
    const previous = slider.querySelector<HTMLElement>(".slider-one-slide-prev-1");
    previous?.setAttribute("role", "button");
    previous?.setAttribute("aria-label", "Previous story");
    previous?.setAttribute("data-decor-slider-previous", "about-story");
    appendStatus(slider, "Story", slides[0]?.dataset.decorSlideLabel ?? "Story 1");
  }
  if (properties.pageId === "faq") {
    element
      .querySelectorAll<HTMLElement>("[data-bs-toggle='collapse']")
      .forEach((control, index) => {
        const panel = control.closest(".accordion-item")?.querySelector<HTMLElement>(".collapse");
        if (!panel) return;
        panel.id = `decor-faq-${index + 1}`;
        control.setAttribute("href", `#${panel.id}`);
        control.setAttribute("role", "button");
        control.setAttribute("aria-controls", panel.id);
        control.setAttribute("aria-expanded", String(panel.classList.contains("show")));
      });
  }
}

function prepareInteractiveSemantics(): void {
  const element = root.value;
  if (!element) return;
  element.querySelectorAll<HTMLElement>(".tab-pane").forEach((panel) => {
    panel.hidden = !panel.classList.contains("active");
  });
  element.querySelectorAll<HTMLElement>(".collapse").forEach((panel) => {
    panel.hidden = !panel.classList.contains("show");
  });
  element.querySelectorAll<HTMLInputElement>("input[type='password']").forEach((input) => {
    input.disabled = true;
  });
  element.querySelectorAll<HTMLAnchorElement>("a").forEach((anchor) => {
    if (anchor.textContent?.trim() || anchor.getAttribute("aria-label")) return;
    anchor.setAttribute("aria-label", anchor.title || "View details");
  });
  element
    .querySelectorAll<HTMLElement>(".qty-plus")
    .forEach((control) => control.setAttribute("aria-label", "Increase quantity"));
  element
    .querySelectorAll<HTMLElement>(".qty-minus")
    .forEach((control) => control.setAttribute("aria-label", "Decrease quantity"));
  element.querySelectorAll<HTMLElement>(".wishlist").forEach((control) => {
    control.setAttribute("aria-label", "Add product to wishlist");
    control.setAttribute("role", "button");
    control.setAttribute("aria-pressed", "false");
  });
  prepareProductItems();
  prepareProductPage();
  if (["shop-left", "shop-right"].includes(properties.pageId))
    element
      .querySelector<HTMLElement>(".shop-sidebar")
      ?.setAttribute("data-sidebar", properties.pageId === "shop-left" ? "left" : "right");
  element.querySelectorAll<HTMLElement>(".shop-sidebar a").forEach((control) => {
    control.setAttribute("role", "button");
    control.setAttribute("aria-pressed", "false");
  });
  element.querySelectorAll<HTMLElement>(".pagination-style-01 a").forEach((control) => {
    const page = Number(control.textContent?.trim());
    if (page) {
      control.setAttribute("role", "button");
      control.setAttribute("aria-label", String(page));
    }
  });
  if (properties.pageId === "cart") prepareCart();
  prepareForms();
  prepareContentControls();
}

onMounted(() => {
  void nextTick(prepareInteractiveSemantics);
  root.value?.addEventListener("click", handleClick);
  root.value?.addEventListener("change", handleChange);
});
watch(markup, () => void nextTick(prepareInteractiveSemantics), { flush: "post" });
watch(
  () => properties.pageId,
  (pageId) => void loadFragment(pageId),
);
onBeforeUnmount(() => {
  root.value?.removeEventListener("click", handleClick);
  root.value?.removeEventListener("change", handleChange);
});
</script>

<template>
  <DecorStoreShell :active-page="pageId" :announcement="announcement" :resolve-asset="resolveAsset">
    <h1 v-if="pageId === 'product'" class="decor-store-preview-shell__title">
      Minimalist wooden chair
    </h1>
    <h1 v-if="pageId === 'article'" class="decor-store-preview-shell__title">
      The best influencers to follow for sartorial inspiration
    </h1>
    <div
      ref="root"
      class="decor-store-source-page"
      :data-decor-source-page="pageId"
      v-html="markup"
    ></div>
  </DecorStoreShell>
</template>
