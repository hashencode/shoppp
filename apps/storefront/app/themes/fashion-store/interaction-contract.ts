import {
  storefrontInteractionContractRowSchema,
  type StorefrontInteractionContractRow,
  type StorefrontInteractionDisposition,
} from "@shoppp/contracts";

import type { ThemeBehaviorContract } from "../../../e2e/support/theme-behavior-contract";
import { fashionStorePageBehaviorContracts } from "./behavior-contract";
import { fashionStoreDestinations } from "./destinations";
import { fashionStorePageContracts } from "./page-contracts";

const local = (control: string): StorefrontInteractionDisposition => ({
  control,
  kind: "local-state",
});
const unavailable = (reason: string): StorefrontInteractionDisposition => ({
  kind: "unavailable",
  reason,
});
const route = (path: string): StorefrontInteractionDisposition => ({
  kind: "internal-navigation",
  target: { kind: "route", path },
});
const external = (url: string): StorefrontInteractionDisposition => ({
  kind: "external-navigation",
  target: { kind: "external", url },
});
const resource = (
  resourceKind: "collection" | "product",
  idSource: string,
): StorefrontInteractionDisposition =>
  resourceKind === "product"
    ? {
        kind: "internal-navigation",
        target: {
          idSource,
          kind: "resource",
          resourceKind: "product",
          routeFamily: "catalog-product",
        },
      }
    : {
        kind: "internal-navigation",
        target: {
          idSource,
          kind: "resource",
          resourceKind: "collection",
          routeFamily: "catalog-collection",
        },
      };
const commerce = (
  intent: Extract<StorefrontInteractionDisposition, { kind: "commerce-intent" }>["intent"],
  ...idSources: string[]
): StorefrontInteractionDisposition => ({ idSources, intent, kind: "commerce-intent" });
interface SemanticDefinition {
  candidate: string;
  disposition: StorefrontInteractionDisposition;
}
const affordance = (
  candidate: string,
  disposition: StorefrontInteractionDisposition,
): SemanticDefinition => ({ candidate, disposition });

function inputOutcomes(
  outcome: string,
  fallback: string,
  branches: ThemeBehaviorContract["behaviors"][number]["branches"] = [],
) {
  const branch = (input: "keyboard" | "mouse" | "touch") =>
    branches.find((candidate) => candidate.input === input)?.outcome ?? outcome;
  return {
    keyboard: branch("keyboard"),
    noJs: fallback,
    pointer: branch("mouse"),
    reducedMotion: fallback,
    touch: branch("touch"),
  };
}

