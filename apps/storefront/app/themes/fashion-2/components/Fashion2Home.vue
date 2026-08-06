<script setup lang="ts">
import { recordPreviewIntent, type PreviewAction } from "../../../theme-engine/actions";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import type { Fashion2HomeData } from "../fixtures/home";
import { useFashion2Runtime } from "../composables/useFashion2Runtime";
import { fashion2AssetId } from "../resources";

const properties = defineProps<{
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}>();
const data = computed<Fashion2HomeData>(() => {
  if (properties.viewModel.kind !== "theme-section") {
    throw new Error("Fashion 2 home requires a theme-section fixture.");
  }
  return properties.viewModel.data as unknown as Fashion2HomeData;
});

const menuOpen = ref(false);
const menuToggle = ref<HTMLButtonElement>();
const cookieVisible = ref(true);
const documentReadyClass = ref<"js" | "no-js">("no-js");
const actionFeedback = ref("");
const actionIntentCount = ref(0);
const runtime = useFashion2Runtime({
  autoplayMs: data.value.slider.options.autoplayMs,
  breakpointPx: data.value.slider.options.breakpointPx,
  count: data.value.slider.slides.length,
  speedMs: data.value.slider.options.speedMs,
});
const activeIndex = computed(() =>
  runtime.motion.value.phase === "transitioning"
    ? runtime.motion.value.targetIndex
    : runtime.motion.value.currentIndex,
);
const heroCurrent = computed(() => String(activeIndex.value + 1).padStart(2, "0"));
const heroNext = computed(() =>
  String(((activeIndex.value + 1) % data.value.slider.slides.length) + 1).padStart(2, "0"),
);

const router = useRouter();

function recordProductAction(action: PreviewAction, feedback: string): void {
  recordPreviewIntent(action, "fashion-2.home.product");
  actionIntentCount.value += 1;
  actionFeedback.value = feedback;
}

function addToCart(): void {
  recordProductAction(data.value.cartAction, "Product added to the preview cart.");
}

function addToWishlist(): void {
  recordProductAction(data.value.wishlistAction, "Product wishlist preview updated.");
}

function openQuickView(): void {
  recordProductAction(data.value.quickViewAction, "Product quick view preview requested.");
}

