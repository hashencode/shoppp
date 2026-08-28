# Local-First CI Runner Operations

This runbook governs the optional, persistent, non-secret macOS runner for the advisory `main`
post-commit lane. It does not authorize registration or make this lane release, candidate, DC, PG,
deployment, or production evidence. Hosted full validation and protected remote delivery remain
separate.

The separate [GitHub-first release availability](github-first-release-availability.md) runbook owns
the provider dependency inventory, the `normal` / `actions-degraded` / `github-unavailable` /
`recovery-audit` states, formal-release pause rules, and fresh exact-SHA recovery. This optional
runner never changes those boundaries and never supplies substitute release evidence.

## Current authority and isolation

Last reconciled 2026-08-24: the product pointer was FS-U8.2. This is a dated snapshot, not current
authority; before every acceptance or job, read the live Fashion and product-master checkpoints and
record their identities. The protected runners use `fashion-staging-preview` and
`fashion-staging-u8`, the `fashion-staging` environment, feature credentials, and feature evidence.
Those labels, environment, workspaces, credentials, artifacts, and service identity must never be
assigned, mounted, copied, or made readable by the CI runner. The advisory runner has no deployment
environment and only the labels `self-hosted`, `macOS`, `ARM64`, `shoppp-main-nonsecret`.

Registration token acquisition and entry are human-only. Runner service installation, enablement,
restart, removal, and registration are human-only. Credential inspection and any decision about a
keychain, helper, SSH key, cloud session, mount, or socket are human-only; evidence records only
scope and pass/fail, never values.

## Fixed host boundary

Use a dedicated non-admin macOS account with its own home and runner root. It must not belong to
admin, developer, Docker, backup, cloud, or production-access groups. It cannot traverse the primary
Shoppp checkout, the Decor worktree, FS-U8 workspaces, sensitive mounts, developer home, or production
data. Host policy, admission state, preflight, and cleanup live outside both checkout and runner
account ownership, so repository code cannot modify them.

Repository access is read-only: workflow `contents: read`, checkout `persist-credentials: false`, no
secret, no environment, no PR/fork/arbitrary-ref route, and no automatic hosted fallback.

## Registration acceptance checklist

One dated operator record must pass every item; unknown or stale means reject.

- [ ] **RUN-ACCEPT-AUTHORITY** — Current CI, Fashion, and master checkpoints were read; repository
      write access was reviewed; FS-U8 and CI runner boundaries are recorded as disjoint.
- [ ] **RUN-ACCEPT-ACCOUNT** — Dedicated non-admin macOS account, canonical home/root, owner, groups,
      and ACLs are approved.
- [ ] **RUN-ACCEPT-ISOLATION** — Primary/Decor/FS-U8/production paths and sensitive mounts are not
      traversable, readable, writable, linked, or mounted.
- [ ] **RUN-ACCEPT-CREDENTIALS** — No usable helper, keychain item, SSH/cloud credential, profile
      secret, Docker socket, deployment token, or protected environment credential exists.
- [ ] **RUN-ACCEPT-LABELS** — Exact four-label set matches the advisory workflow and no broader
      routing label exists.
- [ ] **RUN-ACCEPT-ADMISSION** — The root-owned exact-SHA admission allowlist contains only a SHA
      added by a human-authenticated host command after a verified passing local post-commit report;
      every required negative pre-checkout probe failed closed before the listener was enabled.
- [ ] **RUN-ACCEPT-TOOLS** — Native ARM64 macOS, approved runner/Git versions, Bun `1.3.5`, disk,
      power, and build prerequisites pass without job-time elevation.
- [ ] **RUN-ACCEPT-SERVICE** — Human-installed service is disabled until acceptance, then exposes one
      healthy listener assigned only to this repository and exact labels.
- [ ] **RUN-ACCEPT-WORKSPACE** — Immutable host dispatcher, preflight, disposable-root creation,
      cleanup, retained-output rejection, and interruption recovery have been exercised without
      protected credentials.

Acceptance expires when a live Fashion or product-master checkpoint changes a governed runner
boundary or authority fact, or after any OS, tool, runner, account, group, ACL, mount, label,
workflow, repository-assignment, service, admission-policy, or root change. A pointer-only change
still requires the per-job live checkpoint read and recorded comparison, but not a full host
re-acceptance when every governed fact is unchanged.

## Exact-SHA admission before checkout

A root-owned exact-SHA admission allowlist is the authority boundary. A human-authenticated host
command may add one `main` SHA only after verifying the local post-commit report's SHA, tree, passing
result, clean workspace, toolchain, signer/operator, and report digest. The runner account has no
write access to the allowlist or command.

The human operator records one canonical absolute path outside the runner application directory for
a root-owned, non-writable executable dispatcher and separate root-owned allowlist. The runner
service account may read and execute them but may not modify their files, parent directories, ACLs,
or extended attributes. Configure the runner service with
`ACTIONS_RUNNER_HOOK_JOB_STARTED=<absolute-dispatcher-path>` and restart it; do not enable the listener
until the acceptance probes below pass. GitHub runs this hook synchronously after assignment and
before job steps. The dispatcher reads `GITHUB_EVENT_PATH`, applies an internal timeout, and exits
nonzero unless event=`push`, ref=`refs/heads/main`, non-deletion state, exact workflow identity,
required labels, and an allowlisted event SHA all match. A nonzero exit prevents checkout and every
other repository-controlled step.

