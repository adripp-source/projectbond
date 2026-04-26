
-- 1) Harden get_user_workspace_ids: ignore the parameter and always use auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Intentionally ignore _user_id and always use the caller's identity to
  -- prevent enumeration of other users' workspace memberships.
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid()
$function$;

-- 2) Allow workspace owners to delete their own workspace
CREATE POLICY "Owners can delete their workspace"
ON public.workspaces
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);