async function handleInternalNavigation(event: MouseEvent): Promise<void> {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[data-fashion-2-route]");
  if (!anchor || !document.body.classList.contains("fashion-2-home")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const destination = anchor.getAttribute("href") ?? "/";
  if (menuOpen.value) {
    menuOpen.value = false;
    await nextTick();
    menuToggle.value?.focus();
  }
  if (router.currentRoute.value.fullPath !== destination) await router.push(destination);
}

function sourceAsset(sourcePath: string): string {
  return properties.resolveAsset(fashion2AssetId(sourcePath));
}

function sourceBackground(sourcePath: string): string {
  return `url('${sourceAsset(sourcePath)}')`;
}

useHead(() => ({
  bodyAttrs: {
    class: "fashion-2-home",
    "data-mobile-nav-style": "classic",
  },
  htmlAttrs: { class: documentReadyClass.value, lang: "en" },
  link: [
    {
      as: "image",
      fetchpriority: "high",
      href: properties.resolveAsset("fashion-2.slider-01"),
      rel: "preload",
    },
  ],
}));

onMounted(() => {
  documentReadyClass.value = "js";
  document.addEventListener("click", handleInternalNavigation, true);
});

onBeforeUnmount(() => document.removeEventListener("click", handleInternalNavigation, true));
</script>

<template>
  <a class="skip-link" href="#fashion-2-main">Skip to content</a>
  <h1 class="sr-only">Fashion store</h1>
  <span
    class="sr-only"
    data-fashion-2-source-parity="true"
    :data-preview-intent-count="actionIntentCount"
    :data-runtime-instance-count="runtime.liveInstances.value"
    :data-runtime-status="runtime.status.value"
  />
  <p v-if="runtime.failure.value" class="sr-only" role="alert">
    Visual enhancements are unavailable: {{ runtime.failure.value }}
  </p>
  <button
    v-for="(_, index) in data.slider.slides"
    :key="'slide-control-' + index"
    type="button"
    class="sr-only"
    :data-fashion-2-slide="index"
    :aria-label="'Show slide ' + (index + 1)"
    @click="runtime.select(index)"
  />
  <header class="header-with-topbar" data-fashion-2-header="true">
    <div
      class="header-top-bar top-bar-light bg-base-color disable-fixed md-border-bottom border-color-transparent-dark-very-light"
    >
      <div class="container-fluid">
        <div class="row h-40px align-items-center m-0">
          <div class="col-12 justify-content-center alt-font fs-13 fw-500 text-uppercase">
            <div class="text-dark-gray">{{ data.announcement }}</div>
            <a
              href="/"
              data-fashion-2-route
              class="text-dark-gray fw-600 ms-5px text-dark-gray-hover"
              ><span class="text-decoration-line-bottom">Shop now</span></a
            >
          </div>
        </div>
      </div>
    </div>

    <nav class="navbar navbar-expand-lg header-light bg-white disable-fixed center-logo">
      <div class="container-fluid">
        <div class="col-auto col-xxl-3 col-lg-2 menu-logo">
          <div class="header-icon d-none d-lg-flex">
            <div class="widget-text icon alt-font">
              <a href="/" data-fashion-2-route
                ><i class="feather icon-feather-map-pin d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">Find stores</span></a
              >
            </div>
            <div class="widget-text icon alt-font">
              <a href="https://www.instagram.com/" target="_blank"
                ><i class="feather icon-feather-instagram d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">100k Followers</span></a
              >
            </div>
          </div>
          <a class="navbar-brand" href="/" data-fashion-2-route aria-label="Lifestyle home">
            <img
              alt=""
              class="default-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              alt=""
              class="alt-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
            <img
              alt=""
              class="mobile-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-black.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-black@2x.png')"
            />
          </a>
        </div>
        <div class="col-auto col-xxl-6 col-lg-8 menu-order">
          <button
            ref="menuToggle"
            class="navbar-toggler float-end"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-label="Toggle navigation"
            v-bind:aria-expanded="menuOpen"
            v-on:click="menuOpen = !menuOpen"
          >
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
            <span class="navbar-toggler-line"></span>
          </button>
          <div
            class="collapse navbar-collapse justify-content-between"
            id="navbarNav"
            v-bind:class="{ show: menuOpen }"
          >
            <ul class="navbar-nav alt-font navbar-left justify-content-end">
              <li class="nav-item">
                <a href="/" data-fashion-2-route class="nav-link">Home</a>
              </li>
              <li class="nav-item dropdown submenu">
                <a href="/" data-fashion-2-route class="nav-link">Shop</a>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink1"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <div
                  class="dropdown-menu submenu-content"
                  aria-labelledby="navbarDropdownMenuLink1"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-1 row-cols-lg-5 row-cols-md-3 row-cols-sm-3 mb-50px md-mb-25px xs-mb-15px"
                    >
                      <div class="col">
                        <ul>
                          <li class="sub-title">Men</li>
                          <li><a href="/" data-fashion-2-route>Jeans</a></li>
                          <li><a href="/" data-fashion-2-route>Trousers</a></li>
                          <li><a href="/" data-fashion-2-route>Swimwear</a></li>
                          <li><a href="/" data-fashion-2-route>Casual shirts</a></li>
                          <li><a href="/" data-fashion-2-route>Rain jackets</a></li>
                          <li><a href="/" data-fashion-2-route>Loungewear</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Women</li>
                          <li><a href="/" data-fashion-2-route>Dupattas</a></li>
                          <li><a href="/" data-fashion-2-route>Leggings</a></li>
                          <li><a href="/" data-fashion-2-route>Ethnic wear</a></li>
                          <li><a href="/" data-fashion-2-route>Kurtas &amp; suits</a></li>
                          <li><a href="/" data-fashion-2-route>Western wear</a></li>
                          <li><a href="/" data-fashion-2-route>Dress materials</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Kids</li>
                          <li><a href="/" data-fashion-2-route>Dresses</a></li>
                          <li><a href="/" data-fashion-2-route>Jumpsuits</a></li>
                          <li><a href="/" data-fashion-2-route>Track pants</a></li>
                          <li><a href="/" data-fashion-2-route>Ethnic wear</a></li>
                          <li><a href="/" data-fashion-2-route>Value packs</a></li>
                          <li><a href="/" data-fashion-2-route>Loungewear</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Divided</li>
                          <li><a href="/" data-fashion-2-route>Tops</a></li>
                          <li><a href="/" data-fashion-2-route>Dresses</a></li>
                          <li><a href="/" data-fashion-2-route>Shorts</a></li>
                          <li><a href="/" data-fashion-2-route>Swimwear</a></li>
                          <li><a href="/" data-fashion-2-route>Jeans</a></li>
                          <li><a href="/" data-fashion-2-route>Jackets</a></li>
                        </ul>
                      </div>
                      <div class="col">
                        <ul>
                          <li class="sub-title">Accessories</li>
                          <li><a href="/" data-fashion-2-route>Shoes</a></li>
                          <li><a href="/" data-fashion-2-route>Scarves</a></li>
                          <li><a href="/" data-fashion-2-route>Watches</a></li>
                          <li><a href="/" data-fashion-2-route>Wristwear</a></li>
                          <li><a href="/" data-fashion-2-route>Backpacks</a></li>
                          <li><a href="/" data-fashion-2-route>Sunglasses</a></li>
                        </ul>
                      </div>
                    </div>
                    <div class="row row-cols-1 row-cols-sm-2">
                      <div class="col">
                        <a href="/" data-fashion-2-route
                          ><img
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-banner-01.jpg')
                            "
                        /></a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-2-route
                          ><img
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-banner-02.jpg')
                            "
                        /></a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li class="nav-item dropdown submenu">
                <a href="/" data-fashion-2-route class="nav-link">Collection</a>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink2"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <div
                  class="dropdown-menu submenu-content"
                  aria-labelledby="navbarDropdownMenuLink2"
                >
                  <div class="d-lg-flex mega-menu m-auto flex-column">
                    <div
                      class="row row-cols-2 row-cols-lg-6 row-cols-md-3 row-cols-sm-2 md-mx-0 align-items-center justify-content-center"
                    >
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-01.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Polo t-shirts</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-02.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Sunglasses</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col md-mb-25px">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-03.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Skinny blazer</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col sm-mb-25px">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-04.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Casual shoes</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-05.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Winter jackets</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                      <div class="col">
                        <a href="/" data-fashion-2-route class="justify-content-center mb-10px">
                          <img
                            class="border-radius-4px w-100"
                            alt=""
                            v-bind:src="
                              sourceAsset('images/demo-fashion-store-menu-category-06.jpg')
                            "
                          />
                        </a>
                        <a
                          href="/"
                          data-fashion-2-route
                          class="btn btn-hover-animation fw-500 text-uppercase-inherit justify-content-center pt-0 pb-0"
                        >
                          <span>
                            <span class="btn-text text-dark-gray fs-17">Men's shorts</span>
                            <span class="btn-icon"
                              ><i class="fa-solid fa-arrow-right icon-very-small w-auto"></i
                            ></span>
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
            <ul class="navbar-nav alt-font navbar-right justify-content-start">
              <li class="nav-item">
                <a href="/" data-fashion-2-route class="nav-link">Magazine</a>
              </li>
              <li class="nav-item dropdown simple-dropdown">
                <button type="button" class="nav-link fashion-2-source-action">Pages</button>
                <i
                  class="fa-solid fa-angle-down dropdown-toggle"
                  id="navbarDropdownMenuLink3"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                ></i>
                <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink3">
                  <li><a href="/" data-fashion-2-route>About</a></li>
                  <li><a href="/" data-fashion-2-route>Faq</a></li>
                  <li><a href="/" data-fashion-2-route>Wishlist</a></li>
                  <li><a href="/" data-fashion-2-route>Account</a></li>
                  <li><a href="/" data-fashion-2-route>Cart</a></li>
                  <li><a href="/" data-fashion-2-route>Checkout</a></li>
                </ul>
              </li>
              <li class="nav-item">
                <a href="/" data-fashion-2-route class="nav-link">Contact</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="col-auto col-xxl-3 col-lg-2 text-end">
          <div class="header-icon">
            <div class="header-search-icon icon alt-font">
              <a
                href="/"
                data-fashion-2-route
                class="search-form-icon header-search-form"
                aria-label="Search"
                ><i class="feather icon-feather-search me-5px"></i
                ><span class="d-none d-xxl-inline-block">Search</span></a
              >
              <div class="search-form-wrapper">
                <button title="Close" type="button" class="search-close alt-font">×</button>
                <form
                  id="search-form"
                  role="search"
                  method="get"
                  class="search-form text-left"
                  action="#"
                  v-on:submit.prevent=""
                >
                  <div class="search-form-box">
                    <h2 class="text-dark-gray text-center mb-4 fw-600 alt-font ls-minus-1px">
                      What are you looking for?
                    </h2>
                    <input
                      class="search-input alt-font"
                      id="search-form-input5e219ef164995"
                      placeholder="Enter your keywords..."
                      name="s"
                      value=""
                      type="text"
                      autocomplete="off"
                    />
                    <button type="submit" class="search-button">
                      <i class="feather icon-feather-search" aria-hidden="true"></i>
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div class="widget-text icon alt-font">
              <a href="/" data-fashion-2-route aria-label="Account"
                ><i class="feather icon-feather-user d-inline-block me-5px"></i
                ><span class="d-none d-xxl-inline-block">Account</span></a
              >
            </div>
            <div class="header-cart-icon icon">
              <div class="header-cart dropdown">
                <button
                  type="button"
                  class="fashion-2-source-action"
                  aria-label="Open preview cart"
                >
                  <i class="feather icon-feather-shopping-bag"></i
                  ><span class="cart-count alt-font text-white bg-dark-gray">2</span>
                </button>
                <ul class="cart-item-list">
                  <li class="cart-item align-items-center">
                    <button
                      type="button"
                      class="alt-font close fashion-2-source-action"
                      aria-label="Remove Ribbed tank from preview cart"
                    >
                      ×
                    </button>
                    <div class="product-image">
                      <a href="/" data-fashion-2-route
                        ><img
                          class="cart-thumb"
                          alt=""
                          v-bind:src="sourceAsset('images/demo-fashion-store-product-01.jpg')"
                      /></a>
                    </div>
                    <div class="product-detail fw-600">
                      <a href="/" data-fashion-2-route>Ribbed tank</a>
                      <span class="item-ammount fw-400">1 x $23.00</span>
                    </div>
                  </li>
                  <li class="cart-item align-items-center">
                    <button
                      type="button"
                      class="alt-font close fashion-2-source-action"
                      aria-label="Remove Pleated dress from preview cart"
                    >
                      ×
                    </button>
                    <div class="product-image">
                      <a href="/" data-fashion-2-route
                        ><img
                          class="cart-thumb"
                          alt=""
                          v-bind:src="sourceAsset('images/demo-fashion-store-product-02.jpg')"
                      /></a>
                    </div>
                    <div class="product-detail fw-600">
                      <a href="/" data-fashion-2-route>Pleated dress</a>
                      <span class="item-ammount fw-400">2 x $15.00</span>
                    </div>
                  </li>
                  <li class="cart-total">
                    <div class="fs-18 alt-font mb-15px">
                      <span class="w-50 fw-500 text-start">Subtotal:</span
                      ><span class="w-50 text-end fw-700">$199.99</span>
                    </div>
                    <a
                      href="/cart"
                      data-fashion-2-route
                      class="btn btn-large btn-transparent-light-gray border-color-extra-medium-gray"
                      >View cart</a
                    >
                    <a
                      href="/checkout"
                      data-fashion-2-route
                      class="btn btn-large btn-dark-gray btn-box-shadow"
                      >Checkout</a
                    >
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  </header>
  <section class="p-0" id="fashion-2-main" role="main">
    <div
      class="swiper full-screen top-space-margin md-h-600px sm-h-500px magic-cursor magic-cursor-vertical swiper-number-pagination-progress swiper-number-pagination-progress-vertical"
      data-slider-options='{ "slidesPerView": 1, "direction": "horizontal", "loop": true, "parallax": true, "speed": 1000, "pagination": { "el": ".swiper-number", "clickable": true }, "autoplay": { "delay": 4000, "disableOnInteraction": false },  "keyboard": { "enabled": true, "onlyInViewport": true }, "breakpoints": { "1199": { "direction": "vertical" }}, "effect": "slide" }'
      data-swiper-number-pagination-progress="true"
      v-bind:data-motion-active-index="activeIndex"
      v-bind:data-motion-autoplay-ms="data.slider.options.autoplayMs"
      v-bind:data-motion-direction="runtime.direction.value"
      v-bind:data-motion-phase="runtime.motion.value.phase"
      data-motion-easing="ease"
      v-bind:data-motion-duration-ms="data.slider.options.speedMs"
      v-bind:data-motion-paused="runtime.motion.value.pausedReasons.join(',')"
      v-bind:data-motion-ready="runtime.hydrated.value"
      v-on:keydown="runtime.keydown"
      tabindex="0"
    >
      <div class="swiper-wrapper">
        <div
          class="swiper-slide overflow-hidden fashion-2-hero-slide"
          data-motion-layer="slide"
          v-bind:data-active="activeIndex === 0"
          v-bind:aria-hidden="activeIndex === 0 ? undefined : 'true'"
        >
          <div
            class="cover-background position-absolute top-0 start-0 w-100 h-100"
            data-swiper-parallax="500"
            v-bind:style="{
              backgroundImage: sourceBackground('images/demo-fashion-store-slider-01.jpg'),
            }"
          >
            <div class="container h-100">
              <div class="row align-items-center h-100 justify-content-start">
                <div
                  class="col-md-10 position-relative text-white d-flex flex-column justify-content-center h-100"
                >
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [50, 0], "easing": "easeOutQuad", "duration": 500, "delay": 300 }'
                    class="alt-font text-dark-gray mb-25px fs-20 sm-mb-15px"
                  >
                    <span class="text-highlight"
                      >{{ data.slider.slides[0].eyebrow
                      }}<span class="bg-base-color h-8px bottom-0px"></span
                    ></span>
                  </div>
                  <div
                    class="alt-font fs-120 xs-fs-95 lh-100 mb-40px text-dark-gray fw-600 transform-origin-right ls-minus-5px sm-mb-25px"
                    data-anime='{ "el": "childs", "rotateX": [90, 0], "opacity": [0,1], "staggervalue": 150, "easing": "easeOutQuad" }'
                  >
                    <span class="d-block">Women's</span>
                    <span class="d-block fw-300">collection</span>
                  </div>
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [100, 0], "easing": "easeOutQuad", "duration": 800, "delay": 400 }'
                  >
                    <a
                      href="/"
                      data-fashion-2-route
                      class="btn btn-dark-gray btn-box-shadow btn-large"
                      >View collection</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          class="swiper-slide overflow-hidden fashion-2-hero-slide"
          data-motion-layer="slide"
          v-bind:data-active="activeIndex === 1"
          v-bind:aria-hidden="activeIndex === 1 ? undefined : 'true'"
        >
          <div
            class="cover-background position-absolute top-0 start-0 w-100 h-100"
            data-swiper-parallax="500"
            v-bind:style="{
              backgroundImage: sourceBackground('images/demo-fashion-store-slider-02.jpg'),
            }"
          >
            <div class="container h-100">
              <div class="row align-items-center h-100 justify-content-start">
                <div
                  class="col-md-10 position-relative text-white d-flex flex-column justify-content-center h-100"
                >
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [50, 0], "easing": "easeOutQuad", "duration": 500, "delay": 300 }'
                    class="alt-font text-dark-gray mb-25px fs-20 sm-mb-15px"
                  >
                    <span class="text-highlight"
                      >{{ data.slider.slides[1].eyebrow
                      }}<span class="bg-base-color h-8px bottom-0px"></span
                    ></span>
                  </div>
                  <div
                    class="alt-font fs-120 xs-fs-95 lh-100 mb-40px text-dark-gray fw-600 transform-origin-right ls-minus-5px sm-mb-25px"
                    data-anime='{ "el": "childs", "rotateX": [90, 0], "opacity": [0,1], "staggervalue": 150, "easing": "easeOutQuad" }'
                  >
                    <span class="d-block">Men's</span>
                    <span class="d-block fw-300">collection</span>
                  </div>
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [100, 0], "easing": "easeOutQuad", "duration": 800, "delay": 400 }'
                  >
                    <a
                      href="/"
                      data-fashion-2-route
                      class="btn btn-dark-gray btn-box-shadow btn-large"
                      >View collection</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          class="swiper-slide overflow-hidden fashion-2-hero-slide"
          data-motion-layer="slide"
          v-bind:data-active="activeIndex === 2"
          v-bind:aria-hidden="activeIndex === 2 ? undefined : 'true'"
        >
          <div
            class="cover-background position-absolute top-0 start-0 w-100 h-100"
            data-swiper-parallax="500"
            v-bind:style="{
              backgroundImage: sourceBackground('images/demo-fashion-store-slider-03.jpg'),
            }"
          >
            <div class="container h-100">
              <div class="row align-items-center h-100 justify-content-start">
                <div
                  class="col-md-10 position-relative text-white d-flex flex-column justify-content-center h-100"
                >
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [50, 0], "easing": "easeOutQuad", "duration": 500, "delay": 300 }'
                    class="alt-font text-dark-gray mb-25px fs-20 sm-mb-15px"
                  >
                    <span class="text-highlight"
                      >{{ data.slider.slides[2].eyebrow
                      }}<span class="bg-base-color h-8px bottom-0px"></span
                    ></span>
                  </div>
                  <div
                    class="alt-font fs-120 xs-fs-95 lh-100 mb-40px text-dark-gray fw-600 transform-origin-right ls-minus-5px sm-mb-25px"
                    data-anime='{ "el": "childs", "rotateX": [90, 0], "opacity": [0,1], "staggervalue": 150, "easing": "easeOutQuad" }'
                  >
                    <span class="d-block">Children's</span>
                    <span class="d-block fw-300">collection</span>
                  </div>
                  <div
                    data-anime='{ "opacity": [0, 1], "translateY": [100, 0], "easing": "easeOutQuad", "duration": 800, "delay": 400 }'
                  >
                    <a
                      href="/"
                      data-fashion-2-route
                      class="btn btn-dark-gray btn-box-shadow btn-large"
                      >View collection</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="swiper-pagination-wrapper">
        <div class="pagination-progress-vertical d-flex align-items-center justify-content-center">
          <div class="number-prev text-dark-gray fs-16 fw-500">{{ heroCurrent }}</div>
          <div class="swiper-pagination-progress">
            <span class="swiper-progress"></span>
          </div>
          <div class="number-next text-dark-gray fs-16 fw-500">{{ heroNext }}</div>
        </div>
      </div>
    </div>
  </section>
  <section class="half-section">
    <div class="container">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-4 row-cols-md-2 row-cols-sm-2"
        data-anime='{ "el": "childs", "translateX": [30, 0], "opacity": [0,1], "duration": 800, "delay": 200, "staggervalue": 300, "easing": "easeOutQuad" }'
      >
        <div class="col icon-with-text-style-01 md-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <i class="line-icon-Box-Close icon-large text-dark-gray"></i>
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[0].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[0].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01 md-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <i class="line-icon-Reload-3 icon-large text-dark-gray"></i>
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[1].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[1].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01 xs-mb-35px">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <i class="line-icon-Credit-Card2 icon-large text-dark-gray"></i>
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[2].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[2].description }}</p>
            </div>
          </div>
        </div>

        <div class="col icon-with-text-style-01">
          <div class="feature-box feature-box-left-icon-middle last-paragraph-no-margin">
            <div class="feature-box-icon me-20px">
              <i class="line-icon-Phone-2 icon-large text-dark-gray"></i>
            </div>
            <div class="feature-box-content">
              <span class="alt-font fs-20 fw-500 d-block text-dark-gray">{{
                data.services[3].title
              }}</span>
              <p class="fs-16 lh-24">{{ data.services[3].description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="pt-0 pb-0 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-p-0">
    <div class="container-fluid">
      <div
        class="row row-cols-1 row-cols-xl-4 row-cols-lg-2 row-cols-md-2"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "perspective": [1200,1200], "scale": [1.1, 1], "rotateX": [50, 0], "opacity": [0,1], "duration": 400, "delay": 100, "staggervalue": 200, "easing": "easeOutQuad" }'
      >
        <div class="col categories-style-02 lg-mb-30px">
          <div class="categories-box">
            <a href="/" data-fashion-2-route v-bind:aria-label="'View ' + data.categories[0].name">
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[0].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[0].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                href="/"
                data-fashion-2-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[0].name">{{
                    data.categories[0].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02 lg-mb-30px">
          <div class="categories-box">
            <a href="/" data-fashion-2-route v-bind:aria-label="'View ' + data.categories[1].name">
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[1].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[1].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                href="/"
                data-fashion-2-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[1].name">{{
                    data.categories[1].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02 sm-mb-30px">
          <div class="categories-box">
            <a href="/" data-fashion-2-route v-bind:aria-label="'View ' + data.categories[2].name">
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[2].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[2].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                href="/"
                data-fashion-2-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[2].name">{{
                    data.categories[2].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div class="col categories-style-02">
          <div class="categories-box">
            <a href="/" data-fashion-2-route v-bind:aria-label="'View ' + data.categories[3].name">
              <img
                class="sm-w-100"
                alt=""
                v-bind:src="sourceAsset(data.categories[3].sourceImage)"
              />
            </a>
            <div
              class="border-color-transparent-dark-very-light border alt-font fw-500 text-dark-gray text-uppercase ps-15px pe-15px fs-11 lh-26 border-radius-100px d-inline-block position-absolute right-20px top-20px"
            >
              {{ data.categories[3].itemCount }}
            </div>
            <div class="absolute-bottom-center bottom-40px md-bottom-25px">
              <a
                href="/"
                data-fashion-2-route
                class="btn btn-white btn-switch-text btn-round-edge btn-box-shadow fs-18 text-uppercase-inherit p-5 min-w-150px"
              >
                <span>
                  <span class="btn-double-text ls-0px" v-bind:data-text="data.categories[3].name">{{
                    data.categories[3].name
                  }}</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 sm-pb-6 xs-px-0">
    <div class="container">
      <div class="row mb-5 xs-mb-8">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            Best seller
            <span class="text-highlight fw-600"
              >products<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ul
            class="shop-modern shop-wrapper grid-loading grid grid-5col lg-grid-4col md-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
            data-anime='{ "el": "childs", "translateY": [-15, 0], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer"></li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[0].name"
                      v-bind:src="sourceAsset(data.bestSellers[0].sourceImage)"
                    />
                    <span class="lable new">New</span>
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[0].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[0].originalPrice }}</del
                    >{{ data.bestSellers[0].price }}
                  </div>
                  <p v-if="actionFeedback" class="fashion-2-action-feedback" role="status">
                    {{ actionFeedback }}
                  </p>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[1].name"
                      v-bind:src="sourceAsset(data.bestSellers[1].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[1].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[1].originalPrice }}</del
                    >{{ data.bestSellers[1].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[2].name"
                      v-bind:src="sourceAsset(data.bestSellers[2].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[2].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[2].originalPrice }}</del
                    >{{ data.bestSellers[2].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[3].name"
                      v-bind:src="sourceAsset(data.bestSellers[3].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[3].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[3].originalPrice }}</del
                    >{{ data.bestSellers[3].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[4].name"
                      v-bind:src="sourceAsset(data.bestSellers[4].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[4].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[4].originalPrice }}</del
                    >{{ data.bestSellers[4].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[5].name"
                      v-bind:src="sourceAsset(data.bestSellers[5].sourceImage)"
                    />
                    <span class="lable hot">Hot</span>
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[5].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[5].originalPrice }}</del
                    >{{ data.bestSellers[5].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[6].name"
                      v-bind:src="sourceAsset(data.bestSellers[6].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[6].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[6].originalPrice }}</del
                    >{{ data.bestSellers[6].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[7].name"
                      v-bind:src="sourceAsset(data.bestSellers[7].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[7].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[7].originalPrice }}</del
                    >{{ data.bestSellers[7].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[8].name"
                      v-bind:src="sourceAsset(data.bestSellers[8].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[8].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[8].originalPrice }}</del
                    >{{ data.bestSellers[8].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.bestSellers[9].name"
                      v-bind:src="sourceAsset(data.bestSellers[9].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.bestSellers[9].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.bestSellers[9].originalPrice }}</del
                    >{{ data.bestSellers[9].price }}
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  <section class="p-15px bg-dark-gray text-white">
    <div class="container">
      <div class="row">
        <div class="col-12 text-center">
          <span class="fs-15 text-uppercase fw-500"
            >Take an extra 25% discount our favorite dress style. Use code:<span
              class="fs-14 fw-700 lh-28 alt-font text-dark-gray text-uppercase bg-base-color d-inline-block border-radius-30px ps-15px pe-15px ms-5px align-middle"
              >fw205</span
            ></span
          >
        </div>
      </div>
    </div>
  </section>
  <section class="bg-very-light-gray overflow-hidden position-relative ps-3 xs-ps-0">
    <div class="container-fluid">
      <div class="row align-items-center">
        <div class="col-lg-3 ps-5 pe-5 xl-pe-0 lg-ps-0 text-center text-lg-start md-mb-40px">
          <div class="mb-10px">
            <span class="text-dark-gray fw-500 text-highlight"
              >Lookbook 2023<span class="bg-base-color h-8px bottom-0px"></span
            ></span>
          </div>
          <h2 class="alt-font lh-50 text-dark-gray ls-minus-1px mb-15px">
            New arrival <span class="fw-600">collection</span>
          </h2>
          <p class="xs-pe-15px xs-ps-15px">
            Flash summer sale 70% off on selected collection for him.
          </p>
          <a href="/" data-fashion-2-route class="btn btn-dark-gray btn-box-shadow btn-medium"
            >View collection</a
          >
        </div>
        <div class="col-12 col-lg-9 position-relative">
          <div
            class="outside-box-right-10 lg-outside-box-right-20 md-outside-box-right-25 xs-outside-box-right-0"
          >
            <div
              class="swiper slider-three-slide"
              data-slider-options='{ "slidesPerView": 1, "spaceBetween": 30, "loop": true, "autoplay": { "delay": 4000, "disableOnInteraction": false }, "pagination": { "el": ".slider-four-slide-pagination-1", "clickable": true, "dynamicBullets": false }, "keyboard": { "enabled": true, "onlyInViewport": true }, "breakpoints": { "1400": { "slidesPerView": 4 }, "1024": { "slidesPerView": 3 }, "768": { "slidesPerView": 3 }, "576": { "slidesPerView": 2 }, "320": { "slidesPerView": 1 } }, "effect": "slide" }'
            >
              <div class="swiper-wrapper">
                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[0].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[0].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[0].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[0].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[1].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[1].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[1].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[1].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[2].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[2].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[2].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[2].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[3].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[3].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[3].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[3].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[0].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[0].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[0].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[0].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[1].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[1].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[1].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[1].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[2].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[2].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[2].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[2].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>

                <div class="swiper-slide">
                  <div
                    class="interactive-banner-style-09 border-radius-6px overflow-hidden position-relative"
                  >
                    <img alt="" v-bind:src="sourceAsset(data.collection[3].sourceImage)" />
                    <div class="opacity-full bg-gradient-gray-light-dark-transparent"></div>
                    <div
                      class="image-content h-100 w-100 ps-15 pe-15 pt-11 pb-11 lg-p-11 d-flex justify-content-bottom align-items-start flex-column"
                    >
                      <div
                        class="mt-auto d-flex align-items-start w-100 z-index-1 position-relative overflow-hidden flex-column"
                      >
                        <span class="text-white fw-500 fs-22">{{ data.collection[3].name }}</span>
                        <span
                          class="content-title text-white fs-14 fw-500 opacity-7 text-uppercase ls-05px"
                          >{{ data.collection[3].subtitle }}</span
                        >
                        <a
                          href="/"
                          data-fashion-2-route
                          class="content-title-hover fs-14 lh-24 fw-500 ls-05px text-uppercase text-white opacity-6 text-decoration-line-bottom"
                          >Explore collection</a
                        >
                        <span
                          class="content-arrow lh-50 rounded-circle bg-base-color w-50px h-50px ms-20px text-center"
                          ><i class="bi bi-arrow-right-short text-dark-gray icon-very-medium"></i
                        ></span>
                      </div>
                      <div
                        class="position-absolute left-0px top-0px w-100 h-100 bg-gradient-regal-blue-transparent opacity-9"
                      ></div>
                      <div class="box-overlay bg-gradient-gray-light-dark-transparent"></div>
                      <a
                        href="/"
                        data-fashion-2-route
                        v-bind:aria-label="'Explore ' + data.collection[3].name"
                        class="position-absolute z-index-1 top-0px left-0px h-100 w-100"
                      ></a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      class="fs-180 lg-fs-150 md-fs-130 fw-700 position-absolute bottom-minus-50px md-bottom-minus-40px ls-minus-5px left-0px right-0px text-center w-100 opacity-1 d-none d-md-block"
      data-bottom-top="transform:scale(1, 1) translate3d(0px, 0px, 0px);"
      data-top-bottom="transform:scale(1, 1) translate3d(-100px, 0px, 0px);"
    >
      new collection
    </div>
  </section>
  <section class="half-section border-bottom border-color-extra-medium-gray">
    <div class="container">
      <div
        class="row row-cols-2 row-cols-md-5 row-cols-sm-3 position-relative justify-content-center"
        data-anime='{ "el": "childs", "translateY": [-15, 0], "scale": [0.8, 1], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
      >
        <div class="col text-center sm-mb-30px">
          <a href="/" data-fashion-2-route
            ><img
              class="h-30px"
              v-bind:alt="data.brands[0].name"
              v-bind:src="sourceAsset(data.brands[0].sourceImage)"
          /></a>
        </div>

        <div class="col text-center sm-mb-30px">
          <a href="/" data-fashion-2-route
            ><img
              class="h-30px"
              v-bind:alt="data.brands[1].name"
              v-bind:src="sourceAsset(data.brands[1].sourceImage)"
          /></a>
        </div>

        <div class="col text-center sm-mb-30px">
          <a href="/" data-fashion-2-route
            ><img
              class="h-30px"
              v-bind:alt="data.brands[2].name"
              v-bind:src="sourceAsset(data.brands[2].sourceImage)"
          /></a>
        </div>

        <div class="col text-center xs-mb-30px">
          <a href="/" data-fashion-2-route
            ><img
              class="h-30px"
              v-bind:alt="data.brands[3].name"
              v-bind:src="sourceAsset(data.brands[3].sourceImage)"
          /></a>
        </div>

        <div class="col text-center">
          <a href="/" data-fashion-2-route
            ><img
              class="h-30px"
              v-bind:alt="data.brands[4].name"
              v-bind:src="sourceAsset(data.brands[4].sourceImage)"
          /></a>
        </div>
      </div>
    </div>
  </section>
  <section class="ps-7 pe-7 pb-3 lg-ps-3 lg-pe-3 md-pb-5 xs-px-0">
    <div class="container">
      <div class="row mb-5 xs-mb-8">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            Featured
            <span class="text-highlight fw-600"
              >products<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ul
            class="shop-modern shop-wrapper grid-loading grid grid-5col lg-grid-3col sm-grid-2col xs-grid-1col gutter-extra-large text-center"
            data-anime='{ "el": "childs", "translateY": [-15, 0], "opacity": [0,1], "duration": 300, "delay": 0, "staggervalue": 100, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer"></li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.featuredProducts[0].name"
                      v-bind:src="sourceAsset(data.featuredProducts[0].sourceImage)"
                    />
                    <span class="lable new">New</span>
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.featuredProducts[0].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.featuredProducts[0].originalPrice }}</del
                    >{{ data.featuredProducts[0].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.featuredProducts[1].name"
                      v-bind:src="sourceAsset(data.featuredProducts[1].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.featuredProducts[1].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.featuredProducts[1].originalPrice }}</del
                    >{{ data.featuredProducts[1].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.featuredProducts[2].name"
                      v-bind:src="sourceAsset(data.featuredProducts[2].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.featuredProducts[2].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.featuredProducts[2].originalPrice }}</del
                    >{{ data.featuredProducts[2].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.featuredProducts[3].name"
                      v-bind:src="sourceAsset(data.featuredProducts[3].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.featuredProducts[3].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.featuredProducts[3].originalPrice }}</del
                    >{{ data.featuredProducts[3].price }}
                  </div>
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="shop-box mb-10px">
                <div class="shop-image mb-20px">
                  <a href="/" data-fashion-2-route>
                    <img
                      v-bind:alt="data.featuredProducts[4].name"
                      v-bind:src="sourceAsset(data.featuredProducts[4].sourceImage)"
                    />
                    <div class="shop-overlay bg-gradient-gray-light-dark-transparent"></div>
                  </a>
                  <div class="shop-buttons-wrap">
                    <button
                      type="button"
                      aria-label="Add to cart"
                      class="alt-font btn btn-small btn-box-shadow btn-white btn-round-edge left-icon add-to-cart"
                      @click="addToCart"
                    >
                      <i class="feather icon-feather-shopping-bag"></i
                      ><span class="quick-view-text button-text">Add to cart</span>
                    </button>
                  </div>
                  <div class="shop-hover d-flex justify-content-center">
                    <ul>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Add to wishlist"
                          aria-label="Add to wishlist"
                          @click="addToWishlist"
                        >
                          <i class="feather icon-feather-heart fs-16"></i>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          class="w-40px h-40px bg-white text-dark-gray d-flex align-items-center justify-content-center rounded-circle ms-5px me-5px"
                          data-bs-toggle="tooltip"
                          data-bs-placement="left"
                          title="Quick shop"
                          aria-label="Quick shop"
                          @click="openQuickView"
                        >
                          <i class="feather icon-feather-eye fs-16"></i>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div class="shop-footer text-center">
                  <a href="/" data-fashion-2-route class="alt-font text-dark-gray fs-19 fw-500">{{
                    data.featuredProducts[4].name
                  }}</a>
                  <div class="price lh-22 fs-16">
                    <del>{{ data.featuredProducts[4].originalPrice }}</del
                    >{{ data.featuredProducts[4].price }}
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  <section class="p-0 border-top border-bottom border-color-extra-medium-gray">
    <div class="container-fluid">
      <div class="row position-relative">
        <div
          class="col swiper text-center swiper-width-auto"
          data-slider-options='{ "slidesPerView": "auto", "spaceBetween":0, "speed": 10000, "loop": true, "pagination": { "el": ".slider-four-slide-pagination-2", "clickable": false }, "allowTouchMove": false, "autoplay": { "delay":0, "disableOnInteraction": false }, "navigation": { "nextEl": ".slider-four-slide-next-2", "prevEl": ".slider-four-slide-prev-2" }, "keyboard": { "enabled": true, "onlyInViewport": true }, "effect": "slide" }'
        >
          <div class="swiper-wrapper marquee-slide">
            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[0] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[1] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[2] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[3] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[4] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[5] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[6] }}
              </div>
            </div>

            <div class="swiper-slide">
              <div
                class="alt-font fs-26 fw-500 text-dark-gray border-color-extra-medium-gray border-end pt-30px pb-30px ps-60px pe-60px sm-p-25px"
              >
                {{ data.marquee[7] }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="pb-3 ps-7 pe-7 lg-ps-3 lg-pe-3 xs-px-0">
    <div class="container">
      <div class="row mb-4 xs-mb-7">
        <div class="col-12 text-center">
          <h2 class="alt-font text-dark-gray mb-0 ls-minus-2px">
            Fashion
            <span class="text-highlight fw-600"
              >magazine<span class="bg-base-color h-5px bottom-2px"></span
            ></span>
          </h2>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <ul
            class="blog-classic blog-wrapper grid-loading grid grid-4col xl-grid-4col lg-grid-3col md-grid-2col sm-grid-2col xs-grid-1col gutter-extra-large"
            data-anime='{ "el": "childs", "translateY": [15, 0], "translateX": [-15, 0], "opacity": [0,1], "duration": 500, "delay": 300, "staggervalue": 300, "easing": "easeOutQuad" }'
          >
            <li class="grid-sizer"></li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a href="/" data-fashion-2-route
                    ><img
                      v-bind:alt="data.magazine[0].name"
                      v-bind:src="sourceAsset(data.magazine[0].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      href="/"
                      data-fashion-2-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[0].author }}</a
                    ><a href="/" data-fashion-2-route class="blog-date">{{
                      data.magazine[0].date
                    }}</a></span
                  >
                  <a
                    href="/"
                    data-fashion-2-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[0].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a href="/" data-fashion-2-route
                    ><img
                      v-bind:alt="data.magazine[1].name"
                      v-bind:src="sourceAsset(data.magazine[1].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      href="/"
                      data-fashion-2-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[1].author }}</a
                    ><a href="/" data-fashion-2-route class="blog-date">{{
                      data.magazine[1].date
                    }}</a></span
                  >
                  <a
                    href="/"
                    data-fashion-2-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[1].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a href="/" data-fashion-2-route
                    ><img
                      v-bind:alt="data.magazine[2].name"
                      v-bind:src="sourceAsset(data.magazine[2].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      href="/"
                      data-fashion-2-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[2].author }}</a
                    ><a href="/" data-fashion-2-route class="blog-date">{{
                      data.magazine[2].date
                    }}</a></span
                  >
                  <a
                    href="/"
                    data-fashion-2-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[2].name }}</a
                  >
                </div>
              </div>
            </li>

            <li class="grid-item">
              <div class="card bg-transparent border-0 h-100">
                <div class="blog-image position-relative overflow-hidden">
                  <a href="/" data-fashion-2-route
                    ><img
                      v-bind:alt="data.magazine[3].name"
                      v-bind:src="sourceAsset(data.magazine[3].sourceImage)"
                  /></a>
                </div>
                <div class="card-body px-0 pt-30px pb-30px sm-pb-15px">
                  <span class="mb-5px d-block"
                    >By
                    <a
                      href="/"
                      data-fashion-2-route
                      class="text-dark-gray fw-500 categories-text"
                      >{{ data.magazine[3].author }}</a
                    ><a href="/" data-fashion-2-route class="blog-date">{{
                      data.magazine[3].date
                    }}</a></span
                  >
                  <a
                    href="/"
                    data-fashion-2-route
                    class="alt-font card-title fs-20 lh-30 fw-500 text-dark-gray d-inline-block w-75 xl-w-85 lg-w-100"
                    >{{ data.magazine[3].name }}</a
                  >
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  <footer class="footer-dark bg-dark-gray p-0">
    <div class="container">
      <div class="row align-items-center pt-35px pb-35px">
        <div class="col-12 col-md-auto sm-mb-15px text-center text-md-start">
          <a href="/" data-fashion-2-route class="footer-logo" aria-label="Lifestyle home"
            ><img
              alt=""
              class="default-logo"
              v-bind:src="sourceAsset('images/demo-fashion-store-logo-white.png')"
              v-bind:data-at2x="sourceAsset('images/demo-fashion-store-logo-white@2x.png')"
          /></a>
        </div>

        <div class="col">
          <ul class="footer-navbar text-center text-md-end">
            <li class="nav-item"><a href="/" data-fashion-2-route class="nav-link">Home</a></li>
            <li class="nav-item"><a href="/" data-fashion-2-route class="nav-link">Shop</a></li>
            <li class="nav-item">
              <a href="/" data-fashion-2-route class="nav-link">Collection</a>
            </li>
            <li class="nav-item"><a href="/" data-fashion-2-route class="nav-link">Magazine</a></li>
            <li class="nav-item"><a href="/" data-fashion-2-route class="nav-link">About</a></li>
            <li class="nav-item"><a href="/" data-fashion-2-route class="nav-link">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="row justify-content-center fs-15 lh-28 pb-50px xs-pb-35px">
        <div class="col-12 mb-50px sm-mb-35px">
          <div
            class="divider-style-03 divider-style-03-01 border-color-transparent-white-light"
          ></div>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Categories</span>
          <ul>
            <li><a href="/" data-fashion-2-route>Men</a></li>
            <li><a href="/" data-fashion-2-route>Women</a></li>
            <li><a href="/" data-fashion-2-route>Accessories</a></li>
            <li><a href="/" data-fashion-2-route>Shoes</a></li>
            <li><a href="/" data-fashion-2-route>Dresses</a></li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Information</span>
          <ul>
            <li><a href="/" data-fashion-2-route>About us</a></li>
            <li><a href="/" data-fashion-2-route>Contact us</a></li>
            <li><a href="/" data-fashion-2-route>Terms &amp; conditions</a></li>
            <li><a href="/" data-fashion-2-route>Shipping &amp; delivery</a></li>
            <li><a href="/" data-fashion-2-route>Privacy policy</a></li>
          </ul>
        </div>

        <div class="col-6 col-lg-2 col-sm-4 xs-mb-30px order-sm-3 order-lg-2">
          <span class="fw-500 d-block text-white mb-5px fs-17">Quick links</span>
          <ul>
            <li><a href="/" data-fashion-2-route>My account</a></li>
            <li><a href="/" data-fashion-2-route>Orders tracking</a></li>
            <li><a href="/" data-fashion-2-route>Our store</a></li>
            <li><a href="/" data-fashion-2-route>Size guide</a></li>
            <li><a href="/" data-fashion-2-route>FAQs</a></li>
          </ul>
        </div>

        <div
          class="col-6 col-lg-3 col-md-4 col-sm-5 md-mb-50px xs-mb-30px order-sm-2 order-lg-2 offset-md-2 offset-lg-0"
        >
          <span class="fw-500 d-block text-white mb-10px fs-17">Quick contact</span>
          <div>
            <i class="feather icon-feather-phone-call fs-16 text-white me-10px xs-me-5px"></i
            ><a href="tel:1234567890">123 456 7890</a>
          </div>
          <div class="mb-15px">
            <i class="feather icon-feather-mail fs-16 text-white me-10px xs-me-5px"></i
            ><a href="mailto:info@domain.com" class="text-decoration-line-bottom"
              >info@domain.com</a
            >
          </div>
          <span class="fw-500 d-block text-white mb-5px fs-17">Connect with us</span>
          <div class="elements-social social-icon-style-02">
            <ul class="light">
              <li>
                <a
                  class="facebook"
                  href="https://www.facebook.com/"
                  target="_blank"
                  aria-label="Facebook"
                  ><i class="fa-brands fa-facebook-f"></i
                ></a>
              </li>
              <li>
                <a
                  class="dribbble"
                  href="http://www.dribbble.com"
                  target="_blank"
                  aria-label="Dribbble"
                  ><i class="fa-brands fa-dribbble"></i
                ></a>
              </li>
              <li>
                <a
                  class="twitter"
                  href="http://www.twitter.com"
                  target="_blank"
                  aria-label="Twitter"
                  ><i class="fa-brands fa-twitter"></i
                ></a>
              </li>
              <li>
                <a
                  class="instagram"
                  href="http://www.instagram.com"
                  target="_blank"
                  aria-label="Instagram"
                  ><i class="fa-brands fa-instagram"></i
                ></a>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="col-lg-3 col-md-6 col-sm-7 ps-20px sm-ps-15px md-mb-50px xs-mb-0 order-sm-1 order-lg-5"
        >
          <span class="fw-500 d-block text-white mb-5px fs-17">Become a member</span>
          <div class="mb-15px">Join now and get 20% extra discount!</div>
          <div class="d-inline-block w-100 newsletter-style-04 position-relative mb-15px">
            <form action="#" method="post" class="position-relative w-100" v-on:submit.prevent="">
              <input
                class="input-small bg-nero-grey border-radius-4px fs-14 border-color-transparent w-100 form-control pe-50px ps-20px lg-ps-15px required"
                type="email"
                name="email"
                placeholder="Enter your email"
              />
              <input type="hidden" name="redirect" value="" />
              <button class="btn pe-20px submit" aria-label="submit">
                <i class="icon bi bi-envelope icon-small text-white"></i>
              </button>
              <div
                class="form-results border-radius-4px pt-5px pb-5px ps-15px pe-15px fs-14 lh-22 mt-10px w-100 text-center position-absolute d-none"
              ></div>
            </form>
          </div>
          <div class="footer-card">
            <a
              href="/"
              data-fashion-2-route
              class="d-inline-block me-5px align-middle"
              aria-label="Visa payment information"
              ><img alt="" v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-01.png')"
            /></a>
            <a
              href="/"
              data-fashion-2-route
              class="d-inline-block me-5px align-middle"
              aria-label="PayPal payment information"
              ><img alt="" v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-02.png')"
            /></a>
            <a
              href="/"
              data-fashion-2-route
              class="d-inline-block me-5px align-middle"
              aria-label="Mastercard payment information"
              ><img alt="" v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-03.png')"
            /></a>
            <a
              href="/"
              data-fashion-2-route
              class="d-inline-block me-5px align-middle"
              aria-label="American Express payment information"
              ><img alt="" v-bind:src="sourceAsset('images/demo-decor-store-payment-icon-04.png')"
            /></a>
          </div>
        </div>
      </div>
    </div>
    <div class="pt-30px pb-30px bg-nero-grey">
      <div class="container">
        <div class="row align-items-center fs-15">
          <div
            class="col-12 col-lg-7 last-paragraph-no-margin md-mb-15px text-center text-lg-start lh-22"
          >
            <p>
              This site is protected by reCAPTCHA and the Google
              <a href="/" data-fashion-2-route class="text-white text-decoration-line-bottom"
                >privacy policy</a
              >
              and
              <a href="/" data-fashion-2-route class="text-white text-decoration-line-bottom"
                >terms of service.</a
              >
            </p>
          </div>
          <div class="col-12 col-lg-5 text-center text-lg-end lh-22">
            <span
              >© 2024 Crafto is Proudly Powered by
              <a
                href="https://www.themezaa.com/"
                target="_blank"
                class="text-decoration-line-bottom text-white"
                >ThemeZaa</a
              ></span
            >
          </div>
        </div>
      </div>
    </div>
  </footer>
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
        data-fashion-2-route
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
    <a href="/" data-fashion-2-route class="scroll-top" aria-label="scroll">
      <span class="scroll-text">Scroll</span
      ><span class="scroll-line"><span class="scroll-point"></span></span>
    </a>
  </div>
</template>
