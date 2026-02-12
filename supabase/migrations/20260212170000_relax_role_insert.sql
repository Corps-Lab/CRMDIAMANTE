-- Allow users to insert any role for themselves (ceo/admin/colaborador)
-- while keeping manager full control.

DROP POLICY IF EXISTS "Users can insert colaborador role for themselves" ON public.user_roles;

CREATE POLICY "Users can insert own role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Keep managers able to manage everything (already present, but ensure it exists)
DROP POLICY IF EXISTS "Managers can manage roles" ON public.user_roles;
CREATE POLICY "Managers can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_manager(auth.uid()));
