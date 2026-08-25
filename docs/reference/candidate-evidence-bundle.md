# Candidate evidence bundle contract

The CI-U7 bundle is a provider-neutral, content-addressed directory. Its verifier needs local bytes
and an independently distributed trust store; GitHub metadata, APIs, checks, releases, and artifact
URLs are optional projections and are not inputs.

## Layout

```text
sha256:<bundle-digest>/
  audit.json
  bundle-digest.txt
  manifest.json
  provenance.json
  signature.json
  objects/<sha256-hex>
```

`bundle-digest.txt` is the SHA-256 inventory digest of every other relative path and exact file
byte. Object names equal their byte digest. Writes use a same-filesystem temporary directory and an
atomic rename; existing content-addresses are never overwritten.

`manifest.json` is canonical JSON and binds:

- policy version, exact source commit/tree, and deterministic `git archive` digest;
- `bun.lock` and the pinned release-capsule manifest;
- the passing full-release report and validation-class capsule receipt;
- the capsule image, platform, toolchain-manifest identity, and all deployable artifact digests.

`provenance.json` carries only attempt-specific issued time, attempt ID, executor identity, and
adapter identity. Thus a repeated attempt can retain a unique signed provenance record without
changing source authority.

`signature.json` contains the Ed25519 signer certificate, manifest/provenance digests, and the
signature over those two digests. The offline Ed25519 root signs the short-lived signer certificate;
the bundle never contains a private key.

`audit.json` contains allowlisted local-finalization metadata. Projection and restore events are
written as structured append-only operational audit records, because updating an audit record
inside a finalized bundle would change its content address.

## Verification order

The verifier fails closed and names the earliest invalid component:

1. require supported schemas, safe identities, and the approved policy version;
2. validate the root signature, usage, 90-day maximum signer lifetime, current validity, and
   revocation status;
3. verify manifest/provenance digests and the bundle signature;
4. verify every content-addressed object, source/report/capsule binding, and artifact-digest syntax;
5. verify the whole-directory content address.

Unknown roots, revoked or expired signers, mismatched source/report/capsule identities, missing
objects, altered bytes, renamed objects, and a wrong directory inventory all fail verification.

## Retention and recovery

Authoritative finalization requires exactly the two approved retention classes in different
declared administrative domains and a `2/2` copy plus read-back verification. The repository tool
accepts filesystem roots so the operator can expose an encrypted append-only Intel store and an
independently authenticated VPS/object-lock store through host-controlled mounts. Repository code
does not receive storage credentials and cannot prove administrative separation merely from path
names; the operator must establish and audit that external control.

Restore accepts the immutable bundle digest, verifies a surviving source copy, copies exact bytes
to a new destination, verifies the destination, and records new restore metadata. It never changes
or fabricates the original execution provenance.
