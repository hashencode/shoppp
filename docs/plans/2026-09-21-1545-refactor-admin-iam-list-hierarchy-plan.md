# Admin IAM List Hierarchy

**Status:** Completed  
**Classification:** Independent bounded refactor  
**Product-sequence impact:** None; this plan does not change the active product plan or master pointer.

## Goal

Reduce developer-facing guidance in the IAM operator UI, place the Users / Invitations view switch
inside the list card header, and preserve the shared breadcrumb hierarchy contract.

## Scope

- Remove the role-permission authority Alert from the Roles list page.
- Place the Users / Invitations tabs in the list Card header without changing either resource's
  filters, pagination, loading states, permissions, or actions.
- Keep breadcrumb behavior centralized in `AppShell`: standalone top-level entries stay hidden,
  grouped second-level entries keep their group/current-page hierarchy, and detail pages keep their
  full hierarchy.
- Do not change IAM authorization, API requests, route membership, or product sequence.

## Implementation Unit

### IAM-LH-U1. Clarify IAM list hierarchy

- Strengthen focused coverage for the list-card tab placement and the removed authority guidance.
- Update the Users and Roles list presentation while preserving existing behavior.
- Verification: IAM focused tests, changed-file lint/format checks, and Admin typecheck pass.

## Execution Checkpoint

- **Current unit:** Complete.
- **Result:** The role authority Alert is removed, the Users / Invitations switch uses the native
  Card tab head at the original middle Tabs size, its redundant nav border is removed while the
  active ink bar and Card divider remain, and the shared breadcrumb contract is unchanged. IAM
  component tests, IAM Browser Mode tests, Admin typecheck, changed-file lint/format checks, diff
  whitespace checks, and code review pass.
- **Next action:** None.
- **Blockers:** None. The live local route redirected to login, so authenticated visual inspection
  was replaced by focused real-browser component coverage of the Card-header placement.

## Definition of Done

- The role authority implementation note is absent from the Roles operator page.
- Users / Invitations tabs render inside the active list Card header.
- Existing IAM list behavior and shared breadcrumb rules remain intact.
- Focused tests and proportional Admin checks pass.
