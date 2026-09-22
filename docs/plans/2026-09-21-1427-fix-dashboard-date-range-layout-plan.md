# Commerce Dashboard Date Range Layout

**Status:** Completed  
**Classification:** Independent bounded fix  
**Product-sequence impact:** None; this plan does not change the active product plan or master pointer.

## Goal

Keep the Commerce Dashboard's required start/end reporting interval as one `RangePicker`, while
giving that paired control the width of two standard filter columns in the responsive search grid.

## Scope

- Preserve the existing required, complete date-range validation and reporting query contract.
- Keep start and end dates in one paired date-range control.
- Make the date-range field span two standard filter columns at responsive grid breakpoints.
- Do not change request timing, defaults, metrics, compact-filter behavior, or reporting APIs.

## Implementation Unit

### DDR-U1. Widen the required reporting interval

- Add focused coverage for the date-range field's responsive grid width.
- Configure the Dashboard date-range field to occupy two standard filter columns.
- Verification: Dashboard focused tests, changed-file lint/format checks, and Admin typecheck pass.

## Execution Checkpoint

- **Current unit:** Complete
- **Result:** The required paired reporting interval now spans two standard filter columns. Dashboard
  focused tests, Admin typecheck, changed-file lint/format checks, diff whitespace checks, and a
  1390 px browser inspection pass.
- **Next action:** None.
- **Blockers:** None.

## Definition of Done

- The Dashboard date range remains a mandatory paired interval.
- The field occupies two standard filter columns in the responsive grid.
- Focused tests and proportional Admin checks pass.
