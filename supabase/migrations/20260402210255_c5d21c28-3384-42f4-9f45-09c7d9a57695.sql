
-- Fix workspace_members INSERT policy: only workspace owner can add members
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.workspace_members;

CREATE POLICY "Workspace owner can add members"
ON public.workspace_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  )
  OR
  -- Allow self-join only if workspace exists (for code-based joining during onboarding)
  (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id))
);

-- Add UPDATE policy: only workspace owner can change roles
CREATE POLICY "Only workspace owner can update members"
ON public.workspace_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  )
);

-- Add DELETE policy: owner can remove members, members can leave
DROP POLICY IF EXISTS "Users can delete their own membership" ON public.workspace_members;
CREATE POLICY "Owner can remove or member can leave"
ON public.workspace_members FOR DELETE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  )
);
