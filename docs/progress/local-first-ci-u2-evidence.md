# Local-First CI-U2 Evidence

Date: 2026-08-24  
Unit: `CI-U2`  
Final commit: `bca6fede118dbcc8200f20ea3e857e5b6178c72f`

This file retains focused implementation and verification evidence only. Current-unit and next-action
authority remain in the active CI plan.

## Implemented boundary

- Retired the mixed PR/main/scheduled `.github/workflows/ci.yml` responsibility.
- Added a trusted non-deletion `main` advisory post-commit adapter with read-only permissions,
  immutable checkout identity, non-persistent credentials, full-SHA action pins, bounded timeout,
  exact provider-neutral report identity, and one exact artifact path.
- Added manual/scheduled hosted full validation with the existing 17-gate `release:validate`
  semantics, Linux browser/font prerequisites, immutable checkout, full-SHA action pins, and one
  exact release-report path.
- Added no PR or `pull_request_target` trigger. Production deployment remains hosted and unchanged.
- Did not edit, reuse, or reinterpret FS-U8 preparation, acceptance, preview, runner, environment,
  evidence, or checkpoint boundaries.

## Test-first and final proof

- Initial proof-first run: 7 failures because `post-commit-ci.yml` and `full-validation.yml` did not
  exist.
- Final primary-checkout focused proof: 34 passed, 0 failed, 408 assertions across
  `tools/ci-workflow.test.ts` and `tools/deploy-workflow.test.ts`.
- Final clean-clone proof at the exact commit: 31 passed, 0 failed, 328 assertions. The three U8-only
  tests were correctly absent because their staged feature files were not part of the CI commit.
- Ruby YAML parsing passed for both new workflow files. Focused Prettier, ESLint,
  `tsconfig.tools.json` typecheck, and diff checks passed.
- The shared deployment-contract test's pre-existing U8 staged patch retained stable patch ID
  `cd7b6d3cbdba7647f39bca8b7826b3954bf12028` before and after the CI-only commits.

## Simplification review

- Reuse review: no behavior-equivalent repository helper could replace the exact checkout proof or
  workflow-specific contracts.
- Quality review: renamed the migrated hosted-full-validation test vocabulary.
- Efficiency review: cached CI workflow reads and parallelized feature-workflow reads.

## Temporary clone lifecycle

- Exact final-verification path: `/tmp/shoppp-ci-u2-final.FoutNM/checkout`.
- Owner/purpose: Codex, clean exact-commit CI-U2 workflow-contract verification isolated from active
  FS-U8/IAM work.
- The clone remained clean and created no material ignored dependency or build output.
- Cleanup used `/usr/bin/trash /tmp/shoppp-ci-u2-final.FoutNM` and verified that the original path no
  longer existed.
