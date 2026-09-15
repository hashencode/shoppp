import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { SectionInstance } from "@shoppp/contracts";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { homeViewModelSchema } from "../../../../theme-engine/view-models";
import { fashionStoreAssetId } from "../../resources";
import { fashionStoreHomeDataSchema, type FashionStoreHomeData } from "../../fixtures/home";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";
import { resolveFashionStoreMerchandising } from "../../contracts/home-merchandising";
import {
  fashionStoreHomeBrands,
  fashionStoreHomeMarquee,
  fashionStoreHomeServices,
} from "./home-content";

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
    | { href: string; kind: "link"; label: string; message: string };
  services: readonly {
    description: string;
    icon: "package" | "refresh-cw" | "credit-card" | "phone";
    title: string;
  }[];
}

const parsedFixtureHome = new WeakMap<object, FashionStoreHomeData>();
const parsedLiveHome = new WeakMap<object, LiveHomeViewModel>();

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
): FashionStoreHomeFoundationPresentation {
  const live =
    viewModel.kind === "home" ||
    (viewModel.kind === "theme-section" &&
      homeViewModelSchema.safeParse(viewModel.data.home).success);
  return live
    ? liveFoundation(resolveLiveHomeData(viewModel))
    : fixtureFoundation(resolveFixtureHomeData(viewModel));
}

export function resolveFashionStoreHomeSectionContext(
  viewModel: PresentationViewModel,
): FashionStoreHomeSectionContext {
  const merchandising =
    viewModel.kind === "theme-section" && Object.hasOwn(viewModel.data, "merchandising")
      ? resolveFashionStoreMerchandising(viewModel)
      : undefined;
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
