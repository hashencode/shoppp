# Privacy Requests

## Intake and verification

1. Verify the requester through the approved support process outside the application.
2. In Admin → Privacy requests, choose access, correction, or deletion; enter the verified subject
   email, a reason, and explicit confirmation.
3. Never include identification documents, passwords, card data, or guest access links in the
   reason field.

## Outcomes

- Access creates a subject-scoped JSON export in `PRIVACY_EXPORTS`, available only to
  `privacy.manage`, with `private, no-store` delivery and a seven-day expiry.
- Correction and deletion preserve immutable order and financial snapshots. The system records
  `retained_immutable_financial_records` when matching commerce records exist.
- D1 stores only the normalized email's SHA-256 reference; correction values are not persisted in
  audit/event metadata.

Download the export once for approved delivery, confirm its subject reference and scope, and use
the approved secure delivery channel. Record delivery evidence without attaching export content.

## Verification

```sh
cd apps/api
bunx vitest run test/privacy/privacy-requests.test.ts
```

Escalate a subject mismatch, missing object, expired export, unexpected cross-subject record, or
request to mutate financial records.
