# Candidate evidence bundle profiles

This document describes CI-U7's implemented high-assurance signed profile. The current
solo-developer baseline does not require this profile, an offline root, a signer certificate, or a
signed retention witness. Baseline authority is defined by
`docs/architecture/ci-evidence-trust-and-retention.md` and retains exact source, full validation,
SHA-256 digests, secret scanning, durable read-back, and practical restore requirements.

The default profile uses `evidence:baseline:build`, `evidence:baseline:verify`, and
`evidence:baseline:restore`. It replaces `signature.json` with canonical `profile.json` containing
only schema version `1` and profile `solo-developer-baseline`. Its verifier requires an externally
supplied bundle digest, rejects signature/trust material and unknown files, and applies the same
source, report, capsule, toolchain, artifact, object, secret-scan, durable read-back, and restore
checks as the signed profile. The signed verifier rejects baseline profile material in return.

CI-U7.3 remains open only for one practical restore against the adopted Intel target; an ad-hoc copy
or retained post-commit report is not a substitute.

When explicitly activated, the signed bundle is a provider-neutral, content-addressed directory. Its
verifier needs local bytes and an independently distributed trust store; GitHub metadata, APIs,
checks, releases, and artifact URLs are optional projections and are not inputs.

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

1. require the operator-supplied expected digest to match both `bundle-digest.txt` and the
   recomputed inventory; the directory name is never authority;
2. require supported schemas, exact fields, canonical signed JSON, safe identities, and the
   approved policy version;
3. validate the root signature, usage, 90-day maximum signer lifetime, current validity, and
   revocation status;
4. verify manifest/provenance digests and the bundle signature;
5. verify every content-addressed object, the complete 17-gate passing report, receipt/toolchain
   linkage, artifact inventory, and the Git tree derived from the archived source bytes;
6. for restore, require the source target's signed retention witness to bind every target declared
   by that build, copy through a temporary sibling, reverify, and atomically rename.

Unknown roots, revoked or expired signers, mismatched source/report/capsule identities, missing
objects, altered bytes, renamed objects, and a wrong directory inventory all fail verification.

## Retention and recovery

Signed-profile finalization requires one successfully written and read-back-verified target followed
by a signed retention witness. The implemented profile requires that target set to include the
`intel-append-only` class; a VPS/object-lock target is not a substitute for the approved Intel
baseline. A second independently
administered VPS/object-lock target is recommended for disaster recovery but is not required. If
multiple targets are declared in one build, every declared target must verify before finalization;
the tool never silently ignores a failed configured replica. Repository code does not receive
storage credentials and cannot prove encryption, immutability, or administrative control merely
from path names, so the operator must establish and audit those properties externally.

Restore accepts the immutable bundle digest, verifies the source target's signed witness binds the
requested digest and the original declared target identities, verifies that source copy, copies
exact bytes through a unique temporary sibling, verifies it, atomically renames it to the
destination, and records new restore metadata. It never changes or fabricates the original
execution provenance. A single retained target is sufficient for this operation; when several were
declared, restore tries them in order and can recover from any surviving valid copy.
