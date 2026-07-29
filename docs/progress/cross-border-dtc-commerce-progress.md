# Cross-Border DTC Commerce Implementation Progress

This file is the execution ledger for
`docs/plans/2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md`.
The plan remains the read-only authority.

## Current state

- Active unit: U4 — Build the API shell and admin identity boundary
- Branch: `codex/feat-cross-border-dtc`
- Goal mode: active
- Last updated: 2026-07-30

## Unit ledger

| Unit | Status      | Verification evidence                                                                                                                                                 |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1   | Complete    | Red: checker module missing. Green: frozen install, format, lint, typecheck, 3 boundary tests, build discovery, and aggregate release command.                        |
| U2   | Complete    | Imported 200 allowlisted blobs from `fdd1935…`; repeatability/exclusion 2/2, upstream 233/233, browser 8/8, typecheck and build passed; source status hash unchanged. |
| U3   | Complete    | Invariant red baselines observed. Domain/contracts 21/21, fixture 1/1, workerd+D1 6/6; Wrangler applied 46 statements, reapply no-op, FK and Drizzle checks passed.   |
| U4   | In progress | Reading Worker HTTP, Access JWT, RBAC, audit, redaction, idempotency, environment-isolation, and AE6/AE8 requirements.                                                |
| U5   | Pending     | —                                                                                                                                                                     |
| U6   | Pending     | —                                                                                                                                                                     |
| U7   | Pending     | —                                                                                                                                                                     |
| U8   | Pending     | —                                                                                                                                                                     |
| U9   | Pending     | —                                                                                                                                                                     |
| U10  | Pending     | —                                                                                                                                                                     |
| U11  | Pending     | —                                                                                                                                                                     |
| U14  | Pending     | —                                                                                                                                                                     |
| U12  | Pending     | —                                                                                                                                                                     |
| U13  | Pending     | —                                                                                                                                                                     |

## Human-owned production gates

- Merchant entity, Stripe eligibility, currencies, payout configuration, and webhook ownership.
- Product-category compliance, tax treatment, policies, tracking behavior, and shipping allowlist.
- Production Access policy, secrets, bindings, alerts, backup schedule, support, and escalation.
- Final approval of the immutable artifact that passes staging release validation.
