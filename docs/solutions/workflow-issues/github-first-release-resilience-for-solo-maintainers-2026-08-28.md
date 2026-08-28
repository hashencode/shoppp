---
title: Operating GitHub-first release resilience for a solo-maintained product
date: 2026-08-28
category: docs/solutions/workflow-issues
module: github-first-release-delivery
problem_type: workflow_issue
component: release_workflow
severity: high
applies_when:
  - "A single maintainer uses GitHub-hosted validation and protected deployment as release authority"
  - "Local development must continue during GitHub billing or control-plane degradation"
  - "Release evidence is retained as same-run GitHub artifacts rather than an offline evidence system"
  - "Operational review should be proportional and triggered by material changes"
symptoms:
  - "A provider outage is mistaken for permission to substitute local or historical test output"
  - "Expired or inaccessible artifacts tempt operators to replay or rebuild outside the governed run"
  - "Recovery documentation grows into an owner roster or recurring ceremony for one maintainer"
  - "Toolchain, credential, or workflow action changes silently invalidate retained evidence"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
related_components:
  - github-actions
  - protected-deployment
  - staging-recovery
  - release-evidence
tags:
  - github-actions
  - release-resilience
  - fail-closed
  - recovery-audit
  - solo-maintainer
---

# Operating GitHub-first release resilience for a solo-maintained product

## Context

Shoppp intentionally keeps routine development in repository-owned local commands while GitHub-
hosted full validation, same-run artifacts, protected environments, and protected deployment remain
the one maintained release path. This creates a clear availability limit: local development
continues, but a GitHub outage pauses release.

The tempting alternatives are unsafe. Local reports do not carry GitHub run/attempt or protected-
environment authority. Historical artifacts can expire or describe an old source and toolchain.
Building an alternate credential plane, signing service, or provider-independent restore system
would add security and maintenance costs that are disproportionate for a single maintainer.

## Guidance

### Separate development continuity from release availability

Keep fast and post-commit checks usable without GitHub, but describe them only as development
evidence. Formal validation and deployment remain paused until a fresh exact-SHA hosted run passes
all unchanged gates, produces same-run artifacts, and completes every authorized protected job.
Never infer release proof from a workflow definition, a local run, a queued or zero-step run, or an
old successful attempt.

### Accept the provider boundary and fail closed

Treat source reachability, Actions billing/control plane, hosted runners, environments and
approvals, artifact transport and retention, status/audit visibility, Cloudflare staging, and
package bootstrap as explicit dependencies. Missing, expired, altered, inaccessible, or cross-run
artifacts stop deployment before remote mutation. Recovery produces a fresh exact-SHA hosted run;
it does not relabel or copy old evidence.

### Prove recovery without production authority

One inaugural non-production drill should prove pre-mutation refusal, exact Worker/D1 baseline
capture, post-deploy checks, rollback or governed forward reconciliation, and return to the prior
safe staging state. Keep human access and production disabled. Retain the result as historical
evidence, never as reusable deployment input.

### Use event-driven review for a single maintainer

An event-driven review is enough when one person develops and maintains the product. Re-review only
when GitHub billing/control-plane behavior, artifact retention/access, staging recovery,
credential rotation/revocation, the hosted toolchain, or workflow action pins change materially.
Also re-enter governed planning if the team, repository visibility, runner exposure, credential
model, or deployment provider changes the trust boundary.

For each triggered review, record the observation, required access, checks and evidence, then decide
`keep, revise, or remove`. Stop or disable an unsafe path immediately; reopen the CI plan only when
the current operating boundary can no longer be kept truthful and safe. Do not create a recurring
calendar, owner roster, responsibility matrix, or escalation ceremony solely to prove governance.

## Authority boundary

This pattern does not select a candidate, complete product work, enter DC/PG, approve human access,
or authorize production. Those decisions remain with their owning plans and protected GitHub
environment controls. A future need for portable evidence, independent signing, untrusted runners,
or alternate deployment requires a separately authorized successor plan.
