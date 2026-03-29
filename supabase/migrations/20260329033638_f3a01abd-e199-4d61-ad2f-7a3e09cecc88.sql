
-- Create scans table to store website analysis results
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  health_score INTEGER,
  security_score INTEGER,
  sentiment_score INTEGER,
  ai_summary TEXT,
  brand_analysis JSONB,
  media_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scans" ON public.scans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own scans" ON public.scans FOR DELETE USING (auth.uid() = user_id);

-- Create scan_issues table
CREATE TABLE public.scan_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'qa',
  priority TEXT NOT NULL DEFAULT 'warning',
  impact TEXT,
  location TEXT,
  fix_dev TEXT,
  fix_code TEXT,
  fix_nocode TEXT,
  fix_content TEXT,
  fix_visual TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own issues" ON public.scan_issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own issues" ON public.scan_issues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own issues" ON public.scan_issues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own issues" ON public.scan_issues FOR DELETE USING (auth.uid() = user_id);

-- Add social handles to branding
ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS social_twitter TEXT;
ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS social_linkedin TEXT;
ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS social_facebook TEXT;
ALTER TABLE public.branding ADD COLUMN IF NOT EXISTS social_instagram TEXT;

-- Add triggers
CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON public.scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
