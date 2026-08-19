import {
  assetReferenceSchema,
  canonicalCatalogReleaseSchema,
  catalogResourceBindingSchema,
  experienceSnapshotSchema,
  presentationCollectionSchema,
  presentationProductSchema,
  storefrontLinkSchema,
  storefrontResourceReferenceSchema,
  type CanonicalCatalogRelease,
  type CatalogResourceBinding,
  type ExperienceSnapshot,
  type PageTemplate,
} from "@shoppp/contracts";

import type { ThemeCompositionAdapter } from "./composition";
import { normalizeThemeRoutePath, type ResolvedThemeRouteContract } from "./routes";
import { formatCommerceMoney } from "./runtime-commerce";
import {
  platformRoutePresentationViewModelSchema,
  presentationShellViewModelSchema,
  presentationViewModelSchema,
  type PlatformRoutePresentationViewModel,
  type PresentationProductCard,
  type PresentationShellViewModel,
  type PresentationViewModel,
} from "./view-models";

type CatalogProduct = CanonicalCatalogRelease["products"][number];
type CatalogCollection = CanonicalCatalogRelease["collections"][number];

export type CompositionDiagnosticCode =
  | "catalog-binding-ambiguous"
  | "catalog-binding-missing"
  | "catalog-product-default-currency-missing"
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
  adapter?: ThemeCompositionAdapter;
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
  release: CanonicalCatalogRelease,
  product: CatalogProduct,
  locale: string,
  settings: Readonly<Record<string, unknown>>,
  relatedCollection?: CatalogCollection,
): PresentationViewModel | undefined {
  const pricedProduct = activeVariantsWithDefaultMoney(product, release.site.defaultCurrency);
  if (!pricedProduct) return undefined;
  const { money, variants } = pricedProduct;
  const optionGroups = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.optionValues)) {
      const values = optionGroups.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      optionGroups.set(name, values);
    }
  }
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
    description: requiredTextSetting(settings, "presentation-copy", product.description),
    heading: product.name,
    kind: "product",
    media: product.media,
    optionGroups: [...optionGroups].map(([name, values]) => ({ name, values })),
    priceLabel: formatCommerceMoney(money.amount, money.currency, locale),
    relatedCollection: relatedCollection
      ? {
          href: `/collections/${relatedCollection.slug}`,
          id: relatedCollection.id,
          name: relatedCollection.name,
        }
      : undefined,
    resource,
    state: "populated",
    variants: variants.map((variant) => ({
      id: variant.id,
      label: variant.title,
      optionValues: variant.optionValues,
      selected: variants.length === 1,
    })),
  });
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
    description: requiredTextSetting(settings, "intro-copy", "Discover the latest edit."),
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
  if (product.status !== "published") return [];
  const pricedProduct = activeVariantsWithDefaultMoney(product, defaultCurrency);
  if (!pricedProduct) return [];
  const { money, variants } = pricedProduct;
  const href = `/products/${product.slug}`;
  return [
    {
      actionState: {
        kind: "available",
        message: "Price and availability will be verified before adding.",
      },
      currency: money.currency,
      href,
      id: product.id,
      media: product.media[0],
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

function activeVariantsWithDefaultMoney(product: CatalogProduct, defaultCurrency: string) {
  const variants = product.variants.filter(({ status }) => status === "active");
  const prices = variants.map((variant) =>
    variant.prices.find(({ currency }) => currency === defaultCurrency),
  );
  const money = prices[0];
  return money && prices.every(Boolean) ? { money, variants } : undefined;
}

function requiredTextSetting(
  settings: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string,
): string {
  const value = settings[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function editorLink(
  adapter: ThemeCompositionAdapter | undefined,
  release: CanonicalCatalogRelease,
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
  release: CanonicalCatalogRelease,
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

function catalogMediaOrigin(release: CanonicalCatalogRelease): string | undefined {
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
  release: CanonicalCatalogRelease,
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
  release: CanonicalCatalogRelease,
  settings: Readonly<Record<string, unknown>>,
): PresentationShellViewModel {
  const mediaOrigin = catalogMediaOrigin(release) ?? null;
  return presentationShellViewModelSchema.parse({
    announcement:
      settings["announcement-visible"] === false
        ? undefined
        : requiredTextSetting(
            settings,
            "announcement-text",
            "Catalog content is published; price and availability are verified before purchase.",
          ),
    announcementLink: editorLink(adapter, release, settings["announcement-link"]),
    footer: {
      contactCopy: requiredTextSetting(settings, "footer-contact-copy", "Stay in touch."),
      legalLink: editorLink(adapter, release, settings["footer-legal-link"]),
      logo: editorMedia(release, settings["footer-logo"], mediaOrigin),
      socialLink: editorLink(adapter, release, settings["footer-social-link"]),
    },
    header: {
      contactCopy: requiredTextSetting(settings, "header-contact-copy", "How can we help?"),
      highlightLink: referenceLink(adapter, release, settings["header-highlight-page"]),
      legalLink: editorLink(adapter, release, settings["header-legal-link"]),
      logo: editorMedia(release, settings["header-logo"], mediaOrigin),
      socialLink: editorLink(adapter, release, settings["header-social-link"]),
    },
  });
}

function homeViewModel(
  adapter: ThemeCompositionAdapter,
  release: CanonicalCatalogRelease,
  collection: CatalogCollection,
  productsById: ReadonlyMap<string, CatalogProduct>,
  defaultCurrency: string,
  locale: string,
  settings: Readonly<Record<string, unknown>>,
  featuredProduct?: CatalogProduct,
): PresentationViewModel {
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
  const shell = shellViewModel(adapter, release, settings);
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
  });
}

function transactionViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  pageType: "cart" | "checkout",
  settings: Readonly<Record<string, unknown>>,
  release: CanonicalCatalogRelease,
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
  release: CanonicalCatalogRelease;
}): PresentationShellViewModel | undefined {
  const experience = experienceSnapshotSchema.safeParse(input.experience);
  const release = canonicalCatalogReleaseSchema.safeParse(input.release);
  if (!experience.success || !release.success || !input.adapter?.home) return undefined;
  const home = experience.data.resolvedTemplates
    .find(({ pageType }) => pageType === "home")
    ?.sections.find(({ type, visible }) => visible && type === input.adapter?.home?.sectionType);
  return home ? shellViewModel(input.adapter, release.data, home.settings) : undefined;
}

export function composePlatformRoutePresentation(input: {
  adapter?: ThemeCompositionAdapter;
  experience: ExperienceSnapshot;
  path: string;
  release: CanonicalCatalogRelease;
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

function contentViewModel(
  adapter: ThemeCompositionAdapter | undefined,
  path: string,
  settings: Readonly<Record<string, unknown>>,
  release: CanonicalCatalogRelease,
  locale: string,
): PresentationViewModel {
  const key = contentSettingKey(path);
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
      const relatedBinding = matches.find(
        ({ reference, settingId }) =>
          settingId === "related-collection" && reference.kind === "collection",
      );
      const relatedCollection = relatedBinding
        ? collectionsById.get(relatedBinding.reference.id)
        : undefined;
      const viewModel = productViewModel(
        release,
        product,
        input.locale,
        instance.settings,
        relatedCollection,
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
