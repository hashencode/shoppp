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
          availability: "https://schema.org/InStock",
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
