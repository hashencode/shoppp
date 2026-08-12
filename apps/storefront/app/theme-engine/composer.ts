import {
  canonicalCatalogReleaseSchema,
  catalogResourceBindingSchema,
  experienceSnapshotSchema,
  presentationCollectionSchema,
  presentationProductSchema,
  type CanonicalCatalogRelease,
  type CatalogResourceBinding,
  type ExperienceSnapshot,
  type PageTemplate,
} from "@shoppp/contracts";

import { normalizeThemeRoutePath, type ResolvedThemeRouteContract } from "./routes";
import { formatCommerceMoney } from "./runtime-commerce";
import { presentationViewModelSchema, type PresentationViewModel } from "./view-models";

type CatalogProduct = CanonicalCatalogRelease["products"][number];
type CatalogCollection = CanonicalCatalogRelease["collections"][number];

export type CompositionDiagnosticCode =
  | "catalog-binding-ambiguous"
  | "catalog-binding-missing"
  | "catalog-reference-missing"
  | "catalog-reference-unpublished"
  | "catalog-reference-wrong-kind"
  | "catalog-release-not-canonical"
  | "route-not-found";

export interface CompositionDiagnostic {
  code: CompositionDiagnosticCode;
  message: string;
  pageId: string;
  path: string;
  referenceId?: string;
  referenceKind?: "collection" | "product";
  sectionId?: string;
  settingId?: string;
}

export interface ComposedExperienceRoute {
  diagnostics: CompositionDiagnostic[];
  locale: string;
  ok: boolean;
  pageId: string;
  path: string;
  releaseId: string;
  template?: PageTemplate;
  viewModels: Readonly<Record<string, PresentationViewModel>>;
}

export interface ComposeExperienceRouteInput {
  experience: ExperienceSnapshot;
  locale: string;
  path: string;
  release: CanonicalCatalogRelease;
  route: ResolvedThemeRouteContract;
}

function matchingTemplate(
  experience: ExperienceSnapshot,
  route: ResolvedThemeRouteContract,
): { pageId: string; template?: PageTemplate } {
  const stableId = route.parameters?.productId ?? route.parameters?.collectionId;
  return {
    pageId: stableId ? `${route.pageType}:${stableId}` : route.id,
    template: experience.resolvedTemplates.find(({ pageType }) => pageType === route.pageType),
  };
}

function referenceDiagnostic(
  productsById: ReadonlyMap<string, CatalogProduct>,
  collectionsById: ReadonlyMap<string, CatalogCollection>,
  binding: CatalogResourceBinding,
): Pick<CompositionDiagnostic, "code" | "message"> | undefined {
  const sameKind =
    binding.reference.kind === "product"
      ? productsById.get(binding.reference.id)
      : collectionsById.get(binding.reference.id);
  if (!sameKind) {
    const wrongKind =
      binding.reference.kind === "product"
        ? collectionsById.has(binding.reference.id)
        : productsById.has(binding.reference.id);
    return wrongKind
      ? {
          code: "catalog-reference-wrong-kind",
          message: `Catalog reference ${binding.reference.id} exists with a different kind.`,
        }
      : {
          code: "catalog-reference-missing",
          message: `Catalog ${binding.reference.kind} ${binding.reference.id} is missing from the selected release.`,
        };
  }
  if (
    sameKind.status !== "published" ||
    (binding.reference.kind === "product" &&
      "variants" in sameKind &&
      !sameKind.variants.some(({ status }) => status === "active"))
  ) {
    return {
      code: "catalog-reference-unpublished",
      message: `Catalog ${binding.reference.kind} ${binding.reference.id} is not publishable in the selected release.`,
    };
  }
  return undefined;
}

