# Commerce State Dimensions

Commerce state is deliberately split so an operational action cannot rewrite financial truth.
The domain transition policies, D1 constraints, and admin timelines must agree with this document.

## Independent dimensions

| Dimension        | States                                                                                  | Authority                                           | Monotonic and compensating rules                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout attempt | `validating`, `payment_pending`, `completed`, `failed`, `expired`                       | API plus signed provider truth                      | A terminal failure or expiry releases the reservation. A redirect never completes an attempt.                                                |
| Payment          | `pending`, `authorized`, `paid`, `failed`, `canceled`, `partially_refunded`, `refunded` | Payment adapter and verified webhook/reconciliation | Out-of-order events cannot demote payment. Refunds append financial events instead of rewriting the paid snapshot.                           |
| Order            | `checkout_pending`, `confirmed`, `processing`, `completed`, `canceled`                  | Order use cases                                     | Creation occurs once after an approved payment. Cancellation is a reasoned compensating operation.                                           |
| Fulfillment      | `unfulfilled`, `picking`, `packed`, `shipped`, `delivered`, `canceled`                  | Fulfillment use cases                               | Fulfillment cannot start before approved payment; shipment requires carrier and tracking facts.                                              |
| Reservation      | `active`, `confirmed`, `released`, `expired`                                            | Conditional D1 inventory writes                     | Only `active` consumes reserved quantity. Confirmation decrements on-hand once; release/expiry returns availability once.                    |
| Notification job | `pending`, `processing`, `sent`, `failed`, `dead_letter`                                | Queue/Workflow consumer plus D1 claim               | Attempts append; retry is bounded; replay reuses the original business identity.                                                             |
| Catalog release  | `approved`, `building`, `deployed`, `failed`                                            | Publication API and authenticated build callback    | An immutable approved manifest moves to `building`, then exactly one terminal result. The prior deployed storefront remains live on failure. |

Payment, order, and fulfillment states are always displayed separately in
`apps/admin/src/pages/orders/order-detail.tsx`. The immutable checkout and order snapshots are
protected by D1 triggers in `packages/db/migrations/0004_commerce_operations.sql`.

## Convergence rules

1. Cart totals and availability are revalidated before reservation and payment creation.
2. A provider redirect may only display pending state; it cannot create or fulfill an order.
3. The signed event is deduplicated by provider event ID and reconciled against a retrieved
   provider session.
4. An approved provider state creates one order snapshot and confirms one reservation.
5. Fulfillment, cancellation, refund, and notification transitions append their own facts and
   never collapse the other dimensions.

The invariant suites are `packages/domain/test/order-state.test.ts`,
`apps/api/test/inventory/concurrency.test.ts`, `apps/api/test/payments/checkout.test.ts`, and
`apps/api/test/operations/orders.test.ts`.
