import decorStoreSource from "../upstream/demo-decor-store.html?raw";
import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { decorStoreAssetId } from "../resources";

function between(start: string, end: string, from = 0): string {
  const startIndex = decorStoreSource.indexOf(start, from);
  if (startIndex < 0) throw new Error(`Decor source marker is missing: ${start}`);
  const endIndex = decorStoreSource.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`Decor source marker is missing: ${end}`);
  return decorStoreSource.slice(startIndex, endIndex + end.length);
}

export const decorStoreHeaderSourceMarkup = between(
  '<header class="header-with-topbar">',
  "</header>",
);

export const decorStoreHeroSourceMarkup = between('<section class="p-0">', "</section>").replaceAll(
  /\sdata-thumb="https?:\/\/[^"]*"/g,
  "",
);

const sourceSectionPattern =
  /<!-- start section -->\s*(<section[\s\S]*?<\/section>)\s*<!-- end section -->/g;
const sourceSections = [...decorStoreSource.matchAll(sourceSectionPattern)].map(
  (match) => match[1],
);
const bodyRegionKeys = [
  "featured-categories",
  "products",
  "promotional-marquee",
  "collection-carousel",
  "client-marquee",
  "journal",
  "services",
] as const;

if (sourceSections.length !== bodyRegionKeys.length + 1) {
  throw new Error(`Expected eight Decor source sections, received ${sourceSections.length}.`);
}

export const decorStoreBodySourceMarkup = bodyRegionKeys
  .map((key, index) => {
    const section = sourceSections[index + 1];
    if (!section) throw new Error(`The ${key} Decor source section is missing.`);
    return section
      .replace("<section", `<section data-decor-region="${key}"`)
      .replaceAll(/\sdata-anime='[^']*'/g, "")
      .replaceAll("grid-loading ", "");
  })
  .join("\n");

const footerStart = decorStoreSource.indexOf("<!-- start footer -->");
const scrollProgressEnd = decorStoreSource.indexOf("<!-- end scroll progress -->", footerStart);
if (footerStart < 0 || scrollProgressEnd < 0) {
  throw new Error("The Decor source footer and fixed-control tail is missing.");
}
export const decorStoreTailSourceMarkup = decorStoreSource
  .slice(footerStart, scrollProgressEnd + "<!-- end scroll progress -->".length)
  .replace(
    'action="email-templates/subscribe-newsletter.php" method="post"',
    'action="" data-decor-newsletter-form="" aria-label="Newsletter presentation"',
  )
  .replace(
    '<button class="btn pe-20px submit" aria-label="submit">',
    '<button type="button" class="btn pe-20px submit" aria-label="Newsletter unavailable in preview" aria-disabled="true">',
  )
  .replace(
    'class="btn btn-transparent-white border-1 border-color-transparent-white-light btn-very-small btn-switch-text btn-rounded w-100 mb-15px" aria-label="btn"',
    'class="btn btn-transparent-white border-1 border-color-transparent-white-light btn-very-small btn-switch-text btn-rounded w-100 mb-15px" data-cookie-choice="reject" aria-label="Reject cookies"',
  )
  .replace(
    'class="btn btn-white btn-very-small btn-switch-text btn-box-shadow accept_cookies_btn btn-rounded w-100" data-accept-btn aria-label="text"',
    'class="btn btn-white btn-very-small btn-switch-text btn-box-shadow accept_cookies_btn btn-rounded w-100" data-accept-btn data-cookie-choice="accept" aria-label="Allow cookies"',
  )
  .replace(
    'class="scroll-top" aria-label="scroll"',
    'class="scroll-top" role="button" aria-label="Back to top"',
  )
  .replaceAll('href="#"', 'href="/" data-decor-route-intent="navigation"');

const productGridIndex = decorStoreSource.indexOf(">Best sellers<");
const tableClockIndex = decorStoreSource.indexOf(
  'src="images/demo-decor-store-product-01.jpg"',
  productGridIndex,
);
const tableClockStart = decorStoreSource.lastIndexOf('<li class="grid-item">', tableClockIndex);
const tableClockEnd = decorStoreSource.indexOf("</li>", tableClockIndex);
if (tableClockIndex < 0 || tableClockStart < 0 || tableClockEnd < 0) {
  throw new Error("The representative Table clock card is missing from the Decor source.");
}
export const decorStoreProductCardSourceMarkup = decorStoreSource.slice(
  tableClockStart,
  tableClockEnd + "</li>".length,
);

const routePattern = /href="demo-decor-store(?:-[^"]+)?\.html"/g;
const assetPattern = /(src|data-at2x|data-lazyload)="(images\/[^"]+)"/g;
const backgroundAssetPattern = /url\(['"]?(images\/[^)'"]+)['"]?\)/g;

export function prepareDecorStoreMarkup(markup: string, resolveAsset: ThemeAssetResolver): string {
  return markup
    .replaceAll(assetPattern, (_match, attribute: string, sourcePath: string) => {
      return `${attribute}="${resolveAsset(decorStoreAssetId(sourcePath))}"`;
    })
    .replaceAll(backgroundAssetPattern, (_match, sourcePath: string) => {
      return `url(${resolveAsset(decorStoreAssetId(sourcePath))})`;
    })
    .replaceAll(routePattern, 'href="/" data-decor-route-intent="navigation"')
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
    );
}
