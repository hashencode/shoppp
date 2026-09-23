import type { AddCartLineRequest } from "@shoppp/contracts";
import type { PreviewAction } from "../../../theme-engine/actions";
import type {
  PresentationProductCard,
  PresentationViewModel,
} from "../../../theme-engine/view-models";
import type { FashionStoreIconName } from "../icons/ui";
import type { FashionStoreLegacyProductCard } from "./product-card";

export interface FashionStoreAboutData {
  accordion: readonly { body: string; title: string }[];
  announcement: string;
  brandLogos: readonly string[];
  carouselImages: readonly string[];
  story: { body: readonly string[]; eyebrow: string };
  timeline: readonly { body: string; number: string; title: string }[];
}

export interface FashionStoreFaqCategory {
  label: string;
  questions: readonly { body: string; title: string }[];
}

export interface FashionStoreFaqData {
  announcement: string;
  categories: readonly FashionStoreFaqCategory[];
}

export interface FashionStoreContactData {
  announcement: string;
  locations: readonly {
    address: readonly string[];
    city: string;
    email: string;
    name: string;
    phone: string;
  }[];
  privacyCopy: string;
}

export interface FashionStoreMagazinePost {
  author: string;
  date: string;
  sourceImage: string;
  title: string;
}

export interface FashionStoreMagazineData {
  announcement: string;
  pagination: { active: string; pages: readonly string[] };
  posts: readonly FashionStoreMagazinePost[];
}

export interface FashionStoreArticleComment {
  author: string;
  date: string;
  depth: 0 | 1;
  sourceImage: string;
  text: string;
}

export interface FashionStoreArticleData {
  announcement: string;
  author: { bio: string; name: string; role: string; sourceImage: string };
  comments: readonly FashionStoreArticleComment[];
  lead: { author: string; category: string; date: string; title: string };
  media: readonly string[];
  related: readonly FashionStoreMagazinePost[];
  shareLinks: readonly { href: string; icon: FashionStoreIconName; label: string }[];
}

export interface FashionStoreWishlistData {
  actions: { cart: PreviewAction; remove: PreviewAction };
  announcement: string;
  products: readonly FashionStoreLegacyProductCard[];
}

export interface FashionStoreAccountData {
  announcement: string;
  privacyCopy: string;
}

export interface FashionStoreContentData {
  account: FashionStoreAccountData;
  about: FashionStoreAboutData;
  article: FashionStoreArticleData;
  contact: FashionStoreContactData;
  faq: FashionStoreFaqData;
  magazine: FashionStoreMagazineData;
  wishlist: FashionStoreWishlistData;
}

export type FashionStoreContentRouteKey = keyof FashionStoreContentData;

export interface FashionStoreContentStatePresentation {
  action?: { label: string; target?: string };
  heading: string;
  media?: Extract<PresentationViewModel, { kind: "state" }>["media"];
  message: string;
  products: readonly PresentationProductCard[];
  relatedAction?: { label: string; target?: string };
  state: PresentationViewModel["state"];
}

export interface FashionStoreContentPresentation<K extends FashionStoreContentRouteKey> {
  detail?: FashionStoreContentData[K];
  state: FashionStoreContentStatePresentation;
}

export function resolveFashionStoreLiveContactPresentation(
  viewModel: PresentationViewModel,
  route: FashionStoreContentRouteKey,
): Extract<PresentationViewModel, { kind: "released-content" | "state" }> | undefined {
  return route === "contact" && "publicContact" in viewModel && viewModel.publicContact
    ? viewModel
    : undefined;
}

export function resolveFashionStoreReleasedContentPresentation(
  viewModel: PresentationViewModel,
): Extract<PresentationViewModel, { kind: "released-content" }> | undefined {
  return viewModel.kind === "released-content" ? viewModel : undefined;
}

const routeHeading: Record<FashionStoreContentRouteKey, string> = {
  account: "My account",
  about: "About",
  article: "Article",
  contact: "Contact",
  faq: "FAQs",
  magazine: "Magazine",
  wishlist: "Wishlist",
};

export function resolveFashionStoreContentPresentation<K extends FashionStoreContentRouteKey>(
  viewModel: PresentationViewModel,
  route: K,
): FashionStoreContentPresentation<K> {
  if (viewModel.kind === "theme-section") {
    const content = viewModel.data as unknown as FashionStoreContentData;
    const detail = content[route];
    if (!detail) throw new Error(`Missing Fashion Store ${route} fixture content.`);
    return {
      detail,
      state: {
        heading: routeHeading[route],
        message: "",
        products: [],
        state: viewModel.state,
      },
    };
  }
  if (viewModel.kind === "collection-grid" && route === "wishlist") {
    return {
      state: {
        action: { label: "Continue shopping", target: "/shop" },
        heading: viewModel.heading,
        message:
          viewModel.products.length > 0
            ? "Saved wishlists are not available yet. Browse these published products instead."
            : "Saved wishlists are not available yet, and no recovery products are currently published.",
        products: viewModel.products,
        state: viewModel.state,
      },
    };
  }
  if (viewModel.kind !== "state") {
    throw new Error(`Unsupported Fashion Store ${route} presentation: ${viewModel.kind}.`);
  }
  return {
    state: {
      action: viewModel.action,
      heading: viewModel.heading,
      media: viewModel.media,
      message: viewModel.message,
      products: [],
      relatedAction: viewModel.relatedAction,
      state: viewModel.state,
    },
  };
}

export function buildFashionStoreWishlistPreviewCartRequest(): AddCartLineRequest {
  return {
    expectedUnitPrice: { amount: 6_500, currency: "USD" },
    quantity: 1,
    releaseId: "representative-release-2026-07-30",
    variantId: "var_01JFSHIRTBLUEM00000000001",
  };
}