const semanticDispositionByBehavior = {
  "about-accordion-state": [
    affordance(".fashion-about-mission .fashion-accordion-trigger", local("about-accordion")),
  ],
  "about-carousel-motion": [affordance(".fashion-about-carousel", local("about-carousel"))],
  "account-login-validation": [
    affordance(
      ".fashion-account-login",
      unavailable(
        "Customer accounts and password recovery are not available; fixture validation remains Design QA only.",
      ),
    ),
  ],
  "account-register-validation": [
    affordance(
      ".fashion-account-register",
      unavailable(
        "Customer registration and account policy acceptance are not available; fixture validation remains Design QA only.",
      ),
    ),
  ],
  "article-comment-validation": [
    affordance(
      "#comments form",
      unavailable("Article comments have no live persistence capability and remain read-only."),
    ),
  ],
  "article-content-navigation": [
    affordance(
      ".fashion-article-related a[data-fashion-store-route]",
      route("/magazine/marketing-tips-and-tricks"),
    ),
    affordance("a[href='#comments']", {
      kind: "internal-navigation",
      target: { kind: "fragment", target: "#comments" },
    }),
    affordance(".fashion-article-like, .likes-count", local("article-like-presentation")),
  ],
  "article-external-sharing": [
    affordance(".fashion-article-share a.facebook", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.facebook },
    }),
    affordance(".fashion-article-share a.twitter", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.twitter },
    }),
    affordance(".fashion-article-share a.instagram", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.instagram },
    }),
    affordance(".fashion-article-share a.linkedin", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.linkedin },
    }),
    affordance(".fashion-article-share a.behance", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.behance },
    }),
  ],
  "back-to-top-control": local("back-to-top"),
  "cart-line-mutations": [
    affordance(".cart-products .quantity", commerce("cart.quantity", "variantId", "quantity")),
    affordance(".cart-products .product-remove", commerce("cart.remove", "variantId")),
  ],
  "cart-local-controls": [
    affordance(".coupon-code-panel", local("cart-local-controls")),
    affordance("[data-empty-cart]", commerce("cart.remove", "variantIds")),
    affordance("[data-local-cart-action='update-presentation']", local("cart-local-controls")),
  ],
  "cart-shipping-calculator": [
    affordance(".calculate-shipping", local("cart-shipping-calculator")),
  ],
  "checkout-dependent-fields": [
    affordance(".fashion-checkout-billing", local("checkout-dependent-fields")),
    affordance(".fashion-checkout-helper-trigger", local("checkout-helper-panel")),
  ],
  "checkout-payment-accordion": local("checkout-payment"),
  "checkout-session-progression": [
    affordance("[data-fashion-store-checkout] form", commerce("checkout.start", "cartId")),
    affordance(".your-order-box input", local("checkout-payment-selection")),
    affordance(".your-order-box .btn", commerce("checkout.start", "cartId")),
  ],
  "collection-card-state": [affordance(".categories-style-02", local("collection-card-state"))],
  "collection-category-navigation": resource("collection", "collectionId"),
  "contact-form-validation": [
    affordance(
      "[data-fashion-store-contact] form",
      unavailable(
        "Contact submission has no backend capability; published contact destinations remain available.",
      ),
    ),
  ],
  "contact-map-fallback": local("contact-map-fallback"),
  "desktop-social-rail": [
    affordance(".sticky-wrap a.facebook", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.facebook },
    }),
    affordance(".sticky-wrap a.dribbble", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.dribbble },
    }),
    affordance(".sticky-wrap a.twitter", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.twitter },
    }),
    affordance(".sticky-wrap a.instagram", {
      kind: "external-navigation",
      target: { kind: "external", url: fashionStoreDestinations.instagram },
    }),
  ],
  "faq-accordion-state": [
    affordance(".fashion-faq-content .fashion-accordion-trigger", local("faq-accordion")),
  ],
  "faq-category-tabs": [
    affordance(".fashion-faq-content [role='tab']", local("faq-category-tabs")),
  ],
  "footer-sticky-reveal": local("footer-sticky-reveal"),
  "header-cart-preview": [
    affordance(".header-cart > button", local("header-cart-preview")),
    affordance(
      ".header-cart[data-fashion-store-commerce-mode='live'] .cart-item > button.close",
      commerce("cart.remove", "variantId"),
    ),
    affordance(".header-cart a[href='/cart']", route("/cart")),
    affordance(".header-cart a[href='/checkout']", route("/checkout")),
  ],
  "header-search-overlay": [
    affordance(".header-search-form", local("header-search-trigger")),
    affordance(".search-form-wrapper", local("header-search-dialog")),
  ],
  "header-shop-navigation": [
    affordance("header a.nav-link[href='/shop']", route("/shop")),
    affordance("header .dropdown-toggle", local("header-dropdown")),
    affordance("header .navbar-toggler", local("header-mobile-navigation")),
    affordance("header button.nav-link", local("header-pages-navigation")),
  ],
  "hero-carousel": [
    affordance(".swiper.full-screen", local("hero-carousel")),
    affordance("[data-fashion-store-slide]", local("hero-carousel")),
  ],
  "hero-native-cursor": [
    affordance(".swiper.full-screen:not(.magic-cursor)", local("hero-native-cursor")),
  ],
  "magazine-article-navigation": route("/magazine/marketing-tips-and-tricks"),
  "magazine-card-state": [
    affordance(".fashion-magazine-grid .grid-item", local("magazine-card-state")),
  ],
  "magazine-pagination-presentation": local("magazine-pagination"),
  "new-arrival-collection-carousel": local("new-arrival-carousel"),
  "product-card-actions": [
    affordance(
      ".shop-modern .grid-item .shop-image > a, .shop-modern .grid-item a.add-to-cart[data-fashion-store-route]",
      resource("product", "productId"),
    ),
    affordance(
      ".shop-modern .grid-item button.add-to-cart",
      commerce("cart.add", "productId", "variantId"),
    ),
    affordance(
      ".shop-modern .grid-item [aria-label*='wishlist']",
      unavailable("Wishlist persistence is not available in live mode."),
    ),
    affordance(".shop-modern .grid-item [aria-label*='Quick']", local("product-quick-view")),
  ],
  "product-commerce-actions": [
    affordance(".btn-cart", commerce("cart.add", "productId", "variantId")),
    affordance(".wishlist", unavailable("Wishlist persistence is not available in live mode.")),
  ],
  "product-gallery": local("product-gallery"),
  "product-options": [
    affordance(".fashion-product-options", commerce("variant.select", "productId", "variantId")),
    affordance(".product-info .quantity", local("product-quantity")),
  ],
  "product-tabs-reviews": [
    affordance("#tab .nav-link", local("product-tabs")),
    affordance(
      "#tab form",
      unavailable("Product review submission is not available in live mode."),
    ),
  ],
  "promotional-marquee": local("promotional-marquee"),
  "scroll-progress-indicator": local("scroll-progress"),
  "shop-filters": [
    affordance(".shop-sidebar ul.shop-filter button", local("shop-filters")),
    affordance(".shop-sidebar .tag-cloud button", local("shop-filters")),
  ],
  "shop-new-arrivals": local("shop-new-arrivals"),
  "shop-product-actions": [
    affordance(
      ".shop-modern .grid-item .shop-image > a, .shop-modern .grid-item .shop-footer > a, .shop-modern .grid-item a.add-to-cart[data-fashion-store-route]",
      resource("product", "productId"),
    ),
    affordance(
      ".shop-modern .grid-item button.add-to-cart",
      commerce("cart.add", "productId", "variantId"),
    ),
    affordance(
      ".shop-modern .grid-item [aria-label*='wishlist']",
      unavailable("Wishlist persistence is not available in live mode."),
    ),
    affordance(".shop-modern .grid-item [aria-label*='Quick']", local("product-quick-view")),
  ],
  "wishlist-local-removal": [affordance(".fashion-wishlist-remove", local("wishlist-removal"))],
  "wishlist-product-actions": [
    affordance(
      ".shop-buttons-wrap button.add-to-cart",
      commerce("cart.add", "productId", "variantId"),
    ),
    affordance(
      ".shop-footer a, .shop-buttons-wrap a.add-to-cart[data-fashion-store-route]",
      resource("product", "productId"),
    ),
  ],
} as const satisfies Record<
  string,
  StorefrontInteractionDisposition | readonly SemanticDefinition[]
