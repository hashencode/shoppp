---
title: Shoppp Product Master Plan
type: refactor
date: 2026-08-13
topic: shoppp-product-master-plan
execution: knowledge-work
plan_role: product-master
current_plan: 2026-08-12-003-refactor-development-candidate-readiness-plan.md
current_unit: REL-Pre-DC
---

# Shoppp Product Master Plan

## Purpose and authority

This file is the thin product-level entry point for Shoppp. It answers four questions:

1. What product areas and long-lived authorities exist?
2. Which product plan and unit are active now?
3. What is the next product-level handoff?
4. Which cross-plan decisions still constrain future work?

Detailed requirements, unit status, blockers, tests, run IDs, and completion evidence stay in their
owning plan or `docs/progress/`. Completed and superseded plans remain in `docs/plans/` as immutable
history; they are not copied into a central register. Independent fixes and refactors do not update
this file unless they change the product facts above.

## Product model and long-lived authorities

Shoppp is one cross-border DTC commerce product.

| Alias | Product area | Current authority |
| --- | --- | --- |
| `COM` | Commerce, catalog, cart, checkout, orders, fulfillment, providers, and recovery | [Cross-Border DTC Commerce Platform](2026-07-30-001-feat-cross-border-dtc-commerce-platform-plan.md) |
| `THEME` | Versioned theme manifests, configuration, preview, and template isolation | [Versioned Storefront Theme Platform](2026-07-30-002-feat-versioned-storefront-theme-platform-plan.md) |
| `IAM` | Admin authentication, users, roles, authorization, and environment isolation | [Multi-User Admin Access](2026-08-04-001-feat-multi-user-admin-access-plan.md) |
| `AI` | Reviewable AI assistance in product editing | [AI-Assisted Product Form](2026-08-04-002-feat-ai-assisted-product-form-plan.md), currently deferred |
| `FS` | `fashion-store` product template | [Fashion Store Functional Integration](2026-08-11-001-feat-fashion-store-functional-integration-plan.md) and its named successors |
| `DS` | `decor-store` product template, currently mapped to legacy code ID `decor` | Its named Decor plans until a deliberate identity migration |
| `REL` | Candidate proof and production-promotion policy | [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) |
| `CI` | Repository validation and GitHub-managed release delivery | [GitHub-Managed Cloud Runner Successor](2026-08-28-001-refactor-github-managed-cloud-runner-successor-plan.md) |

Implementation boundaries do not create separate products. A branch, worktree, feature plan, or
template-specific repair does not change product membership or candidate scope by itself.

## Current execution pointer

- **Active product plan:** [Development Candidate Readiness](2026-08-12-003-refactor-development-candidate-readiness-plan.md) — knowledge-work，validation-only。
- **Current unit:** REL-Pre-DC — capability/identity reconciliation。
- **Next action:** 明确本次候选所需能力及已批准延期，按 owner 核对完成证据，并补齐 validator 的完整 candidate identity 约束。
- **Blockers:** REL 的能力范围审计、owner reconciliation 与 candidate identity 门禁仍待完成；候选未冻结，DC/PG 未开始。
- **Tail ownership:** REL 拥有 Pre-DC、候选冻结、真实环境部署及 DC/PG；管理后台本地实施尾部已结束，FS-F14 完成基线保持。

The active child plan is authoritative if this summary and its execution checkpoint temporarily
disagree. Repair this pointer in the same documentation change; do not copy the child plan's full
checkpoint here.

## Product-level sequence

1. REL 核对已完成实现基线与选定能力范围，包括管理后台正式发布接入。
2. 完成 Pre-DC capability/identity reconciliation。
3. 仅由 REL 选择和冻结不可变候选，再按具名人工与生产权限执行 DC/PG。

No candidate is currently frozen. DC and PG have not begun.

## Retained cross-plan decisions

- Candidate membership is decided by the frozen Candidate Template Matrix, not by code existence,
  branch names, historical templates, or a passing focused test.
- DC and PG gate production promotion of an immutable candidate; they do not block ordinary local
  implementation or non-production development proof.
- GitHub-managed runners are the default release path. Developer machines, self-hosted runners, and
  local shared accounts are not release fallbacks.
- `fashion-store` and `decor-store` are the current product template names. The older `fashion`
  implementation is retired; `decor-store` continues to map to code ID `decor` until a deliberate
  migration changes that contract.
- Stable identifiers in historical plans remain valid references. A newer plan supersedes only the
  behavior and authority it names explicitly.

## Small-plan policy

- Create one independent plan for each bounded feature, fix, or refactor.
- Keep its requirements, implementation units, progress, blockers, and verification in that plan.
- On completion, mark or evidence the outcome once and freeze the plan. Do not continue using it as
  a general status log.
- Create a successor when new work has a new goal or boundary. Link the predecessor only when the
  new work inherits or supersedes its authority.
- Update this master file only when the active product pointer, product-level order, product
  membership, candidate policy, or cross-plan tail ownership changes.

## Update contract

Update this file in the same change only when one of these facts changes:

- active product plan, its classification, or current parent/child unit;
- next product-level action or sequence;
- product-area authority, membership, or template identity;
- candidate, DC, PG, or production-promotion authority; or
- a supersession that transfers work between product plans.

Do not add independent plan registrations, completed-plan summaries, per-unit tables, test output,
run IDs, deployment evidence, or historical retry narratives. Those belong to the plan or progress
record that produced them.
