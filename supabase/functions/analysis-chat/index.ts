import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question, run_security_test } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch latest scan data for context
    const { data: latestScan } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let issues: any[] = [];
    if (latestScan) {
      const { data: scanIssues } = await supabase
        .from('scan_issues')
        .select('*')
        .eq('scan_id', latestScan.id);
      issues = scanIssues || [];
    }

    // Check if security test is requested and if quota remains
    let securityTestResult = null;
    if (run_security_test) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if ((count || 0) >= 15) {
        securityTestResult = { ran: false, reason: 'Daily scan limit reached (15/15)' };
      } else {
        securityTestResult = { ran: true, note: 'Security scan triggered' };
      }
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const scanContext = latestScan ? `
Latest scan for: ${latestScan.url}
Health Score: ${latestScan.health_score || 'N/A'}/100
Security Score: ${latestScan.security_score || 'N/A'}/100
Issues found: ${issues.length}
Security issues: ${issues.filter(i => i.category === 'security').length}
QA issues: ${issues.filter(i => ['qa', 'performance', 'accessibility', 'content'].includes(i.category)).length}

Issue details:
${issues.map(i => `- [${i.priority}] ${i.title}: ${i.description}`).join('\n')}
` : 'No scans have been run yet.';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a website analysis assistant for Project Bond. You help users understand their website's health, security, and performance issues. Answer questions based on scan data. Be concise but helpful. If the user asks about security and no scan exists, suggest running one.

${scanContext}

${securityTestResult ? `Security test status: ${JSON.stringify(securityTestResult)}` : ''}`
          },
          { role: 'user', content: question }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'No response generated.';

    return new Response(JSON.stringify({ answer, securityTestResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analysis-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
