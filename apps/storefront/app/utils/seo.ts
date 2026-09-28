import type { CatalogReleaseV3 } from "@shoppp/contracts";

export const resolveReleasedContentSeo = (release: CatalogReleaseV3, path: string) => {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const content = release.content.find(
    (record) => record.kind !== "policy" && record.route === normalizedPath,
  );
  if (!content) return undefined;
  const title = content.payload.seo?.title;
  const description = content.payload.seo?.description;
  return {
    title: typeof title === "string" && title.trim() ? title : content.title,
    description:
      typeof description === "string" && description.trim()
        ? description
        : content.payload.summary?.trim() || content.title,
  };
};

export interface SeoProduct {
  slug: string;
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  media: ReadonlyArray<{ src: string; alt: string; width: number; height: number }>;
  variants: ReadonlyArray<{
    sku: string;
    prices: ReadonlyArray<{ amount: number; currency: string }>;
  }>;
}

export const canonicalUrl = (origin: string, path: string) =>
  `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

export const productStructuredData = (product: SeoProduct, origin: string) => {
  const price = product.variants[0]?.prices[0];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.media.map((media) => canonicalUrl(origin, media.src)),
    sku: product.variants[0]?.sku,
    offers: price
      ? {
          "@type": "Offer",
          price: (price.amount / 100).toFixed(2),
          priceCurrency: price.currency,
          url: canonicalUrl(origin, `/products/${product.slug}`),
        }
      : undefined,
  };
};

export const breadcrumbStructuredData = (
  items: Array<{ name: string; path: string }>,
  origin: string,
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: canonicalUrl(origin, item.path),
  })),
});
