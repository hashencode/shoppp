# Decor Store Theme Source Provenance

- Source identity: `templates/Crafto - The Multipurpose HTML5 Template/html/demo-decor-store.html`
- Source revision: `sha256:90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271`
- Imported on: 2026-08-11
- Ownership approval: Supplied Crafto package approved for repository-local Decor Store reconstruction.
- Import policy: hash-pinned Decor Store source implementation; source-relative paths are preserved below `upstream/`.
- Manifest: `../../../../../tools/storefront-theme-source-manifest.json`

## Runtime boundary

The exact declared jQuery and Revolution chain is eligible for the Decor Hero only; `js/main.js` remains a behavioral reference and is prohibited from application execution. The inactive particles add-on, PHP handlers, analytics, tracking, and remote resources are excluded.

The preserved executable chain is:

1. `js/jquery.js`
2. `revolution/js/jquery.themepunch.tools.min.js`
3. `revolution/js/jquery.themepunch.revolution.min.js`
4. `revolution/js/extensions/revolution.extension.actions.min.js`
5. `revolution/js/extensions/revolution.extension.layeranimation.min.js`
6. `revolution/js/extensions/revolution.extension.navigation.min.js`
7. `revolution/js/extensions/revolution.extension.slideanims.min.js`
8. the source `#decor-store-slider` initializer, transcribed as `decorStoreRevolutionOptions`

The initializer remains `standard`/`fullscreen`, with a `9000ms` delay, `stopLoop: on`, `stopAfterLoops: 0`, `stopAtSlide: 1`, keyboard and horizontal touch navigation, smart lazy loading, responsive levels `[1240, 1024, 778, 480]`, grid widths `[1220, 1024, 778, 480]`, grid heights `[900, 1000, 960, 720]`, visibility levels `[1240, 1024, 1024, 480]`, and the source simplify/focus fallbacks. The source particles add-on is omitted because the Hero markup and initializer do not activate it. `revkill()` plus theme-owned listener, observer, timer, and generated-state cleanup is the route-exit boundary.

## Preserved source order

Styles load as Revolution settings, layers, and navigation, followed by vendors, icons, shared style, responsive style, and Decor Store style. The audited Hero chain loads jQuery, vendors, Revolution tools/core, actions, layer-animation, navigation, and slide-animation before the source inline initializer. The initializer retains the source delay, stop behavior, responsive levels, grid geometry, keyboard/touch behavior, fallback, and destroy/remount obligations.

Google Fonts imports and preconnects are production-prohibited. Plus Jakarta Sans is supplied by the inspected hash-pinned local WOFF2. Secondary links and commerce actions map to existing routes or typed intents; newsletter, locale, and cookie adaptations remain truthful local state without PHP or invented success copy.

Evidence uses static, temporal, interaction, scroll/fixed, and fallback modes at 1440x1000, 1024x900, 768x1024, and 390x844. Required checkpoints are header + Hero + one card, first timed body behavior, complete desktop, and mobile/fallback completion.

- `js/main.js:1-3721` — adapter-reference-only: Behavioral specification for navigation, overlays, Swiper tracks, sticky controls, scroll progress, cookie dismissal, animation readiness, and teardown; prohibited from application execution.

## Theme-local adaptations

- The source DOM, class names, section order, Revolution markup, and source stylesheet order remain Decor-owned. Nuxt supplies only the route shell, selected-theme registry, and typed storefront intent boundary.
- Google Fonts and preconnects are replaced by the inspected local Plus Jakarta Sans WOFF2. All source images and icon fonts are served from the hash-pinned Decor namespace.
- Source `#` and `javascript:void(0)` action placeholders are represented as truthful local controls or the existing `/` route. Icon/image-only controls receive nonvisual accessible names, product tabs expose native tab semantics, and no unsupported action sends a request or invents success state.
- Newsletter submission, locale persistence, cookie persistence, PHP handlers, analytics, tracking, `js/main.js`, and the inactive particles add-on remain intentionally absent.
- Reduced motion, no JavaScript, dependency-load failure, initializer failure, and body-capability failure retain readable static content without blanking sibling regions.

## Acceptance evidence and measurements

The durable contract and command ledger is the Decor Store handoff section in `docs/progress/fashion-decor-source-equivalent-progress.md`. Generated browser evidence is written under `apps/storefront/test-results/decor-store/`; the four viewport source-equivalence cases contain independent `reference.png`, `implementation.png`, `diff.png`, and report attachments. The reference page and implementation run on independent origins.

