import {
  assetReferenceSchema,
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  catalogResourceBindingSchema,
  experienceSnapshotSchema,
  presentationCollectionSchema,
  presentationProductSchema,
  storefrontLinkSchema,
  storefrontResourceReferenceSchema,
  themeCompositionDescriptorSchema,
  type CanonicalCatalogRelease,
  type CatalogReleaseV3,
  type CatalogResourceBinding,
  type ExperienceSnapshot,
  type PageTemplate,
  type ThemeCompositionDescriptor,
} from "@shoppp/contracts";

import type { ThemeCompositionAdapter } from "./composition";
import { normalizeThemeRoutePath, type ResolvedThemeRouteContract } from "./routes";
import { formatCommerceMoney } from "./runtime-commerce";
import {
  platformRoutePresentationViewModelSchema,
  presentationShellViewModelSchema,
  productViewModelSchema,
  publicPaymentBrands,
  presentationViewModelSchema,
  type PlatformRoutePresentationViewModel,
  type PresentationProductCard,
  type PresentationShellViewModel,
  type PresentationViewModel,
  type ProductPageModel,
} from "./view-models";

type StorefrontCatalogRelease = CanonicalCatalogRelease | CatalogReleaseV3;
type CatalogProduct = StorefrontCatalogRelease["products"][number];
type CatalogCollection = StorefrontCatalogRelease["collections"][number];

function relatedCollectionForProduct(
  release: StorefrontCatalogRelease,
  product: CatalogProduct,
  collectionId?: string,
): CatalogCollection | undefined {
  return (
    release.collections.find(({ id, status }) => id === collectionId && status === "published") ??
    release.collections.find(
      ({ productIds, status }) => status === "published" && productIds.includes(product.id),
    )
  );
}

function selectedRelatedCollectionId(
  experience: ExperienceSnapshot | undefined,
  instanceId: string | undefined,
): string | undefined {
  for (const binding of experience?.bindings ?? []) {
    if (
      binding.kind === "catalog" &&
      binding.instanceId === instanceId &&
      binding.settingId === "related-collection" &&
      binding.reference.kind === "collection"
    ) {
      return binding.reference.id;
    }
  }
  return undefined;
}

export type CompositionDiagnosticCode =
  | "catalog-binding-ambiguous"
  | "catalog-binding-missing"
  | "catalog-binding-undeclared"
  | "catalog-product-default-currency-missing"
  | "catalog-reference-missing"
  | "catalog-reference-unpublished"
  | "catalog-reference-wrong-kind"
  | "catalog-release-not-canonical"
  | "section-composition-missing"
  | "section-resolver-mismatch"
  | "section-view-model-kind-mismatch"
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
  shell?: PresentationShellViewModel;
  viewModels: Readonly<Record<string, PresentationViewModel>>;
}

