# Storefront theme references

This tree is audit evidence, not a selectable theme registry or a build input. Runtime code must not
import from it.

The `decor` and `decor-store` directories retain the frozen source and behavior contracts,
acceptance-adapter ledger, provenance, and source digests for the two retired technical identities.
Their shared authoritative HTML and approved source assets remain under
`templates/Crafto - The Multipurpose HTML5 Template/html`, which is independent of the Storefront
runtime graph. `tools/storefront-theme-source-manifest.json` retains the hash-pinned intake manifest.

Supported historical audit uses are:

- verify source identity, provenance, and SHA-256 digests;
- inspect region, behavior, named-state, and adaptation decisions;
- decode immutable historical snapshot metadata and payloads by their original theme ID;
- compare the Fashion-owned successor against the approved source without re-enabling a Decor
  package.

Exact visual replay of a retired Decor runtime is not a supported production capability. Git history
at the recorded FS-R3 U7 recovery ref is the recovery mechanism if an authorized audit requires the
old resolver and runtime files.
