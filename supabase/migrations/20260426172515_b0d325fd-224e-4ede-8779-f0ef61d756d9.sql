
ALTER TABLE public.website_credentials
  ADD COLUMN IF NOT EXISTS test_username text,
  ADD COLUMN IF NOT EXISTS test_password text,
  ADD COLUMN IF NOT EXISTS permission_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permission_granted_at timestamptz;