export interface ComposeExperienceRouteInput {
  adapter?: ThemeCompositionAdapter;
  experience: ExperienceSnapshot;
  locale: string;
  path: string;
  release: StorefrontCatalogRelease;
  route: ResolvedThemeRouteContract;
  sectionComposition?: ThemeCompositionDescriptor;
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

function bindingForResolvedRoute(
  binding: CatalogResourceBinding,
  route: ResolvedThemeRouteContract,
): CatalogResourceBinding {
  if (binding.reference.kind === "product" && route.parameters?.productId) {
    return {
      ...binding,
      reference: { id: route.parameters.productId, kind: "product" },
    };
  }
  if (binding.reference.kind === "collection" && route.parameters?.collectionId) {
    return {
      ...binding,
      reference: { id: route.parameters.collectionId, kind: "collection" },
    };
  }
  return binding;
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
  release: StorefrontCatalogRelease,
  productsById: ReadonlyMap<string, CatalogProduct>,
  product: CatalogProduct,
  locale: string,
  relatedCollection?: CatalogCollection,
  settings: Readonly<Record<string, unknown>> = {},
): ProductPageModel | undefined {
  const pricedProduct = activeVariantsWithDefaultMoney(product, release.site.defaultCurrency);
  if (!pricedProduct) return undefined;
  const { variants } = pricedProduct;
  const presentation = product.presentation;
  const presentationMedia = product.media
    .filter(({ id }) => !presentation?.detailMediaId || id !== presentation.detailMediaId)
    .map(stripCatalogMediaId);
  const colorMedia = presentation?.colorMediaIds
    ? Object.fromEntries(
        Object.entries(presentation.colorMediaIds).map(([color, ids]) => [
          color,
          ids.map((id) => product.media.find((media) => media.id === id)!).map(stripCatalogMediaId),
        ]),
      )
    : undefined;
  const selectedVariantId =
    presentation?.defaultVariantId &&
    variants.some(({ id }) => id === presentation.defaultVariantId)
      ? presentation.defaultVariantId
      : variants[0]!.id;
  const selectedVariant = variants.find(({ id }) => id === selectedVariantId)!;
  const money = selectedVariant.money;
  const optionGroups = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.optionValues)) {
      const values = optionGroups.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      optionGroups.set(name, values);
    }
  }
  const hasExplicitOptionDefinitions = Boolean(
    product.optionDefinitions && product.optionDefinitions.length > 0,
  );
  const optionDefinitions = hasExplicitOptionDefinitions
    ? product.optionDefinitions!
    : [...optionGroups].map(([name, values]) => ({
        name,
        presentation: "text" as const,
        values: values.map((label) => ({ label })),
      }));
  const renderedOptionGroups = hasExplicitOptionDefinitions
    ? optionDefinitions.map(({ name, values }) => ({
        name,
        values: values.map(({ label }) => label),
      }))
    : [...optionGroups].map(([name, values]) => ({ name, values }));
  const resource = presentationProductSchema.parse({
    availability: "unknown",
    id: product.id,
    kind: "product",
    media: presentationMedia,
    money,
    name: product.name,
    slug: product.slug,
    variantIds: variants.map(({ id }) => id),
  });
  const relatedProducts: PresentationProductCard[] = [];
  if (relatedCollection) {
    for (const productId of relatedCollection.productIds) {
      if (productId === product.id) continue;
      const relatedProduct = productsById.get(productId);
      if (relatedProduct) {
        relatedProducts.push(
          ...productCardViewModel(relatedProduct, release.site.defaultCurrency, locale, "default"),
        );
      }
      if (relatedProducts.length === 8) break;
    }
  }
  const detailMedia = presentation?.detailMediaId
    ? product.media.find(({ id }) => id === presentation.detailMediaId)
    : (product.media.find(
        ({ id }) =>
          id === presentation?.colorMediaIds?.[selectedVariant.optionValues.color ?? ""]?.at(-1),
      ) ?? product.media.at(-1));
  const productCollection = release.collections.find(
    ({ productIds, status }) => status === "published" && productIds.includes(product.id),
  );
  const shippingPolicy = release.policies.find(({ slug }) => slug === "shipping");
  const returnsPolicy = release.policies.find(({ slug }) => slug === "returns");
  return productViewModelSchema.parse({
    actions: [
      {
        id: "select-variant",
        intent: "variant.select",
        label: "Select variant",
        value: selectedVariantId,
      },
    ],
    brand: presentation?.brand,
    purchaseStatus: presentation?.purchaseStatus,
    compareAtPriceLabel:
      money.compareAtAmount === undefined
        ? undefined
        : formatCommerceMoney(money.compareAtAmount, money.currency, locale),
    description: product.description,
    descriptionDetail: {
      bullets: presentation?.detail?.bullets ?? [],
      eyebrow: presentation?.detail?.eyebrow,
      heading: presentation?.detail?.heading ?? product.name,
      media: detailMedia ? stripCatalogMediaId(detailMedia) : undefined,
      text: presentation?.detail?.body ?? product.description,
    },
    heading: product.name,
    kind: "product",
    media: presentationMedia,
    colorMedia,
    optionDefinitions,
    optionGroups: renderedOptionGroups,
    paymentBrands: publicPaymentBrands.filter(
      (brand) => settings[`payment-brand-${brand}`] === true,
    ),
    deliverySummary:
      typeof settings["delivery-summary"] === "string" && settings["delivery-summary"].trim()
        ? settings["delivery-summary"].trim()
        : undefined,
    shippingReturnsSummary:
      typeof settings["shipping-returns-summary"] === "string" &&
      settings["shipping-returns-summary"].trim()
        ? settings["shipping-returns-summary"].trim()
        : undefined,
    priceLabel: formatCommerceMoney(money.amount, money.currency, locale),
    publishedRoutes: release.routes,
    relatedProducts,
    relatedCollection: relatedCollection
      ? {
          href: `/collections/${relatedCollection.slug}`,
          id: relatedCollection.id,
          name: relatedCollection.name,
        }
      : undefined,
    resource,
    siteName: release.site.name,
    reviewSummary: {
      averageRating: presentation?.reviewDisplay?.averageRating ?? 0,
      count: presentation?.reviewDisplay?.count ?? 0,
      label: `${presentation?.reviewDisplay?.count ?? 0} Reviews`,
      ...(presentation?.reviewDisplay?.ratingBands
        ? { ratingBands: presentation.reviewDisplay.ratingBands }
        : {}),
    },
    reviews: presentation?.reviewDisplay?.entries ?? [],
    shipping:
      shippingPolicy && returnsPolicy
        ? { returnBody: returnsPolicy.description, standard: shippingPolicy.description }
        : undefined,
    specifications: presentation?.specifications ?? [],
    state: "populated",
    taxonomy: {
      categories: productCollection ? [productCollection.name] : [],
      tags: [],
    },
    variants: variants.map((variant) => ({
      compareAtPriceLabel:
        variant.money.compareAtAmount === undefined
          ? undefined
          : formatCommerceMoney(variant.money.compareAtAmount, variant.money.currency, locale),
      id: variant.id,
      label: variant.title,
      optionValues: variant.optionValues,
      priceLabel: formatCommerceMoney(variant.money.amount, variant.money.currency, locale),
      selected: variant.id === selectedVariantId,
      sku: variant.sku,
    })),
  });
}

export function composeProductPageModel(input: {
  experience?: ExperienceSnapshot;
  locale: string;
  productId: string;
  release: StorefrontCatalogRelease;
  slug: string;
}): ProductPageModel {
  const release = canonicalCatalogReleaseSchema.parse(input.release);
  const product = release.products.find(({ id }) => id === input.productId);
  if (!product || product.slug !== input.slug || product.status !== "published") {
    throw new Error("Product route identity does not match a published Catalog Release product.");
  }
  const productsById = new Map(release.products.map((candidate) => [candidate.id, candidate]));
  const productSection = input.experience?.resolvedTemplates
    .find(({ pageType }) => pageType === "product")
    ?.sections.find(({ type, visible }) => visible && type === "fashion-store.product");
  const selectedCollectionId = selectedRelatedCollectionId(input.experience, productSection?.id);
  if (
    selectedCollectionId &&
    !release.collections.some(
      ({ id, status }) => id === selectedCollectionId && status === "published",
    )
  ) {
    throw new Error("Selected related collection is not published in the Catalog Release.");
  }
  const relatedCollection = relatedCollectionForProduct(release, product, selectedCollectionId);
  const productSettings = productSection?.settings;
  const model = productViewModel(
    release,
    productsById,
    product,
    input.locale,
    relatedCollection,
    productSettings,
  );
  if (!model) {
    throw new Error(
      `Catalog product ${product.id} has no active variant price in ${release.site.defaultCurrency}.`,
    );
  }
  return model;
}

