# Secret Rotation

Rotate one environment at a time, starting in staging. Secrets are supplied through
`wrangler secret put`; never place values in source, `.env` committed files, tickets, commands, or
chat.

Relevant secrets include Access verification configuration, `STRIPE_SECRET_KEY`,
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
