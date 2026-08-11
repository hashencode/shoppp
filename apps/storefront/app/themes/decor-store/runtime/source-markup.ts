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
const backgroundAssetPattern = /url\((images\/[^)]+)\)/g;

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
      '<a href="javascript:void(0);" class="text-dark-gray"><i class="feather icon-feather-globe"></i>English</a>',
      '<a href="#" class="text-dark-gray" role="button" aria-label="Choose language" aria-expanded="false"><i class="feather icon-feather-globe"></i>English</a>',
    )
    .replace(
      '<a href="javascript:void(0);"><i class="feather icon-feather-shopping-bag"></i>',
      '<a href="#" role="button" aria-label="Open cart" aria-expanded="false"><i class="feather icon-feather-shopping-bag"></i>',
    );
}
