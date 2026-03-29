
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