function productViewModel(
  release: CanonicalCatalogRelease,
  product: CatalogProduct,
  locale: string,
): PresentationViewModel {
  const variants = product.variants.filter(({ status }) => status === "active");
  const money =
    variants[0]!.prices.find(({ currency }) => currency === release.site.defaultCurrency) ??
    variants[0]!.prices[0]!;
  const resource = presentationProductSchema.parse({
    availability: "unknown",
    id: product.id,
    kind: "product",
    media: product.media,
    money,
    name: product.name,
    slug: product.slug,
    variantIds: variants.map(({ id }) => id),
  });
  return presentationViewModelSchema.parse({
    actions: [
      {
        id: "select-variant",
        intent: "variant.select",
        label: "Select variant",
        value: variants[0]!.id,
      },
    ],
    description: product.description,
    heading: product.name,
    kind: "product",
    media: product.media,
    priceLabel: formatCommerceMoney(money.amount, money.currency, locale),
    resource,
    state: "populated",
    variants: variants.map((variant, index) => ({
      id: variant.id,
      label: variant.title,
      selected: index === 0,
    })),
  });
}

function collectionViewModel(
  collection: CatalogCollection,
  productsById: ReadonlyMap<string, CatalogProduct>,
  defaultCurrency: string,
  locale: string,
): PresentationViewModel {
  const resource = presentationCollectionSchema.parse({
    id: collection.id,
    kind: "collection",
    name: collection.name,
    productIds: collection.productIds,
    slug: collection.slug,
  });
  return presentationViewModelSchema.parse({
    collections: [
      {
        action: {
          id: "open-collection",
          intent: "navigation",
          label: `View ${collection.name}`,
          target: `/collections/${collection.slug}`,
        },
        id: collection.id,
        name: collection.name,
      },
    ],
    heading: collection.name,
    kind: "collection-grid",
    products: collection.productIds.flatMap((productId) => {
      const product = productsById.get(productId);
      const activeVariant = product?.variants.find(({ status }) => status === "active");
      const money =
        activeVariant?.prices.find(({ currency }) => currency === defaultCurrency) ??
        activeVariant?.prices[0];
      if (!product || product.status !== "published" || !activeVariant || !money) return [];
      return [
        {
          href: `/products/${product.slug}`,
          id: product.id,
          media: product.media[0],
          name: product.name,
          priceLabel: formatCommerceMoney(money.amount, money.currency, locale),
        },
      ];
    }),
    resource,
    state: "populated",
  });
}

function transactionViewModel(pageType: "cart" | "checkout"): PresentationViewModel {
  if (pageType === "cart") {
    return presentationViewModelSchema.parse({
      checkoutAction: {
        id: "start-checkout",
        intent: "checkout.start-preview",
        label: "Continue to checkout",
      },
      heading: "Shopping cart",
      kind: "cart",
      lines: [],
      state: "populated",
      subtotalLabel: "Calculated by Commerce",
    });
  }
  return presentationViewModelSchema.parse({
    action: {
      id: "continue-checkout",
      intent: "checkout.start-preview",
      label: "Continue to secure payment",
    },
    heading: "Checkout",
    kind: "checkout",
    state: "populated",
    steps: ["Address", "Delivery", "Payment"],
    summaryLines: ["Your current cart will be verified before payment."],
  });
}

const unavailableContent = {
  account: {
    heading: "Account unavailable",
    message:
      "Customer accounts are not available yet. You can continue shopping without signing in.",
  },
  contact: {
    heading: "Contact information unavailable",
    message: "Merchant contact details have not been published for this Experience.",
  },
  wishlist: {
    heading: "Wishlist unavailable",
    message: "Saved wishlists are not available yet. No products have been stored for this visit.",
  },
} as const;

function contentSettingKey(path: string): string {
  return path.slice(1).replaceAll("/", ".") || "home";
}

