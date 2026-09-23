import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { PreviewAction } from "../../../../theme-engine/actions";
import type { SectionInstance } from "@shoppp/contracts";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { homeViewModelSchema } from "../../../../theme-engine/view-models";
import { fashionStoreAssetId } from "../../resources";
import { fashionStoreHomeDataSchema, type FashionStoreHomeData } from "../../fixtures/home";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";
import {
  buildFashionStoreMerchandisingGroups,
  fashionStoreMerchandisingDataSchema,
  resolveFashionStoreMerchandising,
} from "../../contracts/home-merchandising";
import {
  fashionStoreHomeBrands,
  fashionStoreHomeCategories,
  fashionStoreHomeCollectionImages,
  fashionStoreHomeMarquee,
  fashionStoreHomeMagazine,
  fashionStoreHomeServices,
} from "./home-content";
import { fashionStoreRoutePaths } from "../../page-contracts";
import {
  fashionStoreBlockReferenceId,
  resolveFashionStoreBlockReferenceHref,
} from "../../contracts/block-destinations";

export interface FashionStoreHomeSectionProperties {
  instance: SectionInstance;
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}

export interface FashionStoreHomeSectionContext {
  merchandising?: ReturnType<typeof resolveFashionStoreMerchandising>;
  presentation: ReturnType<typeof resolveFashionStoreHomePresentation>;
  state: PresentationViewModel["state"];
}

type LiveHomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

export interface FashionStoreHomeFoundationPresentation {
  brands: readonly { name: string; sourceImage: string }[];
  marquee: readonly string[];
  promotion:
    | { badge: string; kind: "badge"; message: string }
    | { href: string; kind: "link"; label: string; message: string; resourceId?: string };
  services: readonly {
    description: string;
    icon: "package" | "refresh-cw" | "credit-card" | "phone";
    title: string;
  }[];
}

export interface FashionStoreHomeEditorialPresentation {
  categories: readonly {
    href: string;
    itemCount?: string;
    name: string;
    resourceId?: string;
    sourceImage: string;
  }[];
  collection: {
    description?: string;
    eyebrow: string;
    href: string;
    items: readonly { name: string; sourceImage: string; subtitle?: string }[];
    title: { emphasis?: string; lead: string };
  };
  magazine: readonly {
    articleHref: string;
    author?: string;
    date?: string;
    indexHref: string;
    name: string;
    resourceId?: string;
    sourceImage: string;
  }[];
}

const parsedFixtureHome = new WeakMap<object, FashionStoreHomeData>();
const parsedLiveHome = new WeakMap<object, LiveHomeViewModel>();

export function isLiveHomeViewModel(viewModel: PresentationViewModel): boolean {
  return (
    viewModel.kind === "home" ||
    (viewModel.kind === "theme-section" &&
      homeViewModelSchema.safeParse(viewModel.data.home).success)
  );
}

export function resolveFixtureHomeData(viewModel: PresentationViewModel): FashionStoreHomeData {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store fixture Home Section requires a theme-section ViewModel.");
  }
  const source = viewModel.data.home ?? viewModel.data;
  if (typeof source !== "object" || source === null)
    return fashionStoreHomeDataSchema.parse(source);
  const cached = parsedFixtureHome.get(source);
  if (cached) return cached;
  const parsed = fashionStoreHomeDataSchema.parse(source);
  parsedFixtureHome.set(source, parsed);
  return parsed;
}

export function resolveLiveHomeData(viewModel: PresentationViewModel): LiveHomeViewModel {
  if (viewModel.kind === "home") return viewModel;
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store live Home Section requires a theme-section ViewModel.");
  }
  const source = viewModel.data.home;
  if (typeof source !== "object" || source === null) return homeViewModelSchema.parse(source);
  const cached = parsedLiveHome.get(source);
  if (cached) return cached;
  const parsed = homeViewModelSchema.parse(source);
  parsedLiveHome.set(source, parsed);
  return parsed;
}

function fixtureFoundation(data: FashionStoreHomeData): FashionStoreHomeFoundationPresentation {
  const icons = ["package", "refresh-cw", "credit-card", "phone"] as const;
  return {
    brands: data.brands,
    marquee: data.marquee,
    promotion: {
      badge: "fw205",
      kind: "badge",
      message: "Take an extra 25% discount our favorite dress style. Use code:",
    },
    services: data.services.map((service, index) => ({ ...service, icon: icons[index]! })),
  };
}

