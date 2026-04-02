
-- Create issue_comments table for team collaboration
CREATE TABLE public.issue_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.scan_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on issues they own
CREATE POLICY "Users can view comments on their issues"
ON public.issue_comments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.scan_issues si WHERE si.id = issue_id AND si.user_id = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Users can insert comments"
ON public.issue_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.issue_comments FOR DELETE
USING (auth.uid() = user_id);