>;

function roleFor(
  disposition: StorefrontInteractionDisposition,
): StorefrontInteractionContractRow["role"] {
  if (disposition.kind === "commerce-intent") return "commerce";
  if (disposition.kind === "contact-navigation") return "contact";
  if (disposition.kind === "external-navigation") return "external-navigation";
  if (disposition.kind === "internal-navigation") return "navigation";
  if (disposition.kind === "unavailable" || disposition.kind === "deferred") return "unavailable";
  return "local-state";
}

function behaviorRows(): unknown[] {
  return fashionStorePageBehaviorContracts.flatMap((contract) =>
    (contract as ThemeBehaviorContract).behaviors.flatMap((behavior) => {
      const semantic =
        semanticDispositionByBehavior[behavior.id as keyof typeof semanticDispositionByBehavior];
      if (!semantic) {
        throw new Error(
          `${contract.routeId}:${behavior.id} is missing a semantic interaction disposition.`,
        );
      }
      const breakpoints = behavior.branches.flatMap(({ breakpoint }) =>
        breakpoint ? [breakpoint] : [],
      );
      const definitions: readonly SemanticDefinition[] = Array.isArray(semantic)
        ? semantic
        : [affordance(behavior.sourceCandidate, semantic as StorefrontInteractionDisposition)];
      const evidence = behavior.evidenceStates.flatMap(({ fidelityState, namedState }) =>
        namedState?.id ? [namedState.id] : fidelityState ? [fidelityState] : [],
      );
      return definitions.map(({ candidate, disposition }, index) => ({
        behaviorId: behavior.id,
        breakpoints: breakpoints.length > 0 ? breakpoints : ["all"],
        candidate,
        disposition,
        evidence: evidence.length > 0 ? evidence : [`${behavior.id}-outcome`],
        fallback: behavior.fallback.outcome,
        id: `${contract.routeId}-${behavior.id}${definitions.length > 1 ? `-${index + 1}` : ""}`,
        inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
        inputOutcomes: inputOutcomes(
          behavior.outcome,
          behavior.fallback.outcome,
          behavior.branches,
        ),
        outcome: behavior.outcome,
        owner: behavior.owner,
        parity: ["structural", "behavioral", "absence"],
        role: roleFor(disposition),
        routeId: contract.routeId,
      }));
    }),
  );
}

