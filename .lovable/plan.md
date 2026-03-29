

## Analysis: Deductions Column

The `deductions` field exists in the database (`payroll_items` table) and displays in the payslips view dialog, but it is **hardcoded to 0** during payroll generation. There is no way for HR to input or calculate deductions.

## Plan

### 1. Add a `deductions` table (Database Migration)

Create a reusable deduction types system so HR can define standard deductions per company:

```
deduction_types table:
- id (uuid, PK)
- company_id (uuid)
- name (text) — e.g. "Provident Fund", "Health Insurance", "Loan Repayment"
- type: "fixed" | "percentage"
- value (numeric) — flat PKR amount or percentage of basic salary
- is_active (boolean, default true)
- created_at
```

RLS: same company-scoped pattern as other tables.

### 2. Add an `employee_deductions` table (Database Migration)

Link specific deductions to specific employees:

```
employee_deductions table:
- id (uuid, PK)
- company_id (uuid)
- user_id (uuid)
- deduction_type_id (uuid, references deduction_types)
- override_value (numeric, nullable) — allows per-employee override
- is_active (boolean, default true)
- created_at
```

RLS: company-scoped, admin/payroll_officer can manage.

### 3. Update Payroll Generation Logic

Modify `GeneratePayrollDialog.tsx` to:
- For each employee, fetch their active `employee_deductions` joined with `deduction_types`
- Calculate total deductions: sum of fixed amounts + percentage-based amounts (% of basic salary)
- Set `deductions` and recalculate `net_pay = basic_salary - tax - deductions`

### 4. Add "Manage Deductions" UI on Payroll Page

Add a section/dialog where admin/payroll_officer can:
- **Define deduction types** for the company (name, fixed/percentage, value)
- **Assign deductions to employees** — select employee, pick deduction type, optionally override amount
- View which employees have which deductions

### 5. Show Deduction Breakdown in Payslips View

In the payslips dialog, make the "Deductions" cell clickable or add a tooltip showing the breakdown (e.g. "Provident Fund: PKR 2,000 + Health Insurance: PKR 1,500 = PKR 3,500").

---

### Technical Details

- Two new tables with RLS policies matching existing patterns
- `GeneratePayrollDialog` will query `employee_deductions` joined with `deduction_types` for each active employee during generation
- Net pay formula: `net_pay = basic_salary - tax - total_deductions`
- New UI components: `ManageDeductionsDialog` for deduction types CRUD, `AssignDeductionDialog` for employee assignment
- No changes to existing RLS or auth — uses same `admin`/`payroll_officer` role checks

