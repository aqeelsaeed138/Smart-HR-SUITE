
-- Update handle_new_user to assign 'admin' role if this is the first user, otherwise 'employee'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also allow admins to update any profile (needed for managing employees)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr_manager'));
