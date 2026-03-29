
-- Create deduction_types table
CREATE TABLE public.deduction_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'fixed' CHECK (type IN ('fixed', 'percentage')),
  value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deduction_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View company deduction types" ON public.deduction_types
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage company deduction types" ON public.deduction_types
  FOR ALL USING (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'payroll_officer'))
  );

-- Create employee_deductions table
CREATE TABLE public.employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  deduction_type_id uuid REFERENCES public.deduction_types(id) ON DELETE CASCADE NOT NULL,
  override_value numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, deduction_type_id)
);

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View company employee deductions" ON public.employee_deductions
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage company employee deductions" ON public.employee_deductions
  FOR ALL USING (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'payroll_officer'))
  );

-- Also create a payroll_item_deductions table to store the breakdown per payslip
CREATE TABLE public.payroll_item_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid REFERENCES public.payroll_items(id) ON DELETE CASCADE NOT NULL,
  deduction_type_name text NOT NULL,
  deduction_type text NOT NULL DEFAULT 'fixed',
  value numeric NOT NULL DEFAULT 0,
  calculated_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_item_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View payroll item deductions" ON public.payroll_item_deductions
  FOR SELECT USING (
    payroll_item_id IN (SELECT id FROM public.payroll_items WHERE company_id = get_user_company_id(auth.uid()))
  );

CREATE POLICY "Manage payroll item deductions" ON public.payroll_item_deductions
  FOR ALL USING (
    payroll_item_id IN (SELECT id FROM public.payroll_items WHERE company_id = get_user_company_id(auth.uid()))
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'payroll_officer'))
  );