Final four-viewport changed-pixel ratios at tolerance 16 are `0.0036479167` (1440x1000), `0.0011914063` (1024x900), `0.0000127157` (768x1024), and `0.0004496294` (390x844), all below the `0.01` source-equivalence budget. Manual side-by-side review found no unresolved P0/P1 discrepancy and uses zero visual waivers.

The motion-enabled cold profile records 104 requests, 618,468 raw bytes of initial application JavaScript, 382,482 raw bytes of Decor vendor JavaScript, 1,360,713 raw bytes of CSS, 304,540 raw bytes of fonts, and 2,180,523 raw bytes of images. Hero ready was approximately 3.60s on cold navigation and 3.51s after reload; both samples recorded zero long tasks. After the source layers settled, a hidden 750ms window produced no DOM mutation. The first and second 750ms post-unmount windows in the final acceptance sample contained 55 and 43 raw callbacks respectively, both within the explicit ceiling of 64 callbacks per window, plus zero Decor-owned `requestAnimationFrame` handles, zero Decor-owned interval handles, and zero DOM mutations. Timeout residue decreased from two to one: the first window contained one Nuxt timeout and one Revolution/GSAP tools timeout; the second contained only the Nuxt timeout. This is bounded, non-accumulating document-lifetime residue, not a claim of zero callbacks; exact raw counts remain attached for every run because document scheduling can vary.

The selected Decor preview emits 77,653 gzip bytes of initial JavaScript against the existing 204,800-byte budget and passes selected-theme isolation. Two consecutive reduced-motion Lighthouse commands passed without lowering thresholds. Their final performance samples were `0.96` with LCP `2577.33ms`/TBT `111.5ms`, and `0.96` with LCP `2606.52ms`/TBT `78ms`; accessibility was `0.92`, best practices `0.96`, and SEO `0.69`. The cold first attempt in each command was also retained: performance `0.52`, LCP `16228.06ms`/TBT `84ms`, then performance `0.52`, LCP `16334.74ms`/TBT `91.5ms`; the existing retry gate subsequently passed. The dedicated Axe gate reports zero critical or serious violations.

## Waivers, bounded residue, and deferred candidates

- Approved waivers: zero. The bounded raw callback residue above is recorded explicitly and does not grow after remount.
- There is no dormant framework Hero, partial Revolution/framework hybrid, or shared theme runtime/kernel in the Decor delivery.
- Post-acceptance candidates only: compare duplicated lifecycle loading/disposal seams, behavior-ledger adapters, selected-theme registration declarations, and source-equivalence capture utilities across accepted themes. They remain candidates for a separate decision; this delivery intentionally performs no shared extraction or Fashion runtime migration.

## Upstream optional references

- `revolution/css/settings.css` references `../assets/coloredbg.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../assets/gridtile.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../assets/gridtile_3x3.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../assets/gridtile_3x3_white.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../assets/gridtile_white.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../fonts/revicons/revicons.eot?5510888`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../fonts/revicons/revicons.eot?5510888#iefix`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../fonts/revicons/revicons.svg?5510888#revicons`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../fonts/revicons/revicons.ttf?5510888`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `../fonts/revicons/revicons.woff?5510888`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `closedhand.cur`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `revolution/css/settings.css` references `openhand.cur`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.
- `css/vendors.min.css` references `mCSB_buttons.png`, which is absent from the supplied package and unused by the Fashion home DOM. It is intentionally not replaced with a substitute asset.

## Imported files

