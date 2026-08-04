# Admin access runbook

## Environment contract

Admin access has two independent controls on every request: Cloudflare Access verifies the exact
environment issuer and audience, then the API resolves the subject in that environment's D1 and
loads the role permissions afresh. A valid Access cookie or service token is never sufficient by
itself. Disabled identities, disabled roles, claim mismatches, and missing permissions fail on the
next request.

There are exactly two shared remote D1 databases:

| Plane      | Consumers                                                                | D1                  | Access and identity boundary                                                                                                          |
| ---------- | ------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Test       | Local authenticated development, remote-dependent tests, test deployment | `shoppp-staging`    | Test admin hostname/tunnel, test Access application and audience, test IdP assignment, test-only service credentials                  |
| Production | Production only                                                          | `shoppp-production` | Production admin hostname, production Access application and audience, production IdP assignment, production-only service credentials |

Never create a shared remote development D1. Local Miniflare state and a time-bounded restore drill
database are disposable tools, not environment bindings.

For both Access applications, protect the entire admin hostname, default deny, allow only the
approved environment IdP group and explicitly named service tokens, and enforce the approved MFA
posture. The API still verifies JWT issuer/audience on direct paths. Do not use an Access bypass
policy for CI.

## First administrator bootstrap

Before bootstrap, apply migrations and verify the target name and environment. The tool creates one
seven-day invitation for the protected role; it does not create a password or shared account. It
fails if an enabled protected human already exists.

Test:

```sh
bun run bootstrap:admin --environment test --database shoppp-staging --email <named-admin-email>
```

Production additionally requires a target-bound confirmation:

```sh
bun run bootstrap:admin \
  --environment production \
  --database shoppp-production \
  --email <named-admin-email> \
  --confirm 'BOOTSTRAP_PRODUCTION:shoppp-production:<normalized-named-admin-email>'
```

The named person must already belong to the correct IdP assignment group. They visit the exact
environment admin hostname, complete the IdP/MFA flow, and accept the matching invitation through
`POST /api/admin/onboarding`. Confirm the invitation is `accepted`, the human identity is enabled,
the protected role is intact, and the audit trail contains `iam.bootstrap.invitation` followed by
`iam.invitations.accept`. Preserve request IDs and record identifiers, never the Access assertion or
cookie.

Before the IAM production migration, provision and independently authenticate a second named
protected administrator while the legacy schema is still active. The deploy workflow verifies both
named administrators before changing production D1 and repeats the invariant after migration. Do
not use the first-admin bootstrap tool for the second administrator; it intentionally refuses once
one enabled protected human exists.

## Invite and change a human administrator

Use **Access management → Users & invitations** as a protected administrator with
`iam.users.write`. Select the least-privileged enabled role, enter the exact normalized email, and
create the invitation. Repeated submission uses the original idempotency identity and must not
create a second active invitation. Resend and revoke actions require the current version; a conflict
means reload before deciding.

After acceptance, role, display-name, enable, and disable changes are made from the user detail
page. Effective authorization changes on the next API request. A user cannot grant permissions they
do not hold, archive a role with dependencies, edit their own role, or disable/demote the last
enabled protected human. Confirm the corresponding `iam.*` success or denial audit event.

Invitation delivery support checks, in order: invitation status/expiry, notification job and
attempts, provider result, recipient normalization, and the current IdP assignment. Never send an
invitation URL containing an Access assertion or application credential.

## Provision a service principal

Service principals are infrastructure-owned and never appear in the human user UI.

1. Create a uniquely named service token inside the target environment's Access application. Limit
   it to the exact admin hostname and record its non-secret `common_name` and credential reference.
2. Put client ID and secret only in that environment's GitHub secrets. Test and production must use
   different values and references.
3. Under an approved database change, insert one `admin_identities` row with
   `principal_kind='service'`, `access_subject` equal to the token JWT `common_name`,
   `normalized_email=NULL`, an explicit display name, a least-privileged enabled role ID, and a
   stable unique identity ID. Do not store either token component in D1.