Before enabling the listener, exercise the installed hook with synthetic event payloads and an empty
job root. Prove that an absent allowlist entry, wrong SHA/report digest, wrong ref/workflow, altered or
unreadable dispatcher, and retained workspace each exit nonzero without creating a checkout. Then
prove that exactly one accepted SHA/report/attempt passes. Retain exit class and filesystem manifest,
not payload contents. Missing, stale, multiply matched, or altered admission stops before
repository-controlled code. One admission is bounded to its recorded attempts and is removed only by
the human operator after clean completion or explicit revocation.

## Host preflight and disposable isolation

Before checkout, verify effective user, canonical paths/ownership, labels, service/version, toolchain,
credentials, mounts, network policy, event/ref/SHA/workflow, and an empty job root. Use one disposable
workspace per job beneath the approved root; never reuse a checkout, `.git`, cache, report, lock, or
artifact between attempts. Outbound access is limited to repository checkout, required package
registries, and GitHub report projection; internal networks and metadata endpoints are denied.

| Rejection               | Condition and result                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `RUN-REJECT-ADMISSION`  | SHA/report/allowlist/attempt is absent or mismatched; infrastructure failure before checkout.  |
| `RUN-REJECT-WORKFLOW`   | Event, ref, deletion state, workflow, permission, or action pin drifts; stop before checkout.  |
| `RUN-REJECT-CREDENTIAL` | Any usable helper, keychain, SSH/cloud/deployment credential or socket exists; isolate host.   |
| `RUN-REJECT-WORKTREE`   | Primary, Decor, FS-U8, production, backup, or sensitive path is reachable; isolate host.       |
| `RUN-REJECT-LABEL`      | Required label missing or extra routing label present; stop.                                   |
| `RUN-REJECT-TOOL`       | Version, architecture, dependency, disk, power, or elevation contract fails; stop.             |
| `RUN-REJECT-WORKSPACE`  | Workspace is nonempty, linked, noncanonical, retained, or wrongly owned; stop.                 |
| `RUN-REJECT-CLEANUP`    | Exact cleanup cannot prove absence of residue; override test pass with infrastructure failure. |

Only a product assertion after preflight is a test failure. Admission, host, checkout, tool, process,
cleanup, queue, upload, and projection failures are infrastructure failure and never a pass.

## Host cleanup and interruption

Host cleanup runs after pass, failure, cancellation, timeout, or interruption. Stop known writers;
retain exact process/mount observations and tracked, untracked, and material ignored-path manifests;
verify canonical path, ownership, no symlink/mount boundary, and then trash only the exact disposable
workspace. Prove the original path absent and no credential/helper state remains. Failed proof disables
new jobs.

An interrupted process never implies cleanup. Disable new jobs, preserve the run/SHA/attempt and
manifests, clean through host policy, repeat acceptance, then permit only a linked same tested commit
SHA replay.

## Queue recovery and updates

The 10-minute expected-online queue threshold triggers human investigation, not fallback or a test
timeout. Record SHA, workflow SHA, run ID/attempt, labels, queue time, expected-online declaration,
service, disk, power, network, and update state. Human repair repeats preflight and reruns only the
same tested commit SHA; never silently substitutes a newer tip.

Before runner/macOS/tool updates, disable new jobs, finish or classify active work, clean, record old
and new versions, repeat acceptance, and exercise retained-output rejection. An automatic runner
update remains rejected until human approval.

## Compromise isolation and recovery

On suspected credential, ACL, mount, admission, workflow, runner, or host compromise: disable new
jobs, stop the listener, revoke registration/admission, quarantine the account/root, preserve
non-secret audit evidence, and invalidate every report since the last trusted checkpoint. Rotate the
runner identity and any possibly exposed credential outside the runner. Rebuild from a clean trusted
host image, repeat acceptance, then require clean rebuild and same-SHA replay before evidence may be
used. Never normalize compromised output as a retry.

## Deregister and clean exact paths

Human-disable jobs, resolve every queued/running attempt, stop writers, retain manifests, deregister
and revoke through the approved GitHub interface, and validate the exact install/root/workspace paths.
They must not be a home, repository root, primary/Decor/FS-U8 path, symlink, or mount boundary. Trash
only explicitly approved exact paths and retain operator, timestamp, command, paths, and outcome.

Never delete a branch, tag, PR, plan, report, candidate record, or product evidence. Deregistration
does not change any Fashion, Decor, CI, candidate, DC, PG, release, or production status.

## Evidence record

Record operator, timestamp, event type, authority link, runner/repository identity, versions, service
health, labels, tested SHA/tree, workflow SHA, event/ref, run ID/attempt, admission digest, local report
digest, queue state, preflight/rejection, validation/failure class, cleanup manifests/result, exact
cleanup paths, attempt lineage, update/compromise checkpoint, and exceptions. Store no token, secret,
credential value, environment dump, private path contents, or raw command output.
