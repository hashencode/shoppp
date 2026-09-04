# Fashion Store controlled quantity evidence — FS-R1-U3

The [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status. This note records the inspected behavior boundary and verification evidence.

## Existing contracts

| Consumer | Authority and normalization | Submission |
| --- | --- | --- |
| Fixture Product | Page-local quantity; finite values floor/clamp to 1–20, invalid values become 1 through `clampFashionStoreProductQuantity` | Buttons and committed text edits call `updateQuantity`; unchanged values do not record a preview intent; no Commerce request |
| Live Product | Page-local requested quantity; `MAX_CART_LINE_QUANTITY` in the shared Commerce contract is 20; `verifyProductCartAdd` remains the inventory/price and final normalization boundary | Editing quantity is local; Add remains the existing verified action with its pending/error state |
| Fixture Cart | Fixture line owns quantity; floor/clamp to 1–20 | A committed change updates the local fixture and preview intent only |
| Live Cart | Existing cart owner owns quantity and monetary totals; floor/clamp to 1–20 | One committed change invokes the existing cart port once; pending disables edits and failure retains the authoritative cart |

The shared input may hold an unfinished text draft, but cannot own committed cart state, inventory, requests or money. A commit must restore the displayed controlled value even when normalization produces the same value or the owner rejects an asynchronous update. Product, Cart and the plain live number input retain their existing markup classes and labels; no extra live increment/decrement controls are introduced.

## Verification — 2026-09-03

- Test-first fixture regressions reproduced 11 unchanged-value draft failures (empty, invalid text, fractions and bounds); live Product showed `3.8` after commit while its actual add boundary already normalized. The pre-change live pending/failure/request-count check passed and was retained as characterization.
- The component owns no reactive draft or business state. It resets the native input to the controlled prop before emitting one normalized `commit`; unchanged values emit nothing. Live Product uses the shared contract's maximum, and Cart retains its pending/error and authoritative owner behavior.
- Typecheck, fixture production build and 7 contract tests passed. Fixture Product/Cart desktop/mobile suite: 17 passed, 11 existing viewport-specific skips. Direct-input normalization then passed all 6 checks across Chromium/Firefox/WebKit.
- Live checks: 3 passed, including fractional requested quantity, exactly one add/PATCH, pending disabled controls, failed update restoration, successful retry and bidirectional MiniCart amounts/counts. Existing grouped-option, accessibility and no-JS checks remain in the live Product scenario.
- Retained artifacts/logs: `apps/storefront/test-results/fs-r1-u3/{red,live-product-red,fixture-green,engines,live-green}` and `/tmp/shoppp-fs-r1-u1-20260903/u3-*.log`.
- The live server uses a temporary Nuxt layer at `/tmp/shoppp-fs-r1-live-probe`, virtually rendering the two generated active modules from the existing live test input. It bypasses prepare scripts and uses a separate build directory. The user-edited generated file's SHA-256 stayed `8d6d803a0221c03e24a6087819b65b52faaa90e64888cb173d12c3b3402071e6`.