const sharedRows = [
  {
    behaviorId: "shared-footer-email",
    breakpoints: ["all"],
    candidate: "footer a[href^='mailto:']",
    disposition: {
      kind: "contact-navigation",
      target: { kind: "contact", uri: fashionStoreDestinations.supportEmail },
    },
    evidence: ["footer-email-destination"],
    fallback: "The native mail client destination remains available without JavaScript.",
    id: "fashion-store-footer-email",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The platform mail handler opens the published address.",
      "The native mailto destination remains available without JavaScript.",
    ),
    outcome: "The published email address opens through the platform mail handler.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "contact",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-footer-phone",
    breakpoints: ["all"],
    candidate: "footer a[href^='tel:']",
    disposition: {
      kind: "contact-navigation",
      target: { kind: "contact", uri: fashionStoreDestinations.phone },
    },
    evidence: ["footer-phone-destination"],
    fallback: "The native telephone destination remains available without JavaScript.",
    id: "fashion-store-footer-phone",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The platform call handler opens the published number.",
      "The native telephone destination remains available without JavaScript.",
    ),
    outcome: "The published telephone number opens through the platform call handler.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "contact",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-content-email",
    breakpoints: ["all"],
    candidate: "main a[href^='mailto:']",
    disposition: {
      kind: "contact-navigation",
      target: { kind: "contact", uri: fashionStoreDestinations.supportEmail },
    },
    evidence: ["content-email-destination"],
    fallback: "The native mail client destination remains available without JavaScript.",
    id: "fashion-store-content-email",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The platform mail handler opens the published address.",
      "The native mailto destination remains available without JavaScript.",
    ),
    outcome: "The published content email opens through the platform mail handler.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "contact",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-content-phone",
    breakpoints: ["all"],
    candidate: "main a[href^='tel:']",
    disposition: {
      kind: "contact-navigation",
      target: { kind: "contact", uri: fashionStoreDestinations.phone },
    },
    evidence: ["content-phone-destination"],
    fallback: "The native telephone destination remains available without JavaScript.",
    id: "fashion-store-content-phone",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The platform call handler opens the published number.",
      "The native telephone destination remains available without JavaScript.",
    ),
    outcome: "The published content telephone opens through the platform call handler.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "contact",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-unresolved-catalog-shortcuts",
    breakpoints: ["all"],
    candidate: "a[data-fashion-store-route]:not([href])",
    disposition: unavailable(
      "Only the explicit Home links resolve to /. Category, store, tracking, guide, and payment shortcuts require published references before activation.",
    ),
    evidence: ["unresolved-shortcuts-unavailable"],
    fallback: "Unresolved shortcuts must render without an active navigation target.",
    id: "fashion-store-unresolved-catalog-shortcuts",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "Unresolved shortcuts have no active target or click behavior.",
      "Unresolved shortcuts remain plain text without JavaScript.",
    ),
    outcome: "Only explicit Home controls navigate to /; unresolved shortcuts remain unavailable.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "unavailable",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-skip-link",
    breakpoints: ["all"],
    candidate: ".skip-link[href='#fashion-store-main']",
    disposition: {
      kind: "internal-navigation",
      target: { kind: "fragment", target: "#fashion-store-main" },
    },
    evidence: ["skip-link-destination"],
    fallback: "The native fragment destination remains available without JavaScript.",
    id: "fashion-store-skip-link",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "Focus and reading position move to the Fashion Store main content.",
      "The native fragment destination remains available without JavaScript.",
    ),
    outcome: "The skip link moves directly to the Fashion Store main content.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "navigation",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-header-instagram",
    breakpoints: ["desktop"],
    candidate: "header a[href='https://www.instagram.com/']",
    disposition: external(fashionStoreDestinations.instagram),
    evidence: ["header-instagram-destination"],
    fallback: "The HTTPS Instagram destination remains available without JavaScript.",
    id: "fashion-store-header-instagram",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The browser opens the published Instagram destination.",
      "The native HTTPS destination remains available without JavaScript.",
    ),
    outcome: "The header social control opens the published Instagram destination.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "external-navigation",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-mini-cart-fixture-removal",
    breakpoints: ["all"],
    candidate: ".header-cart[data-fashion-store-commerce-mode='fixture'] .cart-item > button.close",
    disposition: unavailable(
      "Fixture preview cart lines are presentation-only; no Commerce mutation is implied.",
    ),
    evidence: ["fixture-mini-cart-removal-unavailable"],
    fallback: "Fixture preview lines remain presentation-only without JavaScript.",
    id: "fashion-store-mini-cart-fixture-removal",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The preview control remains visibly unavailable for a Commerce mutation.",
      "Fixture preview lines remain static without JavaScript.",
    ),
    outcome: "Fixture mini-cart removal does not claim or issue a Commerce mutation.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "unavailable",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-cookie-consent",
    breakpoints: ["all"],
    candidate: "#cookies-model .accept_cookies_btn",
    disposition: local("cookie-consent"),
    evidence: ["cookie-banner-dismissed"],
    fallback: "The cookie policy link remains available without JavaScript.",
    id: "fashion-store-cookie-consent",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The local cookie notice closes without a network request.",
      "The notice remains visible and its policy link stays usable without JavaScript.",
    ),
    outcome: "Accepting the local notice dismisses it for the current rendered session.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "local-state",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-review-fragment",
    breakpoints: ["all"],
    candidate: "[data-fashion-store-product] a[href='#tab']",
    disposition: {
      kind: "internal-navigation",
      target: { kind: "fragment", target: "#tab" },
    },
    evidence: ["product-review-fragment"],
    fallback: "The native product review fragment remains available without JavaScript.",
    id: "fashion-store-product-review-fragment",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The browser moves to the product information tabs.",
      "The native review fragment remains available without JavaScript.",
    ),
    outcome: "The review summary moves to the product information tabs.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "navigation",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-secondary-actions",
    breakpoints: ["all"],
    candidate: "[data-fashion-store-product] .fashion-product-secondary-actions button",
    disposition: local("product-secondary-actions"),
    evidence: ["product-secondary-action-state"],
    fallback: "Secondary product labels remain readable without JavaScript.",
    id: "fashion-store-product-secondary-actions",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The chosen secondary action is recorded as local fixture state only.",
      "Secondary product labels remain static without JavaScript.",
    ),
    outcome: "Compare, question, and share controls update only observable local fixture state.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "local-state",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-card-navigation",
    breakpoints: ["all"],
    candidate: ".shop-modern .grid-item [data-fashion-store-route]",
    disposition: resource("product", "productId"),
    evidence: ["shared-product-card-destination"],
    fallback: "The native product destination remains available without JavaScript.",
    id: "fashion-store-shared-product-card-navigation",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The browser opens the bound product resource.",
      "The native product destination remains available without JavaScript.",
    ),
    outcome: "Product-card links open their bound product resource.",
    owner: "nuxt-routing",
    parity: ["structural", "behavioral", "absence"],
    role: "navigation",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-card-cart",
    breakpoints: ["all"],
    candidate: ".shop-modern .grid-item button.add-to-cart",
    disposition: commerce("cart.add", "productId", "variantId"),
    evidence: ["shared-product-card-cart-intent"],
    fallback: "Product details remain readable without JavaScript; no cart mutation is claimed.",
    id: "fashion-store-shared-product-card-cart",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "A typed cart intent is dispatched only when a live Commerce owner exists.",
      "No cart mutation is claimed without JavaScript.",
    ),
    outcome: "The product card dispatches one typed cart-add intent.",
    owner: "nuxt-commerce",
    parity: ["structural", "behavioral", "absence"],
    role: "commerce",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-card-utilities",
    breakpoints: ["all"],
    candidate:
      ".shop-modern .grid-item [aria-label*='wishlist'], .shop-modern .grid-item button[aria-label*='Quick']",
    disposition: unavailable(
      "Wishlist persistence and product quick-view content are not published capabilities.",
    ),
    evidence: ["shared-product-card-utilities-unavailable"],
    fallback: "Product links and labels remain readable without JavaScript.",
    id: "fashion-store-shared-product-card-utilities",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "Unavailable utilities issue no persistence request or success claim.",
      "Product links remain usable without JavaScript.",
    ),
    outcome: "Unpublished product-card utilities remain explicitly unavailable.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "unavailable",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-product-lightbox",
    breakpoints: ["all"],
    candidate: ".fashion-product-lightbox button",
    disposition: local("product-lightbox"),
    evidence: ["product-lightbox-controls"],
    fallback: "Gallery images remain visible in source order without JavaScript.",
    id: "fashion-store-product-lightbox",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The local image preview closes or changes its active gallery image.",
      "Gallery images remain visible without JavaScript.",
    ),
    outcome: "Lightbox controls update only the local product gallery state.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "local-state",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-shop-pagination",
    breakpoints: ["all"],
    candidate: "[data-fashion-store-shop] .pagination button",
    disposition: local("shop-pagination"),
    evidence: ["shop-pagination-state"],
    fallback: "The currently rendered product set remains readable without JavaScript.",
    id: "fashion-store-shop-pagination",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The selected fixture page becomes the active local presentation state.",
      "The first rendered fixture page remains readable without JavaScript.",
    ),
    outcome: "Pagination changes only the deterministic local fixture presentation.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "local-state",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-footer-newsletter",
    breakpoints: ["all"],
    candidate: "footer form",
    disposition: unavailable(
      "Newsletter delivery has no backend capability and the source PHP endpoint is not simulated.",
    ),
    evidence: ["footer-newsletter-unavailable"],
    fallback: "The newsletter field remains visibly unavailable without JavaScript.",
    id: "fashion-store-footer-newsletter",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "Submitting the fixture form issues no request and claims no subscription.",
      "The field remains visible but cannot claim delivery without JavaScript.",
    ),
    outcome: "The fixture newsletter form does not claim or issue a backend subscription.",
    owner: "fashion-store",
    parity: ["structural", "behavioral", "absence"],
    role: "unavailable",
    routeId: "fashion-store-shared",
  },
  {
    behaviorId: "shared-source-credit",
    breakpoints: ["all"],
    candidate: "footer a[href='https://www.themezaa.com/']",
    disposition: external("https://www.themezaa.com/"),
    evidence: ["source-credit-destination"],
    fallback: "The native HTTPS credit destination remains available without JavaScript.",
    id: "fashion-store-source-credit",
    inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
    inputOutcomes: inputOutcomes(
      "The browser opens the source credit destination.",
      "The native HTTPS destination remains available without JavaScript.",
    ),
    outcome: "The source credit opens its credential-free HTTPS destination.",
    owner: "browser-navigation",
    parity: ["structural", "behavioral", "absence"],
    role: "external-navigation",
    routeId: "fashion-store-shared",
  },
] as const satisfies readonly StorefrontInteractionContractRow[];

