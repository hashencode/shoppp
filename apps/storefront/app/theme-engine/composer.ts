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

import { normalizeThemeRoutePath } from "./routes";
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
}

function matchingTemplate(
  experience: ExperienceSnapshot,
  release: CanonicalCatalogRelease,
  path: string,
): { pageId: string; template?: PageTemplate } {
  if (path === "/") {
    const template = experience.resolvedTemplates.find(({ pageType }) => pageType === "home");
    return { pageId: template?.id ?? "home", template };
  }
  if (path.startsWith("/products/")) {
    const slug = path.slice("/products/".length);
    const product = release.products.find(
      (entry) => entry.slug === slug && entry.status === "published",
    );
    if (!product) return { pageId: `product:${slug}` };
    return {
      pageId: `product:${product.id}`,
      template: experience.resolvedTemplates.find(({ pageType }) => pageType === "product"),
    };
  }
  if (path.startsWith("/collections/")) {
    const slug = path.slice("/collections/".length);
    const collection = release.collections.find(
      (entry) => entry.slug === slug && entry.status === "published",
    );
    if (!collection) return { pageId: `collection:${slug}` };
    return {
      pageId: `collection:${collection.id}`,
      template: experience.resolvedTemplates.find(({ pageType }) => pageType === "collection"),
    };
  }
  const pageType = path === "/cart" ? "cart" : path === "/checkout" ? "checkout" : "content";
  return {
    pageId: path.slice(1) || "home",
    template: experience.resolvedTemplates.find(
      ({ pageType: candidate }) => candidate === pageType,
    ),
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
    priceLabel: new Intl.NumberFormat(locale, {
      currency: money.currency,
      style: "currency",
    }).format(money.amount / 100),
    resource,
    state: "populated",
    variants: variants.map((variant, index) => ({
      id: variant.id,
      label: variant.title,
      selected: index === 0,
    })),
  });
}

function collectionViewModel(collection: CatalogCollection): PresentationViewModel {
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
    resource,
    state: "populated",
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
  const { pageId, template } = matchingTemplate(experience, release, path);
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
      viewModels[instance.id] = collectionViewModel(collectionsById.get(binding.reference.id)!);
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