4. Call `/api/admin/session` through Access and confirm `principalKind=service`, the expected role,
   and only the required permissions. Confirm the identity is absent from `/api/admin/iam/users`.
5. Exercise one allowed operation and one disallowed permission. Audit events must use
   `actor_type=machine`. `POST /api/admin/onboarding` must return
   `human_invitation_required`.

The test release principal currently needs `audit.read`, `iam.users.read`, and `iam.users.write` for
the release access proof. Remove those permissions if the proof contract changes; do not silently
broaden the role. Follow `secret-rotation.md` for replacement and overlap.

## Suspend or revoke access

For routine offboarding:

1. Disable the D1 identity first. This blocks the next API request even if the Access cookie remains
   valid. Capture the `iam.users.update` audit record.
2. Remove the person from the environment's IdP assignment group or remove the service token from
   the Access policy.
3. Revoke active Access sessions; for a service principal, revoke the service token credential.
4. Verify the old browser or token cannot call `/api/admin/session` and cannot acquire a new Access
   assertion. Preserve only status, timestamp, actor, environment, and redacted request IDs.

For suspected compromise, perform all four steps immediately, rotate adjacent credentials, inspect
Cloudflare Access logs plus application audit events for the subject, and open the security incident
procedure. Do not delete the D1 identity or audit history.

## Authenticated local development

Copy `.env.example` to an untracked `.env`, fill only approved test identifiers, then run:

```sh
cd apps/admin
bun run dev
```

The preflight requires the HTTPS test API, test audience, test D1 ID, and one named Cloudflare
Tunnel. It rejects production origins/audiences/database IDs. The tunnel hostname uses the test
Access boundary and is the only additional browser-mutation origin accepted by the staging API;
production ignores the tunnel setting. Direct localhost never receives a forwarded Access
assertion. Stop both the dev server and tunnel when the session ends.

## Release proofs and retained evidence

The deploy workflow first runs `e2e/admin-access.spec.ts` with a test-only service token. It proves
the mapped service session, exclusion from the human list, rejected human onboarding, a reversible
revocation of an isolated preseeded invitation, and a matching `machine` audit event. The proof
email uses the reserved `example.test` domain; no delivery job is created, the invitation is
revoked, and the invitation/audit history is intentionally retained.

After all machine tests pass, the workflow pauses at `staging-human-access`. The reviewer must use a
fresh browser profile and a real test IdP account to:

1. complete the IdP and MFA challenge on the exact test admin hostname;
2. confirm `/api/admin/session` shows a human principal and the expected least-privileged role;
3. perform one allowed read and observe one expected route/operation denial;
4. for the designated revocation test identity, keep the Access session open, disable it in D1,
   prove the next API request fails, remove its IdP assignment and revoke the Access session, then
   prove it cannot reacquire perimeter access;
5. append timestamps, environment, reviewer, identity/role IDs, redacted request IDs, audit event
   IDs, and results to the preallocated `human_access_evidence_id` record.

Do not capture credentials, Access assertions, cookies, browser storage state, or screenshots that
display them. Approve `staging-human-access` only after the external record is complete. The workflow
retrieves the environment reviewer from GitHub's approval history and stores a small evidence
artifact; production validation requires both that human evidence and the separate machine proof.

## Monitoring and audit queries

Alert on spikes in redacted `security.access_denied` events, especially
`access_assertion_invalid`, `access_identity_unmapped`, claim mismatch, disabled identity/role, and
permission denials. Missing/malformed/wrong-issuer/wrong-audience requests belong in structured
security and Cloudflare Access logs, not D1. Mapped identity and authorization events belong in the
application audit trail.

During an incident, filter `/api/admin/audit` by actor ID, action, result, and target type, and
correlate its request ID with Worker and Access logs. Export only the minimum redacted event fields.
Retain invitation, identity, role, and audit records; disabling/revoking is the recovery action,
not deletion.
