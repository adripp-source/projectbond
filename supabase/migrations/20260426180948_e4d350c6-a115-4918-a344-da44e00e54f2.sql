
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS code_skill text DEFAULT 'some',
  ADD COLUMN IF NOT EXISTS technicality_level integer DEFAULT 3;

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS github_repo_url text;

ALTER TABLE public.website_credentials
  ADD COLUMN IF NOT EXISTS non_invasive_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_type text DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS pin_or_2fa text;