const sharedFooterSocialRows = [
  ["facebook", fashionStoreDestinations.facebook],
  ["dribbble", fashionStoreDestinations.dribbble],
  ["twitter", fashionStoreDestinations.twitter],
  ["instagram", fashionStoreDestinations.instagram],
] as const;

const parsedSharedFooterSocialRows = sharedFooterSocialRows.map(([name, url]) => ({
  behaviorId: `shared-footer-${name}`,
  breakpoints: ["all"],
  candidate: `footer .elements-social a.${name}[href='${url}']`,
  disposition: external(url),
  evidence: [`footer-${name}-destination`],
  fallback: `The native HTTPS ${name} destination remains available without JavaScript.`,
  id: `fashion-store-footer-${name}`,
  inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
  inputOutcomes: inputOutcomes(
    `The browser opens the published ${name} destination.`,
    `The native HTTPS ${name} destination remains available without JavaScript.`,
  ),
  outcome: `The footer ${name} control opens its declared HTTPS destination.`,
  owner: "browser-navigation",
  parity: ["structural", "behavioral", "absence"],
  role: "external-navigation",
  routeId: "fashion-store-shared",
}));

const sharedNavigationPaths = [
  ...new Set([
    ...fashionStorePageContracts.map(({ path }) => path),
    "/policies/cookies",
    "/policies/privacy",
    "/policies/shipping",
    "/policies/terms",
  ]),
];

