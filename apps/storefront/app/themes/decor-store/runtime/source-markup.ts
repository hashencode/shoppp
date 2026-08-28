import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { decorStorePageContracts } from "../page-contracts";
import { decorStoreAssetId } from "../resources";
import {
  decorStoreBodySourceMarkup,
  decorStoreHeaderSourceMarkup,
  decorStoreHeroSourceMarkup,
  decorStoreTailSourceMarkup,
} from "./source-fragments.generated";

export {
  decorStoreBodySourceMarkup,
  decorStoreHeaderSourceMarkup,
  decorStoreHeroSourceMarkup,
  decorStoreTailSourceMarkup,
};

export type DecorStoreMarkupImagePriority = "default" | "deferred" | "hero";

const routePattern = /href="(demo-decor-store(?:-[^"]+)?\.html)"/g;
const routeBySourceEntry = new Map(
  decorStorePageContracts.map(({ path, sourceEntry }) => [sourceEntry, path]),
);
const assetPattern = /(src|data-at2x|data-lazyload)="(images\/[^"]+)"/g;
const backgroundAssetPattern = /url\(['"]?(images\/[^)'"]+)['"]?\)/g;

function accessibleImageLinkLabel(sourcePath: string): string {
  if (/logo/i.test(sourcePath)) return "Decor Store home";
  if (/payment-icon/i.test(sourcePath)) return "Payment method";
  if (/client-/i.test(sourcePath)) return "Client brand";
  if (/blog-/i.test(sourcePath)) return "Read journal article";
  if (/product-slider/i.test(sourcePath)) return "View collection product";
  if (/product-/i.test(sourcePath)) return "View product";
  if (/icon-/i.test(sourcePath)) return "View category";
  return "Open linked image";
}

function addAccessibleLinkNames(markup: string): string {
  return markup.replaceAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/g,
    (anchor, attributes: string, content: string) => {
      if (/\baria-label=/.test(attributes)) return anchor;
      const visibleText = content
        .replaceAll(/<[^>]+>/g, "")
        .replaceAll(/&(?:[a-z]+|#\d+);/gi, "")
        .trim();
      if (visibleText) return anchor;
      const sourcePath = content.match(/\bsrc="(images\/[^"]+)"/)?.[1];
      const className = attributes.match(/\bclass="([^"]+)"/)?.[1] || "";
      let label = "Open link";
      if (sourcePath) label = accessibleImageLinkLabel(sourcePath);
      else if (/facebook/i.test(className)) label = "Facebook";
      else if (/dribbble/i.test(className)) label = "Dribbble";
      else if (/twitter/i.test(className)) label = "Twitter";
      else if (/instagram/i.test(className)) label = "Instagram";
      else if (/\bbi-info\b/.test(content)) label = "Product information";
      return `<a${attributes} aria-label="${label}">${content}</a>`;
    },
  );
}

function applyImagePriority(markup: string, priority: DecorStoreMarkupImagePriority): string {
  if (priority === "default") return markup;
  if (priority === "deferred")
    return markup.replaceAll(/<img\b/g, '<img loading="lazy" decoding="async"');
  const firstSlideEnd = markup.indexOf("</li>");
  if (firstSlideEnd < 0) throw new Error("Decor Hero first slide boundary is missing.");
  return (
    markup.slice(0, firstSlideEnd).replaceAll(/<img\b/g, '<img decoding="async"') +
    markup.slice(firstSlideEnd).replaceAll(/<img\b/g, '<img loading="lazy" decoding="async"')
  );
}

