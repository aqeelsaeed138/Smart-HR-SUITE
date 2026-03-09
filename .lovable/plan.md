
## Root Cause

The `leave_types` table has 5 old records with `company_id = NULL`. The RLS policy on `leave_types` requires `company_id = get_user_company_id(auth.uid())`, so authenticated users **never see** those null-company rows. Each company needs its own set of leave types seeded when it is created.

## What Will Be Done

### 1. Database Migration (2 parts)

**Part A — Seed existing companies:**
Insert all 6 leave types for each of the 4 existing companies that currently have zero leave types tied to them. This fixes the problem for existing accounts immediately.

**Part B — Update the `handle_new_user` trigger:**
After creating a new company, automatically INSERT the 6 default leave types for that company so every future signup has them from day one.

The 6 leave types with their config:

```text
Name               | Days/yr | Paid  | Color
-------------------|---------|-------|--------
Sick Leave         |   10    | Yes   | #ef4444
Annual Leave       |   20    | Yes   | #3b82f6
Personal Leave     |    5    | Yes   | #f59e0b
Family Emergency   |    3    | Yes   | #8b5cf6
Bereavement Leave  |    5    | Yes   | #6b7280
Other              |    0    | No    | #94a3b8
```

### 2. Leaves.tsx — Minor UI Improvements

- Add **paid/unpaid badge** on each leave type card (e.g. "Paid" in green, "Unpaid" in gray).
- Improve the empty state inside the dialog when `leaveTypes` is loading vs truly empty.
- Add `is_paid` to the `LeaveType` interface (already there) and display it on the balance cards.
- Remove unused `CalendarDays` import.

### No RLS changes needed
The existing RLS policy (`company_id = get_user_company_id(auth.uid())`) is correct — the data just wasn't there. After migration the policies will work perfectly.