const unlinkedSharedRoutes = new Set(["/shop/no-sidebar", "/shop/right-sidebar"]);

const sharedNavigationRows = sharedNavigationPaths.flatMap((path, index) =>
  unlinkedSharedRoutes.has(path)
    ? []
    : [
        {
          behaviorId: `shared-route-${index + 1}`,
          breakpoints: ["all"],
          candidate: `a[data-fashion-store-route][href='${path}']`,
          disposition: route(path),
          evidence: [`shared-route-${index + 1}-destination`],
          fallback: `The native ${path} destination remains available without JavaScript.`,
          id: `fashion-store-shared-route-${index + 1}`,
          inputModes: ["pointer", "keyboard", "touch", "reduced-motion", "no-js"],
          inputOutcomes: inputOutcomes(
            `The browser opens the exact ${path} destination.`,
            `The native ${path} destination remains available without JavaScript.`,
          ),
          outcome: `The control opens the exact ${path} destination.`,
          owner: "browser-navigation",
          parity: ["structural", "behavioral", "absence"],
          role: "navigation",
          routeId: "fashion-store-shared",
        },
      ],
);

export const fashionStoreInteractionContract = Object.freeze(
  [...behaviorRows(), ...sharedRows, ...parsedSharedFooterSocialRows, ...sharedNavigationRows].map(
    (row) => storefrontInteractionContractRowSchema.parse(row),
  ),
);

