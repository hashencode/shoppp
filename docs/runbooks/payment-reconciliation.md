# Payment Reconciliation

## Trigger

Use this runbook for a signed webhook that failed processing, a checkout stuck in
`payment_pending`, a provider-recovery job in `dead_letter`, or a health panel payment failure
count above zero.

## Procedure

1. Open Admin → Automation recovery and filter by `payment_reconciliation`.
2. Confirm the job/order reference against Stripe using a least-privilege operator account. Do
   not paste provider payloads, secrets, customer email, or guest links into notes.
3. If the job is `dead_letter`, choose Replay, enter the evidence and reason, and explicitly
   confirm. Replay retains the same business identity and is idempotent.
4. Confirm the order timeline converges to provider truth and that at most one order exists for
   the checkout attempt.
5. Confirm reservation state: paid checkouts are confirmed; terminal failed/expired checkouts
   release stock.
6. Record the request ID, job ID, order reference, provider event ID (not payload), actor, and
   result in the incident record.

## Verification

Run the Worker convergence suite locally before changing recovery code:

```sh
cd apps/api
bunx vitest run test/payments/checkout.test.ts test/automation/recovery-api.test.ts
```

Escalate when the same event remains dead-lettered after one reasoned replay, provider state
cannot be retrieved, order cardinality is greater than one, or inventory does not reconcile.