function contentViewModel(
  path: string,
  settings: Readonly<Record<string, unknown>>,
): PresentationViewModel {
  const key = contentSettingKey(path);
  const configuredHeading = settings[`${key}.heading`];
  const configuredMessage = settings[`${key}.message`];
  const configured =
    typeof configuredHeading === "string" &&
    configuredHeading.trim().length > 0 &&
    typeof configuredMessage === "string" &&
    configuredMessage.trim().length > 0;
  const unavailable = unavailableContent[key as keyof typeof unavailableContent];
  const fallbackHeading = key
    .split(/[.-]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
  return presentationViewModelSchema.parse({
    action: {
      id: "continue-shopping",
      intent: "navigation",
      label: "Continue shopping",
      target: "/shop",
    },
    heading: configured ? configuredHeading : (unavailable?.heading ?? fallbackHeading),
    kind: "state",
    message: configured
      ? configuredMessage
      : (unavailable?.message ?? "This Experience page has not been published yet."),
    state: configured ? "populated" : "unavailable",
  });
}

export function composeExperienceRoute(
  input: ComposeExperienceRouteInput,
): ComposedExperienceRoute {
  const experience = experienceSnapshotSchema.parse(input.experience);
  const parsedRelease = canonicalCatalogReleaseSchema.safeParse(input.release);
  const path = normalizeThemeRoutePath(input.path);
  if (!parsedRelease.success) {
    return {
      diagnostics: [
        {
          code: "catalog-release-not-canonical",
          message: "Live composition requires a canonical ID-bearing Catalog Release.",
          pageId: path,
          path,
        },
      ],
      locale: input.locale,
      ok: false,
      pageId: path,
      path,
      releaseId: input.release.releaseId,
      viewModels: {},
    };
  }
  const release = parsedRelease.data;
  const productsById = new Map(release.products.map((product) => [product.id, product]));
  const collectionsById = new Map(
    release.collections.map((collection) => [collection.id, collection]),
  );
  const { pageId, template } = matchingTemplate(experience, input.route);
  if (!template) {
    return {
      diagnostics: [
        {
          code: "route-not-found",
          message: `No Experience template resolves ${path} in Catalog Release ${release.releaseId}.`,
          pageId,
          path,
        },
      ],
      locale: input.locale,
      ok: false,
      pageId,
      path,
      releaseId: release.releaseId,
      viewModels: {},
    };
  }

  const diagnostics: CompositionDiagnostic[] = [];
  const viewModels: Record<string, PresentationViewModel> = {};
  const catalogBindingsByInstance = new Map<string, CatalogResourceBinding[]>();
  for (const candidate of experience.bindings) {
    if (candidate.kind !== "catalog") continue;
    const binding = catalogResourceBindingSchema.parse(candidate);
    const bindings = catalogBindingsByInstance.get(binding.instanceId) ?? [];
    bindings.push(binding);
    catalogBindingsByInstance.set(binding.instanceId, bindings);
  }
  const instances = template.sections.flatMap((section) => [section, ...section.blocks]);
  for (const instance of instances.filter(({ visible }) => visible)) {
    if (template.pageType === "cart" || template.pageType === "checkout") {
      viewModels[instance.id] = transactionViewModel(template.pageType);
      continue;
    }
    if (template.pageType === "content") {
      viewModels[instance.id] = contentViewModel(path, instance.settings);
      continue;
    }
    const matches = catalogBindingsByInstance.get(instance.id) ?? [];
    if (matches.length !== 1) {
      diagnostics.push({
        code: matches.length === 0 ? "catalog-binding-missing" : "catalog-binding-ambiguous",
        message:
          matches.length === 0
            ? `Visible instance ${instance.id} is missing a live catalog binding.`
            : `Visible instance ${instance.id} has ambiguous live catalog bindings.`,
        pageId,
        path,
        sectionId: instance.id,
      });
      continue;
    }
    const binding = matches[0]!;
    const invalidReference = referenceDiagnostic(productsById, collectionsById, binding);
    if (invalidReference) {
      diagnostics.push({
        ...invalidReference,
        pageId,
        path,
        referenceId: binding.reference.id,
        referenceKind: binding.reference.kind,
        sectionId: instance.id,
        settingId: binding.settingId,
      });
      continue;
    }
    if (binding.reference.kind === "product") {
      viewModels[instance.id] = productViewModel(
        release,
        productsById.get(binding.reference.id)!,
        input.locale,
      );
    } else {
      viewModels[instance.id] = collectionViewModel(
        collectionsById.get(binding.reference.id)!,
        productsById,
        release.site.defaultCurrency,
        input.locale,
      );
    }
  }
  return {
    diagnostics,
    locale: input.locale,
    ok: diagnostics.length === 0,
    pageId,
    path,
    releaseId: release.releaseId,
    template,
    viewModels,
  };
}
