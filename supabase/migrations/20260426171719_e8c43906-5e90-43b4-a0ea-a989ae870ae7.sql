-- Helper: returns workspace_ids the given user belongs to (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Replace the recursive policy on workspace_members
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_members.workspace_id AND w.owner_id = auth.uid()
  )
);

-- Also fix the workspaces SELECT policy which has the same recursion pattern
DROP POLICY IF EXISTS "Workspace members can view their workspace" ON public.workspaces;

CREATE POLICY "Workspace members can view their workspace"
ON public.workspaces
FOR SELECT
TO authenticated
USING (
  id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  OR owner_id = auth.uid()
);