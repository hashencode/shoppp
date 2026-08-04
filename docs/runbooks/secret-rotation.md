# Secret Rotation

Rotate one environment at a time, starting in staging. Secrets are supplied through
`wrangler secret put`; never place values in source, `.env` committed files, tickets, commands, or
chat.

Relevant secrets include Access service-token client IDs/secrets, Access verification configuration,
`STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET`, build/preview tokens, email provider credentials, and
`D1_REST_API_TOKEN`.

For each rotation:

1. Create the replacement with least privilege.
2. Configure staging and run authentication, checkout/webhook, Turnstile, email, build, or backup
   probes appropriate to the secret.
3. Configure production in the approved window, observe structured failure counts, then revoke the
   old credential.
4. Record actor, environment, credential identifier (never value), validation request IDs, time,
   and rollback owner.

If validation fails, restore the prior still-valid credential, preserve evidence, and stop further
environment rotation.

## Access service credentials

Test and production service credentials are separate and must never share a client ID, secret, or
configuration reference. Create the replacement in the target environment's Access application,
add it to the exact-host policy, and keep the old credential valid during a short overlap. Update
only that environment's GitHub secrets, run `/api/admin/session` plus an allowed operation, and
confirm the resulting audit actor is `machine`. Then remove the old token from the policy, revoke it
in Access, and verify it can no longer obtain an assertion. Never change the D1 service principal's
`access_subject` unless the replacement token's `common_name` changes; if it does, update that row
as an approved, audited infrastructure change before revoking the old credential.

Rotating a human IdP credential is an IdP operation, not an application password reset. Remove a
compromised user from the environment assignment group, revoke their Access sessions, disable the
D1 identity, and follow the incident sequence in `admin-access.md`.
