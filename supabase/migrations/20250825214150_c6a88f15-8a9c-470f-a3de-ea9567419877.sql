-- Fix recursive RLS policy on profiles and ensure profiles are created for users

-- 1) Replace the recursive SELECT policy with a function-based check that avoids recursion
DROP POLICY IF EXISTS "Only editors can view all profiles" ON public.profiles;

CREATE POLICY "Editors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.get_user_role(auth.uid()) = 'editor'::public.user_role);

-- 2) Ensure profiles are auto-created when a new auth user is inserted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END$$;

-- 3) Backfill profiles for any existing users without a profile
INSERT INTO public.profiles (user_id, full_name, role)
SELECT u.id, u.raw_user_meta_data->>'full_name', 'viewer'::public.user_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;