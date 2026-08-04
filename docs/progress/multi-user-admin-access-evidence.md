# Multi-user admin access evidence

Authority: `docs/plans/2026-08-04-001-feat-multi-user-admin-access-plan.md`.
This ledger tracks evidence without modifying the authoritative plan. It contains identifiers and
redacted outcomes only; credentials, cookies, and browser storage state are
forbidden.

Status vocabulary:

- **Local complete** — implemented and covered by repository gates.
- **Environment pending** — the fail-closed integration exists but requires provisioned test or
  production resources and environment-owned credentials.
- **Human pending** — a named person must perform or approve the operational check.
- **Production pending** — production authorization is blocked until the named evidence exists.

## Current authorization decision

**Not production-ready.** The complete 13-gate local staging release validator is green. A new
staging run must prove the password-authenticated human and Bearer-authenticated service paths after
the external identity proxy is removed. Two named enabled protected production administrators, a
recent production backup, and named promotion approval remain external gates. The workflow fails
closed when any is absent.

## Requirement evidence

| Contract | Status                              | Repository evidence                                                                                                                                                                                                                                                                                                                        | Remaining environment evidence                                                                 |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| R1-R2    | Local complete; Staging pending     | Human administrators use email/password and opaque `HttpOnly` sessions; automation uses independently hashed Bearer credentials. The API reloads identity, role, and permissions from D1 and has no external identity-proxy fallback.                                                                                                      | Re-run the public staging password-login and service-principal proof after perimeter removal.  |
| R3       | Local complete; Production pending  | `verify-environment-isolation` proves exactly `shoppp-staging` test D1 and `shoppp-production` production D1, rejects a third shared development database and every identity-plane crossover, and maps local authenticated development only to test. The production D1 ID was verified against the Cloudflare account on 2026-08-04.       | Attach strict production verifier output without changing production.                          |
| R4-R5    | Local complete                      | Normalized invitations, one-time password activation, versioned user/role changes, self-change, last-admin, dependency, escalation, and concurrency tests pass. Invitation validity and latest email-delivery outcome are exposed separately.                                                                                              | Real test invite/change/disable journey.                                                       |
| R6-R8    | Local complete                      | Canonical 21-permission catalog is schema-backed across contracts, seeded D1 roles, API checks, route guards, menus, and IAM UI. The 43-route API matrix fails if a route or permission is unregistered.                                                                                                                                   | None beyond the real journeys below.                                                           |
| R9-R12   | Local complete; Human pending       | Every protected request reloads enabled identity, enabled role, and current permissions from D1. Immediate disable/permission-change denial, exact admin-origin browser mutation checks, session revocation, and the service non-browser path are tested.                                                                                  | Rehearse D1 disable and session revocation with timestamps.                                    |
| R13-R14  | Local complete; Environment pending | IAM success/denial/conflict audit coverage includes rejected privilege escalation and commit-time role races, redacts passwords, session cookies, and service tokens, and attributes service actors as `machine`; unauthenticated failures use redacted security logs without D1 writes.                                                   | Correlate one real human and one service journey across application logs.                      |
| R15-R17  | Local complete                      | IAM UI covers loading, empty, denied, conflict, dependency, last-admin, grouped permissions, responsive and keyboard-accessible states. Guarded bootstrap creates only an invitation and refuses after an enabled protected human exists.                                                                                                  | Named first/second production administrators must be recorded before routine operation.        |
| R18-R19  | Local complete; Human pending       | Exact-host origin enforcement, deny-by-default API behavior, permission subset checks, confirmation/version conflicts, login throttling, and disabled-user next-request denial pass locally.                                                                                                                                               | Release owner confirms password custody, session duration, and recovery ownership.             |
| R20      | Local complete; Environment pending | Production-shaped migration preserves identity IDs, role equivalence, actor foreign keys, audit history, row counts, `quick_check`, and zero `foreign_key_check` rows. Trigger-maintained compatibility columns keep the immediately preceding API readable; rollback proof calls an authenticated session before restoring the candidate. | Complete test backup/restore rehearsal for this candidate and record the production backup ID. |

## Acceptance evidence

