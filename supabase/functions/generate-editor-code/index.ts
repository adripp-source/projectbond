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

    const { url, annotations, mode } = await req.json();

    // Flow mode doesn't need annotations
    if (mode === 'flow') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const flowResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You are an expert software architect. Generate website flow diagrams as JSON. Return ONLY valid JSON, no markdown.'
            },
            {
              role: 'user',
              content: `Analyze ${url} and generate a flow diagram showing:
- All main pages and their relationships
- User flows (signup, login, checkout, etc.)
- API connections
- Decision points
- External services

Return JSON format:
{
  "nodes": [{"id": "n0", "label": "Homepage", "type": "page|action|api|decision|external", "x": 100, "y": 80}],
  "edges": [{"from": "n0", "to": "n1", "label": "Click CTA"}],
  "summary": "Brief description of the website architecture"
}

Generate 8-15 nodes with logical positions (x: 100-900, y: 80-700). Space them in a readable layout.`
            }
          ],
        }),
      });

      if (!flowResponse.ok) {
        if (flowResponse.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (flowResponse.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        throw new Error(`AI gateway error: ${flowResponse.status}`);
      }

      const flowData = await flowResponse.json();
      const output = flowData.choices?.[0]?.message?.content;
      return new Response(JSON.stringify({ output, mode: 'flow' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!url || !annotations || annotations.length === 0) {
      return new Response(JSON.stringify({ error: 'URL and annotations are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user type preference
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await adminClient
      .from('profiles')
      .select('user_type')
      .eq('user_id', user.id)
      .single();

    const userType = profile?.user_type || 'developer';

    const userTypePrompt = userType === 'dev_team'
      ? 'Generate detailed technical implementation steps for a development team. Include architecture considerations, testing requirements, and deployment notes.'
      : userType === 'developer'
      ? 'Generate ready-to-use code (HTML, CSS, JavaScript, React, Tailwind CSS). Provide complete, copy-paste-ready code snippets.'
      : 'Generate step-by-step visual instructions for non-technical users using website builders like Wix, Webflow, WordPress, or Shopify. Include specific menu paths and button names.';

    const modePrompt = mode === 'code' ? 'Output format: code snippets with comments.' : 'Output format: numbered step-by-step instructions.';

    const annotationDescriptions = annotations.map((a: any, i: number) => {
      let desc = `Annotation ${i + 1}: `;
      if (a.type === 'box') {
        desc += `Draw a box/section at position (${a.x}, ${a.y}) with size ${a.width}x${a.height}px.`;
      } else if (a.type === 'text') {
        desc += `Add/change text at position (${a.x}, ${a.y}): "${a.text}"`;
      } else if (a.type === 'move') {
        desc += `Move element from (${a.fromX}, ${a.fromY}) to (${a.toX}, ${a.toY}).`;
      } else if (a.type === 'select') {
        desc += `Selected area at (${a.x}, ${a.y}) size ${a.width}x${a.height}px. Note: "${a.note || 'Change this element'}"`;
      }
      return desc;
    }).join('\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

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
            content: `You are an expert web developer and designer. A user has annotated changes they want to make to their website at ${url}. Based on their annotations, generate implementation guidance.\n\n${userTypePrompt}\n${modePrompt}`
          },
          {
            role: 'user',
            content: `Website: ${url}\n\nThe user has made the following visual annotations on their website:\n\n${annotationDescriptions}\n\nGenerate the implementation for all these changes. Be specific and actionable.`
          }
        ],
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
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const output = aiData.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ output, mode, user_type: userType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-editor-code error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
