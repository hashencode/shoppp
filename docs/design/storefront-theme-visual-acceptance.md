# Storefront Theme Visual Acceptance

For a source-equivalent HTML-template port, this document is subordinate to the
[source-equivalent porting workflow](../runbooks/source-equivalent-html-template-port.md) and the
machine-readable policy in `tools/storefront-source-equivalence-policy.json`. Source HTML,
contributing CSS, runtime initialization, and original assets define the expected result;
screenshots do not define the implementation.

## Required evidence

Review Fashion and Decor independently at desktop, current mobile Chrome dimensions, no JavaScript,
and reduced motion. Exercise home, collection, product, cart, checkout, order, and policy routes
with representative non-empty fixtures. Also inspect every meaningful empty, loading, unavailable,
validation-error, and success presentation.

Automated evidence must include:

- a visible level-one heading and meaningful static content on every route;
- primary and legal navigation, image alternative text, explicit image dimensions, and no
  horizontal overflow;
- no critical or serious WCAG A/AA violations;
- keyboard access using native controls and a working skip link;
- reduced-motion behavior without content loss;
- mobile Lighthouse thresholds and the repository JavaScript budget;
- no inactive-theme classes, assets, prohibited vendor runtime, or external font request.

Record screenshots only from the immutable fixture build being reviewed. Record the commit, theme
and schema versions, preset, viewport, route, fixture state, browser, and any accepted exception.
An intentional difference requires a current policy waiver with a stable route/region target,
owner, approver, rationale, and expiration. Aggregate full-page similarity cannot waive a failed
named state, wrong destination, missing content, or inert control.

Bulk comparison is script-first. Retain changed-pixel ratios, tolerance, diff bounds, computed
style and geometry deltas, ranked regions, heatmaps, and a small number of high-signal crops. Limit
browser/capture concurrency to two and run heavy full-page or named-state batches with one worker by
default.

## Fashion acceptance

Fashion should read as restrained editorial commerce: strong typographic hierarchy, generous
negative space, high-contrast ink and paper, and a deliberate acid accent. The masthead, editorial
hero, optional story, product presentation, and footer must feel related without masking required
transaction, legal, focus, or error regions.

Reject the build if responsive layouts collapse the editorial rhythm, if decoration precedes
content in focus order, or if hiding an optional story affects required capabilities.

## Decor acceptance

Decor should read as layered, tactile, and domestic: clay or sage accents, grounded green ink,
overlapping native-CSS planes, and compact geometric edges. Layering must retain readable contrast
and must not create overflow, focus traps, or animation dependence.

Reject the build if a decorative layer obscures controls, if mobile navigation loses an accessible
name, or if the no-JavaScript document loses the layered hero's message.

## Approval boundary

Visual acceptance approves a theme package and fixture experience for private preview. It does not
approve production activation, business adapters, real product data, or transaction behavior.