function liveFoundation(data: LiveHomeViewModel): FashionStoreHomeFoundationPresentation {
  const icons = ["package", "credit-card", "refresh-cw", "phone"] as const;
  return {
    brands: fashionStoreHomeBrands.map(([name, sourceImage]) => ({ name, sourceImage })),
    marquee: fashionStoreHomeMarquee,
    promotion: {
      href: data.featuredCollection.href,
      kind: "link",
      label: "Shop the collection",
      message: "New-season pieces are available now.",
    },
    services: fashionStoreHomeServices.map(([title, description], index) => ({
      description,
      icon: icons[index]!,
      title,
    })),
  };
}

export function resolveFashionStoreHomeFoundation(
  viewModel: PresentationViewModel,
  instance?: SectionInstance,
): FashionStoreHomeFoundationPresentation {
  const fallback = isLiveHomeViewModel(viewModel)
    ? liveFoundation(resolveLiveHomeData(viewModel))
    : fixtureFoundation(resolveFixtureHomeData(viewModel));
  if (!instance || !isLiveHomeViewModel(viewModel)) return fallback;
  const visible = instance.blocks.filter(({ visible }) => visible);
  const text = (block: (typeof visible)[number], key: string) =>
    typeof block.settings[key] === "string" ? block.settings[key] : "";
  const assetPath = (block: (typeof visible)[number]) => {
    const value = block.settings.image;
    return typeof value === "object" && value !== null && "kind" in value && value.kind === "theme"
      ? value.path
      : "";
  };
  return {
    brands: visible
      .filter(({ type }) => type === "fashion-store.brand")
      .map((block) => ({ name: text(block, "name"), sourceImage: assetPath(block) })),
    marquee: visible
      .filter(({ type }) => type === "fashion-store.marquee-item")
      .map((block) => text(block, "message")),
    promotion: (() => {
      const block = visible.find(({ type }) => type === "fashion-store.promotion-item");
      return block
        ? {
            href:
              resolveFashionStoreBlockReferenceHref(
                isLiveHomeViewModel(viewModel) ? resolveLiveHomeData(viewModel) : null,
                block,
                "collection",
                "collection",
              ) ?? "",
            kind: "link" as const,
            label: text(block, "label"),
            message: text(block, "message"),
            resourceId: fashionStoreBlockReferenceId(block, "collection", "collection"),
          }
        : { badge: "", kind: "badge" as const, message: "" };
    })(),
    services: visible
      .filter(({ type }) => type === "fashion-store.service")
      .map((block) => ({
        description: text(block, "description"),
        icon: (["package", "refresh-cw", "credit-card", "phone"].includes(text(block, "variant"))
          ? text(block, "variant")
          : "package") as "package" | "refresh-cw" | "credit-card" | "phone",
        title: text(block, "title"),
      })),
  };
}

export function resolveFashionStoreHomeEditorial(
  viewModel: PresentationViewModel,
  instance?: SectionInstance,
): FashionStoreHomeEditorialPresentation {
  if (instance) {
    if (!isLiveHomeViewModel(viewModel)) {
      const data = resolveFixtureHomeData(viewModel);
      return {
        categories: data.categories.map((category) => ({
          ...category,
          href: fashionStoreRoutePaths.collection,
        })),
        collection: {
          description: "Flash summer sale 70% off on selected collection for him.",
          eyebrow: "Lookbook 2023",
          href: fashionStoreRoutePaths.collection,
          items: data.collection,
          title: { emphasis: "collection", lead: "New arrival" },
        },
        magazine: data.magazine.map((entry) => ({
          ...entry,
          articleHref: fashionStoreRoutePaths.article,
          indexHref: fashionStoreRoutePaths.magazine,
        })),
      };
    }
    const visible = instance.blocks.filter(({ visible }) => visible);
    const text = (block: (typeof visible)[number], key: string) =>
      typeof block.settings[key] === "string" ? block.settings[key] : "";
    const sourceImage = (block: (typeof visible)[number]) => {
      const value = block.settings.image;
      return typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        value.kind === "theme"
        ? value.path
        : "";
    };
    const live = isLiveHomeViewModel(viewModel) ? resolveLiveHomeData(viewModel) : null;
    return {
      categories: visible
        .filter(({ type }) => type === "fashion-store.category")
        .map((block) => ({
          href:
            resolveFashionStoreBlockReferenceHref(live, block, "collection", "collection") ?? "",
          name: text(block, "name"),
          resourceId: fashionStoreBlockReferenceId(block, "collection", "collection"),
          sourceImage: sourceImage(block),
        })),
      collection: {
        eyebrow: "Curated for you",
        href: live?.featuredCollection.href ?? fashionStoreRoutePaths.collection,
        items: fashionStoreHomeCollectionImages.map((image, index) => ({
          name: live?.featuredCollection.name ?? "Collection",
          sourceImage: image,
          subtitle: `Look ${index + 1}`,
        })),
        title: { lead: live?.featuredCollection.name ?? "New arrival" },
      },
      magazine: visible
        .filter(({ type }) => type === "fashion-store.editorial-card")
        .map((block) => ({
          articleHref:
            resolveFashionStoreBlockReferenceHref(live, block, "article", "article") ?? "",
          indexHref: fashionStoreRoutePaths.magazine,
          name: text(block, "title"),
          resourceId: fashionStoreBlockReferenceId(block, "article", "article"),
          sourceImage: sourceImage(block),
        })),
    };
  }
  if (isLiveHomeViewModel(viewModel)) {
    const data = resolveLiveHomeData(viewModel);
    return {
      categories: fashionStoreHomeCategories.map(([name, sourceImage]) => ({
        href: data.featuredCollection.href,
        name,
        sourceImage,
      })),
      collection: {
        eyebrow: "Curated for you",
        href: data.featuredCollection.href,
        items: fashionStoreHomeCollectionImages.map((sourceImage, index) => ({
          name: data.featuredCollection.name,
          sourceImage,
          subtitle: `Look ${index + 1}`,
        })),
        title: { lead: data.featuredCollection.name },
      },
      magazine: fashionStoreHomeMagazine.map(([name, sourceImage]) => ({
        articleHref: fashionStoreRoutePaths.article,
        indexHref: fashionStoreRoutePaths.magazine,
        name,
        sourceImage,
      })),
    };
  }

  const data = resolveFixtureHomeData(viewModel);
  return {
    categories: data.categories.map((category) => ({
      ...category,
      href: fashionStoreRoutePaths.collection,
    })),
    collection: {
      description: "Flash summer sale 70% off on selected collection for him.",
      eyebrow: "Lookbook 2023",
      href: fashionStoreRoutePaths.collection,
      items: data.collection,
      title: { emphasis: "collection", lead: "New arrival" },
    },
    magazine: data.magazine.map((entry) => ({
      ...entry,
      articleHref: fashionStoreRoutePaths.article,
      indexHref: fashionStoreRoutePaths.magazine,
    })),
  };
}

