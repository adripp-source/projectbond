-- Website credentials for login-required sites
CREATE TABLE public.website_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  requires_login boolean DEFAULT false,
  account_type text DEFAULT 'test', -- test, live, paid
  access_scope text DEFAULT 'public', -- public, logged_in, both
  allow_form_submission boolean DEFAULT false,
  allow_test_actions boolean DEFAULT true,
  block_destructive boolean DEFAULT true,
  safe_mode boolean DEFAULT true,
  login_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(website_id)
);

ALTER TABLE public.website_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credentials" ON public.website_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own credentials" ON public.website_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own credentials" ON public.website_credentials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own credentials" ON public.website_credentials FOR DELETE USING (auth.uid() = user_id);

-- Scan preferences per website
CREATE TABLE public.scan_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  goals text[] DEFAULT '{}', -- growth, fix_issues, optimization, learning
  focus_areas text[] DEFAULT '{}', -- ux, qa, performance, conversion, seo, accessibility
  skill_level text DEFAULT 'beginner', -- beginner, intermediate, advanced
  growth_mode text DEFAULT 'guided', -- guided, detailed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(website_id)
);

ALTER TABLE public.scan_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences" ON public.scan_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.scan_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.scan_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own preferences" ON public.scan_preferences FOR DELETE USING (auth.uid() = user_id);

-- Alerts and notifications
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info', -- info, warning, critical
  category text DEFAULT 'scan', -- scan, security, issue, system
  is_read boolean DEFAULT false,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  issue_id uuid REFERENCES public.scan_issues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_website_credentials_updated_at BEFORE UPDATE ON public.website_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scan_preferences_updated_at BEFORE UPDATE ON public.scan_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();