- `upstream/css/icon.min.css` from `css/icon.min.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `022b07b389369593bd81c52b42f4bf82023ff132e2bfeb333aaf81b5c43c04d4`
- `upstream/css/responsive.css` from `css/responsive.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `7138e274b93c8ead4d8f38d6c2d78bb3d312c5075be933d8b2c42d7ec17f979b`
- `upstream/css/style.css` from `css/style.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `cd76dac4ef81d64578ab373b9f17ff6cd3520e9f5a32d842de9eff87a0f03de5`
- `upstream/css/vendors.min.css` from `css/vendors.min.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `311b7d8d26702239f15af05598f43e3fdeca39528ee31d5ac4f9cfbcbf059e5b`
- `upstream/demo-decor-store.html` from `demo-decor-store.html` — markup; Authorized supplied Crafto Decor Store source; SHA-256 `90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271`
- `upstream/demos/decor-store/decor-store.css` from `demos/decor-store/decor-store.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `1a14c16330d32dcc4f8f5aa8941ebe2ce85c85efb81d9b3c82fbe826fadc22e5`
- `upstream/fonts/bootstrap-icons.woff` from `fonts/bootstrap-icons.woff` — font; Authorized supplied Crafto Decor Store source; SHA-256 `bb1de989b83970f6f4e54de1cd974c5cba55b73582da5e1b225a6d0edf029483`
- `upstream/fonts/bootstrap-icons.woff2` from `fonts/bootstrap-icons.woff2` — font; Authorized supplied Crafto Decor Store source; SHA-256 `476adf42b40325098fcfa8b36ab3e769186bb4f6ce6a249753e2e1a9c22bf99e`
- `upstream/fonts/fa-brands-400.ttf` from `fonts/fa-brands-400.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `5656d596bc597165a42182f67b2b9f17d2ae47a9e3ef1b042b9a729739730705`
- `upstream/fonts/fa-brands-400.woff2` from `fonts/fa-brands-400.woff2` — font; Authorized supplied Crafto Decor Store source; SHA-256 `3a8924cd5203a28628716aedb5cef0943da4c3b44e3ffcee90ab06387b41c490`
- `upstream/fonts/fa-regular-400.ttf` from `fonts/fa-regular-400.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `5d02dc9b858e3c85a794f87e379857f4fedc4e26cf15001714a9a0e0b1d2294d`
- `upstream/fonts/fa-regular-400.woff2` from `fonts/fa-regular-400.woff2` — font; Authorized supplied Crafto Decor Store source; SHA-256 `2bccecf0bc7e96cd5ce4003abeb3ae9ee4a3d19158c4e6edfd2df32d2f0d5721`
- `upstream/fonts/fa-solid-900.ttf` from `fonts/fa-solid-900.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `fbbf06d7437aa30f3cd44c968380193545a8fc3eadfb7ad897bbb101eefec5a2`
- `upstream/fonts/fa-solid-900.woff2` from `fonts/fa-solid-900.woff2` — font; Authorized supplied Crafto Decor Store source; SHA-256 `9fc85f3a4544ab0d570c7f8f9bbb88db8d92c359b2707580ea8b07c75673eae2`
- `upstream/fonts/fa-v4compatibility.ttf` from `fonts/fa-v4compatibility.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `09663a36fc05e7190af8324b855105c5bb511ad94f94b81b34afee503279eca2`
- `upstream/fonts/fa-v4compatibility.woff2` from `fonts/fa-v4compatibility.woff2` — font; Authorized supplied Crafto Decor Store source; SHA-256 `4d4a2d7fd1c6684845cb174fdd7fc073bd64cb741286fb247f8b76c2b7b852c4`
- `upstream/fonts/feather.eot` from `fonts/feather.eot` — font; Authorized supplied Crafto Decor Store source; SHA-256 `93ae23284f34cdd155271e0b593aee42b58062bf0c72244abc7279ead3b43818`
- `upstream/fonts/feather.svg` from `fonts/feather.svg` — font; Authorized supplied Crafto Decor Store source; SHA-256 `7f0825fa0a9f3cddcce1311dd90840ed7d3e22328856c866cd2b6e38f95acd26`
- `upstream/fonts/feather.ttf` from `fonts/feather.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `6920da0983cb1c5365e75edc4eddc224590967d6421ddf7958ed4f4d351377e9`
- `upstream/fonts/feather.woff` from `fonts/feather.woff` — font; Authorized supplied Crafto Decor Store source; SHA-256 `ef3c47cb702e040372a3a4bce66d5e0ecc46c56325ec40f8c00b91da0d1d3f46`
- `upstream/fonts/icomoon.eot` from `fonts/icomoon.eot` — font; Authorized supplied Crafto Decor Store source; SHA-256 `3a835f8d7d4a1dda5ffdef26ddff48f7aa7a032071da0a8ce6225009409c3da1`
- `upstream/fonts/icomoon.svg` from `fonts/icomoon.svg` — font; Authorized supplied Crafto Decor Store source; SHA-256 `36d8cef6154b092edd384889ac5b01da6c7c7d048508efb55c681b061701b72f`
- `upstream/fonts/icomoon.ttf` from `fonts/icomoon.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `043ce6450843f8aa38fcbb2aeef2da40928c9f0853dd8342aafbda8be9be8748`
- `upstream/fonts/icomoon.woff` from `fonts/icomoon.woff` — font; Authorized supplied Crafto Decor Store source; SHA-256 `55167ff2dba40b2eb3734d4653b6a3b25a33094cfce64ffb09a23205f33777f7`
- `upstream/fonts/plus-jakarta-sans-latin.woff2` from `fonts/plus-jakarta-sans-latin.woff2` — font; Authorized inspected local Plus Jakarta Sans WOFF2; SHA-256 `cd8db90cd950e26bc8761f65d323588bd5cd112d326d6d322bc7c8ea86771215`
- `upstream/fonts/themify.eot` from `fonts/themify.eot` — font; Authorized supplied Crafto Decor Store source; SHA-256 `dff415daec911b65dca5be02071a1825b75508ff158de5b8d85976957db931cb`
- `upstream/fonts/themify.svg` from `fonts/themify.svg` — font; Authorized supplied Crafto Decor Store source; SHA-256 `2e2421027bbae2dddf9dd7f0374ad7eb9c3d75fbfa12eb64d32100d377eecf8c`
- `upstream/fonts/themify.ttf` from `fonts/themify.ttf` — font; Authorized supplied Crafto Decor Store source; SHA-256 `350663a4665e00072c68a87ad3fa0be47b8a91424127f5f3e09f664197295f01`
- `upstream/fonts/themify.woff` from `fonts/themify.woff` — font; Authorized supplied Crafto Decor Store source; SHA-256 `0db5c5a1475eb7a3e5028983ea1e642d1b2c00faff6a250a37502b0f3832a4a7`
- `upstream/images/apple-touch-icon-114x114.png` from `images/apple-touch-icon-114x114.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `341708303f20e97b9630dfcdf2e8758d555942a81e626829d715b8391d3a7339`
- `upstream/images/apple-touch-icon-57x57.png` from `images/apple-touch-icon-57x57.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `5a6e7e8fbfb1219fceb10359d5a637b016250f2204b16ab8815cd4ad4b5cef56`
- `upstream/images/apple-touch-icon-72x72.png` from `images/apple-touch-icon-72x72.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `2cb19c650c864f48eeabcf59d9270db366fb53a175b880df4e31d70a23667f1b`
- `upstream/images/contact-form-arrow-white.png` from `images/contact-form-arrow-white.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `0329cc8d0b59fcbcc25e9f1b9705142cd1e8847f96beb59abdff010e34ead193`
- `upstream/images/contact-form-down-arrow.jpg` from `images/contact-form-down-arrow.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `5189ea1a530348bb8965218949064d170927199f9d5b74d3a6a98d7077e147b0`
- `upstream/images/country-flag-16X16/france.png` from `images/country-flag-16X16/france.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `2629de759dd340f44743175bb4510aa6d438a37e3d94e079d2aa4e6032f71de9`
- `upstream/images/country-flag-16X16/russian.png` from `images/country-flag-16X16/russian.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `bc6c51350976a6cbe7cc8d0d08bd8b4c264070dad00cb61c0d28355ca28fae9b`
- `upstream/images/country-flag-16X16/spain.png` from `images/country-flag-16X16/spain.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `efbf0cf75d4b00bd5a0891a4de84ee10bd4dc6bdc7e2d33841d37fdf51263f8c`
- `upstream/images/country-flag-16X16/usa.png` from `images/country-flag-16X16/usa.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `4ac836d19ba59b13f74176339bbb73a752844e528a338bd9340c945d2f2895c5`
- `upstream/images/demo-decor-store-banner-04.jpg` from `images/demo-decor-store-banner-04.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `66e051e40f318c8860e6fc6ca33fa9e0b48f6a487fe683446a229b1ee5c2ba4f`
- `upstream/images/demo-decor-store-blog-03.jpg` from `images/demo-decor-store-blog-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `2a6b77cb9e743d6643d59dc10bea00d53bc646b42159f7ad341bfd9723244743`
- `upstream/images/demo-decor-store-blog-04.jpg` from `images/demo-decor-store-blog-04.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `3528389c694c3280c6384ac20fdbf05b72714981ae4ac10f00346311af705d76`
- `upstream/images/demo-decor-store-blog-07.jpg` from `images/demo-decor-store-blog-07.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `d8b50dc900e773d22ceec74b7e22d135c5977c5be7336126592d9870fb159201`
- `upstream/images/demo-decor-store-blog-08.jpg` from `images/demo-decor-store-blog-08.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `72d5fb42009c6b87366ce970d3d1b94d63628ed5af418de888076baabb000b3c`
- `upstream/images/demo-decor-store-client-01.png` from `images/demo-decor-store-client-01.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `8afe51f61a3ac538a02100806701fa42b6859cea86aade4f8ab2b291823438c2`
- `upstream/images/demo-decor-store-client-02.png` from `images/demo-decor-store-client-02.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `72acf1c388d1bf3bbf6cb7625d74c77a520557656299385d1b7d1c7ed33c1605`
- `upstream/images/demo-decor-store-client-03.png` from `images/demo-decor-store-client-03.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `9b7162520bfc801de37b564544881f8fa3660eab5b23ade402447ade0e9d9dd3`
- `upstream/images/demo-decor-store-client-04.png` from `images/demo-decor-store-client-04.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `f89ec329ce508494d030288064e3c66d558ae3915683027903b5ac7b4c8d78ee`
- `upstream/images/demo-decor-store-client-05.png` from `images/demo-decor-store-client-05.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `549242dd7871041c7dd21b784d2a8996c4600697b78cc75cd6cc7061e46bfa49`
- `upstream/images/demo-decor-store-footer-bg.jpg` from `images/demo-decor-store-footer-bg.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `fbda9ff90ad63374565c5e9d7f043131ebc753d4468449100f4c762fc54421ac`
- `upstream/images/demo-decor-store-icon-01.png` from `images/demo-decor-store-icon-01.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `1e88b606ad380b33347b426e4b2c18d15ba2ff16ebb8bfc6fd79e6abf7ac1e88`
- `upstream/images/demo-decor-store-icon-02.png` from `images/demo-decor-store-icon-02.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `f0b3f3f195abf4df9e90c55fa0fac98b1c61f48088a17f68534d888d83406a21`
- `upstream/images/demo-decor-store-icon-03.png` from `images/demo-decor-store-icon-03.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `36690cf010c6186567803fbd679a1a1c2da1807368a7b82caa74d9bb80a8cdb4`
- `upstream/images/demo-decor-store-icon-04.png` from `images/demo-decor-store-icon-04.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `4e69b6fd34a250206cc79fb81fbe6de12f415b0c348d53408cf7be6b2ed228b2`
- `upstream/images/demo-decor-store-icon-05.png` from `images/demo-decor-store-icon-05.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `976204602bbffccce8fa6e627052143a14c39561b858943d8a26bb857e3b16d0`
- `upstream/images/demo-decor-store-icon-06.png` from `images/demo-decor-store-icon-06.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `2388c1af1eb90062847124bbdb9f6add7b766bda4914385263efa1408e4a86fb`
- `upstream/images/demo-decor-store-icon-07.png` from `images/demo-decor-store-icon-07.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `91c6b093e916549dfa92cb2c3d31369a20179da4c5cab06d57c70c057322e24e`
- `upstream/images/demo-decor-store-icon-08.png` from `images/demo-decor-store-icon-08.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `a4607c544042891bd0f79a281f0378f9c360bf0e37177bb4b2d9435485f10018`
- `upstream/images/demo-decor-store-icon-09.png` from `images/demo-decor-store-icon-09.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `276855245df061ac56175dcde73c07b19cfa729459b8f6e2d9f05ec5a9790533`
- `upstream/images/demo-decor-store-icon-10.png` from `images/demo-decor-store-icon-10.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `5c8f8e6aee635452d9763a525dac168faa994355e56a75bd7b81052ab606e21b`
- `upstream/images/demo-decor-store-logo-black.png` from `images/demo-decor-store-logo-black.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `667d763440051f4275c39499fa3ab0f6dd2ee3c267f4537993c63ade5c04211c`
- `upstream/images/demo-decor-store-logo-black@2x.png` from `images/demo-decor-store-logo-black@2x.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `4043b614c16e96f3615b81bb1639cd1dfe0aabb8f9222b4ee53efbab61ff7018`
- `upstream/images/demo-decor-store-logo-white.png` from `images/demo-decor-store-logo-white.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `f17ea7965ba4fd09c7887fd4c019aa0443c638f36d0289f6705344b8e83b1bda`
- `upstream/images/demo-decor-store-logo-white@2x.png` from `images/demo-decor-store-logo-white@2x.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `b8681eb4fa0df2958b249147731db0f62edeec7930d10f04829c8a4460a4bfe8`
- `upstream/images/demo-decor-store-main-banner-01.jpg` from `images/demo-decor-store-main-banner-01.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `0369707b74459e63e93524405f1b1b2f0a2fbf96f81549f2f61d16640b450425`
- `upstream/images/demo-decor-store-main-banner-02.jpg` from `images/demo-decor-store-main-banner-02.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `1edf394126b5134f74c9a84a669e9eeef7f6fe8102a1a9651a6f4b81bdcb27d6`
- `upstream/images/demo-decor-store-main-banner-03.jpg` from `images/demo-decor-store-main-banner-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `56fe556e846fdf9c53eb64c6f7eca496310d96d0a7470dbe822fd106e006e81a`
- `upstream/images/demo-decor-store-menu-banner-01.jpg` from `images/demo-decor-store-menu-banner-01.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `88ff698a65da24b32a8978d926c2d8d5ae275bd48b4d4eff9a605784c4c83f5d`
- `upstream/images/demo-decor-store-menu-banner-02.jpg` from `images/demo-decor-store-menu-banner-02.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `00a3d46a750f6fda5744849f1d14932103466fd8e0127588ac706656467fa713`
- `upstream/images/demo-decor-store-menu-banner-03.jpg` from `images/demo-decor-store-menu-banner-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `27c47c12dbbc9563bcef4d761fe5526800d119c192f78a8f2db95ea3b2cbb1ef`
- `upstream/images/demo-decor-store-menu-banner-04.jpg` from `images/demo-decor-store-menu-banner-04.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `433b9b853ae2b1998d2a365453550f3129cecde5faa56f7890c778920b094af0`
- `upstream/images/demo-decor-store-menu-category-01.jpg` from `images/demo-decor-store-menu-category-01.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `bf6ada8dc0a74ba11eac00b4ebf707f170542df6a43779dc1bc3f54836a8243e`
- `upstream/images/demo-decor-store-menu-category-02.jpg` from `images/demo-decor-store-menu-category-02.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `c3c1f8119511677a77cabe6e4baf28da7f278969b45008391e1962610f40ba4c`
- `upstream/images/demo-decor-store-menu-category-03.jpg` from `images/demo-decor-store-menu-category-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `d42cfcf11584f03213e53951e57d83f1155e27a8beec691c58b7995f8c8ae24c`
- `upstream/images/demo-decor-store-menu-category-04.jpg` from `images/demo-decor-store-menu-category-04.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `f9aaa59c6c33cd1f619a53eaf83a4414fd29934d07d29bb1a38efad7d375696e`
- `upstream/images/demo-decor-store-menu-category-05.jpg` from `images/demo-decor-store-menu-category-05.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `0d325fbb63d41b2f62660826cc82cd3ab8387ba945d7a03195871cdb0f5296e3`
- `upstream/images/demo-decor-store-menu-category-06.jpg` from `images/demo-decor-store-menu-category-06.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `a23509844e0645a91ca8da161d0cb264bd5f8b0b545af710c7a1cf89b1075412`
- `upstream/images/demo-decor-store-payment-icon-01.png` from `images/demo-decor-store-payment-icon-01.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `12c7960a716d81a9d5003e7d473ced3f8ea30f7c0e583b71b8c3e73849d19b90`
- `upstream/images/demo-decor-store-payment-icon-02.png` from `images/demo-decor-store-payment-icon-02.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `cce62a78cf97cc728a08f13c25f2b80377d48c1d2af0f98c058db05568a0d321`
- `upstream/images/demo-decor-store-payment-icon-03.png` from `images/demo-decor-store-payment-icon-03.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `7479722e0b7901e9c5c0a806531a1ee7aad4ec2e09bb1c213f78836bac95c9e2`
- `upstream/images/demo-decor-store-payment-icon-04.png` from `images/demo-decor-store-payment-icon-04.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `00da36a2c7805e5f044f5b0bc48170240a52a9768de151f676318f427b413fb7`
- `upstream/images/demo-decor-store-product-01.jpg` from `images/demo-decor-store-product-01.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `c47c9b9d227ee6f5b08a38b5f80012b93cc1cc5bc5c70bb5cf083d357d85be0a`
- `upstream/images/demo-decor-store-product-03.jpg` from `images/demo-decor-store-product-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `7fd8289da9b8816fbae6273ae4f98a8d7fb9ea4d14ad768b4d11b0a7d6dcbc1e`
- `upstream/images/demo-decor-store-product-05.jpg` from `images/demo-decor-store-product-05.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `5d51f4516c085789e00ef2d773fdfe2704c5036f7b637f36adeff2336b76a065`
- `upstream/images/demo-decor-store-product-06.jpg` from `images/demo-decor-store-product-06.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `5847aad8d80250743b613aec41bc4eb46fcea33671a4c3d4289446019797d236`
- `upstream/images/demo-decor-store-product-09.jpg` from `images/demo-decor-store-product-09.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `57513bb832d4442bd9a698703cf3792eb3f85ae0aa0efd5a56973c1f15d42ca1`
- `upstream/images/demo-decor-store-product-10.jpg` from `images/demo-decor-store-product-10.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `d488fa7c791e9ef202cfbc42a6a0d279a23eb045c6fc05a64537e8c60687c1bc`
- `upstream/images/demo-decor-store-product-12.jpg` from `images/demo-decor-store-product-12.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `bfb9aab685cf17a58605d6e9b8a1437311c8e41ee69a57cdf13270b0b247f1cf`
- `upstream/images/demo-decor-store-product-13.jpg` from `images/demo-decor-store-product-13.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `1fbfbdf8a8c670e9f45873137fcd190befd444b941f1385470fc1b9c08a71ffd`
- `upstream/images/demo-decor-store-product-14.jpg` from `images/demo-decor-store-product-14.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `e17d64346f789f5d2a57686f7ce83a2e2c2f114ebc0c13ad371dd4b51314d2db`
- `upstream/images/demo-decor-store-product-15.jpg` from `images/demo-decor-store-product-15.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `e0a66c152c0c0dcedfb222bcd5f7421c883236f57f1df2e07905d687bfa37088`
- `upstream/images/demo-decor-store-product-slider-01.png` from `images/demo-decor-store-product-slider-01.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `481d69751c4bde76fa9c821c255a2b6482aed365fe887ee17c87a1485174ef44`
- `upstream/images/demo-decor-store-product-slider-02.png` from `images/demo-decor-store-product-slider-02.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `858a87aebdfcd33ccddbe4863bf01ee7323884e2ad13fc9f885b77787c2b83d0`
- `upstream/images/demo-decor-store-product-slider-03.png` from `images/demo-decor-store-product-slider-03.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `866393557185cc79d11e6ecf38a8a5f55fa20500ea2078f40ee1b60e321b5e0c`
- `upstream/images/demo-decor-store-product-slider-bg-img.jpg` from `images/demo-decor-store-product-slider-bg-img.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `c8eaee3addc081649d4bf7209dcbfd89c152d020266056cfbf6beee8e6ceeb61`
- `upstream/images/demo-decor-store-slider-01-img-01.png` from `images/demo-decor-store-slider-01-img-01.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `54594788dc41dc6506827c9545797222c230a27bdf4632f7abe5f1a9056ac0b4`
- `upstream/images/demo-decor-store-slider-01-img-02.jpg` from `images/demo-decor-store-slider-01-img-02.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `cf827b426ba54048799b35929bfc51ac92f07fb857392593964f26e4d9b1be72`
- `upstream/images/demo-decor-store-slider-01-img-03.jpg` from `images/demo-decor-store-slider-01-img-03.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `74addabd7ebed5e18d4f14655adc468053d42ea2ed1392cecc618778ba1211fc`
- `upstream/images/demo-decor-store-slider-01-thumb.jpg` from `images/demo-decor-store-slider-01-thumb.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `fda36e97ee8eec86980ad1097bdd79370a8ad89c8a79fcb41fb60dddf6b8df73`
- `upstream/images/demo-decor-store-slider-02-img-04.png` from `images/demo-decor-store-slider-02-img-04.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `611ac9ed11e9a2e6bacfd283107b48bdd4c686436aebd1f18f2752cfca9d1c5c`
- `upstream/images/demo-decor-store-slider-02-img-05.jpg` from `images/demo-decor-store-slider-02-img-05.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `599c5088c5d92f04f218d3916cc7cb3b5633ba7dfefe791b1ed833e09d319612`
- `upstream/images/demo-decor-store-slider-02-img-06.jpg` from `images/demo-decor-store-slider-02-img-06.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `e59189a7f35b592efe9f1f4cc5dff16a767d168e50de577314e2dd8e0644b60b`
- `upstream/images/demo-decor-store-slider-02-thumb.jpg` from `images/demo-decor-store-slider-02-thumb.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `9bb15c7bd916e01f69ce7c5d7cc1b57737c4032e4d4f61877f163deb24001678`
- `upstream/images/demo-decor-store-slider-03-img-07.png` from `images/demo-decor-store-slider-03-img-07.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `e10535e74004c9108d9baeedac01bf84e9bf559203c4bcc4ad16b23a18bf916f`
- `upstream/images/demo-decor-store-slider-03-img-08.jpg` from `images/demo-decor-store-slider-03-img-08.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `6997c10814f1db11b187f85fc4254f0c0053441b852a975cc2373edcfd461034`
- `upstream/images/demo-decor-store-slider-03-img-09.jpg` from `images/demo-decor-store-slider-03-img-09.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `7e2991a28aba601457783e4480c849c9a37aaeaf27715975ccbe276c402ed011`
- `upstream/images/demo-decor-store-slider-03-thumb.jpg` from `images/demo-decor-store-slider-03-thumb.jpg` — image; Authorized supplied Crafto Decor Store source; SHA-256 `2c6500ae5b3a48b77de35f4f758dcd1379215f62827c06641d880918b471ff96`
- `upstream/images/favicon.png` from `images/favicon.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `d9990aa0314c5918bc0bfde3a65d19e0f616baea95e236f247e41cb467c4fb84`
- `upstream/images/marker02.png` from `images/marker02.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `b5ee9172bae02ab88a4dbffcbe5f6889e4932e53e73c023b5cb2389a9d42887d`
- `upstream/images/mfg-close.png` from `images/mfg-close.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `8972efa9737fa05affa933cd8a203fb11545e2ce83ad303e7da930ccd23bcf3f`
- `upstream/images/rev-trans-tile.png` from `images/rev-trans-tile.png` — image; Authorized supplied Crafto Decor Store source; SHA-256 `3eb10792d1f0c7e07e7248273540f1952d9a5a2996f4b5df70ab026cd9f05517`
- `upstream/js/jquery.js` from `js/jquery.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `c30b56bf74c6057c8b9104b92d33b4ade752667fe4dcc1a5d121fc4336fffdf1`
- `upstream/js/vendors.min.js` from `js/vendors.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `33ce0c0ce7512617c8b0222f7d53f41541324edcdea2e79c5eec17402132d00e`
- `upstream/revolution/assets/loader.gif` from `revolution/assets/loader.gif` — image; Authorized supplied Crafto Decor Store source; SHA-256 `9034d5d34015e4b05d2c1d1a8dc9f6ec9d59bd96d305eb9e24e24e65c591a645`
- `upstream/revolution/css/layers.css` from `revolution/css/layers.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `cc830234af8b0e2ac01ad515ff209c43b29ba78d5145505a1088b18beefd2ac9`
- `upstream/revolution/css/navigation.css` from `revolution/css/navigation.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `1038275e66032987e6c39ffae357df2c861b140a97768fb16ac30e7f8be97173`
- `upstream/revolution/css/settings.css` from `revolution/css/settings.css` — stylesheet; Authorized supplied Crafto Decor Store source; SHA-256 `b0b1b6ccfa5a09e69e2e1e89777043a637e23f5b9aecc0a3a86e04495804b239`
- `upstream/revolution/js/extensions/revolution.extension.actions.min.js` from `revolution/js/extensions/revolution.extension.actions.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `748f3e447f2f7475a4ba75f6f2e2e9f468a3ac443eae879e2104ec562b2158bc`
- `upstream/revolution/js/extensions/revolution.extension.layeranimation.min.js` from `revolution/js/extensions/revolution.extension.layeranimation.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `3327922dbad940348d79019ec680c730d71649132fa727675303bea91c6c4010`
- `upstream/revolution/js/extensions/revolution.extension.navigation.min.js` from `revolution/js/extensions/revolution.extension.navigation.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `1c94040e2186822caf034fc3758f74f8372a5e8fbe42d5549061f27dd67d4142`
- `upstream/revolution/js/extensions/revolution.extension.slideanims.min.js` from `revolution/js/extensions/revolution.extension.slideanims.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `9dcf557a9e9a7d3641fddaf711b224610496a92cdaeef962ff85b1813f358cca`
- `upstream/revolution/js/jquery.themepunch.revolution.min.js` from `revolution/js/jquery.themepunch.revolution.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `4313fa5bb5c7788ced1058ecc60b11f4e384716bf51b64c3595a712a17e80ee8`
- `upstream/revolution/js/jquery.themepunch.tools.min.js` from `revolution/js/jquery.themepunch.tools.min.js` — visual-runtime; Authorized supplied Crafto Decor Store source; SHA-256 `a1dff8b0c66227748951c4ff891f146f49c5a382ac8e3d6e3c2e9cf8aa560dc8`