export function resolveFashionStoreHomeProductActions(
  viewModel: PresentationViewModel,
): Partial<Record<"cart" | "quickView" | "wishlist", PreviewAction>> {
  if (isLiveHomeViewModel(viewModel)) {
    return {};
  }
  const data = resolveFixtureHomeData(viewModel);
  return {
    cart: data.cartAction,
    quickView: data.quickViewAction,
    wishlist: data.wishlistAction,
  };
}

export function resolveFashionStoreHomeSectionContext(
  viewModel: PresentationViewModel,
): FashionStoreHomeSectionContext {
  let merchandising: ReturnType<typeof resolveFashionStoreMerchandising> | undefined;
  if (viewModel.kind === "theme-section" && viewModel.data.merchandising !== undefined) {
    merchandising = resolveFashionStoreMerchandising(viewModel);
  } else if (isLiveHomeViewModel(viewModel)) {
    const home = resolveLiveHomeData(viewModel);
    merchandising =
      home.state === "populated"
        ? {
            data: fashionStoreMerchandisingDataSchema.parse({
              groups: buildFashionStoreMerchandisingGroups(home.products, home.featuredProduct),
            }),
            state: "populated",
          }
        : { state: home.state };
  } else if (
    viewModel.kind === "theme-section" &&
    viewModel.data.sectionType === "fashion-store.products"
  ) {
    const home = resolveFixtureHomeData(viewModel);
    const normalizeInput = (product: FashionStoreHomeData["bestSellers"][number], id: string) => ({
      ...product,
      categories: [],
      colors: [],
      id,
      sizes: [],
      tags: [],
    });
    const bestSellers = home.bestSellers.map((product, index) =>
      normalizeInput(product, `fashion-store-merchandising-${index + 1}`),
    );
    const featured = home.featuredProducts.map((product, index) =>
      normalizeInput(product, `fashion-store-featured-${index + 1}`),
    );
    merchandising = {
      data: fashionStoreMerchandisingDataSchema.parse({
        groups: [
          { id: "new-arrivals", products: bestSellers.slice(-8).reverse() },
          { id: "best-sellers", products: bestSellers },
          { id: "featured", products: featured },
        ],
      }),
      state: "populated",
    };
  }
  return {
    ...(merchandising ? { merchandising } : {}),
    presentation:
      viewModel.kind === "theme-section"
        ? resolveFashionStoreHomePresentation(viewModel)
        : resolveFashionStoreHomePresentation({
            data: {},
            kind: "theme-section",
            state: viewModel.state,
          }),
    state: viewModel.state,
  };
}

export function resolveHomeAsset(resolveAsset: ThemeAssetResolver, sourcePath: string): string {
  return resolveAsset(fashionStoreAssetId(sourcePath));
}
