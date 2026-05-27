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

    const { url, company_name, scan_id } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Pull recent user feedback so the model learns from prior thumbs up/down + ignored.
    const trainingClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: feedbackRows } = await trainingClient
      .from('scan_issues')
      .select('title, category, feedback, status')
      .eq('user_id', user.id)
      .or('feedback.not.is.null,status.eq.ignored')
      .order('created_at', { ascending: false })
      .limit(80);
    const goodEx = (feedbackRows || []).filter(r => r.feedback === 'good').slice(0, 15);
    const badEx = (feedbackRows || []).filter(r => r.feedback === 'bad' || r.status === 'ignored').slice(0, 25);
    const trainingBlock = (goodEx.length || badEx.length)
      ? `\n\nUSER FEEDBACK MEMORY (use to prioritize the right findings):\nGOOD examples the user found useful — produce MORE like these:\n${goodEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none yet)'}\n\nBAD / IGNORED examples the user dismissed — AVOID raising similar findings unless materially different:\n${badEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none yet)'}`
      : '';


    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are an expert QA team lead + security analyst. You perform deep, production-grade website analysis.

Your analysis MUST cover ALL of the following categories:

FUNCTIONAL TESTING:
- Buttons, links, forms — do they work?
- Navigation flows — are they logical?
- Edge cases: empty states, invalid input, multi-step flows
- Error handling: what happens on bad input?

UI/UX TESTING:
- Layout alignment and spacing issues
- CTA clarity — are buttons/actions obvious?
- Usability friction — confusing elements
- Visual hierarchy — is important content prominent?

CONTENT TESTING:
- Placeholder text left in production
- Missing sections (about, contact, FAQ)
- Unclear messaging or jargon
- Broken images or media

ACCESSIBILITY TESTING:
- Missing alt text on images
- Missing form labels
- Color contrast issues
- Keyboard navigation problems
- ARIA attributes

RESPONSIVE TESTING:
- Mobile layout issues
- Touch target sizes
- Viewport meta tag
- Responsive images

PERFORMANCE / QUALITY:
- Render-blocking resources
- Large images without optimization
- Missing lazy loading
- Slow-loading patterns

USER FLOW TESTING:
- Onboarding flow completeness
- Signup/login friction
- Checkout or conversion flow issues
- Drop-off risk points

SECURITY (STRONG):
- Input validation (XSS, injection patterns)
- Authentication weaknesses
- Session/cookie security
- Data exposure risks
- HTTPS/mixed content
- Missing security headers (CSP, X-Frame, HSTS)
- Business logic bypass potential
- API/data flow safety
- Error information leakage

EDGE CASE GENERATION:
- Generate realistic test cases for the most critical flows
- Identify rare but high-impact failure scenarios

For EACH issue, provide clear, specific, actionable details. Be realistic based on the URL type.${trainingBlock}`
          },
          {
            role: 'user',
            content: `Perform a comprehensive QA + security analysis of: ${url}${company_name ? ` (Company: ${company_name})` : ''}

Generate 15-25 realistic issues across ALL categories. Include at least:
- 3 functional issues
- 3 UI/UX issues  
- 2 content issues
- 2 accessibility issues
- 2 responsive issues
- 2 performance issues
- 3 security issues
- 2 edge case scenarios

For each issue, include specific fix instructions for developers AND non-technical users.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'website_analysis',
            description: 'Return comprehensive QA + security analysis',
            parameters: {
              type: 'object',
              properties: {
                health_score: { type: 'integer', description: 'Overall health 0-100 (weighted: functional 25%, UX 20%, content 15%, accessibility 15%, responsive 10%, performance 15%)' },
                security_score: { type: 'integer', description: 'Security score 0-100' },
                sentiment_score: { type: 'integer', description: 'Brand/user sentiment 0-100' },
                ai_summary: { type: 'string', description: '3-4 sentence executive summary with verdict: good/needs improvement/critical. Include top priority and estimated impact.' },
                brand_analysis: {
                  type: 'object',
                  properties: {
                    tone: { type: 'string' },
                    positioning: { type: 'string' },
                    customer_expectations: { type: 'string' },
                    differentiator: { type: 'string' }
                  },
                  required: ['tone', 'positioning', 'customer_expectations', 'differentiator']
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Clear, concise issue title' },
                      description: { type: 'string', description: 'Detailed description of the problem and why it matters' },
                      category: { type: 'string', enum: ['qa', 'security', 'performance', 'content', 'accessibility', 'responsive', 'ux', 'user_flow', 'edge_case'] },
                      priority: { type: 'string', enum: ['critical', 'warning', 'low'] },
                      impact: { type: 'string', description: 'Business impact: revenue/trust/UX/conversion effect' },
                      location: { type: 'string', description: 'Specific page, component, or element affected' },
                      fix_dev: { type: 'string', description: 'Technical fix for developers with specific steps' },
                      fix_code: { type: 'string', description: 'Ready-to-use code snippet (HTML/CSS/JS/React)' },
                      fix_nocode: { type: 'string', description: 'Step-by-step for non-developers using website builders' },
                      fix_content: { type: 'string', description: 'Content/messaging fix with example copy' },
                      fix_visual: { type: 'string', description: 'Visual/UI design suggestion with specifics' },
                      test_case: { type: 'string', description: 'Human-readable test case to verify the issue' },
                      edge_cases: { type: 'string', description: 'Related edge cases to also test' }
                    },
                    required: ['title', 'description', 'category', 'priority', 'impact', 'location']
                  }
                }
              },
              required: ['health_score', 'security_score', 'sentiment_score', 'ai_summary', 'brand_analysis', 'issues']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'website_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No analysis returned from AI');

    const analysis = JSON.parse(toolCall.function.arguments);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const scanData = {
      user_id: user.id,
      url,
      scan_type: 'full',
      status: 'completed',
      health_score: analysis.health_score,
      security_score: analysis.security_score,
      sentiment_score: analysis.sentiment_score,
      ai_summary: analysis.ai_summary,
      brand_analysis: analysis.brand_analysis,
    };

    let finalScanId = scan_id;
    if (scan_id) {
      const { data: updated, error: updErr } = await adminClient
        .from('scans')
        .update(scanData)
        .eq('id', scan_id)
        .eq('user_id', user.id)
        .select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Scan not found or not owned by user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const { data: newScan, error: scanError } = await adminClient
        .from('scans').insert(scanData).select('id').single();
      if (scanError) throw scanError;
      finalScanId = newScan.id;
    }

    if (analysis.issues && analysis.issues.length > 0) {
      const issueRows = analysis.issues.map((issue: any) => ({
        scan_id: finalScanId,
        user_id: user.id,
        title: issue.title,
        description: issue.description,
        category: issue.category === 'ux' || issue.category === 'user_flow' || issue.category === 'edge_case' || issue.category === 'responsive' ? 'qa' : issue.category,
        priority: issue.priority,
        impact: issue.impact,
        location: issue.location,
        fix_dev: issue.fix_dev || null,
        fix_code: issue.fix_code || null,
        fix_nocode: issue.fix_nocode || null,
        fix_content: issue.fix_content || null,
        fix_visual: issue.fix_visual || null,
      }));

      const { error: issuesError } = await adminClient.from('scan_issues').insert(issueRows);
      if (issuesError) console.error('Issues insert error:', issuesError);
    }

    if (analysis.brand_analysis && company_name) {
      await adminClient.from('branding').upsert({
        user_id: user.id,
        company_name,
        tone: analysis.brand_analysis.tone,
        positioning: analysis.brand_analysis.positioning,
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({ scan_id: finalScanId, ...analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('analyze-website error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
