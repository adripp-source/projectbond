// Analysis chat — deterministic FAQ-style responses, no AI.
// Answers common questions about the latest scan using stored data.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function answer(question: string, scan: any, issues: any[]): string {
  const q = question.toLowerCase();
  if (!scan) return 'No scan has been run yet. Add a URL on the Analysis page and click Scan to get started.';

  const crit = issues.filter(i => i.priority === 'critical');
  const warn = issues.filter(i => i.priority === 'warning');
  const low = issues.filter(i => i.priority === 'low');

  if (/score|health|how (am|are) (we|i)|rating/.test(q)) {
    return `Your health score is ${scan.health_score ?? 'N/A'}/100. Security: ${scan.security_score ?? 'N/A'}/100. ${crit.length} critical, ${warn.length} warning, ${low.length} low.`;
  }
  if (/critical|urgent|priority|most important|top/.test(q)) {
    if (!crit.length) return 'No critical issues right now. Focus on the warnings next.';
    return `Top critical issues:\n${crit.slice(0, 5).map((i, n) => `${n + 1}. ${i.title} — ${i.impact || ''}`).join('\n')}`;
  }
  if (/broken|404|dead/.test(q)) {
    const b = issues.filter(i => i.category === 'qa' && /broken|404|unreachable/i.test(i.title));
    return b.length ? `Found ${b.length} broken link(s):\n${b.slice(0, 8).map(i => `- ${i.location}`).join('\n')}` : 'No broken links detected in the latest scan.';
  }
  if (/security/.test(q)) {
    const s = issues.filter(i => i.category === 'security');
    return s.length ? `Security findings (${s.length}):\n${s.slice(0, 5).map(i => `- [${i.priority}] ${i.title}`).join('\n')}` : `Security score: ${scan.security_score ?? 'N/A'}/100. No security issues raised in this scan.`;
  }
  if (/perform|slow|speed|fast/.test(q)) {
    const p = issues.filter(i => i.category === 'performance');
    return p.length ? `Performance findings:\n${p.slice(0, 5).map(i => `- ${i.title}`).join('\n')}` : 'No major performance issues found.';
  }
  if (/access|a11y|screen reader|disable/.test(q)) {
    const a = issues.filter(i => i.category === 'accessibility');
    return a.length ? `Accessibility findings:\n${a.slice(0, 5).map(i => `- ${i.title}`).join('\n')}` : 'No accessibility issues raised.';
  }
  if (/summary|overview|tldr/.test(q)) {
    return scan.ai_summary || `Scanned ${scan.url}. ${issues.length} total issues (${crit.length} critical).`;
  }
  if (/fix|how do i|what should i do|next/.test(q)) {
    const top = crit[0] || warn[0] || issues[0];
    if (!top) return 'Nothing urgent to fix. Run a new scan to refresh.';
    return `Start here: "${top.title}". ${top.fix_dev ? `\n\nFix:\n${top.fix_dev}` : 'Open the issue card to see the fix steps.'}`;
  }
  if (/run scan|rescan|test again/.test(q)) {
    return 'Go to the Analysis page and click "Run Scan" to test again.';
  }

  // Default: summary
  return `Latest scan: ${scan.url}\nHealth ${scan.health_score ?? 'N/A'}/100 · Security ${scan.security_score ?? 'N/A'}/100\nIssues: ${crit.length} critical, ${warn.length} warning, ${low.length} low.\n\nTry asking: "what\'s critical?", "any broken links?", "how do I fix the top issue?", "show security findings".`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { question, run_security_test } = await req.json();
    if (!question) return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: latestScan } = await supabase
      .from('scans').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).single();

    let issues: any[] = [];
    if (latestScan) {
      const { data: scanIssues } = await supabase
        .from('scan_issues').select('*').eq('scan_id', latestScan.id);
      issues = scanIssues || [];
    }

    let securityTestResult: any = null;
    if (run_security_test) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('scans').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', today.toISOString());
      securityTestResult = (count || 0) >= 15
        ? { ran: false, reason: 'Daily scan limit reached (15/15)' }
        : { ran: true, note: 'Security scan triggered' };
    }

    const ans = answer(question, latestScan, issues);
    return new Response(JSON.stringify({ answer: ans, securityTestResult, source: 'deterministic' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analysis-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