| Acceptance | Local evidence                                                                                                                                                                                    | Remaining proof                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AE1-AE3    | Missing/invalid password or session, exact invitation activation, authoritative session, role permissions, and browser-origin checks pass API/admin tests.                                        | Real test password login and invitation activation.                                |
| AE4-AE5    | User invite/change/disable and role create/edit/archive/subset/dependency workflows have allow, deny, stale-version, concurrency, and audit coverage.                                             | Named operator rehearsal in test.                                                  |
| AE6-AE10   | Full route-permission matrix, direct-route UI denial, self/last-admin/system-role invariants, confirmation dialogs, and audit attribution pass.                                                   | None beyond manual UX evidence retained by release owner.                          |
| AE11       | D1 identity/role disable and permission removal deny the next request despite an otherwise valid application session.                                                                             | Live session revocation/reacquisition proof.                                       |
| AE12       | Local service Bearer/session, machine audit, human-list exclusion, and password-change denial pass. `e2e/admin-access.spec.ts` implements the remote service proof and has no simulated fallback. | Run with the test environment service credential and retain the workflow artifact. |
| AE13       | Negative fixtures reject shared hostname, signing secret, service credential, Worker, D1, and any third remote development database.                                                              | Strict production verifier after real production provisioning.                     |
| AE14       | Empty and production-shaped migration fixtures preserve all legacy role/actor references and finish with clean integrity checks.                                                                  | Workflow pre/post-migration query artifacts for the selected remote candidate.     |

## Local automated gates (2026-08-04)

| Verification Contract gate      | Result                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` | Pass; 1,298 installs checked, no changes.                                                                                                    |
| `bun run lint`                  | Pass; ESLint and import-boundary checks clean.                                                                                               |
| `bun run typecheck`             | Pass for tools, root E2E, admin, API, storefront, contracts, DB, and domain.                                                                 |
| `bun run test`                  | Pass: tools 82, admin 268, storefront 18, contracts 11, DB fixture 1, domain 24.                                                             |
| `bun run test:workers`          | Pass: API 143/143 and DB/migration 10/10.                                                                                                    |
| `bun run test:admin-browser`    | Pass: 9/9, including IAM narrow-layout keyboard interaction.                                                                                 |
| `bun run build`                 | Pass: admin/API/storefront production builds and all Worker dry-runs.                                                                        |
| Admin local Playwright          | Pass: 7/7 against the built candidate with explicit `/admin/session` network fixtures and no stored auth state.                              |
| U8 tool contract                | Pass: deploy/release tests 11/11 before U9; final root tools suite includes those checks.                                                    |
| U8 remote service proof         | Staging rerun pending with environment-owned `E2E_ADMIN_SERVICE_TOKEN`; no proxy credential is required.                                     |
| Staging release validation      | Pass on committed candidate `fdb50aa`: all 13 gates and artifact digests recorded in release report `fdb50aa54aff-2026-08-04T09-09-45-974Z`. |
| Strict staging isolation        | Passes with exactly the test and production D1 topology and distinct application-owned auth secrets.                                         |
| Production release validation   | Production pending by design.                                                                                                                |

## Two-D1 topology

| Plane      | Name                | Repository identity                    | Allowed consumers                                                        |
| ---------- | ------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Test       | `shoppp-staging`    | `0c84c9e0-5ef1-4897-815e-5ec7efb7582e` | Local authenticated development, remote-dependent tests, test deployment |
| Production | `shoppp-production` | `e17ef1dc-d87c-40c7-b218-e4827d815168` | Production deployment only                                               |

Disposable local Miniflare state and an approved time-bounded restore target are not shared remote
environment bindings. No `shoppp-development` binding or third shared remote D1 is present.

## Environment and human evidence to attach

The release owner must attach these records to the immutable workflow/release ID:

- test and production admin hostname, signing-secret reference, service credential reference,
  password custodian, session policy, and deny-by-default confirmation;
- test service proof artifact showing mapped service session, allowed invitation revocation,
  `machine` audit event, human-list exclusion, and rejected human password change;
- `human_access_evidence_id` containing real test password login, expected role, one allowed read,
  one denied action, immediate D1 disable denial, session revocation, and failed reuse, with
  redacted request/audit IDs and timestamps;
- test pre-migration export/backup ID, migration list/apply output, zero foreign-key rows, enabled
  protected-human count, rollback/restore versions, and restore reconciliation;
- production strict-isolation output, at least two named enabled protected administrators, recent
  ready backup ID, migration/integrity output, human approver, and exact immutable artifact digest.

The GitHub `staging-human-access` evidence job is separate from the service-principal job. It
records the environment reviewer where the repository plan supports required reviewers; otherwise
it records the named workflow-dispatch actor and labels that fallback in the artifact. Production
promotion requires both evidence paths plus `PROMOTE <release-id>` and the approved backup ID. No
service-only result can satisfy the human gate.
