import type { ThemeAssetResolver } from "../../../theme-engine/assets";
import { decorStoreAssetId } from "../resources";
import {
  decorStoreBodySourceMarkup,
  decorStoreHeaderSourceMarkup,
  decorStoreHeroSourceMarkup,
  decorStoreProductCardSourceMarkup,
  decorStoreTailSourceMarkup,
} from "./source-fragments.generated";

export {
  decorStoreBodySourceMarkup,
  decorStoreHeaderSourceMarkup,
  decorStoreHeroSourceMarkup,
  decorStoreProductCardSourceMarkup,
  decorStoreTailSourceMarkup,
};

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
