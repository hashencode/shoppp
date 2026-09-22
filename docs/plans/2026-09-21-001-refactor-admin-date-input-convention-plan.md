# Admin Date Input Convention

**Status:** Completed
**Classification:** Independent bounded refactor
**Product-sequence impact:** None; this plan does not change the active product plan or master pointer.

## Goal

Prefer separate start-date and end-date controls for ordinary forms. Keep `RangePicker` only when
the interaction represents one complete, paired interval that must be selected and submitted
together.

## Scope

- Split the Basic Form `起止日期` field into `开始日期` and `结束日期`.
- Split the Advanced Form `生效日期` field into `开始日期` and `结束日期`.
- Preserve the existing API payload keys for Basic Form.
- Reject a start date later than its end date.
- Record the convention in Admin implementation and migration guidance.
- Keep Dashboard reporting and chart interval pickers unchanged because those consumers require a
  complete analytical interval.

## Implementation Units

### DIC-U1. Freeze the input convention

- Add focused coverage for independent controls and date-order validation.
- Verification: the focused test fails against the old range-only implementation.

### DIC-U2. Split ordinary form dates

- Replace the two ordinary-form range values and controls with independent start/end values and
  controls.
- Preserve Basic Form entity-to-form and form-to-payload mapping.
- Verification: focused tests and Admin typecheck pass.

### DIC-U3. Align authoring guidance

- State that independent date fields are the default and `date-range` is reserved for mandatory
  paired intervals.
- Verification: changed documentation is internally consistent with the retained template field.

## Execution Checkpoint

- **Current unit:** Complete
- **Result:** Ordinary form examples use separate start/end controls; paired reporting intervals
  retain `RangePicker`. Focused tests, Admin typecheck, changed-file lint/format checks, and diff
  whitespace checks pass.
- **Next action:** None.
- **Blockers:** None.

## Definition of Done

- Ordinary form examples expose independent start and end date controls.
- Invalid reversed dates are blocked without changing the existing API contract.
- Mandatory paired reporting intervals continue to use `RangePicker`.
- Focused tests, changed-file checks, and Admin typecheck pass.
