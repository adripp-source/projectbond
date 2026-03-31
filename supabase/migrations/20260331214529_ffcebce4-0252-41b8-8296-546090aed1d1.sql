
-- Workspaces table with unique 6-digit company code
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  company_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Workspace members
CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Add workspace_id to profiles
ALTER TABLE public.profiles ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);

-- RLS for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view their workspace"
  ON public.workspaces FOR SELECT TO authenticated
  USING (
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

-- RLS for workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
  );

CREATE POLICY "Users can join workspaces"
  ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave workspaces"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add status column to scan_issues for kanban
ALTER TABLE public.scan_issues ALTER COLUMN status SET DEFAULT 'to_fix';

-- Function to generate unique 6-digit code
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.workspaces WHERE company_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;
