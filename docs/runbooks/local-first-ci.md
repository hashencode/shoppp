# GitHub-Managed Cloud CI Operations

This path retains its historical filename so existing links remain stable. It now governs the
shared and post-commit CI successor that replaced the optional local/self-managed execution path.
All current automation runs on the fixed standard GitHub-hosted `ubuntu-24.04` image. No developer
machine, desktop VM, container runtime, local account, runner listener, or self-managed runner is an
execution authority.

The separate [GitHub-first release availability](github-first-release-availability.md) runbook owns
the `normal`, `actions-degraded`, `github-unavailable`, and `recovery-audit` states. A GitHub outage
pauses formal release; local development may continue, but local or historical results never
substitute for a fresh exact-SHA GitHub-hosted run.

## Current authority

The active product plan owns the product unit and delivery order. The cloud-CI successor owns only
the shared validation and post-commit workflow execution contract. It does not select a candidate,
approve an environment, complete a Fashion unit, or replace DC/PG evidence.

Every current workflow job uses `runs-on: ubuntu-24.04`. Checkout and every third-party Action use a
reviewed full commit SHA; checkout sets `persist-credentials: false` wherever credentials are not
needed. Workflows do not accept dynamic runner labels or a runner input.

## Capability preflight and runner classes

The fixed standard runner is the default and expected executor. A workflow may use a GitHub-hosted
larger or OS-specific runner only after a side-effect-free preflight records one concrete need for
an unsupported operating system, capacity, fixed egress IP, or private-network connectivity. That
decision requires a governed plan update and an exact GitHub-managed runner label.

A test, lint, build, application, authentication, staging, deployment, queue, or provider failure is
not capability evidence and never triggers runner escalation. If a GitHub-managed runner still
cannot execute the work, stop and redesign the workflow or environment.

## Credential-free authority boundary

Shared validation and post-commit CI have no deployment environment and no staging secret. A
protected Fashion workflow begins with a credential-free `verify-authority` job on the fixed main
ref. It rejects forks, pull-request events including `pull_request_target`, non-main refs,
unauthorized actors, a mismatched repository, partial commit identities, and a workflow SHA that is
not the reviewed harness SHA.

Only a later job may name the protected `fashion-staging` GitHub Environment. That job must depend
on the verifier, request `id-token: write`, obtain a GitHub OIDC token for the exact
`shoppp-fashion-staging` audience, and validate repository, owner, actor, event, and main-ref claims
before mutation. Human passwords, browser sessions, and operator credentials never enter Actions.

## Failure classification

| Class                       | Required result                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CI-POLICY-REJECT`          | Mutable Action, dynamic/nonstandard runner, fork/PR route, non-main ref, or unauthorized actor: stop before protected work.                       |
| `CI-CAPABILITY-STOP`        | A proven platform capability is unavailable on GitHub-managed runners: stop and redesign; do not use a local runner.                              |
| `CI-INFRASTRUCTURE-FAILURE` | Checkout, package registry, GitHub Actions, queue, upload, or provider failure: retain diagnostics and rerun the exact governed SHA when healthy. |
| `CI-TEST-FAILURE`           | A product assertion, typecheck, lint, or build fails after preflight: fix the product or test and rerun the same governed workflow class.         |
| `CI-EVIDENCE-REJECT`        | Artifact identity, digest, run attempt, retention, or provenance is missing/mismatched: fail closed and create fresh hosted evidence.             |

## U8 operator boundary

The U8 preparation job writes an immutable server-side run in `awaiting_operator`, uploads only its
non-secret manifest, and exits. The existing named staging operator signs in through the ordinary
Admin path and completes the run-bound edit, validation, preview, conflict-successor, and approval
journey. No workflow provisions an account or waits for the human.

After approval, a separately dispatched hosted refresh reads the server-side Snapshot and audit,
creates the successor build, and dispatches Preview on `main`. A separately dispatched hosted
acceptance run verifies the deployed build, terminal p95 and cleanup, then consumes the exact
server-side approval. Mismatched, expired, already-consumed, or cross-run evidence fails closed.

## Evidence record

Retain repository, workflow, exact SHA, run ID/attempt, fixed runner image, capability-preflight
result, action pins, authority/OIDC verdict, artifact names and digests, failure class, and retry
lineage. Protected Fashion evidence additionally retains the Environment, named actor, operator-run
ID, server-side Snapshot/audit IDs, build identity, and cleanup verdict. Store no token, password,
session, environment dump, or raw credential response.
