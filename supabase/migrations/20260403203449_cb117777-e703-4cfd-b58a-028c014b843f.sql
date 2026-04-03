
-- Fix workspace_members INSERT: remove self-join vulnerability
DROP POLICY IF EXISTS "Workspace owner can add members" ON public.workspace_members;

CREATE POLICY "Workspace owner can add members"
ON public.workspace_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_id AND w.owner_id = auth.uid()
  )
);

-- Remove duplicate DELETE policy
DROP POLICY IF EXISTS "Members can leave workspaces" ON public.workspace_members;

-- Add missing DELETE policies
CREATE POLICY "Users can delete their own branding"
ON public.branding FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
USING (auth.uid() = user_id);
