# Decor Store Theme Source Provenance

- Authority: `templates/Crafto - The Multipurpose HTML5 Template/html/demo-decor-store.html`
- Entry SHA-256: `90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271`
- Revision: `sha256:90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271`
- Ownership: supplied local Crafto package, approved for repository-local theme reconstruction.
- Manifest: `../../../../../tools/storefront-theme-source-manifest.json`
- Policy: `../../../../../tools/storefront-source-equivalence-policy.json`

## Source order and ownership

The source contract preserves the header, eight body sections, footer, cookie notice, sticky social
rail, and scroll-progress control in document order. Markup, copy, classes, links, images, and the
resolved source CSS cascade remain Decor-owned. Nuxt owns application routes and typed storefront
intents; adaptations must not add visible copy or pretend to complete unsupported backend work.

Styles load in this exact order: Revolution `settings.css`, `layers.css`, `navigation.css`, then
`vendors.min.css`, `icon.min.css`, `style.css`, `responsive.css`, and `decor-store.css`. Google Fonts
preconnect/imports are not production dependencies; inspected font binaries must be self-hosted.

## Revolution boundary

The audited Hero chain is jQuery, `vendors.min.js`, Revolution tools/core, then actions,
layer-animation, navigation, and slide-animation extensions, followed by the source inline
`#decor-store-slider` initializer. The initializer retains delay `9000`, responsive levels
`[1240,1024,778,480]`, grid widths `[1220,1024,778,480]`, grid heights
`[900,1000,960,720]`, keyboard/touch navigation, and source stop behavior.

The particles add-on is referenced by the document but no Hero markup or initializer activates it,
so it is excluded. `js/main.js` is a line-addressable behavior reference only, not an executable
application entry. PHP, analytics, tracking, remote fonts/images, and Revolution demo/editor assets
are prohibited.

## Integration adaptations

- Replace source remote font requests with inspected, hash-pinned local fonts.
- Map secondary-page links and commerce actions to existing safe routes or typed intents.
- Keep newsletter and locale behavior truthful and local; send no PHP request and show no invented
  success state.
- Keep a readable stable Hero slide for reduced motion, blocked dependencies, and initializer
  failure; isolate failure to the owning region.
- Destroy owned vendor state on route exit and prove one clean instance after remount.

## Executable evidence

`source-contract.ts` owns structural and absence parity, `behavior-contract.ts` owns state changes and
fallbacks, and `acceptance-adapter.ts` is the theme-local runner seam. Evidence uses static,
temporal, interaction, scroll/fixed, and fallback modes at `1440x1000`, `1024x900`, `768x1024`, and
`390x844`. Checkpoints are header + Hero + one card, first timed body behavior, complete desktop,
and mobile/fallback completion.
