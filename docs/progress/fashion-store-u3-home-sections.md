# Fashion Store U3 Home Section Evidence

This file retains focused U3 evidence only. The active FS-R3 plan remains the sole authority for the current stage, status, blocker, and next action.

## Characterized baseline

- The fixture and live Home paths render the same source-ordered region sequence: Hero, Services, Categories, Best Sellers, Promotion, Collection Feature, Brand Strip, Featured Products, Marquee, and Editorial.
- The historical `fashion-store@1.0.0` pages keep their page-owned shell and `fashion-store-main` landmark. Only the isolated `1.1.0`/schema-2 successor preset decomposes Home.
- Existing Home settings and the `fashion-store-home` binding owner remain stable. The successor adds stable singleton region instances without rewriting the historical package.

## Completed successor composition

- Ten stable Home instances and nine namespaced Section types are present in the successor manifest and source-parity preset. Best Sellers and Featured Products intentionally share the U1-approved `fashion-store.products` type while a composition-owned instance resolver selects their presentation.
- Dedicated fixture and live components own each stable region boundary. Their neutral renderer props, fixture schema, and live ViewModel schema remain separate; parsed Home payloads are cached per shared object without reconnecting live code to fixture modules.
- Renderer-owned shell composition is scoped explicitly to `pageTypes: ["home"]`; non-covered legacy templates keep their registry and page-shell behavior. The independent `rendererShell` opt-in preserves the existing global `platformShell` meaning.
- The renderer contributes the single successor Home shell and `fashion-store-main` landmark. Non-Home and platform routes inherit the Experience presentation shell instead of shadowing it with an undefined renderer context.
- Fixture data is deterministic and transaction-free. Live Home Section ViewModels are composed from the selected Catalog Release; empty bound collections render an explicit truthful status in both product regions.
- Successor merchandising order is the persisted stable Section order. The historical package retains `merchandising-order`; translating old overrides belongs to U6.2 and was not implemented early.
- Admin rejects hiding the final optional Home content Section, preserves the switch state, focuses the local owning-Section error, clears the error on reset or draft reload, and issues no save request for the rejected action.

## Review corrections retained

- Restored the historical fixture and live Home components after review found that reusing their names for shell-free successor implementations removed shells from the legacy registry.
- Restored the Product Card hydration guard so no-JavaScript purchase controls remain inert until the client owns the action.
- Split the strict full shell schema from the partial renderer-shell projection instead of weakening the existing presentation shell contract globally.
- Made partial composition descriptors explicitly page-type scoped and reject uncovered namespaced Sections on covered templates.
- Replaced the live Home ViewModel cast with schema parsing.
- Added persisted visibility/order rendering coverage and reciprocal empty-collection coverage.
- Split fixture and live validation helpers after simplification review found that the shared helper reintroduced a fixture dependency into the live graph.
- Centralized the two product-region instance variants and made unknown product instances fail closed.
- Both live browser configs now restore the checked-in fixture-preview generated runtime through a shared global teardown, including after the dedicated empty-collection run.

## Verification snapshot

- Storefront focused Bun suite: 67 passed, 0 failed, 705 expectations across Home source, successor theme, live commerce, and theme-engine tests.
- Storefront live Playwright suite: 15 passed, including Home, non-Home, platform-route shell presentation, authoritative Commerce facts, and cart/checkout behavior.
- Empty live Home Playwright probe: 1 passed, proving both product Sections expose a visible `role="status"` and render no Product Cards when the bound collection has no products.
- Decor Hero focused Playwright regression: 4 passed across desktop, laptop, tablet, and mobile.
- Static Fashion preview generation and Wrangler dry-run completed successfully with 34 prerendered routes before the final focused pass; the live empty-state run then proved its global teardown restores fixture-preview mode before the package-registry test executes.
- Storefront and Admin typechecks passed. Repository lint and import-boundary checks passed.
- Admin verification level: `L2`, because the change is a local behavior and focus-recovery branch with an explicit page boundary. The focused ThemeEditor unit file passed 29/29; the real-browser final-visible/focus case passed 1/1 with four unrelated cases skipped. Browser Mode was added because focus placement is a real-browser risk. Storefront contract changes additionally triggered the focused Storefront suite, Storefront typecheck, and repository boundary/lint checks.
- Simplification review: three quality findings and one efficiency finding were applied; no missed reuse was found. The proposed provider-wide binding/fixture pre-index was not applied because it would change generic provider construction/error timing outside U3.
