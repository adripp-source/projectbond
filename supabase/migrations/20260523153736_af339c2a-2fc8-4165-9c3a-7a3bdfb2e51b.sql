
-- 1. Explicit UPDATE policy on issue_comments
CREATE POLICY "Users can update their own comments"
ON public.issue_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Hide worker_token_hash column from client roles
REVOKE SELECT (worker_token_hash) ON public.scan_jobs FROM anon, authenticated;

-- 3. Tighten SECURITY DEFINER function execute privileges
REVOKE EXECUTE ON FUNCTION public.generate_company_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_ids(uuid) FROM PUBLIC, anon, authenticated;
-- join_workspace_by_code must remain callable by authenticated users (intentional API)
