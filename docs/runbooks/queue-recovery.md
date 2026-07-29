# Queue and DLQ Recovery

## Procedure

1. Open Admin → Automation recovery. Filter by status `dead_letter` and the relevant job type.
2. Expand the job to inspect bounded attempts and stable error codes. Recipient values are masked.
3. Correct the external cause first: email-provider availability/configuration, payment-provider
   reachability, or invalid destination data.
4. Replay only the same job through the admin action. Supply a reason and confirm. Never publish a
   replacement Queue message manually because that bypasses D1 deduplication and audit.
5. Verify a new attempt is appended and the job becomes `sent`, `pending`, or a reasoned
   `dead_letter`. A duplicate delivery must return the existing result.

## Checks

```sh
cd apps/api
bunx vitest run test/automation/notifications.test.ts test/automation/recovery-api.test.ts
```

If the queue is broadly unavailable, stop replays, preserve the DLQ, and escalate with the
environment, first/last failure time, error-code counts, and request IDs. Do not include payloads.
