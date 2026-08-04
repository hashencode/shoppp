# Secret Rotation

Rotate one environment at a time, starting in staging. Secrets are supplied through
`wrangler secret put`; never place values in source, `.env` committed files, tickets, commands, or
chat.

Relevant secrets include administrator service Bearer tokens, `AUTH_TOKEN_SECRET`, `STRIPE_SECRET_KEY`,
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

## Administrator service credentials

Test and production service Bearer credentials are separate and must never share a token or
configuration reference. Insert only the replacement token hash in `admin_service_credentials`,
keep the old credential enabled during a short overlap, and update only the matching environment's
secret. Run `/admin/session` plus an allowed operation and confirm the audit actor is `machine`.
Then disable the old D1 credential and verify it returns 401.

For a compromised human account, disable the D1 identity immediately. Ordinary users then use the
one-time password reset flow; protected administrators use the offline recovery command documented
in `admin-access.md`. Both paths revoke prior sessions.
