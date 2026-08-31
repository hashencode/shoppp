# Administrator account access

Human administrators authenticate directly with an environment-local email and password. The API
stores only a salted PBKDF2 hash, issues an opaque `HttpOnly` session cookie, and resolves the
current role and permission set from D1 on every protected request. No external identity proxy is
required for the administrator login path.

## Environment boundaries

There are exactly two shared remote databases. Fashion staging is a third, isolated acceptance
database and is never a development fallback:

| Environment | D1 database         | Allowed use                                                    |
| ----------- | ------------------- | -------------------------------------------------------------- |
| Test        | `shoppp-staging`    | Local development, automated remote tests, and test deployment |
| Production  | `shoppp-production` | Production only                                                |

| Isolated profile | D1 database              | Allowed use                              |
| ---------------- | ------------------------ | ---------------------------------------- |
| Fashion staging  | `shoppp-fashion-staging` | Governed Fashion staging acceptance only |

The environments also use distinct admin/API hostnames, Worker names, `AUTH_TOKEN_SECRET` values,
service credentials, backups, and email configuration. No shared remote development database is
permitted.

Configure independent random token-signing secrets of at least 32 characters without putting them
in Wrangler vars or the repository:

```sh
bunx wrangler secret put AUTH_TOKEN_SECRET --config apps/api/wrangler.jsonc --env staging
bunx wrangler secret put AUTH_TOKEN_SECRET --config apps/api/wrangler.jsonc --env production
```

## First administrator

Create one named protected-administrator invitation against the exact environment database:

```sh
bun run bootstrap:admin --environment test --database shoppp-staging --email owner@example.com
```

Fashion staging is provisioned only by the protected GitHub-hosted
`provision-fashion-staging-operator.yml` workflow. It deploys the dedicated
`shoppp-admin-fashion-staging` Worker, creates a named invitation in `shoppp-fashion-staging`, and
sends its one-time activation link. The recipient sets the password outside Actions; the workflow
never creates, accepts, logs, or transports a human password. Ordinary U8 preparation reuses this
durable identity and must not create a run-scoped account.

Production additionally requires the exact confirmation defined by the bootstrap command. The
invitation email contains a signed, expiring activation link. The recipient sets the first password;
no default or checked-in administrator password exists.

## Additional users

An authorized identity manager creates an invitation and assigns one role. The email activation link
is signed, expires with the invitation, and becomes unusable after acceptance. The user sets their
own password during activation. Administrators cannot read or set another person's long-term
password.

Disabling a user or role, or changing a role assignment or permission set, affects the next API
request because authorization is loaded from D1 for every request.

## Password rules

- Passwords contain 12–128 characters and are stored only as salted PBKDF2-SHA-256 hashes.
- Five failed attempts for the same account/network address block login for 15 minutes.
- Human sessions last 12 hours and use `HttpOnly`, `SameSite=Strict` cookies.
- A logged-in user may change their password after providing the current password. All previous
  sessions are revoked and the current session is rotated.
- Ordinary users may request a 30-minute, one-time email reset link. Completing it revokes all
  existing sessions and all other reset links.
- The protected `admin` role cannot use online password reset. The API enforces this on direct calls.

## Protected administrator recovery

If a protected administrator forgets the password, use the controlled offline recovery command.
The password is read only from the process environment and is never included in command output or
SQL as plaintext:

```sh
ADMIN_RECOVERY_PASSWORD='a-new-long-random-password' \
  bun run recover:admin-password --environment test --database shoppp-staging \
  --email owner@example.com
```

Production requires the exact `RECOVER_PRODUCTION_ADMIN:<database>:<email>` confirmation. Recovery
rotates the hash, revokes all sessions, and writes `iam.password.recover` to the audit trail.

For the first password-auth release, apply migration `0013` while the previous release is still
serving, then run this command once for every enabled protected administrator. The deployment gate
requires at least one credentialed protected administrator in test and two in production before it
switches traffic to the password-auth release. Keep each password outside CI logs and deliver it to
its named owner through the approved secret channel; each owner should change it after first login.

## Service principals

Automation uses an independent random Bearer credential stored only as a SHA-256 token hash in
`admin_service_credentials`. Service principals remain distinct from human users, cannot activate
invitations, and are audited as machines. Rotate test and production service tokens independently.
Provision a token for an existing service principal with `ADMIN_SERVICE_TOKEN` and
`bun run provision:admin-service`; production requires the exact confirmation emitted by the tool.

Migration `0014` rewrites the compatibility email value for every service principal and replaces
the insert/update triggers so future service rows receive the application-owned marker. The
physical column default remains historical because rebuilding this heavily referenced identity
table would endanger inbound actor foreign keys; the trigger is the authoritative writer, and the
migration suite verifies both facts.

## Local development

Copy `.env.example`, then run:

```sh
bun --filter @shoppp/admin dev
```

The preflight accepts only the staging/test API and verifies that it is bound to `shoppp-staging`.
The local proxy preserves application cookies and forwards API requests to the test Worker.

## Verification

Before production promotion, prove in test that:

1. a named administrator can activate and log in with a password;
2. ordinary-user reset succeeds and invalidates old sessions;
3. protected-administrator reset returns 403 while logged-in password change succeeds;
4. user disablement and permission reduction affect the next request;
5. a service Bearer credential is authorized as a machine principal;
6. test and production share no D1, signing secret, service credential, hostname, or Worker identity.
