# Cross-Border DTC Commerce Implementation Progress

This file is the execution ledger for
`docs/plans/2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md`.
The plan remains the read-only authority.

## Current state

- Active unit: U2 — Import the admin template safely
- Branch: `codex/feat-cross-border-dtc`
- Goal mode: active
- Last updated: 2026-07-30

## Unit ledger

| Unit | Status      | Verification evidence                                                                                                                          |
| ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| U1   | Complete    | Red: checker module missing. Green: frozen install, format, lint, typecheck, 3 boundary tests, build discovery, and aggregate release command. |
| U2   | In progress | Approved upstream commit `fdd1935d35b1919ae6673970e8c428777c71d261` exists locally; import reads the commit, not the dirty source worktree.    |
| U3   | Pending     | —                                                                                                                                              |
| U4   | Pending     | —                                                                                                                                              |
| U5   | Pending     | —                                                                                                                                              |
| U6   | Pending     | —                                                                                                                                              |
| U7   | Pending     | —                                                                                                                                              |
| U8   | Pending     | —                                                                                                                                              |
| U9   | Pending     | —                                                                                                                                              |
| U10  | Pending     | —                                                                                                                                              |
| U11  | Pending     | —                                                                                                                                              |
| U14  | Pending     | —                                                                                                                                              |
| U12  | Pending     | —                                                                                                                                              |
| U13  | Pending     | —                                                                                                                                              |

## Human-owned production gates

- Merchant entity, Stripe eligibility, currencies, payout configuration, and webhook ownership.
- Product-category compliance, tax treatment, policies, tracking behavior, and shipping allowlist.
- Production Access policy, secrets, bindings, alerts, backup schedule, support, and escalation.
- Final approval of the immutable artifact that passes staging release validation.
