
-- 1. Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Company',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Add company_id to all relevant tables
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.departments ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.attendance_records ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.leave_requests ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.leave_types ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.shift_templates ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.shift_assignments ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.payroll_periods ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.payroll_items ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.audit_log ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- 3. Helper function: get current user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 4. Update handle_new_user to create company + assign admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Every new signup = new company (client)
  INSERT INTO public.companies (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    NEW.id
  )
  RETURNING id INTO new_company_id;

  -- Create profile with company_id
  INSERT INTO public.profiles (user_id, email, full_name, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_company_id
  );

  -- Every signup user is admin of their company
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- 5. Companies RLS
CREATE POLICY "Users can view their own company"
ON public.companies FOR SELECT
USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Owner can update their company"
ON public.companies FOR UPDATE
USING (owner_id = auth.uid());

-- 6. Drop old profiles RLS and recreate with company isolation
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and HR can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view own company profiles"
ON public.profiles FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update company profiles"
ON public.profiles FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 7. Departments RLS
DROP POLICY IF EXISTS "Authenticated users can view departments" ON public.departments;
DROP POLICY IF EXISTS "Admins and HR can manage departments" ON public.departments;

CREATE POLICY "View company departments"
ON public.departments FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage company departments"
ON public.departments FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

-- 8. Attendance RLS
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "HR and admins can view all attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "HR and admins can manage attendance" ON public.attendance_records;

CREATE POLICY "Users view own attendance"
ON public.attendance_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view company attendance"
ON public.attendance_records FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') OR public.has_role(auth.uid(), 'department_manager'))
);

CREATE POLICY "Users insert own attendance"
ON public.attendance_records FOR INSERT
WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update own attendance"
ON public.attendance_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage company attendance"
ON public.attendance_records FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

-- 9. Leave types RLS
DROP POLICY IF EXISTS "Authenticated can view leave types" ON public.leave_types;
DROP POLICY IF EXISTS "Admins can manage leave types" ON public.leave_types;

CREATE POLICY "View company leave types"
ON public.leave_types FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage company leave types"
ON public.leave_types FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

-- 10. Leave requests RLS
DROP POLICY IF EXISTS "Users can view own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers and HR can view all leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can create own leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Users can update own pending leaves" ON public.leave_requests;
DROP POLICY IF EXISTS "Managers and HR can manage leaves" ON public.leave_requests;

CREATE POLICY "Users view own leaves"
ON public.leave_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view company leaves"
ON public.leave_requests FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') OR public.has_role(auth.uid(), 'department_manager'))
);

CREATE POLICY "Users create own leaves"
ON public.leave_requests FOR INSERT
WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update own pending leaves"
ON public.leave_requests FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins manage company leaves"
ON public.leave_requests FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') OR public.has_role(auth.uid(), 'department_manager'))
);

-- 11. Shift templates RLS
DROP POLICY IF EXISTS "Authenticated can view shifts" ON public.shift_templates;
DROP POLICY IF EXISTS "HR can manage shifts" ON public.shift_templates;

CREATE POLICY "View company shifts"
ON public.shift_templates FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins manage company shifts"
ON public.shift_templates FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

-- 12. Shift assignments RLS
DROP POLICY IF EXISTS "Users can view own shifts" ON public.shift_assignments;
DROP POLICY IF EXISTS "HR can view all shifts" ON public.shift_assignments;
DROP POLICY IF EXISTS "HR can manage shifts" ON public.shift_assignments;

CREATE POLICY "Users view own shift assignments"
ON public.shift_assignments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view company shift assignments"
ON public.shift_assignments FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') OR public.has_role(auth.uid(), 'department_manager'))
);

CREATE POLICY "Admins manage company shift assignments"
ON public.shift_assignments FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

-- 13. Payroll periods RLS
DROP POLICY IF EXISTS "Payroll officers and admins can view payroll" ON public.payroll_periods;
DROP POLICY IF EXISTS "Payroll officers can manage payroll" ON public.payroll_periods;

CREATE POLICY "View company payroll periods"
ON public.payroll_periods FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') OR public.has_role(auth.uid(), 'payroll_officer'))
);

CREATE POLICY "Manage company payroll periods"
ON public.payroll_periods FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll_officer'))
);

-- 14. Payroll items RLS
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payroll_items;
DROP POLICY IF EXISTS "Payroll officers can view all payroll items" ON public.payroll_items;
DROP POLICY IF EXISTS "Payroll officers can manage payroll items" ON public.payroll_items;

CREATE POLICY "Users view own payslips"
ON public.payroll_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "View company payroll items"
ON public.payroll_items FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll_officer'))
);

CREATE POLICY "Manage company payroll items"
ON public.payroll_items FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll_officer'))
);

-- 15. Audit log RLS
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit entries" ON public.audit_log;

CREATE POLICY "View company audit log"
ON public.audit_log FOR SELECT
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'))
);

CREATE POLICY "Insert company audit entries"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id AND company_id = public.get_user_company_id(auth.uid()));

-- 16. User roles - add company awareness (admins can only manage roles within their company)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view company roles"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.company_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "Admins insert company roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.company_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "Admins update company roles"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.company_id = public.get_user_company_id(auth.uid()))
);

CREATE POLICY "Admins delete company roles"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.company_id = public.get_user_company_id(auth.uid()))
);

-- Create indexes for company_id
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_departments_company ON public.departments(company_id);
CREATE INDEX idx_attendance_company ON public.attendance_records(company_id);
CREATE INDEX idx_leave_requests_company ON public.leave_requests(company_id);
CREATE INDEX idx_leave_types_company ON public.leave_types(company_id);
CREATE INDEX idx_shift_templates_company ON public.shift_templates(company_id);
CREATE INDEX idx_shift_assignments_company ON public.shift_assignments(company_id);
CREATE INDEX idx_payroll_periods_company ON public.payroll_periods(company_id);
CREATE INDEX idx_payroll_items_company ON public.payroll_items(company_id);
CREATE INDEX idx_audit_log_company ON public.audit_log(company_id);
