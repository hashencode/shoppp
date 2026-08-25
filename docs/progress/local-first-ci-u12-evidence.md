# CI-U12 provider-neutral capsule evidence

Date: 2026-08-24

This file retains focused execution evidence only. The active CI plan remains the sole authority for
the current unit, blocker, next action, and completion status. This evidence supports the active
plan's CI-U12 closure; it does not create candidate, DC, PG, or production authority.

## Exact implementation

- Commit: `1893903c9dcfd6ee551820a774330f9c4ae3261e`
- Tree: `bd5cbbce33b68b3ca154f561743bd344d50d9a67`
- Capsule image ID: `sha256:502770d79fe6e31de590976939ff8768109d4e4b21a591d67a416d2d60a46cf6`
- Capsule manifest digest: `sha256:1bc81b5ca8a79dc134acaac793ab7ebb93069b5cd7cd018b80a00f1b54f525ba`
- Platform requested and recorded: `linux/amd64`
- Host: macOS ARM64 using OrbStack/Docker emulation
- Release ID: `ci-u12-1893903c`
- Release report SHA-256: `c0fe7fad04bcf3209ed284bfa2fc0a461b8f15848de12ad80211fa5a165427c8`
- Capsule receipt SHA-256: `82270fbe53d90696ba8d041be0e4d3a8720367c86bbe9c7a09e6867c01a78ca2`
- Receipt classification: `validation`; container exit: `1`; release status: `failed`

The image records Bun `1.3.5`, Node `v24.18.0`, Playwright `1.62.0`, Ubuntu `24.04.4`,
digest-pinned Bun and Playwright bases, exact system-command hashes, browser executable hashes, and
the image-owned manifest digest. Runtime execution used no network, dropped all capabilities, set
`no-new-privileges`, and mounted only the empty evidence directory.

## Gate result

| #   | Gate                   | Result | Duration |
| --- | ---------------------- | ------ | -------: |
| 1   | reproducible-install   | passed |    5.0 s |
| 2   | format                 | passed |   13.0 s |
| 3   | lint                   | passed |   23.4 s |
| 4   | types                  | passed |   60.0 s |
| 5   | source-equivalence     | passed |    6.3 s |
| 6   | theme-contracts        | passed |    1.8 s |
| 7   | fidelity-contract      | passed |    2.1 s |
| 8   | unit-contract          | passed |   77.6 s |
| 9   | worker-integration     | passed |   63.9 s |
| 10  | admin-browser          | passed |   14.4 s |
| 11  | representative-catalog | failed |  163.4 s |

The unit gate included 299/299 Admin tests, 187/187 API tests, and the repository tool suites. The
browser gate passed 12/12 tests. The representative-catalog gate failed only because the three
emulated Lighthouse performance scores were `0.78`, `0.76`, and `0.75` against the unchanged `0.90`
minimum. The final attempt reported FCP `1.4 s`, LCP `1.6 s`, and TBT `1,230 ms`.

Because validation is fail-fast, gates 12-17 did not execute: theme-matrix, production-builds,
static-output, browser-journeys, accessibility, and performance. An independent native amd64
same-source run is therefore still required before CI-U12 can close. Hosted Ubuntu remains a
separate adapter-compatibility check when GitHub Actions billing permits and is not closure
authority.

## Review and negative-path proof

The formal review covered correctness, project standards, testing, maintainability, security,
performance, reliability, and adversarial false-green behavior. It found and the implementation
closed these defects before the final run:

- ordinary checkouts could trust an unscoped `.release-source.json` marker;
- a minimal three-field report could be classified as valid capsule evidence;
- zero-exit invalid evidence could return command success;
- receipt and prior-image cleanup behavior was asserted from source text instead of executed.

The focused tests now pass 24/24, full typecheck passes, invalid or incomplete evidence fails closed,
and the final real capsule run produced a validation-class failed receipt rather than infrastructure
or passing evidence. The previous exact capsule image is retained on failure.

## Native Intel amd64 attempt

The same exact `1893903c9dcfd6ee551820a774330f9c4ae3261e` capsule image was exported with
transfer SHA-256 `6fff97751b12527de13cfbe505548d20042a5fa9bfed010e8bb8e026142f16ac`,
verified byte-for-byte after transfer, and run on Ubuntu 22.04.5 x86_64 with an Intel Core
i9-14900KF, 125 GiB RAM, and Docker Engine 29.3.0. Runtime isolation remained `--network none`,
`--cap-drop ALL`, `no-new-privileges`, a 2,048 PID limit, and a single empty evidence bind mount.

The native report has SHA-256
`06b6a3206a869f6eb099f895a7cdf6885e7d3e8189296ad2389d48de99e575ae`. Gates 1-10 passed.
Gate 11 also passed: homepage Lighthouse performance was `0.97`; representative collection,
product, cart, checkout, order, and policy routes reported `1.00`. Gate 12 then exposed two
successive repository contracts: the representative-Catalog cleanup restored Release but not
Experience selection, and after that cleanup was repaired the Fashion live fixture omitted the
required `mediaOrigins` field. A later static-output attempt also rejected secret-shaped Stripe test
literals, and the first browser-journey attempt showed that the capsule copied `bun` without its
`bunx` command. Each failure was fail-closed and repaired without changing gate semantics or the
`0.90` Lighthouse threshold.

Docker/OrbStack identified the exported image by OCI manifest digest
`sha256:502770d79fe6e31de590976939ff8768109d4e4b21a591d67a416d2d60a46cf6`, while Docker Engine
loaded the same verified archive under its image-config digest
`sha256:3da73e0df2af2abe5f38cf966f6ec5e981b0d81ea8a72a67652ab7005419effa`. This representation
difference is retained explicitly and must be normalized by artifact role rather than asserted as
raw digest equality.

## Native Intel amd64 passing run

The repaired exact source commit `47b6b340e1c75bb50b3c8a539bf08b6003766cb1` (tree
`28b6ea0727e58d92185047338da77dfbe0f98dc2`) was rebuilt and exported with archive SHA-256
`ee0071058533703d9eeb297f540c4b28c90b2a531eaf8014b7a9eb137f1cdaa7`. The Intel host verified the
same bytes, loaded image-config digest
`sha256:c5167b8cd2f0553ce533038e8a99e2d810bcfe61b5f31a4ec05b945dfd921e24`, and ran with no network,
all capabilities dropped, `no-new-privileges`, a 2,048 PID limit, 1 GiB shared memory, and only an
empty evidence bind mount. The originating OCI manifest-list ID was
`sha256:6278fc2502d4b8cdc58d17e0c8123eb1358eeb0fb08d733fcc94cfab09a16c6c`.

All 17 gates passed. The representative-Catalog gate covered 1,000 products and 5,000 variants;
the theme matrix completed its configured Decor and Fashion Store suites; production builds,
static sensitive-output checks, browser journeys, accessibility, and final performance all passed.
The run report is classified `passed` and has SHA-256
`6c929bf6908d11a03b8a63c480bdae0a8028223bc94e0a8cf75d2eb479a3f7cc`. Its immutable capsule
receipt is classified `validation`, records container exit `0`, the exact source/tree and pinned
Linux amd64 toolchain (including `bunx`), and has SHA-256
`5cb952e6315a554a61591a1f4d25a67eb4414a8b3546beee4766d4850582a61d`. GitHub-hosted Ubuntu
compatibility remains unexecuted while billing is unavailable; under the revised provider-neutral
authority this is an optional adapter check and not a CI-U12 blocker.
