-- 1) ai_endpoints
CREATE TABLE public.ai_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  website_id UUID,
  source_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat_widget',
  vendor TEXT,
  label TEXT NOT NULL,
  evidence TEXT,
  api_endpoint TEXT,
  request_template JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_tested_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_endpoints TO authenticated;
GRANT ALL ON public.ai_endpoints TO service_role;
ALTER TABLE public.ai_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own ai_endpoints" ON public.ai_endpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own ai_endpoints" ON public.ai_endpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own ai_endpoints" ON public.ai_endpoints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own ai_endpoints" ON public.ai_endpoints FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_ai_endpoints_user ON public.ai_endpoints(user_id, status);

-- 2) ai_tests
CREATE TABLE public.ai_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint_id UUID NOT NULL,
  prompt_limit INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'running',
  overall_score INTEGER,
  consistency_score INTEGER,
  hallucination_rate INTEGER,
  refusal_quality INTEGER,
  summary TEXT,
  fix_suggestions JSONB,
  improved_prompt TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tests TO authenticated;
GRANT ALL ON public.ai_tests TO service_role;
ALTER TABLE public.ai_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own ai_tests" ON public.ai_tests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own ai_tests" ON public.ai_tests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own ai_tests" ON public.ai_tests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own ai_tests" ON public.ai_tests FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_ai_tests_user ON public.ai_tests(user_id, created_at DESC);
CREATE INDEX idx_ai_tests_endpoint ON public.ai_tests(endpoint_id, created_at DESC);

-- 3) ai_test_prompts
CREATE TABLE public.ai_test_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  expected_behavior TEXT,
  response TEXT,
  verdict TEXT,
  issue TEXT,
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_test_prompts TO authenticated;
GRANT ALL ON public.ai_test_prompts TO service_role;
ALTER TABLE public.ai_test_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own ai_test_prompts" ON public.ai_test_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own ai_test_prompts" ON public.ai_test_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own ai_test_prompts" ON public.ai_test_prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own ai_test_prompts" ON public.ai_test_prompts FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_ai_test_prompts_test ON public.ai_test_prompts(test_id, created_at);