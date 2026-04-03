
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _workspace_id FROM public.workspaces WHERE company_code = _code;
  
  IF _workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invalid company code';
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id) THEN
    RETURN _workspace_id;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace_id, _user_id, 'member');

  RETURN _workspace_id;
END;
$$;