export interface RenderedInteractionCandidateEvidence {
  candidate: string;
  interactionIds: readonly string[];
  routeId: string;
}

export function assertFashionStoreRenderedInteractionCoverage(
  candidates: readonly RenderedInteractionCandidateEvidence[],
  interactions: readonly StorefrontInteractionContractRow[],
): void {
  const knownIds = new Set(interactions.map(({ id }) => id));
  const issues = candidates.flatMap(({ candidate, interactionIds, routeId }) => {
    const unknownIds = interactionIds.filter((id) => !knownIds.has(id));
    if (unknownIds.length > 0) {
      return [`${routeId}:${candidate} references unknown rows ${unknownIds.join(", ")}`];
    }
    if (interactionIds.length !== 1) {
      return [
        `${routeId}:${candidate} must map to exactly one semantic row; found ${interactionIds.length}`,
      ];
    }
    return [];
  });
  if (issues.length > 0) throw new Error(issues.join("\n"));
}

export function assertFashionStoreInteractionContractComplete(
  interactions: readonly StorefrontInteractionContractRow[],
  behaviorContracts: readonly ThemeBehaviorContract[],
): void {
  const issues: string[] = [];
  const ids = new Set<string>();
  const behaviorKeys = new Map<string, number>();
  for (const row of interactions) {
    if (ids.has(row.id)) issues.push(`duplicate interaction ID ${row.id}`);
    ids.add(row.id);
    const key = `${row.routeId}:${row.behaviorId}`;
    behaviorKeys.set(key, (behaviorKeys.get(key) ?? 0) + 1);
  }
  for (const contract of behaviorContracts) {
    for (const behavior of contract.behaviors) {
      const key = `${contract.routeId}:${behavior.id}`;
      const matches = behaviorKeys.get(key) ?? 0;
      if (matches < 1) issues.push(`${key} has no semantic interaction row`);
    }
  }
  if (issues.length > 0) throw new Error(issues.join("\n"));
}

assertFashionStoreInteractionContractComplete(
  fashionStoreInteractionContract,
  fashionStorePageBehaviorContracts,
);