function collectionViewModel(
  collection: CatalogCollection,
  productsById: ReadonlyMap<string, CatalogProduct>,
  defaultCurrency: string,
  locale: string,
  settings: Readonly<Record<string, unknown>>,
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
    description: optionalTextSetting(settings, "intro-copy"),
    heading: requiredTextSetting(settings, "intro-title", collection.name),
    kind: "collection-grid",
    products: collection.productIds.flatMap((productId) => {
      const product = productsById.get(productId);
      return product ? productCardViewModel(product, defaultCurrency, locale, "default") : [];
    }),
    resource,
    state: "populated",
  });
}

function productCardViewModel(
  product: CatalogProduct,
  defaultCurrency: string,
  locale: string,
  visualVariant: PresentationProductCard["visualVariant"],
): PresentationProductCard[] {
  if (product.status !== "published" || product.presentation?.purchaseStatus === "unverified")
    return [];
  const pricedProduct = activeVariantsWithDefaultMoney(product, defaultCurrency);
  if (!pricedProduct) return [];
  const { variants } = pricedProduct;
  const money = variants[0]!.money;
  const href = `/products/${product.slug}`;
  return [
    {
      actionState: {
        kind: "available",
        message: "Price and availability will be verified before adding.",
      },
      currency: money.currency,
      compareAtPriceLabel:
        money.compareAtAmount === undefined
          ? undefined
          : formatCommerceMoney(money.compareAtAmount, money.currency, locale),
      href,
      id: product.id,
      media: product.media[0] ? stripCatalogMediaId(product.media[0]) : undefined,
      name: product.name,
      priceLabel: formatCommerceMoney(money.amount, money.currency, locale),
      productId: product.id,
      slug: product.slug,
      staticPurchase:
        variants.length === 1
          ? {
              kind: "direct-add",
              label: "Add to cart",
              productId: product.id,
              variantId: variants[0]!.id,
            }
          : {
              href,
              kind: "choose-options",
              label: "Choose options",
              productId: product.id,
            },
      variantIds: variants.map(({ id }) => id),
      visualVariant,
    } satisfies PresentationProductCard,
  ];
}

function stripCatalogMediaId(media: CatalogProduct["media"][number]) {
  const { id: _id, ...presentationMedia } = media;
  return presentationMedia;
}

function activeVariantsWithDefaultMoney(product: CatalogProduct, defaultCurrency: string) {
  const activeVariants = product.variants.filter(({ status }) => status === "active");
  const variants = activeVariants.flatMap((variant) => {
    const money = variant.prices.find(({ currency }) => currency === defaultCurrency);
    return money ? [{ ...variant, money }] : [];
  });
  return variants.length > 0 && variants.length === activeVariants.length
    ? { variants }
    : undefined;
}

