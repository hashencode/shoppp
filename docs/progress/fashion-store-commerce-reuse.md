# Fashion Store commerce reuse evidence — FS-R1-U8

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status.

## Reused behavior

Fixture ProductCard and live Product already call the same `verifyProductCartAdd` boundary before mutating the shared cart. Their surrounding flows remain separate because the fixture card records preview intent while the live product owns variant selection, pending state, API errors and authoritative cart synchronization.

MiniCart, Cart and Checkout used identical one-line wrappers around `formatCommerceMoney`. They now import that formatter under the local `money` name, removing three duplicate functions without changing call sites or formatting behavior.

## Deliberately retained differences

No new generic pending/error component was extracted. ProductCard, LiveProduct, MiniCart, Cart and Checkout expose different actions, recovery paths and status placement, so they do not have two equivalent UI consumers to justify a shared abstraction.

Cart and Checkout also retain their separate line/totals presentation. Checkout owns billing and alternate shipping addresses, country, optional phone and second address line, stale-quote sequencing, payment and Turnstile state. Cart owns the shipping estimator, coupon and direct quantity/removal interactions. The existing platform ports and cart state remain their shared source of truth; flattening those page-specific fields would remove behavior rather than deduplicate it.

## Verification

The focused Cart, Checkout, live-commerce and Product contract tests passed. The desktop/mobile fixture Cart and Checkout run passed 15 applicable checks with 9 intentional project skips, covering source geometry, quantity normalization, removal, shipping/coupon validation, optional account and shipping fields, payment keyboard behavior, transaction isolation and remount fallback. Live browser coverage remains part of the final U11 run. No API, request-order, money, inventory or field semantics were changed by this unit.