export function prepareDecorStoreMarkup(
  markup: string,
  resolveAsset: ThemeAssetResolver,
  imagePriority: DecorStoreMarkupImagePriority = "default",
): string {
  return addAccessibleLinkNames(applyImagePriority(markup, imagePriority))
    .replaceAll(assetPattern, (_match, attribute: string, sourcePath: string) => {
      return `${attribute}="${resolveAsset(decorStoreAssetId(sourcePath))}"`;
    })
    .replaceAll(backgroundAssetPattern, (_match, sourcePath: string) => {
      return `url(${resolveAsset(decorStoreAssetId(sourcePath))})`;
    })
    .replaceAll(routePattern, (_match, sourceEntry: string) => {
      const route = routeBySourceEntry.get(sourceEntry);
      if (!route) throw new Error(`Unknown Decor Store source route: ${sourceEntry}`);
      return `href="${route}" data-decor-route-intent="navigation"`;
    })
    .replace('action="search-result.html"', 'action="/" data-decor-search-form=""')
    .replace(
      'class="search-form-icon header-search-form"',
      'class="search-form-icon header-search-form" role="button" aria-label="Open search" aria-controls="decor-store-search" aria-expanded="false"',
    )
    .replace(
      '<div class="search-form-wrapper">',
      '<div class="search-form-wrapper" id="decor-store-search" role="dialog" aria-modal="true" aria-label="Search">',
    )
    .replace(
      '<button type="submit" class="search-button">',
      '<button type="submit" class="search-button" aria-label="Search">',
    )
    .replace(
      'aria-controls="navbarNav" aria-label="Toggle navigation"',
      'aria-controls="navbarNav" aria-label="Toggle navigation" aria-expanded="false"',
    )
    .replaceAll(
      'role="button" data-bs-toggle="dropdown"',
      'role="button" tabindex="0" data-bs-toggle="dropdown"',
    )
    .replaceAll(/title="(Add to wishlist|Add to cart|Quick shop)"/g, 'title="$1" aria-label="$1"')
    .replace(
      '<a data-bs-toggle="tab" href="#tab_five1" class="nav-link active">',
      '<a data-bs-toggle="tab" href="#tab_five1" id="decor-products-tab-best" class="nav-link active" role="tab" aria-controls="tab_five1" aria-selected="true">',
    )
    .replace(
      '<ul class="nav nav-tabs border-0 justify-content-center text-uppercase fw-600 mb-50px sm-mb-20px alt-font fs-32 ls-minus-05px text-transform-none">',
      '<ul class="nav nav-tabs border-0 justify-content-center text-uppercase fw-600 mb-50px sm-mb-20px alt-font fs-32 ls-minus-05px text-transform-none" role="tablist" aria-label="Product collections">',
    )
    .replace(
      '<li class="nav-item"><a data-bs-toggle="tab"',
      '<li class="nav-item" role="presentation"><a data-bs-toggle="tab"',
    )
    .replace(
      '<li class="nav-item"><a class="nav-link" data-bs-toggle="tab"',
      '<li class="nav-item" role="presentation"><a class="nav-link" data-bs-toggle="tab"',
    )
    .replace(
      '<a class="nav-link" data-bs-toggle="tab" href="#tab_five2">',
      '<a class="nav-link" data-bs-toggle="tab" href="#tab_five2" id="decor-products-tab-new" role="tab" aria-controls="tab_five2" aria-selected="false" tabindex="-1">',
    )
    .replace(
      '<div class="tab-pane fade in active show" id="tab_five1">',
      '<div class="tab-pane fade in active show" id="tab_five1" role="tabpanel" aria-labelledby="decor-products-tab-best">',
    )
    .replace(
      '<div class="tab-pane fade" id="tab_five2">',
      '<div class="tab-pane fade" id="tab_five2" role="tabpanel" aria-labelledby="decor-products-tab-new" hidden>',
    )
    .replace(
      'class="slider-one-slide-prev-1 swiper-button-prev slider-navigation-style-06"',
      'class="slider-one-slide-prev-1 swiper-button-prev slider-navigation-style-06" role="button" tabindex="0" aria-label="Previous product"',
    )
    .replace(
      'class="slider-one-slide-next-1 swiper-button-next slider-navigation-style-06"',
      'class="slider-one-slide-next-1 swiper-button-next slider-navigation-style-06" role="button" tabindex="0" aria-label="Next product"',
    )
    .replace(
      '<a href="javascript:void(0);" class="text-dark-gray"><i class="feather icon-feather-globe"></i>English</a>',
      '<a href="#" class="text-dark-gray" role="button" aria-label="Choose language" aria-expanded="false"><i class="feather icon-feather-globe"></i>English</a>',
    )
    .replace(
      '<a href="javascript:void(0);"><i class="feather icon-feather-shopping-bag"></i>',
      '<a href="#" role="button" aria-label="Open cart" aria-expanded="false"><i class="feather icon-feather-shopping-bag"></i>',
    )
    .replaceAll('href="#"', 'href="/" data-decor-route-intent="navigation"')
    .replaceAll(/href="javascript:void\(0\);?"/g, 'href="/" data-decor-local-control=""');
}