function requiredTextSetting(
  settings: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string,
): string {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function optionalTextSetting(settings: Readonly<Record<string, unknown>>, key: string) {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function editorLink(
  adapter: ThemeCompositionAdapter | undefined,
  release: StorefrontCatalogRelease,
  value: unknown,
) {
  const parsed = storefrontLinkSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const href =
    parsed.data.target.kind === "external"
      ? parsed.data.target.url
      : adapter?.referenceHref(release, parsed.data.target.reference);
  return href
    ? {
        href,
        label: parsed.data.label,
        targetBehavior: parsed.data.targetBehavior,
      }
    : undefined;
}

function referenceLink(
  adapter: ThemeCompositionAdapter | undefined,
  release: StorefrontCatalogRelease,
  value: unknown,
) {
  const parsed = storefrontResourceReferenceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const href = adapter?.referenceHref(release, parsed.data);
  if (!href || !adapter) return undefined;
  const destination = adapter
    .destinations(release)
    .find(({ id, kind }) => id === parsed.data.id && kind === parsed.data.kind);
  return {
    href,
    label: destination?.name ?? parsed.data.id,
    targetBehavior: "same-window" as const,
  };
}

function catalogMediaOrigin(release: StorefrontCatalogRelease): string | undefined {
  for (const product of release.products) {
    for (const media of product.media) {
      try {
        const url = new URL(media.src);
        if (url.protocol === "https:" && !url.username && !url.password) return url.origin;
      } catch {
        // Local Catalog media paths do not establish an external media origin.
      }
    }
  }
  return undefined;
}

function editorMedia(
  release: StorefrontCatalogRelease,
  value: unknown,
  resolvedCatalogOrigin?: string | null,
) {
  const parsed = assetReferenceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  if (parsed.data.kind === "theme") {
    return {
      alt: parsed.data.alt,
      height: parsed.data.height,
      source: "theme" as const,
      themePath: parsed.data.path,
      width: parsed.data.width,
    };
  }
  if (parsed.data.kind === "remote") {
    return {
      alt: parsed.data.alt,
      height: parsed.data.height,
      source: "url" as const,
      src: parsed.data.url,
      width: parsed.data.width,
    };
  }
  const mediaOrigin =
    resolvedCatalogOrigin === undefined ? catalogMediaOrigin(release) : resolvedCatalogOrigin;
  const src = mediaOrigin ? `${mediaOrigin}/${parsed.data.key}` : `/media/${parsed.data.key}`;
  return {
    alt: parsed.data.alt,
    height: parsed.data.height,
    source: "url" as const,
    src,
    width: parsed.data.width,
  };
}

function shellViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  release: StorefrontCatalogRelease,
  settings: Readonly<Record<string, unknown>>,
  contact?: ExperienceSnapshot["contact"],
): PresentationShellViewModel {
  const mediaOrigin = catalogMediaOrigin(release) ?? null;
  return presentationShellViewModelSchema.parse({
    announcement:
      settings["announcement-visible"] === false
        ? undefined
        : optionalTextSetting(settings, "announcement-text"),
    announcementLink: editorLink(adapter, release, settings["announcement-link"]),
    footer: {
      ...(contact
        ? { contactVersion: contact.version, publicContact: contact.publicContact }
        : { contactCopy: optionalTextSetting(settings, "footer-contact-copy") }),
      legalLink: editorLink(adapter, release, settings["footer-legal-link"]),
      logo: editorMedia(release, settings["footer-logo"], mediaOrigin),
      ...(!contact
        ? { socialLink: editorLink(adapter, release, settings["footer-social-link"]) }
        : {}),
    },
    header: {
      ...(contact
        ? { contactVersion: contact.version, publicContact: contact.publicContact }
        : { contactCopy: optionalTextSetting(settings, "header-contact-copy") }),
      highlightLink: referenceLink(adapter, release, settings["header-highlight-page"]),
      legalLink: editorLink(adapter, release, settings["header-legal-link"]),
      logo: editorMedia(release, settings["header-logo"], mediaOrigin),
      ...(!contact
        ? { socialLink: editorLink(adapter, release, settings["header-social-link"]) }
        : {}),
    },
  });
}

function homeViewModel(
  adapter: ThemeCompositionAdapter,
  release: StorefrontCatalogRelease,
  collection: CatalogCollection,
  productsById: ReadonlyMap<string, CatalogProduct>,
  defaultCurrency: string,
  locale: string,
  settings: Readonly<Record<string, unknown>>,
  featuredProduct?: CatalogProduct,
  contact?: ExperienceSnapshot["contact"],
): Extract<PresentationViewModel, { kind: "home" }> {
  const products: PresentationProductCard[] = [];
  for (const productId of collection.productIds) {
    if (products.length === 24) break;
    const product = productsById.get(productId);
    if (product) products.push(...productCardViewModel(product, defaultCurrency, locale, "home"));
  }
  const primaryLink = editorLink(adapter, release, settings["hero-primary-link"]);
  const secondaryLink = editorLink(adapter, release, settings["hero-secondary-link"]);
  const mediaOrigin = catalogMediaOrigin(release) ?? null;
  const media = editorMedia(release, settings["hero-image"], mediaOrigin);
  const shell = shellViewModel(adapter, release, settings, contact);
  const [featuredProductCard] = featuredProduct
    ? productCardViewModel(featuredProduct, defaultCurrency, locale, "home")
    : [];
  return presentationViewModelSchema.parse({
    announcement: shell.announcement,
    announcementLink: shell.announcementLink,
    featuredCollection: {
      href: `/collections/${collection.slug}`,
      id: collection.id,
      name: collection.name,
    },
    hero: {
      body: requiredTextSetting(settings, "hero-body", "Explore the latest edit."),
      eyebrow: requiredTextSetting(settings, "hero-eyebrow", "New collection"),
      heading: requiredTextSetting(settings, "hero-title", "Fashion for every day"),
      media,
      primaryLink,
      secondaryLink,
    },
    featuredProduct: featuredProductCard,
    kind: "home",
    merchandisingOrder:
      typeof settings["merchandising-order"] === "number" ? settings["merchandising-order"] : 1,
    merchandisingTitle: requiredTextSetting(settings, "merchandising-title", "Best sellers"),
    merchandisingVisible: settings["merchandising-visible"] !== false,
    products,
    sections: [
      { kind: "hero" },
      { kind: "services" },
      { kind: "categories" },
      { kind: "best-sellers" },
      { kind: "promotion" },
      { kind: "collection" },
      { kind: "brands" },
      { kind: "featured-products" },
      { kind: "marquee" },
      { kind: "magazine" },
    ],
    shell: { footer: shell.footer, header: shell.header },
    state: "populated",
  }) as Extract<PresentationViewModel, { kind: "home" }>;
}

function transactionViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  pageType: "cart" | "checkout",
  settings: Readonly<Record<string, unknown>>,
  release: StorefrontCatalogRelease,
): PresentationViewModel {
  const helpCopy = requiredTextSetting(
    settings,
    "help-copy",
    pageType === "cart" ? "Need help with your cart?" : "Secure checkout",
  );
  const policyLink = editorLink(adapter, release, settings["policy-link"]);
  if (pageType === "cart") {
    return presentationViewModelSchema.parse({
      checkoutAction: {
        id: "start-checkout",
        intent: "checkout.start-preview",
        label: "Continue to checkout",
      },
      heading: "Shopping cart",
      helpCopy,
      kind: "cart",
      lines: [],
      state: "populated",
      subtotalLabel: "Calculated by Commerce",
      policyLink,
    });
  }
  return presentationViewModelSchema.parse({
    action: {
      id: "continue-checkout",
      intent: "checkout.start-preview",
      label: "Continue to secure payment",
    },
    heading: "Checkout",
    helpCopy,
    kind: "checkout",
    state: "populated",
    steps: ["Address", "Delivery", "Payment"],
    summaryLines: ["Your current cart will be verified before payment."],
    policyLink,
  });
}

export function composeExperienceShell(input: {
  adapter?: ThemeCompositionAdapter;
  experience: ExperienceSnapshot;
  release: StorefrontCatalogRelease;
  sectionComposition?: ThemeCompositionDescriptor;
}): PresentationShellViewModel | undefined {
  const experience = experienceSnapshotSchema.safeParse(input.experience);
  const release = canonicalCatalogReleaseSchema.safeParse(input.release);
  if (!experience.success || !release.success) return undefined;
  const homeTemplate = experience.data.resolvedTemplates.find(
    ({ pageType }) => pageType === "home",
  );
  const descriptor = input.sectionComposition
    ? themeCompositionDescriptorSchema.parse(input.sectionComposition)
    : undefined;
  const descriptorCoversHome =
    descriptor && (!descriptor.pageTypes || descriptor.pageTypes.includes("home"));
  const shellSourceType = descriptorCoversHome
    ? descriptor.rendererShell?.sourceSectionType
    : input.adapter?.home?.sectionType;
  const shellSource = homeTemplate?.sections.find(
    ({ type, visible }) => visible && type === shellSourceType,
  );
  return shellSource
    ? shellViewModel(input.adapter, release.data, shellSource.settings, experience.data.contact)
    : undefined;
}

