# Fashion Store product payment icon correction

The user approved normalizing Payment method 6 on `/products/relaxed-corduroy-shirt`.
The upstream UnionPay SVG has a transparent logo without the card background present in
the other assets. The source template also omits the last image's bottom margin, placing
it 2.5px below the preceding five icons in the desktop preview.

The product component now applies the same 5px bottom margin to every payment image.
A product-scoped class gives UnionPay a 48 × 30px white card, a 1px theme-gray border,
3px corners and inset spacing while preserving the logo's aspect ratio. Upstream assets
remain unchanged. This is a user-approved visual departure from the upstream template.

Verification on the local Chrome preview at `http://127.0.0.1:3435`:

- Before: all images were 30px high; UnionPay's top was 2.5px below the others.
- After: all six images were 30px high with identical top coordinates and 5px bottom
  margins. UnionPay's computed card was 48px wide, white, with a 1px `rgb(228, 228, 228)`
  border. The desktop screenshot confirmed aligned card frames and an inset logo.
- `bun test apps/storefront/tests/fashion-store-product.test.ts`: 4 passed.
- Prettier checks passed for both implementation files. Targeted manual diff review
  found no additional issues; no broader refactoring was needed for this local style fix.

This internal correction does not change REL-Pre-DC eligibility, candidate identity,
DC/PG state, plan unit status, execution order, blockers or tail ownership. It is local
verification evidence, not formal candidate or cross-template regression evidence.
