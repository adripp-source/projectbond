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
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { issue_id, issue_title, issue_description, target_type } = await req.json();
    if (!issue_title || !issue_description) {
      return new Response(JSON.stringify({ error: 'Issue details required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const targetPrompt = target_type === 'dev'
      ? 'Provide detailed technical implementation steps for a development team.'
      : target_type === 'code'
      ? 'Provide ready-to-use code (HTML/CSS/JS or React/Tailwind) that fixes this issue.'
      : target_type === 'nocode'
      ? 'Provide step-by-step instructions that a non-technical person can follow using common website builders or CMS tools.'
      : target_type === 'content'
      ? 'Provide improved copy, messaging, FAQs, or content that addresses this issue.'
      : 'Provide visual/UI design suggestions with specific layout, color, and typography recommendations.';

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
            content: 'You are an expert website developer, designer, and consultant. Generate specific, actionable fixes for website issues. Be detailed and practical.'
          },
          {
            role: 'user',
            content: `Generate a fix for this issue:
Title: ${issue_title}
Description: ${issue_description}

${targetPrompt}

Provide a complete, ready-to-implement solution.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited' }), {
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
    const fix = aiData.choices?.[0]?.message?.content;

    // Update the issue with the fix
    if (issue_id && fix) {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const updateField = target_type === 'dev' ? 'fix_dev'
        : target_type === 'code' ? 'fix_code'
        : target_type === 'nocode' ? 'fix_nocode'
        : target_type === 'content' ? 'fix_content'
        : 'fix_visual';

      await adminClient.from('scan_issues').update({ [updateField]: fix }).eq('id', issue_id);
    }

    return new Response(JSON.stringify({ fix, target_type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-fix error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
