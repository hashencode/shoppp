# Storefront theme icon map

This inventory keeps large reference artwork separate from small functional controls. Crafto
artwork is copied or derived only from the user-supplied local package; Lucide is limited to
compact controls whose meaning comes from an accessible label.

## Fashion

| Reference element       | Source identity                                                | Theme asset / implementation                          | Render contract                                |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| Free shipping           | `fonts/icomoon.svg`, glyph `U+E6E5` (`line-icon-Box-Close`)    | `fashion.service-box` → `FashionServiceStrip.vue`     | Decorative original vector, 48 × 48 CSS pixels |
| Returns                 | `fonts/icomoon.svg`, glyph `U+EBD7` (`line-icon-Reload-3`)     | `fashion.service-return` → `FashionServiceStrip.vue`  | Decorative original vector, 48 × 48 CSS pixels |
| Secure payment          | `fonts/icomoon.svg`, glyph `U+E7C3` (`line-icon-Credit-Card2`) | `fashion.service-payment` → `FashionServiceStrip.vue` | Decorative original vector, 48 × 48 CSS pixels |
| Online support          | `fonts/icomoon.svg`, glyph `U+EB58` (`line-icon-Phone-2`)      | `fashion.service-support` → `FashionServiceStrip.vue` | Decorative original vector, 48 × 48 CSS pixels |
| Search, account, bag    | Functional control                                             | Lucide in `FashionHeader.vue`                         | 19px, button has an accessible name            |
| Store/follower metadata | Compact utility metadata                                       | Lucide in `FashionHeader.vue`                         | 14px, hidden from the accessibility tree       |
| Carousel previous/next  | Functional control                                             | Lucide in `FashionCollectionCarousel.vue`             | 18px, button has an accessible name            |

The four service vectors are extracted from the named Crafto IcoMoon glyph paths, not redrawn
with Lucide. They remain namespaced Fashion assets and do not load the 1.1MB Crafto icon font or
its global stylesheet.

## Decor

| Reference element        | Source identity                                                         | Theme asset / implementation                                                     | Render contract                              |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Featured category icons  | `images/demo-decor-store-icon-01.png` through `-05.png`, plus `-10.png` | `decor.icon-01` … `decor.icon-05`, `decor.icon-10` → `DecorCategoryShowcase.vue` | Original 65 × 65 PNGs                        |
| Free shipping            | `images/demo-decor-store-icon-06.png`, SHA-256 `2388c1af…e4a86fb`       | `decor.icon-06` → `DecorServiceStrip.vue`                                        | Original 60 × 50 PNG                         |
| Store locator            | `images/demo-decor-store-icon-07.png`, SHA-256 `91c6b093…322e24e`       | `decor.icon-07` → `DecorServiceStrip.vue`                                        | Original 60 × 50 PNG                         |
| Secure payment           | `images/demo-decor-store-icon-08.png`, SHA-256 `a4607c54…5f10018`       | `decor.icon-08` → `DecorServiceStrip.vue`                                        | Original 60 × 50 PNG                         |
| Online support           | `images/demo-decor-store-icon-09.png`, SHA-256 `27685524…90533`         | `decor.icon-09` → `DecorServiceStrip.vue`                                        | Original 60 × 50 PNG                         |
| Search, bag, add, arrows | Functional control                                                      | Lucide in Decor header, hero, products, collection, and category CTA             | 15–19px, control/link has an accessible name |
| Footer social links      | Compact linked utilities                                                | Lucide in `DecorFooter.vue`                                                      | 17px, link has an accessible name            |

`UPSTREAM.md` and `tools/storefront-theme-source-manifest.json` retain the full imported-file
hashes. Browser and theme-resource tests verify the namespaced asset identity, intrinsic size,
loaded state, and rendered geometry.
