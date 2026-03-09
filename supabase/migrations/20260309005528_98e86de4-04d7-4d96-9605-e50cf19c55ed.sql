
-- Drop the global unique constraint on name so leave types can exist per-company
ALTER TABLE public.leave_types DROP CONSTRAINT IF EXISTS leave_types_name_key;

-- Add a per-company unique constraint instead (name unique within a company)
ALTER TABLE public.leave_types
  ADD CONSTRAINT leave_types_company_name_unique UNIQUE (company_id, name);