export function composePlatformRoutePresentation(input: {
  adapter?: ThemeCompositionAdapter;
  experience: ExperienceSnapshot;
  path: string;
  release: StorefrontCatalogRelease;
}): PlatformRoutePresentationViewModel | undefined {
  const experience = experienceSnapshotSchema.safeParse(input.experience);
  const release = canonicalCatalogReleaseSchema.safeParse(input.release);
  if (!experience.success || !release.success) return undefined;
  const settings = experience.data.resolvedTemplates
    .find(({ pageType }) => pageType === "content")
    ?.sections.find(({ visible }) => visible)?.settings;
  if (!settings) return undefined;
  const path = normalizeThemeRoutePath(input.path);
  if (path.startsWith("/orders/")) {
    return platformRoutePresentationViewModelSchema.parse({
      helpCopy: requiredTextSetting(settings, "order.help-copy", "Questions about this order?"),
      kind: "order-presentation",
      policyLink: editorLink(input.adapter, release.data, settings["order.policy-link"]),
    });
  }
  if (path.startsWith("/policies/")) {
    return platformRoutePresentationViewModelSchema.parse({
      documentLink: referenceLink(input.adapter, release.data, settings["policy.document"]),
      helpCopy: requiredTextSetting(settings, "policy.help-copy", "Questions about this policy?"),
      kind: "policy-presentation",
      relatedLink: editorLink(input.adapter, release.data, settings["policy.related-link"]),
    });
  }
  return undefined;
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
} as const;

const wishlistUnavailableHeading = "Wishlist unavailable";

function contentSettingKey(path: string): string {
  if (path.startsWith("/orders/")) return "order";
  if (path.startsWith("/policies/")) return "policy";
  return path.slice(1).replaceAll("/", ".") || "home";
}

function releasedContentViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  path: string,
  release: StorefrontCatalogRelease,
): PresentationViewModel | undefined {
  if (release.schemaVersion !== 3) return undefined;
  const normalizedPath = normalizeThemeRoutePath(path);
  const record = release.content.find(
    ({ kind, route }) => (kind === "article" || kind === "page") && route === normalizedPath,
  );
  if (!record || (record.kind !== "article" && record.kind !== "page")) return undefined;
  const sections: unknown[] = [];
  for (const section of record.payload.sections) {
    if (section.kind === "heading" || section.kind === "paragraph") {
      sections.push(section);
      continue;
    }
    if (section.kind === "image") {
      const media = release.products
        .flatMap(({ media: productMedia }) => productMedia)
        .find(({ id }) => id === section.assetId);
      if (media) {
        sections.push({
          alt: section.alt,
          ...(section.caption === undefined ? {} : { caption: section.caption }),
          id: section.id,
          kind: section.kind,
          media: {
            alt: media.alt,
            height: media.height,
            src: media.src,
            width: media.width,
          },
        });
      }
      continue;
    }
    if (section.kind === "link") {
      const href =
        section.link.target.kind === "external"
          ? section.link.target.url
          : adapter?.referenceHref(release, section.link.target.reference);
      if (href) {
        sections.push({
          href,
          id: section.id,
          kind: "link" as const,
          label: section.link.label,
          targetBehavior: section.link.targetBehavior,
        });
      }
    }
  }
  if (sections.length === 0) return undefined;
  return presentationViewModelSchema.parse({
    contentKind: record.kind,
    id: record.id,
    kind: "released-content",
    route: record.route,
    sections,
    state: "populated",
    summary: record.payload.summary ?? "",
    title: record.title,
    version: record.version,
  });
}

function contentViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  path: string,
  settings: Readonly<Record<string, unknown>>,
  release: StorefrontCatalogRelease,
  locale: string,
  contact?: ExperienceSnapshot["contact"],
): PresentationViewModel {
  const key = contentSettingKey(path);
  const released = releasedContentViewModel(adapter, path, release);
  if (released && key !== "contact") return released;
  if (released && key === "contact" && contact) {
    return presentationViewModelSchema.parse({
      ...released,
      contactVersion: contact.version,
      publicContact: contact.publicContact,
    });
  }
  if (key === "contact" && contact) {
    const publicContact = contact.publicContact;
    const hasPublicDetails = Boolean(
      publicContact.supportEmail ||
      publicContact.privacyEmail ||
      publicContact.publicPhone ||
      publicContact.locations.length ||
      publicContact.socials.length,
    );
    const contactMessage = requiredTextSetting(
      settings,
      "contact.message",
      "Get in touch with us.",
    );
    return presentationViewModelSchema.parse({
      contactVersion: contact.version,
      heading: hasPublicDetails
        ? requiredTextSetting(settings, "contact.heading", "Contact")
        : unavailableContent.contact.heading,
      kind: "state",
      media: editorMedia(release, settings["contact.image"]),
      message: hasPublicDetails
        ? contactMessage === "Merchant contact details will appear here."
          ? "Choose a published channel below to reach us."
          : contactMessage
        : unavailableContent.contact.message,
      presentationStyle: settings["content-style"] === "editorial" ? "editorial" : "standard",
      publicContact,
      state: hasPublicDetails ? "populated" : "unavailable",
    });
  }
  if (key === "wishlist") {
    const products: PresentationProductCard[] = [];
    for (const product of release.products) {
      const [card] = productCardViewModel(product, release.site.defaultCurrency, locale, "default");
      if (card) products.push(card);
      if (products.length === 4) break;
    }
    return presentationViewModelSchema.parse({
      collections: [],
      description: requiredTextSetting(
        settings,
        "wishlist.message",
        "Saved wishlists are not available yet.",
      ),
      heading: requiredTextSetting(settings, "wishlist.heading", wishlistUnavailableHeading),
      kind: "collection-grid",
      products,
      state: "unavailable",
    });
  }
  const configuredHeading = settings[`${key}.heading`];
  const configuredMessage = settings[`${key}.message`];
  const configured =
    key !== "account" &&
    typeof configuredHeading === "string" &&
    configuredHeading.trim().length > 0 &&
    typeof configuredMessage === "string" &&
    configuredMessage.trim().length > 0;
  const unavailable = unavailableContent[key as keyof typeof unavailableContent];
  const linkKey =
    key === "order"
      ? "order.policy-link"
      : key === "policy"
        ? "policy.related-link"
        : `${key}.link`;
  const configuredLink = editorLink(adapter, release, settings[linkKey]);
  const relatedReference =
    key === "magazine"
      ? referenceLink(adapter, release, settings["magazine.featured-article"])
      : key === "policy"
        ? referenceLink(adapter, release, settings["policy.document"])
        : undefined;
  const fallbackHeading = key
    .split(/[.-]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
  return presentationViewModelSchema.parse({
    action: {
      id: "continue-shopping",
      intent: "navigation",
      label: configuredLink?.label ?? "Continue shopping",
      target: configuredLink?.href ?? "/shop",
    },
    heading:
      (configured || key === "account") &&
      typeof configuredHeading === "string" &&
      configuredHeading.trim().length > 0
        ? configuredHeading
        : (unavailable?.heading ?? fallbackHeading),
    kind: "state",
    media: editorMedia(release, settings[`${key}.image`]),
    message:
      (configured || key === "account") &&
      typeof configuredMessage === "string" &&
      configuredMessage.trim().length > 0
        ? configuredMessage
        : (unavailable?.message ?? "This Experience page has not been published yet."),
    presentationStyle: settings["content-style"] === "editorial" ? "editorial" : "standard",
    relatedAction: relatedReference
      ? {
          id: "open-related-content",
          intent: "navigation",
          label: relatedReference.label,
          target: relatedReference.href,
        }
      : undefined,
    state: configured ? "populated" : "unavailable",
  });
}

function composeDeclaredSections(input: {
  adapter: ThemeCompositionAdapter | undefined;
  contact: ExperienceSnapshot["contact"];
  bindingsByInstance: ReadonlyMap<string, CatalogResourceBinding[]>;
  collectionsById: ReadonlyMap<string, CatalogCollection>;
  descriptor: ThemeCompositionDescriptor;
  locale: string;
  pageId: string;
  path: string;
  productsById: ReadonlyMap<string, CatalogProduct>;
  release: StorefrontCatalogRelease;
  template: PageTemplate;
}): Pick<ComposedExperienceRoute, "diagnostics" | "shell" | "viewModels"> {
  const diagnostics: CompositionDiagnostic[] = [];
  const viewModels: Record<string, PresentationViewModel> = {};
  const visibleSections = input.template.sections.filter(({ visible }) => visible);
  const shellContract = input.descriptor.rendererShell;
  const shellSection = shellContract
    ? visibleSections.find(({ type }) => type === shellContract.sourceSectionType)
    : undefined;
  let composedHome: Extract<PresentationViewModel, { kind: "home" }> | undefined;

  for (const section of visibleSections) {
    const contract = input.descriptor.sections[section.type];
    if (!contract) {
      diagnostics.push({
        code: "section-composition-missing",
        message: `Visible Section ${section.type} has no composition descriptor.`,
        pageId: input.pageId,
        path: input.path,
        sectionId: section.id,
      });
      continue;
    }
    const bindingSource =
      contract.live.resolver === "home-sections" && shellSection ? shellSection : section;
    const bindings = input.bindingsByInstance.get(bindingSource?.id ?? section.id) ?? [];
    const resolvedBindings = new Map<string, CatalogResourceBinding>();
    let invalid = false;
    const undeclaredBinding = bindings.find(
      ({ settingId }) => !contract.bindings.some((slot) => slot.settingId === settingId),
    );
    if (undeclaredBinding) {
      diagnostics.push({
        code: "catalog-binding-undeclared",
        message: `Visible instance ${section.id} has an undeclared live catalog binding for ${undeclaredBinding.settingId}.`,
        pageId: input.pageId,
        path: input.path,
        referenceId: undeclaredBinding.reference.id,
        referenceKind: undeclaredBinding.reference.kind,
        sectionId: section.id,
        settingId: undeclaredBinding.settingId,
      });
      invalid = true;
    }
    for (const slot of contract.bindings) {
      const matches = bindings.filter(({ settingId }) => slot.settingId === settingId);
      if (matches.length === 0 && slot.cardinality === "required") {
        diagnostics.push({
          code: "catalog-binding-missing",
          message: `Visible instance ${section.id} is missing its ${slot.name} live catalog binding.`,
          pageId: input.pageId,
          path: input.path,
          sectionId: section.id,
          settingId: slot.settingId,
        });
        invalid = true;
        continue;
      }
      if (matches.length > 1) {
        diagnostics.push({
          code: "catalog-binding-ambiguous",
          message: `Visible instance ${section.id} has multiple live catalog bindings for ${slot.settingId}.`,
          pageId: input.pageId,
          path: input.path,
          sectionId: section.id,
          settingId: slot.settingId,
        });
        invalid = true;
        continue;
      }
      const binding = matches[0];
      if (!binding) continue;
      if (binding.reference.kind !== slot.referenceKind) {
        diagnostics.push({
          code: "catalog-reference-wrong-kind",
          message: `Catalog binding ${binding.id} does not match declared ${slot.referenceKind} slot ${slot.name}.`,
          pageId: input.pageId,
          path: input.path,
          referenceId: binding.reference.id,
          referenceKind: binding.reference.kind,
          sectionId: section.id,
          settingId: slot.settingId,
        });
        invalid = true;
        continue;
      }
      const referenceError = referenceDiagnostic(
        input.productsById,
        input.collectionsById,
        binding,
      );
      if (referenceError) {
        diagnostics.push({
          ...referenceError,
          pageId: input.pageId,
          path: input.path,
          referenceId: binding.reference.id,
          referenceKind: binding.reference.kind,
          sectionId: section.id,
          settingId: slot.settingId,
        });
        invalid = true;
        continue;
      }
      resolvedBindings.set(slot.name, binding);
    }
    if (invalid) continue;

    let viewModel: PresentationViewModel | undefined;
    const firstCollection = [...resolvedBindings.values()].find(
      ({ reference }) => reference.kind === "collection",
    );
    const firstProduct = [...resolvedBindings.values()].find(
      ({ reference }) => reference.kind === "product",
    );
    if (contract.live.resolver === "theme-section") {
      viewModel = presentationViewModelSchema.parse({
        data: { settings: section.settings },
        kind: "theme-section",
        state: "populated",
      });
    } else if (contract.live.resolver === "collection" && firstCollection) {
      viewModel = collectionViewModel(
        input.collectionsById.get(firstCollection.reference.id)!,
        input.productsById,
        input.release.site.defaultCurrency,
        input.locale,
        section.settings,
      );
    } else if (contract.live.resolver === "product" && firstProduct) {
      viewModel = productViewModel(
        input.release,
        input.productsById,
        input.productsById.get(firstProduct.reference.id)!,
        input.locale,
        undefined,
        section.settings,
      );
    } else if (contract.live.resolver === "home" && firstCollection && input.adapter) {
      const featuredProduct = firstProduct
        ? input.productsById.get(firstProduct.reference.id)
        : undefined;
      viewModel = homeViewModel(
        input.adapter,
        input.release,
        input.collectionsById.get(firstCollection.reference.id)!,
        input.productsById,
        input.release.site.defaultCurrency,
        input.locale,
        section.settings,
        featuredProduct,
        input.contact,
      );
    } else if (contract.live.resolver === "home-sections" && firstCollection && input.adapter) {
      const featuredProduct = firstProduct
        ? input.productsById.get(firstProduct.reference.id)
        : undefined;
      composedHome ??= homeViewModel(
        input.adapter,
        input.release,
        input.collectionsById.get(firstCollection.reference.id)!,
        input.productsById,
        input.release.site.defaultCurrency,
        input.locale,
        bindingSource?.settings ?? section.settings,
        featuredProduct,
        input.contact,
      );
      viewModel = {
        data: {
          home: composedHome,
          ...(input.adapter.home?.sectionData?.({
            home: composedHome,
            sectionType: section.type,
          }) ?? {}),
          mode: "live",
          presentation: section.settings,
          sectionType: section.type,
        },
        kind: "theme-section",
        state: "populated",
      };
    } else if (
      contract.live.resolver === "transaction" &&
      (input.template.pageType === "cart" || input.template.pageType === "checkout")
    ) {
      viewModel = transactionViewModel(
        input.adapter,
        input.template.pageType,
        section.settings,
        input.release,
      );
    } else if (contract.live.resolver === "content") {
      viewModel = contentViewModel(
        input.adapter,
        input.path,
        section.settings,
        input.release,
        input.locale,
        input.contact,
      );
    }

    if (!viewModel) {
      diagnostics.push({
        code: "section-resolver-mismatch",
        message: `Section ${section.type} cannot satisfy resolver ${contract.live.resolver} with its declared inputs.`,
        pageId: input.pageId,
        path: input.path,
        sectionId: section.id,
      });
      continue;
    }
    if (viewModel.kind !== contract.live.kind) {
      diagnostics.push({
        code: "section-view-model-kind-mismatch",
        message: `Section ${section.type} resolved ${viewModel.kind} instead of declared ${contract.live.kind}.`,
        pageId: input.pageId,
        path: input.path,
        sectionId: section.id,
      });
      continue;
    }
    viewModels[section.id] = viewModel;
  }

  if (shellContract && !shellSection) {
    diagnostics.push({
      code: "section-resolver-mismatch",
      message: `Renderer shell source ${shellContract.sourceSectionType} is not visible in the selected template.`,
      pageId: input.pageId,
      path: input.path,
    });
  }

  return {
    diagnostics,
    ...(shellSection
      ? {
          shell: shellViewModel(input.adapter, input.release, shellSection.settings, input.contact),
        }
      : {}),
    viewModels,
  };
}

export function composeExperienceRoute(
  input: ComposeExperienceRouteInput,
): ComposedExperienceRoute {
  const experience = experienceSnapshotSchema.parse(input.experience);
  const parsedRelease = catalogReleaseV3Schema
    .or(canonicalCatalogReleaseSchema)
    .safeParse(input.release);
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
  const compositionCoversTemplate = Boolean(
    input.sectionComposition &&
    (!input.sectionComposition.pageTypes ||
      input.sectionComposition.pageTypes.includes(template.pageType)),
  );
  if (input.sectionComposition && compositionCoversTemplate) {
    const descriptor = themeCompositionDescriptorSchema.parse(input.sectionComposition);
    const declared = composeDeclaredSections({
      adapter: input.adapter,
      contact: experience.contact,
      bindingsByInstance: catalogBindingsByInstance,
      collectionsById,
      descriptor,
      locale: input.locale,
      pageId,
      path,
      productsById,
      release,
      template,
    });
    return {
      diagnostics: declared.diagnostics,
      locale: input.locale,
      ok: declared.diagnostics.length === 0,
      pageId,
      path,
      releaseId: release.releaseId,
      template,
      ...(declared.shell ? { shell: declared.shell } : {}),
      viewModels: declared.viewModels,
    };
  }
  const instances = template.sections.flatMap((section) => [section, ...section.blocks]);
  for (const instance of instances.filter(({ visible }) => visible)) {
    if (template.pageType === "cart" || template.pageType === "checkout") {
      viewModels[instance.id] = transactionViewModel(
        input.adapter,
        template.pageType,
        instance.settings,
        release,
      );
      continue;
    }
    if (template.pageType === "content") {
      viewModels[instance.id] = contentViewModel(
        input.adapter,
        path,
        instance.settings,
        release,
        input.locale,
        experience.contact,
      );
      continue;
    }
    const matches = (catalogBindingsByInstance.get(instance.id) ?? []).map((binding) =>
      template.pageType === "product" ? binding : bindingForResolvedRoute(binding, input.route),
    );
    const duplicateSetting = matches.find(
      (binding, index) =>
        matches.findIndex(({ settingId }) => settingId === binding.settingId) !== index,
    );
    if (duplicateSetting) {
      diagnostics.push({
        code: "catalog-binding-ambiguous",
        message: `Visible instance ${instance.id} has multiple live catalog bindings for ${duplicateSetting.settingId}.`,
        pageId,
        path,
        sectionId: instance.id,
        settingId: duplicateSetting.settingId,
      });
      continue;
    }
    let invalid = false;
    for (const binding of matches) {
      const invalidReference = referenceDiagnostic(productsById, collectionsById, binding);
      if (!invalidReference) continue;
      invalid = true;
      diagnostics.push({
        ...invalidReference,
        pageId,
        path,
        referenceId: binding.reference.id,
        referenceKind: binding.reference.kind,
        sectionId: instance.id,
        settingId: binding.settingId,
      });
    }
    if (invalid) continue;
    const homeContract = input.adapter?.home;
    const requiresHomeCollection =
      template.pageType === "home" &&
      homeContract !== undefined &&
      instance.type === homeContract.sectionType;
    const primaryKind =
      template.pageType === "product" || (template.pageType === "home" && !requiresHomeCollection)
        ? "product"
        : "collection";
    const primarySetting = requiresHomeCollection
      ? homeContract.featuredCollectionSettingId
      : template.pageType === "collection"
        ? "default-collection"
        : undefined;
    const routeProductId =
      template.pageType === "product" ? input.route.parameters?.productId : undefined;
    const binding =
      template.pageType === "product"
        ? routeProductId
          ? ({
              id: `route-product:${routeProductId}`,
              instanceId: instance.id,
              kind: "catalog",
              reference: { id: routeProductId, kind: "product" },
              settingId: "route.parameters.productId",
            } satisfies CatalogResourceBinding)
          : undefined
        : ((primarySetting
            ? matches.find(({ settingId }) => settingId === primarySetting)
            : undefined) ?? matches.find(({ reference }) => reference.kind === primaryKind));
    if (!binding) {
      diagnostics.push({
        code: "catalog-binding-missing",
        message: `Visible instance ${instance.id} is missing its ${primaryKind} live catalog binding.`,
        pageId,
        path,
        sectionId: instance.id,
        ...(primarySetting ? { settingId: primarySetting } : {}),
      });
      continue;
    }
    if (routeProductId) {
      const invalidRouteProduct = referenceDiagnostic(productsById, collectionsById, binding);
      if (invalidRouteProduct) {
        diagnostics.push({
          ...invalidRouteProduct,
          pageId,
          path,
          referenceId: binding.reference.id,
          referenceKind: binding.reference.kind,
          sectionId: instance.id,
          settingId: binding.settingId,
        });
        continue;
      }
    }
    if (binding.reference.kind === "product") {
      const product = productsById.get(binding.reference.id)!;
      const selectedCollectionId = selectedRelatedCollectionId(input.experience, instance.id);
      const relatedCollection = relatedCollectionForProduct(release, product, selectedCollectionId);
      const viewModel = productViewModel(
        release,
        productsById,
        product,
        input.locale,
        relatedCollection,
        instance.settings,
      );
      if (!viewModel) {
        diagnostics.push({
          code: "catalog-product-default-currency-missing",
          message: `Catalog product ${product.id} has no active variant price in ${release.site.defaultCurrency}.`,
          pageId,
          path,
          referenceId: binding.reference.id,
          referenceKind: binding.reference.kind,
          sectionId: instance.id,
          settingId: binding.settingId,
        });
        continue;
      }
      viewModels[instance.id] = viewModel;
    } else {
      const collection = collectionsById.get(binding.reference.id)!;
      const featuredProductBinding = matches.find(
        ({ reference, settingId }) =>
          settingId === homeContract?.featuredProductSettingId && reference.kind === "product",
      );
      const featuredProduct = featuredProductBinding
        ? productsById.get(featuredProductBinding.reference.id)
        : undefined;
      viewModels[instance.id] = requiresHomeCollection
        ? homeViewModel(
            input.adapter!,
            release,
            collection,
            productsById,
            release.site.defaultCurrency,
            input.locale,
            instance.settings,
            featuredProduct,
            experience.contact,
          )
        : collectionViewModel(
            collection,
            productsById,
            release.site.defaultCurrency,
            input.locale,
            instance.settings,
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
