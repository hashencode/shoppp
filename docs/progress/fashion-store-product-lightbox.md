# Fashion Store Product lightbox evidence — FS-R1-U7

The active [FS-R1 plan](../plans/2026-09-03-1750-refactor-fashion-store-components-dependencies-plan.md) owns execution status.

The fixture Product gallery lightbox now uses Bootstrap Modal 5.3.2 instead of the native `dialog` element. The module is dynamically imported only from the client-side `open()` path, so SSR never evaluates its DOM-dependent module body. Bootstrap owns the backdrop, Escape handling, focus containment and body scroll lock; Vue continues to own the image, caption, counter, next/previous events and theme styles.

The invoking gallery control is remembered locally and receives focus after the hidden event when it still exists. Repeated opens reuse one instance. Unmount removes Bootstrap listeners, hides and disposes the instance. A failed dynamic import occurs before `show()`, leaves the page unlocked and the gallery entrance visible, clears the pending promise, and allows a later invocation to retry.

Focused modal interaction, route-unmount and three-engine results are appended with U11 verification. The implementation contains no `showModal` call.
