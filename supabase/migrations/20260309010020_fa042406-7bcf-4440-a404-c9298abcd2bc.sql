
-- Update handle_new_user to auto-seed 6 leave types for every new company on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_company_id UUID;
BEGIN
  INSERT INTO public.companies (name, owner_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
    NEW.id
  )
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (user_id, email, full_name, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_company_id
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

  INSERT INTO public.leave_types (company_id, name, days_per_year, is_paid, color)
  VALUES
    (new_company_id, 'Sick Leave',        10, true,  '#ef4444'),
    (new_company_id, 'Annual Leave',      20, true,  '#3b82f6'),
    (new_company_id, 'Personal Leave',     5, true,  '#f59e0b'),
    (new_company_id, 'Family Emergency',   3, true,  '#8b5cf6'),
    (new_company_id, 'Bereavement Leave',  5, true,  '#6b7280'),
    (new_company_id, 'Other',              0, false, '#94a3b8');

  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
