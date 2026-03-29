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

    // Call AI to analyze the website
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
            content: `You are an expert website analyst specializing in QA testing, security analysis, UX evaluation, and brand perception. You analyze websites thoroughly and return structured findings. Be specific, actionable, and realistic. Base your analysis on common patterns for the type of website the URL suggests.`
          },
          {
            role: 'user',
            content: `Analyze the website at: ${url}${company_name ? ` (Company: ${company_name})` : ''}

Perform a comprehensive analysis covering:
1. QA/UX issues (navigation, forms, buttons, mobile, accessibility, content)
2. Security concerns (OWASP-based safe checks: input validation, CSRF, headers, cookies, auth flows)
3. Performance concerns
4. Brand perception and positioning

Based on the URL structure and what you can infer about this type of website, provide realistic findings.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'website_analysis',
            description: 'Return structured website analysis results',
            parameters: {
              type: 'object',
              properties: {
                health_score: { type: 'integer', description: 'Overall health score 0-100' },
                security_score: { type: 'integer', description: 'Security score 0-100' },
                sentiment_score: { type: 'integer', description: 'Brand/sentiment score 0-100' },
                ai_summary: { type: 'string', description: 'Executive summary of findings in 2-3 sentences' },
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
                      title: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string', enum: ['qa', 'security', 'performance', 'content', 'accessibility'] },
                      priority: { type: 'string', enum: ['critical', 'warning', 'low'] },
                      impact: { type: 'string' },
                      location: { type: 'string' },
                      fix_dev: { type: 'string', description: 'Technical fix steps for developers' },
                      fix_code: { type: 'string', description: 'Code snippet to fix the issue (HTML/CSS/JS)' },
                      fix_nocode: { type: 'string', description: 'Step-by-step instructions for non-developers' },
                      fix_content: { type: 'string', description: 'Content/messaging improvements' },
                      fix_visual: { type: 'string', description: 'Visual/UI suggestions' }
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

    // Use service role to insert data
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update or create scan record
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
      await adminClient.from('scans').update(scanData).eq('id', scan_id);
    } else {
      const { data: newScan, error: scanError } = await adminClient
        .from('scans')
        .insert(scanData)
        .select('id')
        .single();
      if (scanError) throw scanError;
      finalScanId = newScan.id;
    }

    // Insert issues
    if (analysis.issues && analysis.issues.length > 0) {
      const issueRows = analysis.issues.map((issue: any) => ({
        scan_id: finalScanId,
        user_id: user.id,
        title: issue.title,
        description: issue.description,
        category: issue.category,
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
      if (issuesError) {
        console.error('Issues insert error:', issuesError);
      }
    }

    // Update branding if brand_analysis exists
    if (analysis.brand_analysis && company_name) {
      await adminClient.from('branding').upsert({
        user_id: user.id,
        company_name,
        tone: analysis.brand_analysis.tone,
        positioning: analysis.brand_analysis.positioning,
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({
      scan_id: finalScanId,
      ...analysis,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('analyze-website error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
