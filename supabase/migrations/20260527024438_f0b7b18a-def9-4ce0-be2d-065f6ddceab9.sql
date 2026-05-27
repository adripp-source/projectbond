-- Revoke broad UPDATE from authenticated and grant only on user-facing columns,
-- excluding worker_token_hash so users cannot overwrite internal worker auth.
REVOKE UPDATE ON public.scan_jobs FROM authenticated;

GRANT UPDATE (
  website_id,
  scan_id,
  scheduled_scan_id,
  url,
  status,
  depth,
  focus_areas,
  outcome,
  forms_policy,
  exclusions,
  requested_by,
  result_summary,
  error_message,
  started_at,
  finished_at,
  updated_at
) ON public.scan_jobs TO authenticated;

-- Service role retains full access for backend workers.
GRANT ALL ON public.scan_jobs TO service_role;